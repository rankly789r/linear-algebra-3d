# 审计报告 — 2026-08-07

**审计范围**：两个分支 vs master
- `feat/panel/touch-adaptation`（面板负责人：触屏适配实现，1 commit `0f1832c`）
- `fix/panel/ai-apply-double-click`（副面板负责人：AI 修复 + 文档清理 + app.py 绑定，2 commits `e1e09cd` + `7eee2fc`）

**分支拓扑**：
```
* 0f1832c feat: 触屏适配 (feat/panel/touch-adaptation)
| * 7eee2fc fix: app.py 绑定 0.0.0.0 (fix/panel/ai-apply-double-click)
| * e1e09cd fix: AI参数应用 + 文档清理
|/  
* 45fc8a2 fix: certifi (master)
```

**合并安全性**：两个分支修改 `scene-base.js` 的不同区域（触屏 ~713-803，AI 修复 ~1140-1220），无冲突。合并顺序建议：先 `fix/panel/ai-apply-double-click`，后 `feat/panel/touch-adaptation`。

## 问题汇总

| # | 严重度 | 文件:行号 | 问题简述 |
|---|--------|----------|----------|
| 1 | 🟡 | `panel-system.js:_onPointerMove` | 缺少 `pointercancel` 处理——指针中断后 ghost 残留 |
| 2 | 🟡 | `scene-base.js:_initSubPanelDrag` | 同样缺少 `pointercancel` 处理 |
| 3 | 🟡 | `scene-base.js:_initSubPanelDrag` | 子面板 header 未设置 `touch-action: none` |

> 无 🔴 或 ⚠️ 级别问题。

## 详细分析

### 🟡 #1：panel-system.js 缺少 pointercancel 处理

- **位置**：`client/js/panel-system.js` — `_onPointerMove()` / `_onPointerUp()`
- **症状**：平板拖拽面板时如果接到电话、通知中心下拉等导致指针中断，ghost 元素和 `.dragging` class 会残留在页面上，面板显示异常直到下次拖拽
- **根因**：只监听了 `pointerup`，未监听 `pointercancel`。浏览器中断触摸时触发 `pointercancel` 而非 `pointerup`
- **修复**：在 `_bindDragEvents()` 中加一行：
  ```js
  document.addEventListener('pointercancel', (e) => this._onPointerUp(e));
  ```
  `_onPointerUp` 现有的清理逻辑（ghost.remove + class 清理 + dragState=null）已经足够，直接复用即可
- **验证**：无法在桌面模拟，需在平板上拖拽中途下拉通知中心

### 🟡 #2：scene-base.js 缺少 pointercancel 处理

- **位置**：`client/js/scene-base.js` — `_initSubPanelDrag()`
- **症状**：同上，子面板拖拽中断后插入指示线残留
- **修复**：
  ```js
  document.addEventListener('pointercancel', onPointerUp);
  ```
  并在清理函数中同步移除
- **验证**：同上

### 🟡 #3：子面板 header 未设置 touch-action: none

- **位置**：`client/js/scene-base.js:796`（`_initSubPanelDrag`）
- **症状**：在部分移动浏览器上，手指在子面板标题栏上滑动可能触发面板内容滚动而非拖拽
- **根因**：`panel-system.js` 的面板拖拽在 header 上设置了 `touch-action: none`（正确），但 `scene-base.js` 的子面板拖拽遗漏了这个设置。`pointerdown` 注册在 `container` 上，浏览器可能在事件到达前就消费了触摸手势
- **修复**：在 `_initSubPanelDrag` 中，对 container 内所有 `.lecture-sub-panel-header` 设置 `touch-action: none`，或直接在 CSS 中加：
  ```css
  .lecture-sub-panel-header { touch-action: none; }
  ```
- **验证**：平板上拖拽子面板标题栏，确认不触发滚动

## 正面发现

### 面板负责人（触屏适配）

1. **代码质量高**：Pointer Events 迁移做得干净利落。事件名替换无遗漏，`setPointerCapture`/`releasePointerCapture` 配对正确，清理逻辑完整
2. **架构决策正确**：`dockZone` 反向引用（`this.el.dockZone = this`）是简洁的 DOM→对象关联方案，比维护全局 Map 更优雅
3. **向后兼容好**：`_getInsertionIndex`、`_showInsertionIndicator`、`_clearInsertionIndicator` 等方法完全不动，证明事件层和业务逻辑层解耦良好
4. **CSS 复用**：`.dragging`、`.drag-over`、`.drag-expand`、`.is-dragging`、`.insertion-indicator` 全部复用，新增的只有 `.panel-drag-ghost` 一个类
5. **Ghost 设计**：`position: fixed` + `pointer-events: none` + CSS class 管理，比旧代码的 `requestAnimationFrame(() => ghost.remove())` 更可控

### 副面板负责人（AI 修复 + 文档清理）

1. **Bug 根因分析准确**：`_applied` 在 `await` 之后 → 重渲染复活卡片，一针见血
2. **修复方案好**：`cardEl.remove()` 替代 `_replaceToolCard`——3D 画面已变，不需要额外确认文字
3. **文档清理彻底**：22 文件 3786 行删除，`AI_CHAT_PROMPT.md` 配套文件引用同步更新，`AI_TOOLS_REFERENCE.md` 的 `certifi.where()` → `verify=True` 也已更新
4. **app.py 修正**：`127.0.0.1` → `0.0.0.0`，配合触屏适配让平板能访问

## 建议优先级

**合并前建议修**：🟡 #3（sub-panel `touch-action: none`）——一行 CSS，几秒钟的事
**合并后修**：🟡 #1、#2（pointercancel）——概率低，不影响功能，可以后续补

## 合并建议

**两个分支都可以合并。**

合并顺序：
```
1. git checkout master
2. git merge --no-ff fix/panel/ai-apply-double-click   # 副面板负责人的修复
3. git merge --no-ff feat/panel/touch-adaptation       # 面板负责人的触屏适配
```

两个分支的 `scene-base.js` 改动在不同行号范围（触屏 713-803，AI 修复 1140-1220），不会冲突。合并后建议先在桌面验证，再上平板测试全部 10 个测试用例（见 TOUCH_ADAPTATION_PLAN.md 第八节）。
