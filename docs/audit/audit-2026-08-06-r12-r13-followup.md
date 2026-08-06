# 审计报告 — 2026-08-06（ch3_r12/r13 修复 + 新场景 后续审计）

**审计范围**：commit `59972d4`（审计报告🟡项修复 + UX1动画重设计）+ `ed30b9f`（新增零空间/列空间场景 + AI聊天增强）
**审计时间**：2026-08-06 傍晚
**依据**：CLAUDE.md、ARCHITECTURE.md、DEV_GUIDE.md、上次审计报告

---

## 问题总览

| # | 严重度 | 位置 | 简述 |
|---|--------|------|------|
| 1 | 🔴 | [CLAUDE.md:101-130](CLAUDE.md) | 场景数量过期：写 26 实际 27，`ch3_r6b_nullspace` 未列入清单 |
| 2 | 🔴 | [_elem_transform_base.js:11-12](client/js/renderers/_elem_transform_base.js#L11-L12) | 死配置：`CONFIG.colors[0]` 和 `CONFIG.arrowLabel` 从未使用 |
| 3 | 🟡 | [ai_chat.py:10](server/ai_chat.py#L10) | `import certifi` 直接导入但未在 requirements.txt 声明 |
| 4 | 🟡 | [_elem_transform_base.js:13-22](client/js/renderers/_elem_transform_base.js#L13-L22) | CUBE_EDGES / CUBE_FACES 仍未提取到 draw-utils.js（P2 未完成） |
| 5 | 🟡 | [ch3_r12_elem_row.py:170](server/scenes/ch3_r12_elem_row.py#L170) / [ch3_r13:173](server/scenes/ch3_r13_elem_col.py#L173) | `t_EA["unit_shape"] = ...` 字典变异模式脆弱 |
| 6 | 🟡 | [_elem_transform_base.js:88-107](client/js/renderers/_elem_transform_base.js#L88-L107) | Canvas Sprite 标签创建仍内联（P3 未完成） |
| 7 | 🟢 | [SCENE_ANALYSIS.md](docs/SCENE_ANALYSIS.md) / [SCENE_PLAN.md](docs/SCENE_PLAN.md) | 2 个新场景未列入规划文档 |
| 8 | 🟢 | [_elem_transform_base.js:30-34](client/js/renderers/_elem_transform_base.js#L30-L34) | CONFIG 默认值从未被使用（仅子类覆盖值生效） |

---

## 详细分析

### 🔴 严重问题

#### #1 · CLAUDE.md 场景数量过期（再犯）

- **位置**：[CLAUDE.md:101](CLAUDE.md)（`场景清单（26个）`）、[CLAUDE.md:46](CLAUDE.md)（`26 个场景`）、[CLAUDE.md:55](CLAUDE.md)（`26 个场景渲染器`）、[CLAUDE.md:148](CLAUDE.md)（`全部 26 个场景`）
- **症状**：上次审计后从 24→26 修正了，但本批又新增了 `ch3_r6b_nullspace`，实际有 27 个场景（26 个教学 + 1 个计算器），CLAUDE.md 仍写 26。场景清单表缺少 `ch3_r6b_nullspace`（零空间）行。
- **修复**：26→27（4 处），并在 Ch3 章节补上：
  ```
  | Ch3 | `ch3_r6b_nullspace` | 零空间（齐次方程组的解） |
  ```

#### #2 · `_elem_transform_base.js` 死配置

- **位置**：[`_elem_transform_base.js:11-12`](client/js/renderers/_elem_transform_base.js#L11-L12)
- **症状**：UX1 动画重设计后，两个形状并排 + 箭头的布局被替换为单形状动画。但 CONFIG 中的 `colors[0]`（原 A 形状颜色）和 `arrowLabel`（原箭头标签）没有被清理。`buildScene()` 中仅使用 `colors[1]` 作为动画形状颜色，箭头也已被移除。
- **根因**：UX1 改动时只删了渲染逻辑，忘了清理配置常量。
- **修复**：
  ```js
  // _elem_transform_base.js CONFIG 默认值，删掉 arrowLabel，colors 改为单值
  static CONFIG = {
      color: 0xffd166,        // 动画形状颜色（原 colors[1]）
      storageKey: 'la_chXrX_anim_auto',
  };
  // 子类对应修改：
  // ch3_r12: static CONFIG = { color: 0xffd166, storageKey: 'la_ch3r12_anim_auto' };
  // ch3_r13: static CONFIG = { color: 0xef476f, storageKey: 'la_ch3r13_anim_auto' };
  ```
  同时 `buildScene()` 中 `this._cfg.colors[1]` 改为 `this._cfg.color`。

---

### 🟡 中等问题

#### #3 · `certifi` 导入未声明依赖

- **位置**：[ai_chat.py:10](server/ai_chat.py#L10)
- **症状**：`ai_chat.py` 直接 `import certifi` 并调用 `certifi.where()`。`certifi` 不在 `requirements.txt` 中（当前仅 5 个依赖：fastapi, uvicorn, numpy, scipy, httpx）。虽然 httpx 依赖 certifi 作为传递依赖，实践中不会崩溃，但直接导入的包应显式声明。
- **修复**：在 `requirements.txt` 加一行 `certifi`（或确认 httpx 版本始终包含后加注释说明）。同时 `verify=certifi.where()` 与 httpx 默认行为（`verify=True`）等效，可考虑简化。

#### #4 · CUBE_EDGES / CUBE_FACES 未提取（上次 P2 未完成）

- **位置**：[`_elem_transform_base.js:13-22`](client/js/renderers/_elem_transform_base.js#L13-L22)
- **症状**：上次审计报告 P2 明确要求将这两个常量移到 `draw-utils.js`（与 `EDGES_QUAD`/`FACES_QUAD` 并列），但合并到 `_elem_transform_base.js` 时原样保留了。虽然已从 2 份重复减为 1 份，但仍不在统一管理位置。
- **修复**：移到 `draw-utils.js`：
  ```js
  // draw-utils.js 新增
  export const CUBE_EDGES = [...];
  export const CUBE_FACES = [...];
  ```
  `_elem_transform_base.js` 改为从 draw-utils.js import。

#### #5 · 字典变异模式脆弱

- **位置**：[ch3_r12_elem_row.py:170](server/scenes/ch3_r12_elem_row.py#L170) / [ch3_r13_elem_col.py:173](server/scenes/ch3_r13_elem_col.py#L173)
- **症状**：
  ```python
  t_EA = self._get_transform_data(EA, f"E·A ({op_desc})")
  if t_EA:
      t_EA["unit_shape"] = t_A["transformed_shape"]  # 原地变异
  ```
  覆盖了 `_get_transform_data` 返回字典中的 `"unit_shape"` 键。当前安全（`_get_transform_data` 每次返回新 dict），但若未来有人给 `_get_transform_data` 加缓存（如 `@lru_cache`），会静默破坏数据。
- **修复**（建议非紧急）：用不可变模式：
  ```python
  t_EA = {**self._get_transform_data(EA, f"E·A ({op_desc})"),
          "unit_shape": t_A["transformed_shape"]}
  ```
  或在 `_get_transform_data` 文档中明确标注「返回新 dict，调用方可安全修改」。

#### #6 · Canvas Sprite 创建仍内联（上次 P3 未完成）

- **位置**：[`_elem_transform_base.js:88-107`](client/js/renderers/_elem_transform_base.js#L88-L107)、[`_elem_transform_base.js:110-123`](client/js/renderers/_elem_transform_base.js#L110-L123)
- **症状**：上次审计 P3 建议提取 `createCanvasSprite()` 到 draw-utils.js。合并后虽从 4 份重复减为 2 份（形状标签 + ghost 标签），但仍是内联 Canvas→Sprite 的样板代码。
- **状态**：上次已标注「不紧急——等第三个场景需要时再提取」，本次维持此判断。不影响功能。

---

### 🟢 低优先级

#### #7 · 规划文档未更新

- **位置**：[SCENE_ANALYSIS.md](docs/SCENE_ANALYSIS.md)、[SCENE_PLAN.md](docs/SCENE_PLAN.md)
- **症状**：`ch3_r6b_nullspace` 和 `ch3_r7b_col_space` 已实现但规划文档未标记为完成。
- **修复**：在相应章节标记 ✅。

#### #8 · CONFIG 默认值冗余

- **位置**：[`_elem_transform_base.js:30-34`](client/js/renderers/_elem_transform_base.js#L30-L34)
- **症状**：基类 `CONFIG` 定义了 `colors`、`arrowLabel`、`storageKey` 默认值，但两个子类都完整覆盖了所有值，基类默认值从未被使用。
- **建议**：要么删除基类默认值（只保留文档注释说明子类需提供哪些字段），要么在 `_cfg` getter 中做运行时校验。

---

## 上次审计问题复查

| 上次编号 | 问题 | 状态 |
|---------|------|------|
| #1 | `createBaseScene()` 死代码 | ✅ 已删除 |
| #2 | `ch1_r0_equation_to_plane.py` 手写参数 | ✅ 已迁移到工厂函数 |
| #3 | DEV_GUIDE.md 设置菜单位置过期 | ✅ 已更新 |
| #4 | AI_PANEL_LEAD_PROMPT.md 引用过期 | ✅ 已更新 |
| #5 | CLAUDE.md 场景数量 24→26 | ⚠️ 已更新但需再更新（26→27） |
| #6 | CLAUDE.md 场景清单缺 2 个 | ⚠️ 已补但需再补 1 个（ch3_r6b_nullspace） |
| #7 | ch3_r12/r13 无 lecture | ✅ 已添加（各 4 节） |
| #8 | `_build_matrix`/`_get_transform_data` 重复 | ✅ 已提取到 base.py |
| #9 | JS 渲染器 95% 重复 | ✅ 已提取到 `_elem_transform_base.js` |
| #10 | 参数标签不友好 | ✅ 已中文化 + 1-based |
| #11 | panelDefs 硬编码耦合 | ✅ 已改为 `panelManager.getPanels()` |
| UX1 | 动画设计不直观 | ✅ 已重设计为单形状 A→EA |
| UX2 | 交换变换无翻转感 | ❓ 未确认（可能需要实际运行验证） |
| P2 | CUBE_EDGES/CUBE_FACES 提取到 draw-utils | ❌ 未完成（见本次 #4） |
| P3 | Canvas Sprite 提取 | ❌ 未完成（见本次 #6） |
| #12 | 规划文档更新 | ❌ 未完成（见本次 #7） |

---

## 正面发现

1. **`_elem_transform_base.js` 提取质量高**：ch3_r12 渲染器从 210 行 → 15 行，ch3_r13 从 202 行 → 15 行。子类通过 `static CONFIG` 实现差异化，模式优雅。
2. **UX1 动画重设计实现正确**：后端通过覆写 `t_EA["unit_shape"]` 传递 A→EA 的过渡数据，前端单形状 ghost + 动画的展示直观清晰。插值引擎无需改动。
3. **两个新场景质量好**：`ch3_r6b_nullspace.py` 和 `ch3_r7b_col_space.py` 都正确使用 `matrix_params` 工厂函数，有完整的 lecture（3 节）、verification、solution_info。渲染器全部走 `createLabel()` 标注。
4. **AI 聊天持久化（chat-store.js）**设计得当：IndexedDB 按场景名分片存储，静默失败不阻断 UI，过滤 `__LOADING__` 占位消息。保存时机选在 `destroy()` 中，切换场景时自动持久化。
5. **AI 工具调用确认卡片**：`_parseToolCall()` 解析 → `_createToolCard()` 显示确认 → `_applyAIParams()` 带后端验证 → `_replaceToolCard()` 展示结果。完整闭环且用户体验好。
6. **笔记生成重构**：从「前端拼 Markdown 模板」改为「发送场景数据给 DeepSeek 生成结构化笔记」，质量大幅提升。`max_tokens` 从硬编码 1024 改为参数化。
7. **gridHelper 的 `depthWrite: false`**：settings-menu.js 中已正确设置，上次审计 #12 对应的网格穿透问题已解决。

---

## 建议优先级

**本次必须修（🔴）**：
- #1 CLAUDE.md 场景数量 26→27 + 补 ch3_r6b_nullspace
- #2 _elem_transform_base.js 清理死配置（colors[0], arrowLabel）

**建议尽快修（🟡）**：
- #3 certifi 加入 requirements.txt
- #4 CUBE_EDGES/CUBE_FACES 移到 draw-utils.js
- #5 字典变异加注释或改为不可变模式

**可以以后修（🟢）**：
- #6 Canvas Sprite 提取（等第三个场景需要时）
- #7 规划文档更新
- #8 CONFIG 默认值清理
