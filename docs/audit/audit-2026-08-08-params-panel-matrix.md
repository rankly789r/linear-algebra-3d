# 审计报告 — 2026-08-08 · 参数面板矩阵分组功能

> **审计范围**：8 个提交（c279e5a ~ 158ff3d），10 文件，+1306/-997 行

## 总体评估

**核心功能正确，实现质量好。** 1 个必须修、3 个建议修、其余不影响使用。

---

## 问题汇总

| # | 严重度 | 文件 | 问题 |
|---|--------|------|------|
| 1 | 🔴 | `scene-base.js:588` | `document.addEventListener` 从未移除，场景切换/重建时泄漏 |
| 2 | 🟡 | `style.css:968,1047` | `--bg-hover` CSS 变量未定义，箭头和多选标签 hover 背景不生效 |
| 3 | 🟡 | `style.css` | 嵌套滚动条：`.panel-body` + `.param-sub-panel-body` 均设 `overflow-y: auto`，内容多时出现双层滚动 |
| 4 | 🟡 | `style.css:1160` | `.param-pick-cell` 点击目标 ~18px，小于 WCAG 建议的 24px |
| 5 | 🟢 | `scene-base.js:1289` | AI 答疑 / 基础讲解顺序未交换（设计文档第四节要求） |
| 6 | 🟢 | `style.css:1109` | 矩阵网格滑块高度 3px vs 旧布局 4px，视觉不一致 |
| 7 | 🟢 | `scene-base.js:229` | 正则中 `*?` 惰性量词无用，简化为 `[a-zA-Z]+` 即可 |
| 8 | 🟢 | `scene-base.js:831` | `_renderOtherGroup` 中有无效的 `SELECT` 标签检查（从 `_renderMatrixGroup` 复制而来） |
| 9 | 🟢 | `scene-base.js:457,644` | Unicode 下标字符串在两个方法中重复定义 |

---

## 详细说明

### 🔴 #1：document click 监听器泄漏

**位置**：`scene-base.js:588`

每次 `_renderMatrixGroup()` 被调用时注册一个 `document.addEventListener('click', closePopup, true)`，且在 `body.innerHTML = ''` 时不移除。场景切换、参数范围调整、`_rows/_cols` 变化都会触发重建，监听器持续累积，连带闭包中的 `multiSel` 和 `msPopup` 无法 GC。

**修复**：在 `_buildParams()` 中 `body.innerHTML = ''` 之前清理旧监听器。

### 🟡 #2：`--bg-hover` CSS 变量不存在

**位置**：`style.css:968`（箭头 hover）+ `style.css:1047`（多选标签 hover）

`:root` 中只有 `--bg-primary / --bg-secondary / --bg-tertiary`，没有 `--bg-hover`。应改为 `var(--bg-tertiary)` 或其他已定义的变量。

### 🟡 #3：嵌套滚动条

**位置**：`.panel-body`（`overflow-y: auto; max-height: 420px`）+ `.param-sub-panel-body`（`overflow-y: auto; max-height: 320px`）

矩阵组大 + "其他参数"组同时展开时，外层先滚、内层也滚。Windows 下 `scrollbar-gutter: stable` 每个子面板占 ~17px 宽度。

### 🟡 #4：自选复选框太小

**位置**：`.param-pick-cell`（`padding: 3px`，checkbox 12px）

总点击区域 ~18px，触屏几乎点不中。建议 `padding: 6px` 或 `min-height: 28px`。

### 🟢 #5~#9

代码风格/维护性问题，详见上表，均不影响功能。

---

## 正面发现

1. **检测算法全面**：两位数矩阵 + 一位数向量 + 前缀冲突处理 + 单元素降级全部正确
2. **四种视图模式正确**：全部/按行/按列/自选逻辑清晰，自选模式用"盖住不销毁"策略保持网格形状
3. **localStorage 安全**：三个新 key 均按场景 + 前缀嵌套存储，旧格式向后兼容迁移
4. **非矩阵场景兼容**：`matrix_calculator` 和仅有 `choice` 类型的场景正常降级为"其他参数"子面板
5. **子面板折叠**：`max-height: 0` 折叠无跳动，状态持久化
6. **多选弹窗设计**：行/列可多选，checkbox 右侧对齐，点击外部关闭
7. **`_renderSliderRow` 提取**：旧代码提取为独立方法，所有调用点一致
8. **错误处理**：所有 localStorage 操作 try/catch，UI 操作 console.error 不崩溃

---

## 合并建议

**修完 🔴 #1 即可合并。** 🟡 #2~#4 建议后续迭代中修，不影响核心功能。
