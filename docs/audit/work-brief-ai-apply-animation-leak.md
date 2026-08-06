# AI 修改参数后动画对象残留问题

> 2026-08-06 · 写给前端 AI 开发者

## 现象

AI 答疑中点击「✓ 应用」修改矩阵参数后，3D 画面出现大量重叠的箭头/线框——旧的动画对象没有被销毁，新的又叠加上去，画面越来越脏。

## 根因

`_applyAIParams()` 调用 `buildScene()` 时没有先清理 `this.sceneObjects`，而所有 28 个渲染器的 `buildScene()` 都假设自己面对的是一个空的 Group（只做 `group.add()`，从不做 `group.clear()`）。

### 两条调用路径对比

**正常路径**（`_computeAndRender()`，[scene-base.js:1387-1405](..\client\js\scene-base.js#L1387)）——正确：

```javascript
// 双缓冲：新 Group → 构建 → 替换旧 Group → 销毁旧 Group
const oldGroup = this.sceneObjects;
const newGroup = new THREE.Group();
this.threeScene.add(newGroup);
this.sceneObjects = newGroup;

try {
    this.buildScene(result.data);   // 在新 Group 里构建
} catch (buildErr) {
    this.threeScene.remove(newGroup);
    this._disposeRecursive(newGroup);
    this.sceneObjects = oldGroup;
    throw buildErr;
}

this.threeScene.remove(oldGroup);   // 移除旧 Group
this._disposeRecursive(oldGroup);   // 递归释放 geometry/material
```

**AI 应用路径**（`_applyAIParams()`，[scene-base.js:1200](..\client\js\scene-base.js#L1200)）——**有 bug**：

```javascript
// ❌ 直接在旧的 sceneObjects 上 buildScene()，旧对象原封不动
this.buildScene(result.data);
```

没有任何清理步骤，渲染器直接把新箭头/线框/平面叠到已有对象之上。

### 为什么每个渲染器都受影响

所有渲染器都遵循同一模式（以 [ch3_r1_two_vectors.js:10-15](..\client\js\renderers\ch3_r1_two_vectors.js#L10) 为例）：

```javascript
buildScene(data) {
    const group = this.sceneObjects;  // 拿到 Group，假设它是空的
    sd.vectors.forEach(v => {
        group.add(drawVector(...));   // 直接往里加
    });
}
```

没有一个渲染器在开头调用 `group.clear()` 或 `this._disposeRecursive(group)`。这个假设在正常路径下成立（因为刚 new 了一个空 Group），但在 AI 应用路径下不成立。

## 修复方案

**推荐：让 `_applyAIParams()` 复用已有的双缓冲逻辑。** 不需要在每个渲染器里加清理代码。

将 [scene-base.js:1198-1204](..\client\js\scene-base.js#L1198) 的：

```javascript
// 更新场景
this._lastComputeResult = result.data;
this.buildScene(result.data);
this._updateSolutionInfo(result.data);
this._updateLecturePanel(result.data);
this._updateVerifyPanel(result.data);
this._updateMatrixDisplay(result.data);
```

替换为复用 `_computeAndRender()` 中的双缓冲模式：

```javascript
// 更新场景（双缓冲，避免旧对象残留）
this._lastComputeResult = result.data;

const oldGroup = this.sceneObjects;
const newGroup = new THREE.Group();
this.threeScene.add(newGroup);
this.sceneObjects = newGroup;

try {
    this.buildScene(result.data);
} catch (buildErr) {
    this.threeScene.remove(newGroup);
    this._disposeRecursive(newGroup);
    this.sceneObjects = oldGroup;
    throw buildErr;
}

this.threeScene.remove(oldGroup);
this._disposeRecursive(oldGroup);

this._updateSolutionInfo(result.data);
this._updateLecturePanel(result.data);
this._updateVerifyPanel(result.data);
this._updateMatrixDisplay(result.data);
```

> 注意：需要确保 `THREE` 已在 `scene-base.js` 顶部 import。

## 涉及文件

| 文件 | 角色 |
|------|------|
| [scene-base.js:1200](..\client\js\scene-base.js#L1200) | **唯一需要修改的位置**——加双缓冲 |
| 28 个渲染器 | 不需要改——它们假设空 Group 是正确的设计 |

## 验证方法

1. 打开任意场景（推荐 ch3_r3_matrix_rank 或 ch0_r0_matrix_columns，动画对象多，容易观察）
2. 在 AI 答疑中发送「改成对角矩阵」
3. 点击 ✓ 应用
4. 观察 3D 画面：应该只有一组干净的箭头/线框，无重叠残留
5. 重复 2-4 多次，确认每次都是干净的
