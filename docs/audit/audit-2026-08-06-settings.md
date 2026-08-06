# 审计报告：设置菜单升级 + 网格缩放

- **审计日期**：2026-08-06
- **被审提交**：`ce87f98` feat: 设置菜单升级 — ⚙替换👁，整合面板显示/网格/参数区间/颜色主题四大功能
- **审阅范围**：`client/index.html` `client/css/style.css` `client/js/main.js` `client/js/scene-base.js` `client/js/draw-utils.js`
- **审计员**：AI 审计员
- **结论**：⚠️ 2 个必改项 + 2 个建议项（本次提交内），另有 4 项扩展任务待林执行

---

## 总体评价

设置菜单的基础架构写得不错。从旧的 `panel-vis-toggle`（仅面板可见性）升级为 4 组可折叠二级菜单的完整设置面板，代码结构清晰、分段注释到位、持久化完整。本次审计发现了 1 个性能问题、1 个重复计算问题、以及 2 个建议优化项需要修复。此外，后续扩展工作已整理为[工作指令](work-brief-settings-grid.md)，待林执行。

---

## 一、后续扩展任务（来自工作指令，不在本次提交范围内）

以下是我在审计前撰写的工作指令中要求的新功能，需后续提交实现：

| # | 待实现功能 | 位置 |
|---|-----------|------|
| — | 网格 size 上限 30→100 | [main.js:320](client/js/main.js#L320) |
| — | 网格颜色选择器（设置菜单中可编辑） | [main.js:769](client/js/main.js#L769) |
| — | `COLORS` 对象通过 Proxy 接入设置系统 | [draw-utils.js:12-27](client/js/draw-utils.js#L12) |
| — | 清理 `createBaseScene()` 死代码 | [draw-utils.js:34-66](client/js/draw-utils.js#L34) |

## 二、代码质量——通过项 ✅

### 2.1 架构设计
- ✅ 从旧的 `initPanelVisibilityMenu()` 重构为 `initSettingsMenu()`，职责扩展但结构清晰
- ✅ 4 个子菜单用分隔注释 `════` 标记边界，可读性好
- ✅ `_refreshParamRangeUI` 通过 `window._refreshParamRangeUI` 暴露给 `switchScene()` 调用（[main.js:416](client/js/main.js#L416) + [main.js:1076](client/js/main.js#L1076)）
- ✅ `scene-base.js` `_buildParams()` 正确读取 `la_param_ranges` 覆盖滑块 min/max（[scene-base.js:298-305](client/js/scene-base.js#L298)）

### 2.2 数据持久化
- ✅ `la_grid_settings`、`la_param_ranges`、`la_color_theme`、`la_settings_collapsed` 全部正确读写
- ✅ 所有持久化操作包裹在 `try/catch` 中

### 2.3 旧代码清理
- ✅ HTML 中旧的 `#panel-vis-toggle` / `#panel-vis-menu` / `#panel-vis-list` 已完全替换
- ✅ CSS 中旧的 `.panel-vis-*` 样式已删除（仅保留注释提及）
- ✅ JS 中旧的 `initPanelVisibilityMenu` 已完全重构
- ✅ 旧 `const grid = new THREE.GridHelper(...)` 已改为 `let gridHelper`

### 2.4 关键 Bug 修复
- ✅ **const TDZ 引用错误**：颜色恢复拆分为 CSS 立即生效（[main.js:462-467](client/js/main.js#L462)）+ `window._applySavedThemeBg` 延迟回调（[main.js:469-477](client/js/main.js#L469)），在 `scene` 创建后调用（[main.js:718](client/js/main.js#L718)）。设计正确。

### 2.5 HTML/CSS
- ✅ HTML 结构：4 组 L1/L2 折叠菜单，语义清晰
- ✅ CSS：`.settings-l1.expanded .settings-arrow { transform: rotate(90deg) }` 展开动画
- ✅ CSS：菜单 `overflow: hidden` + `border-radius: 6px` 避免子元素溢出圆角

---

## 三、问题清单

### 🔴 必改项

#### B1. `_saveGridSettings` 在每个 `input` 事件中调用
**位置**：[main.js:774](client/js/main.js#L774) — `updateGridRenderer` 末尾调用 `_saveGridSettings(size, divisions)`；而 `updateGridRenderer` 在滑块 `input` 事件（[main.js:311](client/js/main.js#L311)）中被调用。
**问题**：拖拽滑块时，`input` 事件连续触发（~60次/秒），每次都会 `JSON.stringify` + `localStorage.setItem`。频繁写 localStorage 是同步阻塞操作，会导致滑块拖动卡顿。
**严重度**：中等 — 用户体验受影响。
**修复**：将 `_saveGridSettings` 从 `updateGridRenderer` 中移出，改为在 `change` 事件中调用：
```js
// main.js:306 slider.addEventListener('input', ...)
slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    valSpan.textContent = v;
    const size = key === 'size' ? v : parseInt(gridBody.querySelector('input[type="range"]').value);
    const divisions = key === 'divisions' ? v : parseInt(gridBody.querySelectorAll('input[type="range"]')[1].value);
    updateGridRenderer(size, divisions);  // 不持久化
});
slider.addEventListener('change', () => {
    _saveGridSettings(gridSize, gridDivisions);  // 松手后才持久化
});
```
同时从 `updateGridRenderer` 中移除 `_saveGridSettings` 调用。

#### B2. 颜色主题初始化时重复读取 `getComputedStyle`
**位置**：[main.js:462-477](client/js/main.js#L462)
```js
const savedColors = _loadColorTheme();         // ← 第一次读取 getComputedStyle
colorDefs.forEach(d => {
    const val = savedColors[d.cssProp];
    if (val) document.documentElement.style.setProperty(d.varName, val);
});

window._applySavedThemeBg = function() {
    const savedColors = _loadColorTheme();     // ← 第二次读取 getComputedStyle
    ...
};
```
**问题**：`_loadColorTheme()` 每次都调用 6 次 `getComputedStyle`（相对昂贵的操作）。这里调用了两次，第二次是浪费的——第一次已经拿到了完整的 `savedColors`，回调里不需要再读一次。
**修复**：缓存 `savedColors` 并用闭包传入回调：
```js
const savedColors = _loadColorTheme();
// ... 应用 CSS 变量 ...
window._applySavedThemeBg = function() {
    const bgColor = savedColors.bgPrimary;  // ← 直接用缓存的
    if (bgColor) {
        scene.background = new THREE.Color(bgColor);
        scene.fog = new THREE.Fog(bgColor, 12, 30);
    }
};
```

### 🟡 建议项

#### S1. `_resetPanelVisibility` 写入空对象
**位置**：[main.js:552](client/js/main.js#L552)
```js
_savePanelVisibility();
panelList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = true;
    _applyPanelVisibility(cb.dataset.panelId, true);
});
```
**问题**：先调用 `_savePanelVisibility()`，此时 checkbox 还是旧值，所以保存的是旧的 visibility 状态。然后才把 checkbox 设为 true。虽然最终结果正确（checkbox 都勾上了），但中间保存了一次错误状态到 localStorage。下次页面加载时如果恰好在 `_savePanelVisibility` 和 `forEach` 之间发生异常，状态会不一致。
**修复**：交换顺序——先设 checkbox，再保存：
```js
panelList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = true;
    _applyPanelVisibility(cb.dataset.panelId, true);
});
_savePanelVisibility();
```

#### S2. 颜色重置时字符串数组硬编码
**位置**：[main.js:541-542](client/js/main.js#L541)
```js
const defHex = ['#4cc9f0','#1a1a2e','#16213e','#10101c','#06d6a0','#ef476f'][i];
```
**问题**：默认颜色在 3 个地方重复定义——CSS 变量声明（`:root`）、重置按钮 JS、CSS 属性直接写入。如果以后改默认颜色，容易遗漏。
**修复**：将默认颜色定义为一个常量数组/对象，多处引用。不阻塞合并。

---

## 五、审计结论

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | ⭐⭐⭐⭐⭐ | 4 子菜单清晰，扩展性好 |
| 代码可读性 | ⭐⭐⭐⭐ | 分段注释到位 |
| 持久化完整性 | ⭐⭐⭐⭐⭐ | 所有设置持久化，try/catch 包裹 |
| 旧代码清理 | ⭐⭐⭐⭐⭐ | 旧 panel-vis-* 完全移除 |
| 性能 | ⭐⭐⭐ | B1 频繁写 localStorage |
| 正确性 | ⭐⭐⭐⭐ | B2 轻微浪费，S1 顺序问题 |

**结论**：⚠️ 本次提交需修 2 个必改项（B1/B2）和 1 个建议项（S1 顺序问题），修完后可合并。4 项扩展任务（网格 size 100、网格颜色、COLORS 集成、createBaseScene 清理）见[工作指令](work-brief-settings-grid.md)，由林在后续提交中实现。
