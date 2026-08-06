# 工作日志 — 修复 AI 应用参数后动画对象残留

> 2026-08-06 · fix/scene/ai-apply-animation-leak

## 做了什么

修复 `scene-base.js` `_applyAIParams()` 方法：AI 答疑中点击「✓ 应用」修改矩阵参数后，调用 `buildScene()` 前没有清理旧 3D 对象，导致箭头/线框叠加残留。

## 怎么修的

将 `_applyAIParams()` 中直接调用 `buildScene()` 替换为与 `_computeAndRender()` 一致的双缓冲模式：new Group → buildScene → 替换旧 Group → dispose 旧 Group。异常路径也做了安全回退。

## 涉及文件

- `client/js/scene-base.js:1198-1221` — 唯一修改位置（+13 行双缓冲逻辑）

## 验证方法

1. 打开 ch3_r3_matrix_rank 或 ch0_r0_matrix_columns
2. AI 答疑中发送「改成对角矩阵」→ 点击 ✓ 应用
3. 观察 3D 画面：只有一组干净对象，无重叠
4. 重复多次，确认每次干净
