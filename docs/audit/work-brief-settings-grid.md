# 工作指令：设置功能完善 + 网格缩放支持

> **发起**：AI 审计员（2026-08-06）
> **执行者**：林（AI 场景开发者）
> **审计日期**：待林提交后

---

## 背景

设置菜单的 HTML / CSS / JS 骨架已经存在（~80%），但有以下缺口需要补齐：

- HTML：[client/index.html:50-90](../client/index.html#L50)
- CSS：[client/css/style.css:208-447](../client/css/style.css#L208)
- JS：[client/js/main.js:212-608](../client/js/main.js#L210)

---

## 一、扩大网格 size 范围（⭐⭐ 优先级高）

**问题**：当前网格 size 上限为 30（覆盖 -15 到 15）。大矩阵场景（如高斯消元、特征值）需要更大范围。

**改法**：[main.js:320](client/js/main.js#L320) 将 `'30'` 改为 `'100'`。

同时检查 [main.js:745-754](client/js/main.js#L745) `_loadGridSettings` 的默认值是否需要同步调整（当前 `{ size: 10, divisions: 10 }`，默认值不变即可，只改上限）。

---

## 二、网格颜色可编辑（⭐⭐ 优先级高）

**问题**：[main.js:769](client/js/main.js#L769) `updateGridRenderer()` 的网格颜色写死为 `0x333355`（主线）和 `0x222240`（辅线）。用户无法自定义。

**改法**：

1. **在设置菜单「3D 网格渲染距离」子菜单中增加颜色选择器**（[main.js:286-322](client/js/main.js#L282) 区域）：

   - 新增一个 `div.settings-grid-row`，内含 `<label>颜色</label>` + `<input type="color">` + 色值显示
   - 从 `localStorage` 读取保存的网格颜色，默认值 `#333355`
   - 持久化到 `la_grid_settings`（扩展现有 `{ size, divisions }` 结构，增加 `color` 和 `subColor` 字段）

2. **修改 `updateGridRenderer()`**（[main.js:757-775](client/js/main.js#L757)）：

   - 从 `_loadGridSettings()` 读取 `color` / `subColor`
   - 将新的颜色值传入 `THREE.GridHelper(size, divisions, color, subColor)`

3. **`_saveGridSettings()` 同步扩展**（[main.js:753](client/js/main.js#L753)）

4. **重置按钮同步更新**（[main.js:504-510](client/js/main.js#L504)）：重置时恢复默认颜色

---

## 三、清理死代码 `createBaseScene()`（⭐ 优先级低）

**问题**：[draw-utils.js:34-66](client/js/draw-utils.js#L34) 的 `createBaseScene()` 导出了但**没有任何 renderer 调用**（已在两个 agent 中确认）。它内部创建的 `GridHelper(10, 10)` 永远不会被设置系统影响。

**改法**：
- 删除 `createBaseScene()` 函数体（保留注释说明该函数已废弃）
- 或者直接整个删除，同时删除 `COLORS.grid` 中对它的引用（如果 COLORS.grid 有其他使用者则保留）

---

## 四、COLORS 对象接入设置系统（⭐ 优先级中）

**问题**：[draw-utils.js:12-27](client/js/draw-utils.js#L12) 的 `COLORS` 对象是硬编码常量。设置菜单的颜色主题只能改 CSS 变量和场景背景，**无法影响 3D 元素**（向量、平面、坐标轴、网格等）。

**设计选择**（请选择一种）：

### 方案 A：全局配置对象（推荐）

```js
// draw-utils.js 顶部新增
window._laDrawConfig = {
    colors: { ...COLORS },  // 可被设置菜单覆盖
};

// COLORS 改为从配置读取（保持向后兼容）
export const COLORS = new Proxy(window._laDrawConfig.colors, {
    get(target, prop) { return target[prop]; }
});
```

设置菜单修改 `window._laDrawConfig.colors` 后，渲染器下次 `_computeAndRender` 时自然使用新颜色。

**优点**：侵入性最小，无需改 24 个渲染器。
**缺点**：需要 `Proxy`（所有现代浏览器支持）。

### 方案 B：draw-utils 函数接受颜色参数

给 `drawVector()`、`drawPlane()` 等函数增加可选的 `color` 参数，覆盖全局默认值。

**优点**：更显式。
**缺点**：需要改 24 个渲染器的调用方式，工作量大。

**建议**：先用方案 A 做全局默认色配置，后续场景如需独立颜色可再加方案 B。

### 颜色主题子菜单扩展

在「颜色主题」（[main.js:422-493](client/js/main.js#L418)）中增加以下 3D 专属颜色项：

| 配置项 | 默认值 | 对应 COLORS 字段 |
|--------|--------|------------------|
| 网格线色 | `#333355` | `grid` |
| 向量1色 | `#ff6b6b` | `vector1` |
| 向量2色 | `#4ecdc4` | `vector2` |
| 向量3色 | `#ffd93d` | `vector3` |
| 平面1色 | `#ff6b6b` | `plane1` |
| 平面2色 | `#4ecdc4` | `plane2` |
| 坐标轴X | `#ff4444` | `axisX` |
| 坐标轴Y | `#44ff44` | `axisY` |
| 坐标轴Z | `#4488ff` | `axisZ` |

颜色变更后需触发场景重绘（调用当前 renderer 的 `_computeAndRender`）。

---

## 五、验证清单

完成后请逐一确认：

- [ ] ⚙ 按钮在 3D 视图右上角可见，点击弹出设置菜单
- [ ] 4 个子菜单均可折叠/展开，折叠状态刷新后保持
- [ ] 面板可见性 checkbox 即时生效
- [ ] 网格「范围」滑块拖到 100，3D 视图中的网格正确扩展到 100×100
- [ ] 网格「密度」滑块改变网格线数量
- [ ] 网格颜色选择器修改后，3D 视图中的网格线颜色即时更新
- [ ] 参数范围修改后，场景的参数滑块被重建，区间正确变化
- [ ] 颜色主题修改后，3D 元素颜色正确变化（如果做了方案 A）
- [ ] 重置按钮恢复所有设置为默认值
- [ ] 点击菜单外空白处关闭菜单
- [ ] 所有新设置项持久化到 localStorage，刷新后恢复
- [ ] 切换场景不会丢失设置
- [ ] `createBaseScene()` 已清理

---

## 六、关键约束（不可违反）

1. **所有计算在后端**：前端只做渲染，不实现任何数学逻辑
2. **面板操作走 PanelManager**：禁止 `document.getElementById()` 操作面板
3. **CSS 驱动排版**：新增 UI 元素使用已有的 CSS 类名规范
4. **localStorage key 遵循 `la_` 前缀**：新 key 命名为 `la_*` 格式
5. **兼容 24 个已有场景**：任何修改不得破坏现有场景的渲染

---

## 七、参考文件

| 文件 | 关键行号 | 内容 |
|------|---------|------|
| [client/index.html](client/index.html) | 50-90 | 设置菜单 HTML 结构 |
| [client/css/style.css](client/css/style.css) | 208-447 | 设置菜单 CSS |
| [client/js/main.js](client/js/main.js) | 212-608 | 设置菜单 JS（initSettingsMenu IIFE） |
| [client/js/main.js](client/js/main.js) | 737-775 | 网格初始化和 updateGridRenderer() |
| [client/js/draw-utils.js](client/js/draw-utils.js) | 12-27 | COLORS 常量 |
| [client/js/draw-utils.js](client/js/draw-utils.js) | 34-66 | createBaseScene()（待清理） |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | 39-50 | localStorage key 表（需要更新） |
| [docs/DEV_GUIDE.md](DEV_GUIDE.md) | 249-259 | localStorage key 表（需要更新） |

---

> **给林**：优先做一、二（网格 size + 颜色），然后做四（COLORS 接入）。三（清理死代码）顺手做掉。完成后告诉我，我来审计。
