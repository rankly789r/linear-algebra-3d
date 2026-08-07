"""
AI 答疑模块 — 调用 DeepSeek Chat API (原生 function calling)

使用 httpx（异步 HTTP 客户端）调用 DeepSeek API，
DeepSeek API 兼容 OpenAI Chat Completions 格式（含 tools/tool_calls）。
"""
import os
import json
import httpx

# DeepSeek API 配置
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_CHAT_MODEL = "deepseek-chat"

# 工具调用循环限制
MAX_TOOL_LOOPS = 5

# 读工具集合（后端直接执行，结果反馈给 AI）
READ_TOOLS = {"get_scene_params", "get_matrix_data", "get_solution_info", "get_verification"}

# ─── 工具定义（OpenAI / DeepSeek 兼容格式）─────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_scene_params",
            "description": (
                "获取当前场景所有可调参数的名称、中文标签、类型、取值范围和当前值。"
                "当你需要修改参数前，必须先调用此工具了解有哪些参数可用。"
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_matrix_data",
            "description": (
                "获取当前场景的所有矩阵数据（系数矩阵、增广矩阵等），包含标签、符号和数据。"
                "当学生问「矩阵是多少」或你需要引用具体数值时调用。"
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_solution_info",
            "description": (
                "获取当前方程组的解的类型（唯一解/无解/无穷多解）、描述和数学详情"
                "（秩、解空间维数等）。当学生问「有没有解」或「秩是多少」时调用。"
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_verification",
            "description": (
                "获取数学验证检查的结果，包括秩的比较、解是否满足方程等验证项目及其通过/失败状态。"
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_params",
            "description": (
                "提议修改场景参数以向学生演示不同的数学情况。"
                "参数修改建议会提交给用户确认后才生效。"
                "你必须先从 get_scene_params 获取可用参数名，然后只修改需要改变的参数。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "用一句话解释为什么要修改这些参数，会显示在学生的确认卡片上。",
                    },
                    "params": {
                        "type": "object",
                        "description": (
                            "要修改的参数名和新的值。键名必须与 get_scene_params 返回的参数名完全一致。"
                            "只包含需要改变的参数，不需要列出所有参数。"
                        ),
                        "additionalProperties": {"type": "number"},
                    },
                },
                "required": ["reason", "params"],
            },
        },
    },
]


# ─── 读工具执行 ──────────────────────────────────────────────

def _execute_read_tool(tool_name: str, tool_context: dict) -> dict:
    """根据工具名从 tool_context 中提取并返回数据。"""
    if tool_name == "get_scene_params":
        params_list = []
        for name, meta in tool_context.get("params_meta", {}).items():
            current_val = tool_context.get("params_current", {}).get(name, meta.get("default"))
            params_list.append({
                "name": name,
                "label": meta.get("label", name),
                "type": meta.get("type", "float"),
                "current_value": current_val,
                "min": meta.get("min"),
                "max": meta.get("max"),
                "options": meta.get("options"),
            })
        return {"params": params_list}

    elif tool_name == "get_matrix_data":
        return {"matrices": tool_context.get("matrices", [])}

    elif tool_name == "get_solution_info":
        return {"solution_info": tool_context.get("solution_info", {})}

    elif tool_name == "get_verification":
        return {"verification": tool_context.get("verification", {})}

    return {"error": f"未知工具: {tool_name}"}


# ─── HTTP 调用（抽取为独立函数）─────────────────────────────

async def _call_deepseek_api(api_key: str, request_body: dict) -> tuple[dict | None, str | None]:
    """
    发送请求到 DeepSeek API。
    返回 (response_dict, None) 成功，或 (None, error_message) 失败。
    """
    try:
        async with httpx.AsyncClient(timeout=60.0, verify=True) as client:
            response = await client.post(
                f"{DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )

            if response.status_code != 200:
                try:
                    err_data = response.json()
                    err_msg = err_data.get("error", {}).get("message", response.text)
                except Exception:
                    err_msg = response.text[:300]
                return None, f"DeepSeek API 错误 (HTTP {response.status_code}): {err_msg}"

            return response.json(), None

    except httpx.TimeoutException:
        return None, "AI 响应超时（60秒），请稍后重试"
    except httpx.ConnectError:
        return None, "无法连接到 DeepSeek API，请检查网络连接"
    except Exception as e:
        return None, f"AI 调用失败: {str(e)}"


# ─── 主入口：带工具调用循环的 ask_deepseek ──────────────────

async def ask_deepseek(
    system_prompt: str,
    messages: list[dict],
    api_key: str | None = None,
    max_tokens: int = 2048,
    tool_context: dict | None = None,
) -> dict:
    """
    调用 DeepSeek Chat API（支持原生 function calling）。

    参数：
        system_prompt: 系统提示词（角色定义和格式要求）
        messages: 历史消息列表，格式 [{"role": "user"|"assistant", "content": "..."}]
        api_key: DeepSeek API Key
        max_tokens: 最大输出 token 数
        tool_context: 工具数据源。为 None 时禁用工具调用（如笔记生成）

    返回：
        {"success": True, "reply": "...", "tool_calls": [...] | None}
        {"success": False, "error": "..."}
    """
    key = api_key or os.environ.get("DEEPSEEK_API_KEY")

    if not key:
        return {
            "success": False,
            "error": "未配置 DeepSeek API Key。请在设置中填入您的 API Key（可从 https://platform.deepseek.com 获取）。",
        }

    full_messages = [{"role": "system", "content": system_prompt}]
    full_messages.extend(messages)

    collected_tool_calls = []
    loop_count = 0

    # 只有提供了 tool_context 才启用工具
    use_tools = tool_context is not None

    while loop_count < MAX_TOOL_LOOPS:
        loop_count += 1

        # ── 构建请求体 ──
        request_body = {
            "model": DEEPSEEK_CHAT_MODEL,
            "messages": full_messages,
            "temperature": 0.7,
            "max_tokens": max_tokens,
        }
        if use_tools:
            request_body["tools"] = TOOLS
            request_body["tool_choice"] = "auto"

        # ── 调用 API ──
        data, error = await _call_deepseek_api(key, request_body)
        if error:
            return {"success": False, "error": error}

        choices = data.get("choices", [])
        if not choices:
            return {"success": False, "error": "AI 未返回任何回答"}

        choice = choices[0]
        message = choice.get("message", {})
        finish_reason = choice.get("finish_reason", "")

        # ── 无 tool_calls：纯文本回答，直接返回 ──
        if not message.get("tool_calls"):
            reply = message.get("content", "")
            if not reply:
                return {"success": False, "error": "AI 回答为空"}
            return {
                "success": True,
                "reply": reply,
                "tool_calls": collected_tool_calls if collected_tool_calls else None,
            }

        # ── 有 tool_calls → 分类处理 ──
        assistant_content = message.get("content") or ""
        raw_tool_calls = message["tool_calls"]

        read_calls = []
        set_params_calls = []

        for tc in raw_tool_calls:
            fn_name = tc["function"]["name"]
            try:
                fn_args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                fn_args = {}

            if fn_name == "set_params":
                set_params_calls.append({
                    "id": tc["id"],
                    "action": "set_params",
                    "reason": fn_args.get("reason", ""),
                    "params": fn_args.get("params", {}),
                })
            elif fn_name in READ_TOOLS:
                read_calls.append(tc)

        # ── 追加 assistant 消息（含 tool_calls）─
        full_messages.append({
            "role": "assistant",
            "content": assistant_content,
            "tool_calls": raw_tool_calls,
        })

        # ── 执行读工具 → 追加 tool result ──
        for tc in read_calls:
            fn_name = tc["function"]["name"]
            result_data = _execute_read_tool(fn_name, tool_context or {})
            full_messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps(result_data, ensure_ascii=False),
            })

        # ── set_params：不执行，追加提示 → 收集到返回值 ──
        for sp in set_params_calls:
            collected_tool_calls.append({
                "action": sp["action"],
                "reason": sp["reason"],
                "params": sp["params"],
            })
            full_messages.append({
                "role": "tool",
                "tool_call_id": sp["id"],
                "content": (
                    "参数修改建议已提交给用户确认。请在后续文字回复中向用户解释"
                    "你为何建议此修改以及修改后的数学含义。"
                ),
            })

        # ── 如果有文本解释 + set_params + 无读工具 → 提前返回 ──
        if set_params_calls and assistant_content.strip() and not read_calls:
            return {
                "success": True,
                "reply": assistant_content,
                "tool_calls": collected_tool_calls,
            }

        # 否则继续循环（AI 可能需要基于工具结果再输出）

    # 达到最大循环次数
    return {
        "success": True,
        "reply": "AI 思考轮次过多，请重新提问。",
        "tool_calls": collected_tool_calls if collected_tool_calls else None,
    }


# ─── System Prompt ──────────────────────────────────────────

def build_system_prompt() -> str:
    """构建精简的 system prompt。不含场景数据，数据通过 function calling 获取。"""
    return """你是线性代数教学助手，使用中文回答。你正在帮助一位正在学习同济大学《线性代数》教材的学生。

你有以下工具能力：
- 调用 get_scene_params 查询当前场景有哪些可调参数及其取值
- 调用 get_matrix_data 查询当前矩阵数据
- 调用 get_solution_info 查询解的类型、秩、解空间等数学信息
- 调用 get_verification 查询数学验证结果
- 调用 set_params 提议修改场景参数（提交后需用户确认，3D 视图会实时更新）

=== 使用工具的铁律 ===
1. 修改参数前，必须先调用 get_scene_params 获取可用参数名——禁止猜测参数名
2. 回答涉及矩阵数值时，必须调用 get_matrix_data——禁止凭记忆编造
3. 回答涉及解的判断（秩、有没有解），必须调用 get_solution_info
4. 你是教学助手，不是客服——禁止说「我没有权限」「无法直接修改」「建议您尝试手动修改」
5. 禁止为自己的错误道歉——直接使用工具获取正确数据或修改参数即可

=== 数学公式格式（严格遵守）===
- 行内公式必须用单个美元符号：$x + y = z$
- 独立公式必须用双美元符号独占一行：$$\\det A = 3$$
- 矩阵使用 bmatrix 环境：$$A = \\begin{bmatrix} 2 & -1 \\\\ 1 & 1 \\end{bmatrix}$$
- 绝对禁止使用 \\(...\\) 或 \\[...\\] 格式——前端无法渲染
- 公式中的特殊符号：秩用 \\operatorname{r} 或 r，转置用 ^T，向量用 \\mathbf{b}

=== 回答要求 ===
1. 使用同济教材的术语（如：系数矩阵、增广矩阵、秩、解空间等）
2. 回答简洁有力，一般 150-350 字
3. 如果学生的问题超出当前场景范围，也可以基于你的线性代数知识回答
4. 当学生让你演示某个概念时，先用 get_scene_params 获取参数，再用 set_params 提议修改"""


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
            content = msg.get("content", "")[:500]
            chat_lines.append(f"  [{role}]: {content}")
        chat_text = "\n\n学生与 AI 的交流记录：\n" + "\n".join(chat_lines[-10:])

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
