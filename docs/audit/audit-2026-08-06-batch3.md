# 审计报告 — 2026-08-06 增量审计（Batch 3）

**审计范围**：`01e14cd` → `74fcf8c`（7 个新提交）
**审计时间**：2026-08-06
**基线**：`d402987`（Batch 2 审计终点）

---

## 问题汇总

| # | 严重度 | 位置 | 问题简述 |
|---|--------|------|----------|
| 1 | 🟡 | main.js:187 + panel-system.js:407 + style.css | 隐藏全部面板后 👁 按钮无法触及 |
| 2 | 🟢 | style.css:1016-1035 | `.lecture-sub-panel-swap-btn` CSS 死代码 |
| 3 | 🟢 | scene-base.js:42-43, 111-112 | 子面板折叠状态未持久化（与 `_subPanelOrder` 不一致） |

---

## 详细分析

### 🟡 中等问题

**#1 隐藏全部面板导致 👁 按钮死锁**

- **位置**：
  - `main.js:187-196` — `_applyPanelVisibility()` 调用 `panel.hide()`
  - `panel-system.js:318-321` — `hide()` 调用 `zone._updateEmptyState()`
  - `panel-system.js:407-427` — `_updateEmptyState()` 将「全部隐藏」视为空列，加 `no-panels` 类
  - `style.css` (8189fa8) — `#right-column.no-panels #scene-info-header { display: none !important; }`
- **症状**：用户在 👁 菜单中取消勾选所有面板后，两个侧栏都变为 `no-panels`。CSS 隐藏了 `#scene-info-header`（内含 👁 按钮）和侧栏折叠按钮。用户只能看到空白 3D 画面，无法通过 UI 恢复面板。
- **恢复方式**：F5 刷新页面（`_userHidden` 默认 `false`，所有面板恢复显示）。用户不会丢数据，但体验中断。
- **根因**：`_updateEmptyState()` 将「用户主动隐藏全部面板」和「dock zone 真的没有任何面板」混为一谈。前者不应导致 UI 控件自身被隐藏。
- **修复建议**（三选一，推荐方案 A）：
  - **方案 A**：`_updateEmptyState()` 中区分「空 dock」（`isEmpty()`）和「全隐藏」（`allHidden`）——只有真实的空 dock 才触发 `no-panels`。全隐藏时保留侧栏可见（或至少保留 `#scene-info-header`）。
  - **方案 B**：将 `#panel-vis-toggle` 移出 `#scene-info-header`，放到 viewer 区域（回退到 01e14cd 之前的位置），使其不受 `no-panels` 影响。
  - **方案 C**：在 👁 菜单中添加防呆逻辑——至少保留一个面板可见（不允许全部取消勾选）。

---

### 🟢 低优先级

**#2 `.lecture-sub-panel-swap-btn` CSS 死代码**

- **位置**：`client/css/style.css:1016-1035`
- **详情**：commit 74fcf8c 的 message 明确写「移除旧的 ↕ 交换按钮，改为拖拽交互」。JS 中不再创建 `.lecture-sub-panel-swap-btn` 元素，但 CSS 中的 20 行样式规则仍保留。
- **修复**：删除 `style.css` 中 `.lecture-sub-panel-swap-btn` 和 `.lecture-sub-panel-swap-btn:hover` 两个规则块。

**#3 子面板折叠状态未持久化**

- **位置**：`scene-base.js:42-43`（初始值）、`111-112`（destroy 重置）
- **详情**：`_subPanelOrder`（子面板排列顺序）通过 `localStorage` 持久化，但 `_basicCollapsed` 和 `_aiCollapsed`（子面板折叠状态）在每次 `destroy()` 时重置为 `false`，切换场景后总是展开。用户体验不一致。
- **修复**：在 `constructor` 中从 `localStorage` 读取折叠状态，在折叠按钮的 click handler 中写入 `localStorage`（参照 `_syncSubPanelOrder` 模式）。

---

## 逐提交审查

### 01e14cd — `feat: 空列逻辑覆盖隐藏面板 + 面板按钮移至标题栏右上角`

**文件**：`style.css` (+25/-23), `index.html` (+5/-7), `panel-system.js` (+11/-2)

**审查结论**：✅ 核心逻辑正确
- `_updateEmptyState()` 新增 `allHidden` 检测合理——用户通过菜单隐藏全部面板后，空列应该消失
- `show()`/`hide()` 中调用 `_updateEmptyState()` 确保状态同步
- 👁 按钮移入 `#scene-info-header` 更符合 UI 语义（面板管理按钮属于场景信息区）
- ⚠️ 但此移动配合后续 8189fa8 的 `#scene-info-header` 隐藏规则，产生了 issue #1

### 927ad56 — `feat: 左右栏空列隐藏 — 无面板时消失，拖拽时显示窄条，悬停时展开`

**文件**：`style.css` (+33), `panel-system.js` (+25)

**审查结论**：✅ 无问题
- CSS transition `width 0.2s ease` 实现平滑消失/出现
- `body.is-dragging` 下显示 10px 窄条作为拖放目标，交互合理
- `drag-expand` 展开至 200px，有足够空间显示 placeholder
- JS 中 `_onDragStart`/`_onDragEnd` 正确管理 `is-dragging` 类

### 6ed1647 — `fix: 空区域提示常驻遮挡画面 — 仅在拖拽悬停时显示 placeholder`

**文件**：`style.css` (+1/-1)

**审查结论**：✅ 精确修复
- `.dock-zone.empty .zone-placeholder` → `.dock-zone.drag-over.empty .zone-placeholder`
- 之前 empty zone 的 placeholder 文字常驻显示，遮挡 3D 画面
- 现在仅在拖拽悬停（`.drag-over`）时才显示

### 8189fa8 — `fix: 拖拽目标60px + no-panels隐藏场景标题 + 强制显示dock区覆盖collapsed`

**文件**：`style.css` (+14/-3)

**审查结论**：⚠️ 包含 issue #1 的触发条件
- 拖拽目标从 40px → 60px：合理，更大的拖放区更容易命中
- `body.is-dragging ... #dock-left/right { display: flex !important; }`：正确，覆盖面板 collapsed 状态，确保拖放目标可见
- `#right-column.no-panels #scene-info-header { display: none !important; }`：**引入了 UX 死锁触发条件**（见 issue #1）。当用户通过 👁 隐藏右栏全部面板后，`no-panels` → `#scene-info-header` hidden → 👁 按钮消失

### d7ee550 — `fix: 拖拽目标扩至100px + ResizeObserver debounce 120ms 消除闪烁`

**文件**：`style.css` (+2/-2), `main.js` (+10/-11)

**审查结论**：✅ 无问题
- 拖拽目标 60px → 100px：扩大拖放命中区域
- ResizeObserver 从观察 4 个 dock zone 改为观察 viewer：架构简化，减少连锁触发
- 120ms debounce：合理的防抖策略

### cf79b20 — `fix: 移除 resize debounce — canvas 同步跟随列过渡，消除跳跃感`

**文件**：`main.js` (+3/-6)

**审查结论**：✅ 无问题
- 移除 120ms debounce，改为实时 resize
- 原因：debounce 导致 canvas resize 晚于 CSS transition 完成，产生视觉跳跃
- `renderer.setSize()` 轻量级操作，无性能顾虑
- `_resizeDebounce` 变量被移除，无残留

### 74fcf8c — `v1.9 — 讲解子面板拖拽排序 + ResizeObserver RAF 修复`

**文件**：`style.css` (+104), `main.js` (+9/-1), `scene-base.js` (+296/-70)

**审查结论**：✅ 核心实现质量高，有 2 个 🟢 级别小问题

**正面发现**：
- 子面板重构清晰：单体 lecture 拆分为 `basic` / `ai` 两个子面板，各带独立折叠
- 拖拽排序设计优雅：6px 死区 + 插入指示线，与主面板拖拽系统通过 `data-parent-panel`/`data-sub-panels-of` 隔离
- `_subPanelDragCleanup` 模式：保存清理函数供 `destroy()` 调用，防止内存泄露
- `_ensureSubPanels` 守卫：`if (panel.body.querySelector('.lecture-sub-panels')) return;` 避免重复创建 DOM
- `_cachedLectureHTML` 移除：简化为仅缓存 `_cachedLectureKey`，按需渲染
- main.js RAF 修复：`requestAnimationFrame(() => resize())` 确保 canvas resize 不与 CSS paint 冲突
- 侧栏折叠的 `setTimeout(resize, 300)` 被移除：ResizeObserver 自动处理，不再需要手动补偿

**问题**：
- `scene-base.js:1016-1035`：`.lecture-sub-panel-swap-btn` CSS 死代码（issue #2）
- `scene-base.js:42-43, 111-112`：折叠状态未持久化（issue #3）

---

## 交叉验证

| 检查项 | 结果 |
|--------|------|
| 资源管理（rAF/setTimeout/Texture） | ✅ main.js RAF 正确包装；scene-base.js destroy() 清理完整 |
| 面板系统规范（document.getElementById） | ✅ 无违规，均通过 PanelManager |
| 数学正确性（前端计算 / NumPy 序列化） | ✅ 无涉及 |
| 输入验证 / 安全 | ✅ 无新增端点 |
| 注册完整性 | ✅ 无新增场景 |
| innerHTML XSS | ✅ 用户输入不进入 innerHTML（AI 聊天内容走 KaTeX 安全渲染） |
| 事件监听器泄露 | ✅ `_subPanelDragCleanup` + `innerHTML = ''` 双重保障；mousedown 随 DOM 移除而 GC |
| localStorage 异常处理 | ✅ 所有 `JSON.parse` 和 `setItem` 均有 try-catch |

---

## 正面发现

1. **渐进式迭代**：从 01e14cd 到 74fcf8c，7 个提交逐步演化——先移按钮位置，再实现空列隐藏，再调整拖拽目标大小，最后重构讲解面板。每一步都是可独立工作的增量。
2. **ResizeObserver 演进合理**：4 个 dock zone 观察者 → 1 个 viewer 观察者 + debounce → 移除 debounce + 加 RAF。每一步都有明确的 commit message 解释原因。
3. **子面板拖拽隔离**：`data-parent-panel` / `data-sub-panels-of` 属性隔离机制防止子面板拖拽与主面板拖拽系统冲突。
4. **`_subPanelDragCleanup` 模式**：将清理函数保存为实例属性，在 `destroy()` 中调用——与项目已有的 `_animFrameId`、`_animTimeout` 清理模式一致。

---

## 建议优先级

**本次应考虑修复**：
- 🟡 #1：隐藏全部面板后 UI 死锁（建议方案 A，改动最小）

**可以以后修**：
- 🟢 #2：删除 `.lecture-sub-panel-swap-btn` 死 CSS
- 🟢 #3：持久化子面板折叠状态

---

**审计员**：AI 审计员 · **状态**：3 个待修项（1×🟡 + 2×🟢），无严重问题
