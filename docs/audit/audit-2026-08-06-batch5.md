# 审计报告 — 2026-08-06 增量审计（Batch 5）

**审计范围**：`7da0149`（1 个新提交，448 行新增）
**审计时间**：2026-08-06
**基线**：`d04866b`（Batch 4 审计报告提交）

---

## 问题汇总

| # | 严重度 | 位置 | 问题简述 |
|---|--------|------|----------|
| — | ✅ | — | **本次审计未发现严重或高优先级问题** |
| 1 | 🟢 | `scene-base.js:1251` | `URL.revokeObjectURL` 调用时机可能过早 |

---

## 详细分析

### 变更概述

`7da0149` — `fix: ch0_r0动画按钮缺失 — _updateSolutionInfo容器化 + 场景搜索/键盘导航/导出笔记`

6 个文件：`scene-base.js` (+190), `main.js` (+173), `draw-utils.js` (+116), `ch0_r0_matrix_columns.js` (+25/-33), `style.css` (+36), `index.html` (+1)

---

### 1. `_updateSolutionInfo` 容器化 ✅

**变更**：不再使用 `panel.body.innerHTML` 全量替换，改为在 `panel.body` 内查找或创建 `[data-section="solution-info"]` 容器，只替换容器内容。

```js
// 旧：panel.body.innerHTML = html;
// 新：
let container = panel.body.querySelector('[data-section="solution-info"]');
if (!container) {
    container = document.createElement('div');
    container.dataset.section = 'solution-info';
    panel.body.appendChild(container);
}
container.innerHTML = html;
```

**审查结论**：✅ 根因正确、修复正确。这正是 DEV_GUIDE.md §十三 常见陷阱中记录的「innerHTML 全量替换覆盖动态子元素」问题的标准解法。ch0_r0 在 `buildScene()` 中创建的动画重播按钮不再被 `_updateSolutionInfo` 误删。

---

### 2. ch0_r0 动画按钮重构 ✅

**变更**：
- 按钮加 `anim-replay-btn` class（与其他 9 个动画场景统一）
- 添加去重检查：`if (body.querySelector('.anim-replay-btn')) return;`
- 新增 `_updateAnimButton(text, disabled)` 辅助方法，消除 6 处重复的按钮操作代码
- 净效果：+25/-33 行，减少 8 行

**审查结论**：✅ 重构合理，代码更简洁。`_updateAnimButton` 替代了之前散落在 `_startAnimation()`、`_animFrame()`、`_setToTarget()` 中的重复查询-更新代码。

---

### 3. 笔记导出功能 ✅🟢

**变更**：AI 答疑面板标题行新增 📥 按钮，点击生成 Markdown 文件并触发下载。

**内容覆盖**：场景参数 → 矩阵数据（LaTeX 格式） → 分析结果 → 讲解内容 → 截图占位符

**审查结论**：✅ 功能设计合理，无安全风险（所有内容来自后端计算结果，无用户输入注入）。
- `Blob` + `URL.createObjectURL` + `<a download>` 是标准的浏览器端文件下载模式
- 矩阵数据已做 `toFixed(4)` 处理，数值安全
- `_lastComputeResult` 在 `_computeAndRender` 中每次更新，不会引用过期数据

**🟢 小问题**：`URL.revokeObjectURL(url)` 在 `a.click()` 之后立即调用。`click()` 只是将下载加入浏览器任务队列，下载本身是异步的。在部分浏览器中，立即 revoke 可能导致下载失败。建议加 `setTimeout(() => URL.revokeObjectURL(url), 100)`。

---

### 4. 场景搜索 ✅

**变更**：场景目录面板顶部新增搜索框，支持文本过滤。

**审查结论**：✅ 实现简洁正确。
- 过滤逻辑遍历 `.scene-btn` 按钮，匹配 `textContent`
- 空分组标签（`.menu-label`）在组内无可见按钮时自动隐藏
- `Ctrl+K` / `Ctrl+F` 快捷键聚焦搜索框
- `Ctrl+F` 时检查 `document.activeElement?.tagName === 'INPUT'` 避免劫持浏览器搜索

---

### 5. 键盘快捷键 ✅

**变更**：全局键盘导航。

| 快捷键 | 功能 | 输入框内禁用 |
|--------|------|-------------|
| `R` | 重置相机 | 否（总是触发） |
| `Space` | 重播动画 | 是 |
| `1`–`5` | 切换预设 | 是 |
| `[` / `]` | 上/下一个场景 | 是 |
| `↑` / `↓` | 同组导航 | 是 |
| `Enter` | 加载高亮场景 | 是 |
| `Escape` | 清除高亮 | 否 |

**审查结论**：✅ 设计周到。
- 输入框检查：`tag === 'INPUT' || 'TEXTAREA' || isContentEditable`，覆盖全面
- 所有场景切换类快捷键在输入框内禁用，防止误触发
- `R`（重置相机）和 `Escape`（清除高亮）总是触发——合理，因为这两个操作不受输入框影响
- 使用 `.kb-hover` class 做键盘高亮，与 `.active` class（当前场景指示）分离——设计清晰

---

### 6. 面包屑导航 ✅

**变更**：场景信息标题区显示章节路径（如「第3章 矩阵的秩与线性方程组 › 秩的概念」）。

**审查结论**：✅ 实现简洁。`getBreadcrumb()` 使用路由前缀匹配（`ch3_r0`、`ch3_r12` 等），逻辑清晰。

---

### 7. 动画工厂函数提取到 draw-utils.js ✅

**变更**：`draw-utils.js` 新增 3 个工厂函数 + 2 个几何常量：
- `EDGES_QUAD`, `FACES_QUAD` — 四边形边/面索引
- `createUpdatableWireframe(vertices, edgePairs, color, opacity)` — 可更新线框
- `createUpdatableFaces(vertices, faceIndices, color, opacity)` — 可更新半透明面
- `createAnimatableArrow(endPos, color, labelText)` — 可动画箭头

**审查结论**：✅ 这是 comprehensive audit #16 技术债的解决。
- 3 个渲染器已切换为从 `draw-utils.js` 导入：`ch0_r0_matrix_columns.js`、`ch0_r1_column_decompose.js`、`ch2_r0_matrix_multiply.js`
- 其余 7 个渲染器仍有本地拷贝（`ch1_r0`、`ch2_r1`、`ch3_r0`、`ch3_r3`、`ch3_r12`、`ch3_r13`、`matrix_calculator`）— 后续可逐步迁移
- `createAnimatableArrow` 中 `CanvasTexture` 的 `dispose()` 由 `_disposeRecursive()` 统一处理——资源安全
- `createUpdatableFaces` 在 `updateVertices` 时重建所有面（dispose 旧 geometry/material），资源管理正确

---

## 交叉验证

| 检查项 | 结果 |
|--------|------|
| 资源管理 | ✅ `CanvasTexture` 由 `_disposeRecursive` 统一 dispose |
| 面板系统规范 | ✅ 使用 `_panel('solution')`，未用 `document.getElementById` |
| 数学正确性 | ✅ 无前端数学计算 |
| 输入验证 / 安全 | ✅ 无新增端点；导出内容来自后端，无 XSS |
| 注册完整性 | ✅ 无新增场景 |
| 代码质量 | ✅ `_updateAnimButton` 消除重复代码；ch0_r0 净减 8 行 |
| 键盘事件 | ✅ 正确处理输入框内禁用 |

---

## 正面发现

1. **`_updateSolutionInfo` 容器化是教科书级的修复**：用 `data-section` 属性标记专用容器，只替换内容不触碰兄弟元素。这比之前的 `innerHTML` 全量替换方案安全得多，也应成为未来所有面板内容更新的标准模式。

2. **键盘导航设计周全**：输入框检查覆盖了 INPUT、TEXTAREA、contentEditable 三种情况，`Ctrl+F` 不劫持浏览器搜索，`R` 和 `Escape` 在输入框内仍可用——这些细节考虑得很到位。

3. **工厂函数提取是对的方向**：虽然只迁移了 3 个渲染器，但这是 comprehensive audit #16 技术债的实质性推进。`EDGES_QUAD` 和 `FACES_QUAD` 作为导出常量，其他渲染器可以逐步迁移。

4. **提交信息准确**：commit message 清楚说明了根因（`_updateSolutionInfo` 的 `innerHTML` 覆写动画按钮）和修复方案，符合项目规范。

---

## 建议优先级

**可以以后修**：
- 🟢 #1：`URL.revokeObjectURL` 加 `setTimeout` 延迟（1 分钟）

---

**审计员**：AI 审计员 · **状态**：1 个 🟢 小问题，无代码问题
