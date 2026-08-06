# 工作日志：项目健康度审查与修复

> 2026年8月6日 · 从用户视角 + 项目管理视角的双重审查

## 一、审查方法论

### 为什么做这个？

用户要求站在两个视角审视项目：
1. **用户视角**：安全、内存泄露、稳定性、浏览器兼容
2. **项目管理视角**：架构、可维护性、文档同步、死代码

### 审查流程（可复用）

```
第一步：逐文件阅读关键路径代码
  - scene-base.js（所有场景的基类，影响最大）
  - panel-system.js（面板系统核心）
  - main.js（入口文件）
  - main.py（后端入口）
  - style.css（全局样式）

第二步：针对每个文件问三个问题
  1. 资源生命周期是否完整？（创建→使用→销毁）
  2. 异常路径是否被处理？
  3. 是否有从未生效的代码？

第三步：交叉验证文档
  - CLAUDE.md vs 实际代码（场景数、节流值）
  - ARCHITECTURE.md vs 实际代码（实现细节）

第四步：按严重程度排序，逐项修复
```

### 给以后 AI 的建议

做这种审查时，**不要只看代码表面逻辑**。要追踪资源生命周期。比如：
- 看到 `new CanvasTexture(...)` → 立刻问：哪里 dispose？
- 看到 `requestAnimationFrame(...)` → 立刻问：哪里 cancel？
- 看到 `new THREE.Group()` 被赋值 → 立刻问：旧的 Group 去哪了？

---

## 二、发现的问题与修复

### 严重 ⚠️：3 个内存泄露

#### 1. 纹理泄露（_disposeRecursive 不释放纹理）

**症状**：拖动滑块时 JS heap 持续增长，最终页面变卡。

**根因**：`scene-base.js` 的 `_disposeRecursive()` 只释放了 `geometry.dispose()` 和 `material.dispose()`，但 Canvas 2D 生成的 `CanvasTexture` 从未释放。每个标签精灵对应一个纹理，每次重渲染都创建新的。

**修复**：在 material.dispose() 之前检查并释放 `map`、`emissiveMap`、`alphaMap`。

#### 2. 动画 rAF 泄漏

**症状**：动画播放中切换场景，偶尔白屏或报 WebGL 错误。

**根因**：10 个动画场景通过 `requestAnimationFrame` 驱动动画循环，但 `destroy()` 时未取消 rAF。回调在对象销毁后触发，访问已 dispose 的 BufferGeometry。

**修复**：`destroy()` 中设置 `_animating = false` 并 `cancelAnimationFrame(_animFrameId)`。（注：有 10 个渲染器未存储 rAF ID，但 `_animating = false` 守卫使回调立即返回，实际无害。）

#### 3. 双缓冲异常泄漏

**症状**：`buildScene()` 抛异常后，场景残留空白 Group。

**根因**：`_computeAndRender()` 先创建 newGroup 并赋值 `this.sceneObjects = newGroup`，再调用 `buildScene()`。如果 `buildScene` 抛异常，newGroup 留在了 threeScene 中，oldGroup 未被移除。

**修复**：try-catch 包裹 `buildScene()`，异常时回退 `this.sceneObjects`。

---

### 高：3 个功能 Bug

#### 4. 面板尺寸恢复从未生效

**发现过程**：读 `panel-system.js` 时注意到 `_restoreSize()` 在 `this.el` 赋值前被调用，而 `_restoreSize()` 内部第一行就是 `this.el.style`。空 catch 块静默吞下了 TypeError。

**影响**：用户拖拽调整面板大小后刷新——尺寸不会恢复。这个功能从项目第一天起就没工作过。

**修复**：`_restoreSize()` 移到 `this.el = el` 之后。

#### 5. WebGL 不可用时白屏

**修复**：`main.js` 中 WebGLRenderer 创建前加检测，失败时用 `#error-overlay` 显示友好提示。

#### 6. 错误覆盖层无操作按钮

**修复**：`index.html` + `scene-base.js` 增加遮罩背景、重试按钮、关闭按钮，`_showError()` 保存重试参数。

---

### 中：文档同步

- CLAUDE.md 场景数 18→24，6 个已实现场景从「待建」移除
- ARCHITECTURE.md 节流值 50ms→80ms
- CLAUDE.md 从 263 行精简到 198 行（场景表合并、常见操作精简为指针）
- 新增 AI 行为守则（CLAUDE.md §11 + DEV_GUIDE.md §12-13）

### 低：死代码清理

- `scene-base.js`: 删除未使用的 `_debounceTimer`
- `main.js`: 删除未使用的 `getDefaultParams()`
- `main.py`: 删除未使用的 `MathEngine` import

### 意外发现：与另一个 AI 的修改重叠

v1.8.3（另一个 AI 提交）也修改了 `style.css` 中的 `--text-muted` 对比度，从 `#666680` 到 `#8888a0`——和本次审查的修复完全一致。这说明对比度问题是肉眼可见的，两个 AI 独立发现了它。

---

## 三、审查结果总结

| 类别 | 数量 | 严重程度 |
|------|------|----------|
| 内存泄露 | 3 | ⚠️ 严重 |
| 功能 Bug | 3 | 🔴 高 |
| 文档过时 | 4 | 🟡 中 |
| 死代码 | 3 | 🟢 低 |
| 无障碍改善 | 2 | 🔵 已修 |

**未修的遗留项**（需独立处理）：
- 工厂函数去重：`createUpdatableWireframe` 等在 9 个文件中重复
- rAF ID 存储：10 个渲染器未保存 rAF 返回 ID
- 零自动化测试

---

## 四、给以后 AI 的审查清单

做同类审查时，按以下顺序扫描：

1. **资源生命周期**：搜索 `new THREE.` → 检查是否有对应 dispose
2. **异步清理**：搜索 `requestAnimationFrame` / `setTimeout` / `setInterval` → 检查 destroy 中是否取消
3. **异常安全**：搜索 `try {` → 检查 catch 块是否真的处理了问题（还是空块）
4. **文档一致性**：grep 场景数 / 端口号 / 版本号 → 对照实际代码
5. **死代码**：搜索 `import` + 未使用的变量 → 删除
