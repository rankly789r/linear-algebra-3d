# 触摸适配方案

> 目标：让项目在平板等触屏设备上完整可用，面板拖拽、子面板换位、resize 全部支持手指操作。

## 一、现状分析

项目有三处拖拽交互，实现方式各不相同：

| # | 位置 | 功能 | 当前实现 | 移动端兼容性 |
|---|------|------|----------|-------------|
| 1 | `scene-base.js:796` | 子面板（基础讲解/AI答疑）拖拽换位 | `mousedown/mousemove/mouseup` | ❌ 触摸无效 |
| 2 | `panel-system.js:180` | 面板 resize 手柄拖拽 | `mousedown/mousemove/mouseup` | ❌ 触摸无效 |
| 3 | `panel-system.js:701-748` | 面板在停靠区之间拖拽 | **HTML5 Drag and Drop API** | ❌ 移动端完全不支持 |

## 二、策略

**统一用 Pointer Events（`pointerdown`/`pointermove`/`pointerup`）替换所有鼠标事件和 HTML5 Drag API。**

理由：
- Pointer Events 是 W3C 标准，同时覆盖鼠标和触摸，一套代码两种输入
- 现代浏览器全部支持（Chrome 55+ / Safari 13+ / Edge 12+ / Firefox 59+），平板和桌面都覆盖
- 无需维护两套镜像的事件处理器
- `e.clientX`/`e.clientY` 在 Pointer Events 中同样可用

## 三、逐项改动

### 改动 1：子面板拖拽换位（scene-base.js）

**文件**：`client/js/scene-base.js` · `_initSubPanelDrag()` 方法

**改动量**：约 10 行（替换事件名）

**改动内容**：
- `mousedown` → `pointerdown`
- `mousemove` → `pointermove`
- `mouseup` → `pointerup`
- `mousedown` 回调中加一行 `subPanel.setPointerCapture(e.pointerId)` 防止手指移出元素后丢失跟踪
- 清理函数同步替换事件名

### 改动 2：面板 resize 手柄（panel-system.js）

**文件**：`client/js/panel-system.js` · `_bindResizeEvents()` 方法

**改动量**：约 10 行（替换事件名）

**改动内容**：
- `mousedown` → `pointerdown`
- `mousemove` → `pointermove`
- `mouseup` → `pointerup`
- `pointerdown` 回调中加 `handle.setPointerCapture(e.pointerId)`
- `cursor` 样式设置保留（触摸时不显示光标，不影响功能）

### 改动 3：面板停靠拖拽（panel-system.js）⚠️ 主要工作量

**文件**：`client/js/panel-system.js` · 涉及方法：`_bindDragEvents`、`_onDragStart`、`_onDragEnd`、`_onDragOver`、`_onDragLeave`、`_onDrop`、`_getInsertionIndex`、`_showInsertionIndicator`、`_clearInsertionIndicator`

**改动量**：约 120-150 行（新增 + 修改）

**原因**：HTML5 Drag and Drop API 无法在移动端工作，需完整重写为 Pointer Events 驱动的拖拽流程。

**设计方案**：

```
Pseudo-code for the unified drag flow:

_bindDragEvents() {
    for each panel:
        header.addEventListener('pointerdown', (e) => this._onPointerDown(e, panel));
}

_onPointerDown(e, panel) {
    e.preventDefault();
    header.setPointerCapture(e.pointerId);

    this._dragState = {
        panelId: panel.id,
        sourceZoneId: panel.zone?.id,
        startX: e.clientX,
        startY: e.clientY,
        ghost: null,           // 跟手的半透明元素
        moved: false,          // 死区判断
    };
}

// 全局 pointermove（document 级别，手指可能移出面板头）
_onPointerMove(e) {
    if (!this._dragState) return;

    // 死区 6px（区分点击和拖拽）
    const dx = e.clientX - this._dragState.startX;
    const dy = e.clientY - this._dragState.startY;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;

    if (!this._dragState.moved) {
        this._dragState.moved = true;
        // 创建跟随手指的半透明 ghost（替代 HTML5 setDragImage）
        this._createDragGhost(panel);
        panel.el.classList.add('dragging');
        document.body.classList.add('is-dragging');
    }

    // 更新 ghost 位置
    this._moveDragGhost(e.clientX, e.clientY);

    // 检测当前手指悬停在哪个 dock zone
    const zone = this._findZoneAt(e.clientX, e.clientY);
    if (zone !== this._dragState.hoveredZone) {
        // 离开旧 zone
        if (this._dragState.hoveredZone) {
            this._dragState.hoveredZone.el.classList.remove('drag-over');
            this._dragState.hoveredZone._clearInsertionIndicator();
        }
        // 进入新 zone
        this._dragState.hoveredZone = zone;
        if (zone) {
            zone.el.classList.add('drag-over');
        }
    }

    // 在 hoveredZone 内显示插入指示线
    if (zone) {
        zone._showInsertionIndicator(zone._getInsertionIndex(e));
    }
}

_onPointerUp(e) {
    if (!this._dragState) return;

    const { panelId, sourceZoneId, hoveredZone, moved, ghost } = this._dragState;

    // 清理 ghost
    if (ghost) ghost.remove();

    // 清理所有 zone 的状态
    for (const [_, zone] of this.zones) {
        zone.el.classList.remove('drag-over');
        zone._clearInsertionIndicator();
        const col = zone.el.parentElement;
        if (col) col.classList.remove('drag-expand');
    }

    if (moved && hoveredZone) {
        const index = hoveredZone._getInsertionIndex(e);
        window.panelManager.movePanel(panelId, hoveredZone.id, index);
    }

    // 重置
    const panel = this.panels.get(panelId);
    if (panel) panel.el.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    this._dragState = null;
}
```

**关键点**：

1. **Ghost 元素**：`position: fixed`，`pointer-events: none`，跟随手指偏移 10px（以免被手指遮挡）。样式与当前 HTML5 drag image 一致：`background: #0f3460; color: #4cc9f0; border: 1px solid #4cc9f0; padding: 6px 14px; border-radius: 4px;`（CSS 中已有 `.panel-drag-ghost` 备用，直接用）
2. **Zone 碰撞检测**：`_findZoneAt(x, y)` 用 `document.elementFromPoint(x, y)` 向上查找最近的 `.dock-zone` 元素（指针事件期间临时将 ghost 设为 `pointer-events: none` 后调用）
3. **死区**：复用 scene-base.js 的 6px 策略，区分点击（折叠/展开）和拖拽
4. **捕获**：`setPointerCapture` 确保手指滑动到面板外也不会丢失事件
5. **事件注册位置**：`pointerdown` 注册在 header 上；`pointermove` 和 `pointerup` 注册在 `document` 上（与现有 mouse 模式一致）
6. **停靠区展开**：空列悬停展开逻辑从 `_onDragOver` 移到 `_onPointerMove` 中，检测到 `hoveredZone.isEmpty()` 时给列添加 `drag-expand` 类

## 四、CSS 补充

约 15 行。需新增的样式：

```css
/* 拖拽时的半透明跟随标签（替代 HTML5 drag image） */
.panel-drag-ghost {
    position: fixed;
    pointer-events: none;
    z-index: 10000;
    padding: 6px 14px;
    background: #0f3460;
    color: #4cc9f0;
    border: 1px solid #4cc9f0;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0.9;
    transform: translate(10px, 10px); /* 偏移，不被手指遮住 */
}
```

已有样式无需改动：`.dragging`、`.drag-over`、`.drag-expand`、`.is-dragging`、`insertion-indicator`、`sub-panel-insertion-indicator` 全部复用。

## 五、涉及文件汇总

| 文件 | 改动类型 | 行数估计 |
|------|----------|----------|
| `client/js/scene-base.js` | 替换事件名 + 加 setPointerCapture | ~10 |
| `client/js/panel-system.js` | 重写拖拽 + 替换 resize 事件 | ~150 |
| `client/css/style.css` | 新增 ghost 样式 | ~15 |
| **合计** | | **~175 行** |

## 六、不改变的内容

- 面板拖拽后的布局持久化（`localStorage`）——逻辑不变
- 子面板顺序持久化——逻辑不变
- Resize 吸附（`_applySnap`）——逻辑不变
- 插入指示线（`_showInsertionIndicator` / `_clearInsertionIndicator`）——逻辑不变
- `movePanel()` 方法——逻辑不变

## 七、兼容性说明

- **Pointer Events 支持情况**：Chrome 55+ / Safari 13+ / Edge 12+ / Firefox 59+，覆盖 iPadOS 13+ 上所有主流浏览器
- **桌面端不受影响**：Pointer Events 完全向后兼容鼠标，桌面端拖拽体验不变
- **`setPointerCapture`**：防止触摸事件在手指移出元素后丢失，桌面鼠标操作下等同于默认行为

## 八、测试用例

| # | 场景 | 操作 | 预期 |
|---|------|------|------|
| 1 | 桌面浏览器 | 鼠标拖拽面板到另一停靠区 | 正常停靠 |
| 2 | 桌面浏览器 | 鼠标拖拽 resize 手柄 | 正常 resize |
| 3 | 桌面浏览器 | 鼠标拖拽子面板换位 | 正常换位 |
| 4 | 桌面浏览器 | 点击子面板折叠按钮 | 正常折叠（不触发拖拽） |
| 5 | 平板浏览器 | 手指拖拽面板到另一停靠区 | 正常停靠 |
| 6 | 平板浏览器 | 手指拖拽 resize 手柄 | 正常 resize |
| 7 | 平板浏览器 | 手指拖拽子面板换位 | 正常换位 |
| 8 | 平板浏览器 | 手指点击子面板折叠按钮 | 正常折叠（不触发拖拽） |
| 9 | 平板浏览器 | 手指轻触场景导航菜单项 | 正常切换场景（不触发拖拽） |
