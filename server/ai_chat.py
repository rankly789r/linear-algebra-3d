"""
AI 答疑模块 — 调用 DeepSeek Chat API

使用 httpx（异步 HTTP 客户端）调用 DeepSeek API，
DeepSeek API 兼容 OpenAI Chat Completions 格式。
"""
import os
import json
import httpx
import certifi

# DeepSeek API 配置
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_CHAT_MODEL = "deepseek-chat"


def _get_api_key() -> str | None:
    """从环境变量获取 DeepSeek API Key（部署者可选配置）"""
    return os.environ.get("DEEPSEEK_API_KEY")


def build_system_prompt(scene_data: dict) -> str:
    """根据场景数据构建 system prompt，让 AI 了解当前上下文"""
    # 提取场景元信息
    matrices = scene_data.get("matrices", [])
    solution_info = scene_data.get("solution_info", {})
    verification = scene_data.get("verification", {})

    # 构建矩阵信息文本
    matrix_text = ""
    for m in matrices:
        label = m.get("label", "")
        symbol = m.get("symbol", "")
        data = m.get("data", [])
        matrix_text += f"\n  {label} ({symbol}): {json.dumps(data)}"

    # 构建验证信息文本
    verify_text = ""
    checks = verification.get("checks", [])
    if checks:
        verify_text = "\n" + "\n".join(
            f"  - {c['label']} {'✓' if c.get('passed') else '✗'}" for c in checks
        )

    # 解信息
    sol_text = ""
    if solution_info:
        sol_type = solution_info.get("type", "")
        sol_desc = solution_info.get("description", "")
        sol_details = solution_info.get("details", {})
        sol_text = f"\n  解类型: {sol_type}\n  描述: {sol_desc}"
        if sol_details:
            sol_text += "\n  " + ", ".join(f"{k}={v}" for k, v in sol_details.items())

    prompt = f"""你是线性代数教学助手，使用中文回答。你正在帮助一位正在学习同济大学《线性代数》教材的学生。

学生当前正在查看的场景数据如下：

矩阵数据：{matrix_text if matrix_text else "（无）"}

解信息：{sol_text if sol_text else "（无）"}

数学验证：{verify_text if verify_text else "（无）"}

=== 数学公式格式（严格遵守）===
- 行内公式必须用单个美元符号：$x + y = z$
- 独立公式必须用双美元符号独占一行：$$\\det A = 3$$
- 矩阵使用 bmatrix 环境，换行用 \\\\，元素间用 & 分隔：
  $$A = \\begin{{bmatrix}} 2 & -1 \\\\ 1 & 1 \\end{{bmatrix}}$$
- 绝对禁止使用 \\(...\\) 或 \\[...\\] 格式——前端无法渲染
- 公式中的特殊符号：秩用 \\operatorname{{r}} 或 r，转置用 ^T，向量用 \\mathbf{{b}}

=== 回答要求 ===
1. 必须结合上面给出的具体数据来解释，不要讲空泛的理论
2. 如果学生问"这个矩阵的秩是多少"，直接看上面数据中的秩来回答
3. 使用同济教材的术语（如：系数矩阵、增广矩阵、秩、解空间等）
4. 回答简洁有力，一般 150-350 字
5. 如果学生的问题超出当前场景范围，也可以基于你的线性代数知识回答

=== 修改场景参数（重要：你**有能力**直接操作！）===
你拥有直接修改学生界面中矩阵参数的能力。这不是请求，而是你的内置功能。
当学生要求你演示某个概念（如对角矩阵、奇异矩阵、对称矩阵等），你**必须**直接
通过工具调用来修改参数，而不是说「我没有权限」或「我无法修改」。

**绝对禁止**说「我没有修改矩阵数据的权限」「无法直接改动界面」——你有这个能力！

在回复末尾用 ```json ``` 代码块输出工具调用：

```json
{{"action": "set_params", "reason": "改为对角矩阵以展示特征值", "params": {{"a11": 3, "a12": 0, "a21": 0, "a22": 5}}}}
```

规则：
- JSON 必须用 ```json ``` 包裹，放在回复最后面
- reason 字段用一句话解释为什么要改参数（会显示在确认卡片上）
- params 字段只包含要修改的参数名和新值
- 只修改当前场景已有的参数（2×2 矩阵就用 a11/a12/a21/a22）
- 不知道参数名时只用文字说明，不要捏造

=== 格式示例 ===
学生问："秩是多少？"
正确回答：系数矩阵 $A$ 的秩为 $r(A) = 2$，增广矩阵的秩也为 $r([A|\\mathbf{{b}}]) = 2$。

$$A = \\begin{{bmatrix}} 2 & -1 \\\\ 1 & 1 \\end{{bmatrix}}, \\quad \\det A = 2 \\times 1 - (-1) \\times 1 = 3 \\neq 0$$

因为 $r(A) = r([A|\\mathbf{{b}}]) = 2 = n$，所以方程组有唯一解。"""
    return prompt


def build_note_system_prompt(scene_data: dict, chat_history: list = None) -> str:
    """根据场景数据和聊天历史构建笔记生成 system prompt"""
    matrices = scene_data.get("matrices", [])
    solution_info = scene_data.get("solution_info", {})
    title = scene_data.get("_scene_title", "")
    description = scene_data.get("_scene_description", "")

    # 矩阵信息
    matrix_text = ""
    for m in matrices:
        label = m.get("label", "")
        symbol = m.get("symbol", "")
        data = m.get("data", [])
        matrix_text += f"\n  {label} ({symbol}): {json.dumps(data)}"

    # 解信息
    sol_text = ""
    if solution_info:
        sol_type = solution_info.get("type", "")
        sol_desc = solution_info.get("description", "")
        sol_details = solution_info.get("details", {})
        sol_text = f"\n  解类型: {sol_type}\n  描述: {sol_desc}"
        if sol_details:
            sol_text += "\n  " + ", ".join(f"{k}={v}" for k, v in sol_details.items())

    # 聊天上下文
    chat_text = ""
    if chat_history:
        chat_lines = []
        for msg in chat_history:
            role = "学生" if msg.get("role") == "user" else "AI"
            content = msg.get("content", "")[:500]  # 截断长回复
            chat_lines.append(f"  [{role}]: {content}")
        chat_text = "\n\n学生与 AI 的交流记录：\n" + "\n".join(chat_lines[-10:])  # 最近10条

    prompt = f"""你是线性代数教学笔记撰写助手。请根据以下信息，撰写一篇结构化的学习笔记。

场景：{title}
简介：{description}

当前矩阵数据：{matrix_text if matrix_text else "（无）"}
分析结果：{sol_text if sol_text else "（无）"}
{chat_text}

=== 笔记格式要求 ===
请严格按以下 Markdown 模板输出（不要输出模板之外的文字）：

---
title: "{title}"
chapter: ""
date: ""
tags: [线性代数]
---

## 一、核心概念

> 一句话总结本节的核心数学思想。

## 二、数学定义

给出本节关键概念的数学定义，使用 LaTeX 公式。

## 三、几何直觉

结合 3D 可视化场景，描述几何含义。解释「为什么」而不仅仅是「是什么」。

## 四、关键公式

列出本节最重要的公式，使用独立 $$ 格式：

$$
公式
$$

## 五、常见误区

列举 2-3 个学生容易混淆或犯错的地方，并给出纠正。

## 六、与教材的对应关系

说明本节对应同济大学《线性代数》教材的哪一章哪一节。

=== 写作要求 ===
1. 使用中文撰写，数学公式使用 LaTeX
2. 行内公式用单个 $，独立公式用双 $$
3. 矩阵使用 bmatrix 环境：$$A = \\begin{{bmatrix}} 2 & -1 \\\\ 1 & 1 \\end{{bmatrix}}$$
4. 绝对禁止使用 \\(...\\) 或 \\[...\\] 格式
5. 结合当前矩阵数据来写，不要写空泛的理论
6. 如果有学生与 AI 的交流记录，将交流中澄清的概念融入笔记
7. 笔记总字数严格控制在 2000 字以内（约 1200 tokens），超出会被截断丢失内容"""
    return prompt


async def ask_deepseek(
    system_prompt: str,
    messages: list[dict],
    api_key: str | None = None,
    max_tokens: int = 2048,
) -> dict:
    """
    调用 DeepSeek Chat API。

    参数：
        system_prompt: 系统提示词（包含场景数据上下文）
        messages: 历史消息列表，格式 [{"role": "user"|"assistant", "content": "..."}]
        api_key: DeepSeek API Key，不传则从环境变量或默认值获取
        max_tokens: 最大输出 token 数（默认 2048，笔记生成建议 4096）

    返回：
        {"success": True, "reply": "AI 的回答文本"}
        {"success": False, "error": "错误信息"}
    """
    key = api_key or _get_api_key()

    if not key:
        return {
            "success": False,
            "error": "未配置 DeepSeek API Key。请在设置中填入您的 API Key（可从 https://platform.deepseek.com 获取）。",
        }

    # 构建完整的消息列表
    full_messages = [{"role": "system", "content": system_prompt}]
    full_messages.extend(messages)

    try:
        async with httpx.AsyncClient(timeout=60.0, verify=certifi.where()) as client:
            response = await client.post(
                f"{DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": DEEPSEEK_CHAT_MODEL,
                    "messages": full_messages,
                    "temperature": 0.7,
                    "max_tokens": max_tokens,
                },
            )

            if response.status_code != 200:
                # 尝试解析错误详情
                try:
                    err_data = response.json()
                    err_msg = err_data.get("error", {}).get("message", response.text)
                except Exception:
                    err_msg = response.text[:300]
                return {
                    "success": False,
                    "error": f"DeepSeek API 错误 (HTTP {response.status_code}): {err_msg}",
                }

            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                return {"success": False, "error": "AI 未返回任何回答"}

            reply = choices[0].get("message", {}).get("content", "")
            if not reply:
                return {"success": False, "error": "AI 回答为空"}

            return {"success": True, "reply": reply}

    except httpx.TimeoutException:
        return {"success": False, "error": "AI 响应超时（60秒），请稍后重试"}
    except httpx.ConnectError:
        return {
            "success": False,
            "error": "无法连接到 DeepSeek API，请检查网络连接",
        }
    except Exception as e:
        return {"success": False, "error": f"AI 调用失败: {str(e)}"}
