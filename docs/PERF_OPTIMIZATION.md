# 渲染性能优化建议

> 写给重构场景的 Claude，改 `client/js/scene-base.js` 即可，不影响任何场景渲染器。

## 问题诊断

滑块拖动或切换预设时，偶尔出现「加载中」短暂闪烁。根因有三个：

| 优先级 | 问题 | 位置 |
|--------|------|------|
| ⭐⭐⭐ | 加载遮罩过早显示导致闪烁 | `_computeAndRender()` |
| ⭐⭐ | KaTeX 每次重复渲染，阻塞 UI 线程 | `_updateLecturePanel()` |
| ⭐ | 节流窗口偏短，请求密度过高 | `_throttleCompute()` |

---

## 修改 1：加载遮罩加延迟门（主要问题）

**现象**：API 调用只需 50ms，但遮罩瞬间闪现又消失，肉眼可见。
**思路**：只有调用耗时超过 200ms 才显示遮罩，快的请求直接无感刷新。

**文件**：`client/js/scene-base.js`

找到 `_computeAndRender` 方法（约第 505 行），当前代码：

```js
async _computeAndRender(params, showLoading = false) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorOverlay = document.getElementById('error-overlay');

    if (showLoading) {
        loadingOverlay.style.display = 'flex';
    }
    errorOverlay.style.display = 'none';

    try {
        const result = await computeScene(this.meta.id, params);
        // ... 后续渲染逻辑不变 ...
```

改为：

```js
async _computeAndRender(params, showLoading = false) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorOverlay = document.getElementById('error-overlay');
    errorOverlay.style.display = 'none';

    // 加一个延迟门：请求超过 200ms 才显示遮罩，避免短暂闪烁
    let loadingTimer = null;
    if (showLoading) {
        loadingTimer = setTimeout(() => {
            loadingOverlay.style.display = 'flex';
        }, 200);
    }

    try {
        const result = await computeScene(this.meta.id, params);

        // 如果请求在 200ms 内就返回了，取消遮罩
        if (loadingTimer) clearTimeout(loadingTimer);
        loadingOverlay.style.display = 'none';

        // ... 后续渲染逻辑不变（从原 try 块 copy 过来即可）...
```

> ⚠️ 改完后注意把 `finally` 里的 `loadingOverlay.style.display = 'none';` 删掉（已经移到 try 块里了），或者保留也无妨。

---

## 修改 2：KaTeX 渲染结果缓存

**现象**：每次参数变化都重新调用 `katex.renderToString()`，它是同步的，会阻塞主线程。
**思路**：讲解内容在同一个场景内不变，缓存渲染后的 HTML，只有数据变了才重渲。

**文件**：`client/js/scene-base.js`

在 `_updateLecturePanel` 方法开头加缓存检查（约第 402 行）：

```js
_updateLecturePanel(data) {
    const panel = this._panel('lecture');
    if (!panel) return;

    if (!data.lecture || !data.lecture.sections || data.lecture.sections.length === 0) {
        panel.body.innerHTML = '';
        panel.hide();
        this._cachedLectureHTML = null;   // 新增：清除缓存
        return;
    }
    panel.show();

    // 新增：与上次数据相同则跳过
    const lectureKey = JSON.stringify(data.lecture);
    if (this._cachedLectureKey === lectureKey && this._cachedLectureHTML) {
        panel.body.innerHTML = this._cachedLectureHTML;
        return;
    }
    this._cachedLectureKey = lectureKey;

    // ... 后续原有的渲染逻辑不变，在最后加一行缓存 ...

    // 所有 sections 渲染完成后（innerHTML 赋值前）：
    this._cachedLectureHTML = html;
    panel.body.innerHTML = html;
}
```

> 需要新增两个实例属性，在 `constructor` 里初始化：
> ```js
> this._cachedLectureKey = null;
> this._cachedLectureHTML = null;
> ```

---

## 修改 3（可选）：放宽节流窗口

**文件**：`client/js/scene-base.js`

找到 `_throttleCompute`（约第 481 行），把 50ms 改成 80ms：

```js
_throttleCompute() {
    const now = performance.now();
    if (this._lastCompute && now - this._lastCompute < 80) {  // 原来是 50
        if (this._trailingTimer) clearTimeout(this._trailingTimer);
        this._trailingTimer = setTimeout(() => {
            this._lastCompute = performance.now();
            this._computeAndRender(this.params, false);
        }, 80);  // 原来是 50
        return;
    }
    // ... 后面不变
```

---

## 影响范围

- 只改 `client/js/scene-base.js` 一个文件
- 所有 18 个场景渲染器子类无需任何改动
- 与正在进行的场景重构零冲突
