# 工作简报：AI 聊天增强 Bug 修复

> **日期**：2026-08-06
> **来源**：用户测试 AI 聊天增强三项功能（持久化、笔记生成、工具调用修改矩阵），发现 6 个 bug
> **提交**：`ed30b9f` feat: 新增零空间/列空间场景 + AI聊天增强

---

## Bug 清单

| # | Bug | 症状 | 严重度 |
|---|-----|------|--------|
| 1 | Python f-string 花括号未转义 | AI 聊天 HTTP 500：`ValueError: Invalid format specifier` | 🔴 |
| 2 | `SSL_CERT_FILE` 指向不存在文件 | `[Errno 2] No such file or directory` | 🔴 |
| 3 | AI 拒绝修改矩阵参数 | 「我没有修改矩阵数据的权限」 | 🟡 |
| 4 | `max_tokens` 硬编码 1024 | AI 笔记写到一半截断 | 🟡 |
| 5 | `buildScene()` 入参不一致 | `Cannot read properties of undefined (reading 'mode')` | 🔴 |
| 6 | 方法名拼写错误 | `_updateSolutionPanel is not a function` | 🔴 |

---

## 详细分析

### 1 · f-string 花括号未转义

**文件**：[server/ai_chat.py:89](server/ai_chat.py)

`build_system_prompt()` 中使用 f-string，但 JSON 示例中的花括号未转义：

```python
# ❌ 错误：f-string 把 {"a11": 3, ...} 当作格式说明符
f"""{"action": "set_params", "params": {"a11": 3, "a12": 0, ...}}"""

# ✅ 正确：双花括号转义
f"""{{"action": "set_params", "params": {{"a11": 3, "a12": 0, ...}}}}"""
```

**教训**：`commit 58b0fce` 提交时这个文件从未被运行过（StatReload 检测到的修改还在缓冲区里），导致语法错误上线后才暴露。

### 2 · SSL 证书验证失败

`SSL_CERT_FILE` 环境变量指向不存在的路径 `anaconda3/envs/xianxingdaishu/ssl/cacert.pem`。

**修复**：`httpx.AsyncClient(verify=certifi.where())` 显式使用 certifi 的 CA bundle。

### 3 · AI 拒绝改参数

DeepSeek 模型对「你可以修改参数」的温和提示不买账，坚持自称没有权限。

**修复**：重写工具调用提示词，使用强硬语气——「你**有能力**直接操作」「**绝对禁止**说我没有权限」。

### 4 · 笔记截断

`ask_deepseek()` 硬编码 `max_tokens: 1024`（约 500 中文字），笔记写不全。

**修复**：`max_tokens` 参数化：
- AI 答疑：默认 2048
- 笔记生成：4096
- System prompt 中加「严格控制在 2000 字以内」

### 5 · `buildScene()` 入参不一致

`_applyAIParams()` 中 `buildScene(result.data.scene_data)`（只传 scene_data），但正常流程 `_computeAndRender()` 传的 `buildScene(result.data)`（完整响应）。

渲染器内部写的是 `const d = data.scene_data`，期望 `data` 是完整响应对象。传 `scene_data` 进去后，`d` = `undefined`，然后 `d.mode` 报错。

**修复**：统一为 `this.buildScene(result.data)`。

### 6 · 方法名拼写

`_applyAIParams()` 中有两个方法名跟实际不符：

| 错误 | 正确 |
|------|------|
| `_updateSolutionPanel()` | `_updateSolutionInfo()` |
| `_updateMatrixPanel()` | `_updateMatrixDisplay()` |

原因是手动编写而非对照已有代码复制粘贴。

**修复**：对齐 `_computeAndRender()` 中的调用。

---

## 新增常见陷阱（已加入 DEV_GUIDE.md）

见 [DEV_GUIDE.md 第十三节](../DEV_GUIDE.md) 新增的 4 条陷阱。

---

## 测试验证

| 功能 | 测试方法 | 结果 |
|------|---------|------|
| AI 聊天 | 任意场景发送消息，AI 正常回复 | ✅ |
| 聊天持久化 | 切场景再切回，消息保留 | ✅ |
| AI 改矩阵 | 让 AI 演示对角矩阵，点 ✓ 应用，3D 视图 + 面板同步更新 | ✅ |
| AI 笔记生成 | 点生成笔记，下载完整 .md 文件（不被截断） | ✅ |
| SSL 证书 | Windows 环境 httpx 正常连接 DeepSeek API | ✅ |
