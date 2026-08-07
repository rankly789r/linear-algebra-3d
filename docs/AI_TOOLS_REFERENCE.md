# AI 答疑工具系统参考文档

> 本文档供所有开发者查阅。记录了 AI 教学助手可调用的全部工具、调用流程、前后端协议和扩展方法。
>
> 最后更新：2026-08-06 · 副面板负责人维护

## 一、架构概览

```
用户提问
  → 前端 POST /api/chat/{scene}（params + message + history + api_key）
  → 后端 server/main.py：执行场景计算 → 构建 tool_context
  → server/ai_chat.py ask_deepseek()：工具调用循环（最多 5 轮）
    ├─ AI 调读工具 → 后端从 tool_context 取数据 → 结果反馈 AI → 继续循环
    ├─ AI 调 set_params → 收集到返回值 → 可能继续或返回
    └─ AI 返回纯文本 → 结束循环
  → 返回 {reply, tool_calls: [...]|null}
  → 前端渲染回复 + 确认卡片（如有 set_params）
```

## 二、5 个工具一览

### 读工具（4 个）— 后端直接执行，结果反馈 AI

| 工具名 | 用途 | 触发场景 | 返回数据 |
|--------|------|----------|----------|
| `get_scene_params` | 查询当前场景所有可调参数 | AI 需要修改参数前（必须！） | `{params: [{name, label, type, current_value, min, max, options}]}` |
| `get_matrix_data` | 查询当前矩阵数据 | 学生问「矩阵是多少」或 AI 需引用数值 | `{matrices: [{label, symbol, data}]}` |
| `get_solution_info` | 查询解的类型、秩、解空间 | 学生问「有没有解」「秩是多少」 | `{solution_info: {type, description, details}}` |
| `get_verification` | 查询数学验证结果 | 学生质疑结果或 AI 需要确认 | `{verification: {passed, checks: [{label, passed}]}}` |

### 写工具（1 个）— 不执行，返回前端确认

| 工具名 | 参数 | 用途 |
|--------|------|------|
| `set_params` | `reason: string` — 修改原因（显示在确认卡片上） | 提议修改场景参数。必须先从 `get_scene_params` 获取参数名 |
| | `params: {key: number}` — 要修改的参数名和新值 | 只传需要改变的参数，不需要列全部 |

## 三、数据流详解

### 3.1 tool_context 结构（由 server/main.py 构建）

```python
tool_context = {
    "params_meta": {
        "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "options": None},
        "a12": {"label": "a₁₂", "type": "float", "default": 1, "min": -5, "max": 5, "options": None},
        # ...
    },
    "params_current": {"a11": 3, "a12": 0, ...},  # 用户当前正在看的参数值
    "matrices": [{"label": "系数矩阵 A", "symbol": "A", "data": [[3,0],[0,5]]}, ...],
    "solution_info": {"type": "unique", "description": "唯一解", "details": {"r(A)": 2}},
    "verification": {"passed": True, "checks": [{"label": "r(A)=r(A|b)", "passed": True}]},
}
```

### 3.2 _execute_read_tool() 分发（server/ai_chat.py）

```python
def _execute_read_tool(tool_name: str, tool_context: dict) -> dict:
    if tool_name == "get_scene_params":
        return {"params": [...]}        # 从 params_meta + params_current 构建
    elif tool_name == "get_matrix_data":
        return {"matrices": [...]}      # 直接透传
    elif tool_name == "get_solution_info":
        return {"solution_info": {...}} # 直接透传
    elif tool_name == "get_verification":
        return {"verification": {...}}  # 直接透传
```

### 3.3 前端处理（scene-base.js）

```javascript
// _sendChatMessage() — 收到 {reply, tool_calls}
let toolCalls = result.data.tool_calls || null;
if (!toolCalls) {
    // 兜底：正则解析旧格式（JSON 代码块）
    const fallback = this._parseToolCallFallback(reply);
    toolCalls = fallback.toolCalls;
}
// 存入聊天历史（同时保存到 IndexedDB）
this._chatHistory.push({ role: 'assistant', content: reply, toolCalls });

// _renderChatMessages() — 渲染工具调用卡片
if (toolCalls) {
    toolCalls.forEach(tc => {
        // 渲染确认卡片：原因 + 参数表格 + ✓ 应用 / ✗ 取消
    });
}
```

### 3.4 前后端协议

```
POST /api/chat/{scene_name}
请求体：
{
    params: {a11: 2, a12: 1, ...},   // 当前场景参数值
    message: "改成对角矩阵试试",        // 用户问题
    history: [{role, content}, ...],  // 聊天历史
    api_key: "sk-..."                 // DeepSeek API Key
}

响应体：
{
    success: true,
    data: {
        reply: "好的，我把矩阵改成了...",   // AI 文字回复
        tool_calls: [                     // null 或数组
            {
                action: "set_params",
                reason: "演示对角矩阵的秩等于非零对角元个数",
                params: {a11: 3, a12: 0, a21: 0, a22: 5}
            }
        ]
    }
}
```

## 四、关键约束（修改时必须遵守）

### 4.1 System Prompt 铁律

`build_system_prompt()` **不接收参数**。所有数据由 AI 通过工具自行查询。

原因：如果数据嵌在 system prompt 里，场景改初始数据 → system prompt 也要改。工具查询模式下，场景数据变了 AI 自动看到新值。

### 4.2 读工具不能改数据

4 个读工具 (`get_*`) 是**只读**的——从 `tool_context` 提取数据，不能修改任何状态。

### 4.3 set_params 不自动执行

`set_params` 不在后端执行参数修改，只收集到返回值的 `tool_calls` 数组。前端渲染确认卡片，用户手动点击「✓ 应用」后，由 `_applyAIParams()` 重新调用场景计算 API + 双缓冲更新 3D 场景。

### 4.4 工具调用循环上限

`MAX_TOOL_LOOPS = 5`。如果 AI 5 轮后还没返回文本，强制截断。

### 4.5 后端 HTTP 客户端

使用 `httpx`（异步），证书验证 `verify=True`（系统证书），超时 60 秒。不要改用 `requests`（同步）或 `openai` 包。

## 五、如何新增工具

### 5.1 在 server/ai_chat.py 中添加

**第 1 步**：在 `TOOLS` 列表中追加工具定义（OpenAI 兼容格式）：

```python
{
    "type": "function",
    "function": {
        "name": "get_eigenvalues",          # 工具名（snake_case）
        "description": "查询矩阵的特征值和特征向量。当学生问特征值时调用。",
        "parameters": {                     # 输入参数 JSON Schema
            "type": "object",
            "properties": {
                "matrix_symbol": {
                    "type": "string",
                    "description": "要查询的矩阵符号，如 'A'。可从 get_matrix_data 获取。",
                }
            },
            "required": ["matrix_symbol"],
        },
    },
}
```

**第 2 步**：如果是读工具，在 `READ_TOOLS` 集合中添加工具名：

```python
READ_TOOLS = {"get_scene_params", "get_matrix_data", "get_solution_info", "get_verification", "get_eigenvalues"}
```

**第 3 步**：在 `_execute_read_tool()` 中添加分支：

```python
elif tool_name == "get_eigenvalues":
    matrix_symbol = json.loads(...)  # 从 tool call arguments 中解析参数
    # 从 tool_context 或调用 math_engine 获取数据
    return {"eigenvalues": [...]}
```

如果是写工具（类似 `set_params`）：
- 不需要加入 `READ_TOOLS`
- 不需要在 `_execute_read_tool()` 中添加分支
- `ask_deepseek()` 的工具循环会自动将其收集到 `collected_tool_calls`

**第 4 步**：在 `build_system_prompt()` 中添加工具说明（一句话），让 AI 知道新工具的存在和用途。

### 5.2 在 server/main.py 中扩展 tool_context

如果新工具需要额外的场景数据，在 `/api/chat` 端点构建 `tool_context` 时添加字段：

```python
tool_context = {
    # ... 现有字段 ...
    "eigenvalues": scene_data.get("eigenvalues", []),  # 新增
}
```

### 5.3 在前端 scene-base.js 中处理新工具

如果新工具是写工具（类似 `set_params`），在 `_renderChatMessages()` 中添加对应的卡片渲染逻辑。

## 六、笔记生成端点（独立体系）

笔记生成走单独的 `/api/notes/generate` 端点，**不启用工具调用**。调用 `ask_deepseek()` 时 `tool_context=None`，回退为纯文本对话。

笔记 system prompt 由 `build_note_system_prompt(scene_data, chat_history)` 构建，**仍接收数据**（因为笔记是一次性生成，不需要交互式查询），与答疑的 `build_system_prompt()` 互不干扰。

## 七、已知问题与注意事项

| 问题 | 状态 |
|------|------|
| AI 偶尔不调 `get_scene_params` 直接调 `set_params` 导致参数名错误 | System prompt 已强调「必须先调 get_scene_params」，但仍偶发。前端 merger 只更新存在的 key 做兜底 |
| 兜底正则 `_parseToolCallFallback()` 对嵌套 JSON 可能提取不完整 | 仅在后端 tool_calls 为 null 时触发，概率较低 |
| 笔记生成 tokens 上限 4096，约 2000 中文字 | System prompt 中已写明字数限制 |

## 八、相关文件索引

| 文件 | 内容 |
|------|------|
| [server/ai_chat.py](../server/ai_chat.py) | 工具定义、API 调用、工具循环、system prompt |
| [server/main.py](../server/main.py) | `/api/chat` 和 `/api/notes` 端点，tool_context 构建 |
| [client/js/scene-base.js](../client/js/scene-base.js) | 聊天 UI、`_sendChatMessage()`、`_applyAIParams()` |
| [client/js/api.js](../client/js/api.js) | `askAI()`、`generateNote()` 接口 |
| [docs/AI_CHAT_PROMPT.md](AI_CHAT_PROMPT.md) | 副面板负责人提示词 |
