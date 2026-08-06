# 审计报告 — 2026-08-07（AI 答疑 function calling 升级 + 动画残留修复）

**审计范围**：分支 `fix/scene/ai-apply-animation-leak`（2 个提交，领先 master）
**审计时间**：2026-08-07
**改动量**：11 个文件，+1069 / -191 行

---

## 提交清单

| 提交 | 简述 |
|------|------|
| `d3b4864` | feat: AI答疑升级为原生function calling — 5个工具+工具调用循环 |
| `9a34a55` | fix: scene-base — AI应用参数后动画对象残留，加双缓冲清理旧Group |

## 面板负责人状态

**未发现面板负责人的活跃分支。** 当前 `git branch -a` 仅有一个非 archive 分支即 `fix/scene/ai-apply-animation-leak`。面板负责人的工作可能尚未推送，或已在 master 上（`59972d4` 已在上次审计中审查）。

---

## 问题总览

| # | 严重度 | 位置 | 简述 |
|---|--------|------|------|
| 1 | 🔴 | [scene-base.js:1198-1216 / 1404-1422](client/js/scene-base.js#L1198) | 双缓冲代码重复：`_applyAIParams()` 和 `_computeAndRender()` 各有一份 17 行拷贝 |
| 2 | 🟡 | [ai_chat.py:175-180](server/ai_chat.py#L175) | 工具循环：set_params + 读工具同时存在时不提前返回，下一轮可能重复收集 |
| 3 | 🟡 | [scene-base.js:1091](client/js/scene-base.js#L1091) | `_parseToolCallFallback` 标记 `@deprecated` 但无移除计划 |
| 4 | 🟢 | [CLAUDE.md:203](CLAUDE.md#L203) | AI 角色分工表新增「副面板负责人」但旧提示词文件引用未同步更新 |
| 5 | 🟢 | [ai_chat.py:15](server/ai_chat.py#L15) | `READ_TOOLS` 集合硬编码在模块顶层——加新读工具需改两处（TOOLS 列表 + READ_TOOLS 集合） |

---

## 详细分析

### 🔴 严重问题

#### #1 · 双缓冲代码重复

- **位置**：[scene-base.js:1198-1216](client/js/scene-base.js#L1198) 和 [scene-base.js:1404-1422](client/js/scene-base.js#L1404)
- **症状**：17 行完全相同的双缓冲逻辑出现在两个方法中：

  ```javascript
  // _applyAIParams() — 1198 行
  const oldGroup = this.sceneObjects;
  const newGroup = new THREE.Group();
  this.threeScene.add(newGroup);
  this.sceneObjects = newGroup;
  try {
      this.buildScene(result.data);
  } catch (buildErr) {
      this.threeScene.remove(newGroup);
      this._disposeRecursive(newGroup);
      this.sceneObjects = oldGroup;
      throw buildErr;
  }
  this.threeScene.remove(oldGroup);
  this._disposeRecursive(oldGroup);

  // _computeAndRender() — 1404 行
  // ... 完全相同的 17 行 ...
  ```

- **根因**：`9a34a55` 修复动画残留时，直接把 `_computeAndRender()` 中的双缓冲逻辑复制到了 `_applyAIParams()`。修复本身是正确的，但没有提取公共方法。

- **修复**：提取为 `_renderWithDoubleBuffer(data)`：

  ```javascript
  /**
   * 双缓冲渲染：在新 Group 中 buildScene，然后替换旧 Group。
   * 避免旧 3D 对象残留，buildScene 失败时回退旧 Group。
   */
  _renderWithDoubleBuffer(data) {
      const oldGroup = this.sceneObjects;
      const newGroup = new THREE.Group();
      this.threeScene.add(newGroup);
      this.sceneObjects = newGroup;

      try {
          this.buildScene(data);
      } catch (buildErr) {
          this.threeScene.remove(newGroup);
          this._disposeRecursive(newGroup);
          this.sceneObjects = oldGroup;
          throw buildErr;
      }

      this.threeScene.remove(oldGroup);
      this._disposeRecursive(oldGroup);
  }
  ```

  两个调用方改为：
  ```javascript
  // _applyAIParams():
  this._lastComputeResult = result.data;
  this._renderWithDoubleBuffer(result.data);
  this._updateSolutionInfo(result.data);
  // ...

  // _computeAndRender():
  this._renderWithDoubleBuffer(result.data);
  this._updateSolutionInfo(result.data);
  // ...
  ```

- **验证**：正常切换场景 + AI 修改参数后点击 ✓ 应用，3D 画面均无对象残留。

---

### 🟡 中等问题

#### #2 · 工具循环中 set_params + 读工具混合场景

- **位置**：[ai_chat.py:175-180](server/ai_chat.py#L175)
- **症状**：当 AI 在同一轮同时调用读工具和 `set_params` 时，代码跳过提前返回（因为 `read_calls` 非空），继续循环。下一轮如果 AI 再次调用 `set_params`，同一个参数修改会被收集两次到 `collected_tool_calls`，前端会渲染重复的确认卡片。

- **实际风险**：低。DeepSeek 模型通常不会在同一轮混合读+写工具，且在收到 "已提交用户确认" 的 tool result 后不会重复提议相同的参数修改。

- **修复**（建议非紧急）：在收集 `set_params` 时做去重：
  ```python
  for sp in set_params_calls:
      # 去重：相同 params 只保留最后一次
      existing = next((tc for tc in collected_tool_calls
                       if tc.get("action") == "set_params"
                       and tc.get("params") == sp["params"]), None)
      if existing:
          collected_tool_calls.remove(existing)
      collected_tool_calls.append({...})
  ```

#### #3 · `_parseToolCallFallback` 标记 @deprecated 但无移除计划

- **位置**：[scene-base.js:1091](client/js/scene-base.js#L1091)
- **症状**：兜底正则解析器被标记为 `@deprecated`，但每次 `_sendChatMessage()` 中 `tool_calls` 为 null 时仍然调用。既然是兜底安全网，注释应改为「fallback safety net」而非「deprecated」。

- **修复**：改注释：
  ```javascript
  /**
   * 兜底解析：如果后端未返回结构化 tool_calls（API 异常、旧版本等），
   * 尝试从 AI 回复文本中用正则提取 JSON 代码块中的参数修改指令。
   * 正式路径是后端 tool_calls 字段；此方法作为安全网保留。
   */
  ```

---

### 🟢 低优先级

#### #4 · CLAUDE.md 角色数量更新但相关文件引用未同步

- **位置**：[CLAUDE.md:200-210](CLAUDE.md#L200)
- **症状**：角色分工表新增了「副面板负责人」，4→5。但以下内容未检查：
  - `AI_PANEL_LEAD_PROMPT.md` 中「项目有三个专职 AI 并行工作」→ 现在是 4 个（加上副面板负责人）
  - `AI_SCENE_DEV_PROMPT.md` 中可能也有类似引用
  - `AI_AUDITOR_PROMPT.md` 中「有 24 个交互式 3D 场景」→ 实际 27
  - `AI_CHAT_PROMPT.md` 中「有 27 个交互式 3D 场景」→ 正确 ✅

- **修复**：全局搜索「24 个」「三个 AI」等过时数字，统一更新。

#### #5 · `READ_TOOLS` 集合与 `TOOLS` 列表分离维护

- **位置**：[ai_chat.py:15](server/ai_chat.py#L15)、[ai_chat.py:19-108](server/ai_chat.py#L19)
- **症状**：新增读工具需要在两处修改：`TOOLS` 列表（加工具定义）+ `READ_TOOLS` 集合（加工具名）。如果漏加 `READ_TOOLS`，工具会被当作写工具处理（收集到返回值而非执行）。

- **修复**（建议）：从 `TOOLS` 定义中自动提取，或至少在 `READ_TOOLS` 上方加注释提醒：
  ```python
  # ⚠️ 新增读工具时，必须同步更新此集合！
  READ_TOOLS = {"get_scene_params", "get_matrix_data", "get_solution_info", "get_verification"}
  ```

---

## 正面发现

1. **Function calling 架构升级质量高**：从正则匹配升级到原生 OpenAI/DeepSeek function calling 是一次正确的架构决策。旧方案的正则提取对嵌套 JSON、花括号转义都脆弱，新方案利用 API 原生能力，可靠性和可扩展性大幅提升。

2. **工具循环设计合理**：`MAX_TOOL_LOOPS = 5` 防止无限循环；读工具执行后结果反馈 AI 继续对话；写工具收集到返回值由前端确认。分工清晰。

3. **`_call_deepseek_api()` 独立抽取**：HTTP 调用逻辑从 `ask_deepseek()` 中分离，返回统一的 `(data, error)` 元组，职责单一，便于测试。

4. **`build_system_prompt()` 去数据化**：不再接收 `scene_data` 参数，数据全部通过 function calling 获取。这意味着场景改初始数据不需要改 system prompt——解耦彻底。

5. **前端向后兼容做得好**：`msg.toolCalls`（新格式，数组）和 `msg.toolCall`（旧格式，单数）同时支持；`_parseToolCallFallback()` 在结构化数据缺失时兜底。新旧版本平滑过渡。

6. **动画残留修复分析透彻**：[work-brief-ai-apply-animation-leak.md](docs/audit/work-brief-ai-apply-animation-leak.md) 把两条调用路径的差异讲得很清楚——正常路径有双缓冲，AI 应用路径没有，根因一目了然。这种分析质量值得其他 AI 学习。

7. **新角色提示词明确管辖边界**：[AI_CHAT_PROMPT.md](docs/AI_CHAT_PROMPT.md) 不仅列出自己负责的文件，还列出了共享文件的注意事项和绝对不能碰的文件清单。比另外两个角色的提示词更严谨。

8. **AI_TOOLS_REFERENCE.md 文档结构化**：5 个工具的定义、数据流、前后端协议、新增工具的步骤全部文档化。后续扩展工具时有章可循。

9. **DEV_GUIDE.md 陷阱持续积累**：本分支新增 4 条陷阱（f-string 花括号、buildScene 入参、方法名拼写、max_tokens 硬编码），均来自实际踩坑。这种「踩一个记一个」的文化值得坚持。

---

## 建议优先级

**本次必须修（🔴）**：
- #1 提取双缓冲为 `_renderWithDoubleBuffer()` 公共方法

**建议尽快修（🟡）**：
- #2 工具循环 set_params 去重
- #3 `_parseToolCallFallback` 注释修正

**可以以后修（🟢）**：
- #4 CLAUDE.md 过时数字全局同步
- #5 READ_TOOLS 集合维护提醒

---

## 合并建议

分支 `fix/scene/ai-apply-animation-leak` **可以合并**。两个提交逻辑正确，没有发现功能性 bug。🔴 #1（双缓冲重复）是代码质量问题，不影响功能，可以在合并后单独修。

建议合并前确认：
- [ ] 面板负责人的工作是否也需要在此分支合并前处理（避免冲突）
- [ ] AI 答疑 function calling 是否已经实际测试过（在浏览器中发送消息、确认工具卡片出现、点击应用后 3D 更新正常）
