# AI 场景开发者指南

> **给任何要新增或修改场景的 AI（或人类）——开工前逐节阅读，避免踩坑。**

## 一、全局架构速览

在开始写代码之前，先搞清楚数据是怎么流动的：

```
用户拖滑块 / 点预设
    ↓
scene-base.js: _throttleCompute() / _computeAndRender()
    ↓
POST /api/scene/{name}  →  server/main.py  →  SCENE_REGISTRY[name].compute(params)
    ↓
server/scenes/chX_rY_name.py  →  math_engine.py (NumPy/SciPy)
    ↓ 返回 JSON: { scene_data, verification, solution_info, lecture }
    ↓
scene-base.js: _computeAndRender()
    ├── buildScene(data)          ← 你写的 3D 渲染逻辑（新 Group，双缓冲）
    ├── _updateSolutionInfo()     ← 自动渲染解信息
    ├── _updateLecturePanel()    ← 自动渲染讲解
    ├── _updateMatrixDisplay()   ← 自动渲染矩阵（如果 data.scene_data.matrices 存在）
    └── _updateVerifyPanel()     ← 自动渲染验证结果
```

**关键原则**：
- Python 做所有数学计算，前端只渲染——`client/js/` 下不得出现矩阵运算
- 每个场景是独立模块，崩一个不影响其他
- 矩阵显示、面板管理、参数绑定全部由基类自动处理——你不需要写

## 二、新增场景六步清单

每次新增场景必须完成这六步，缺一不可：

| 步骤 | 文件 | 做什么 |
|------|------|--------|
| 1 | `server/scenes/chX_rY_name.py` | 后端：实现 `get_meta()` + `compute()` |
| 2 | `client/js/renderers/chX_rY_name.js` | 前端：实现 `buildScene(data)` |
| 3 | `server/main.py` | 注册：import + `SCENE_REGISTRY` |
| 4 | `client/js/main.js` | 注册：import + `SCENE_RENDERERS` + `getSceneMeta()` |
| 5 | `client/js/main.js` → `buildNavPanel()` | 菜单：添加场景按钮 |
| 6 | 浏览器验证 | 检查 3D 渲染、矩阵、预设、滑块、验证面板 |

## 三、Python 后端：标准模板

### 3.1 文件结构

```python
"""
场景 X.Y：场景标题
简要描述这个场景展示什么数学概念。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class ChXRYName(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "chX_rY_name",            # 与文件名一致，用下划线
            "title": "X.Y 场景标题",          # 显示在场景信息区
            "chapter": "第X章",               # 用于面包屑导航
            "description": "一句话描述场景展示的数学概念。",
            "params": { ... },               # 参数定义（见 3.2）
            "presets": [ ... ],              # 3-5 个预设（见 3.3）
        }

    def compute(self, params: SceneParams) -> dict:
        # 1. 提取参数
        # 2. 用 M.xxx() 做数学计算
        # 3. 构建 scene_data
        # 4. 构建 verification
        # 5. 构建 solution_info
        # 6. 构建 lecture（可选）
        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            "lecture": {"sections": [...]},  # 可选
        }
```

### 3.2 参数定义

```python
"params": {
    "a11": {"label": "a₁₁", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
    "count": {"label": "数量", "type": "int", "default": 3, "min": 1, "max": 10, "step": 1},
    "mode": {"label": "模式", "type": "choice", "default": "A", "options": ["A", "B", "C"]},
    # 动态矩阵参数（配合 matrix 类型使用）：
    "A_rows": {"label": "A 行数", "type": "int", "default": 2, "min": 1, "max": 5, "step": 1},
    "A_cols": {"label": "A 列数", "type": "int", "default": 3, "min": 1, "max": 5, "step": 1},
    "matrix_A": {"label": "矩阵 A", "type": "matrix", "default": [[1,0,0],[0,1,0]]},
}
```

**命名规范**：
- 参数 key 用英文蛇形命名（`a11`, `vector1_x`）
- 标签用中文 + Unicode 下标（`"a₁₁"`, `"v₁_x"`）
- `step` 决定了滑块精度，一般 float 用 `0.1`，int 用 `1`
- `min`/`max` 范围不宜过大（±5 通常足够），过大导致 3D 场景溢出

### 3.3 预设类型

```python
"presets": [
    {"label": "唯一解", "type": "unique", "params": {...}},
    {"label": "无解", "type": "none", "params": {...}},
    {"label": "无穷多解", "type": "infinite", "params": {...}},
    {"label": "退化情形", "type": "degenerate", "params": {...}},
]
```

| type | 左边框颜色 | 含义 |
|------|-----------|------|
| `unique` | 蓝色 | 满秩/唯一解 |
| `none` | 红色 | 降秩/无解 |
| `infinite` | 绿色 | 无穷多解 |
| `degenerate` | 橙色 | 退化/边界情形 |

每个场景 **3-5 个预设**，覆盖教学中的典型情形。

### 3.4 compute() 方法详解

```python
def compute(self, params: SceneParams) -> dict:
    # ── 第 1 步：提取参数 ──
    # 用 params.get(key, default) 提取，default 必须与 get_meta 中的 default 一致
    a11 = float(params.get("a11", 1))
    a12 = float(params.get("a12", 0))
    # ...

    # ── 第 2 步：数学计算 ──
    # 必须通过 math_engine 调用，不要手写算法！
    A = np.array([[a11, a12, a13], [a21, a22, a23], [a31, a32, a33]], dtype=float)
    det = M.matrix_determinant(A)
    rank = M.matrix_rank(A)

    # ── 第 3 步：构建 scene_data ──
    # 这是传给前端的核心数据，前端 buildScene(data) 从这里读取
    scene_data = {
        # 矩阵数据（有则自动显示矩阵面板，无需前端代码）
        "matrices": [
            {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
        ],
        # 场景特定的几何数据
        # 坐标用 list 格式: [x, y, z]，不要用 NumPy array！
        "vectors": [
            {"components": [1.0, 0.0, 0.0], "color": 0xff6b6b, "label": "v₁"},
        ],
        "some_value": float(some_result),
    }

    # ── 第 4 步：构建 verification ──
    # 每个 check 有 label 和 passed，独立验证计算结果
    verification = self.make_verification([
        {"label": f"det(A) = {det:.4f}", "passed": True},
        {"label": f"r(A) = {rank}", "passed": True},
        {"label": "r(A)=3 ⇔ det≠0", "passed": (rank == 3) == (abs(det) > 1e-8)},
    ])

    # ── 第 5 步：构建 solution_info ──
    solution_info = {
        "type": "unique",  # "unique" | "none" | "infinite"
        "description": "解的中文说明，会显示在分析结果面板中。",
        "details": {
            "r(A)": str(rank),
            "det(A)": f"{det:.4f}",
        },
    }

    # ── 第 6 步：构建 lecture（可选）──
    lecture_sections = [
        {
            "title": "小节标题",
            "content": (
                "支持 **粗体** 和行内公式 $x^2 + y^2 = 1$。\n"
                + "独立公式用双美元：$$\nA = \\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}\n$$"
            ),
        },
    ]

    return {
        "scene_data": scene_data,
        "verification": verification,
        "solution_info": solution_info,
        "lecture": {"sections": lecture_sections},
    }
```

### 3.5 Python 常见陷阱

| 陷阱 | 症状 | 正确做法 |
|------|------|----------|
| NumPy array 未转 list | JSON 序列化失败 | `A.tolist()` |
| LaTeX 反斜杠转义错误 | KaTeX 渲染失败 | Python f-string 中 `\\begin`→前端收到 `\begin` |
| 参数提取忘记 float() | 类型错误 | `float(params.get("a11", 1))` |
| scene_data 中的值是 numpy 标量 | JSON 序列化失败 | `float(val)` 或 `int(val)` |
| `make_verification()` 的 checks 列表为空 | 验证面板空 | 至少提供 2-3 个 checks |

**LaTeX 转义速查**（Python f-string → 前端 KaTeX）：

| LaTeX 目标 | Python 写法 | 说明 |
|------------|------------|------|
| `\begin{pmatrix}` | `\\begin{pmatrix}` | 单反斜杠命令 |
| `\\` (换行) | `\\\\` | 双反斜杠 |
| `{` `}` (花括号) | `{{` `}}` | f-string 转义 |

## 四、JavaScript 前端：标准模板

### 4.1 简单场景（无动画）

这是最常见的场景类型，只需实现 `buildScene(data)`：

```js
/**
 * 场景 X.Y 渲染器：场景标题
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawPlane, drawLine, drawPoint, COLORS } from '../draw-utils.js';

export class MySceneRenderer extends SceneRenderer {

    /**
     * 根据后端返回的 data 构建 3D 场景。
     * @param {Object} data — API 返回的 result.data（即 {scene_data, solution_info, ...}）
     */
    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        const group = this.sceneObjects;  // THREE.Group，基类会自动做双缓冲替换

        // 示例 1：画向量
        sd.vectors.forEach(v => {
            const vec = new THREE.Vector3(...v.components);
            group.add(drawVector(vec, v.color, v.label));
            // ⚠️ 注意：drawVector 返回 Group，必须整体 add
            // ❌ drawVector(...).children.forEach(c => group.add(c));  // 锥体会丢失！
        });

        // 示例 2：画平面
        const normal = new THREE.Vector3(sd.plane.normal[0], sd.plane.normal[1], sd.plane.normal[2]);
        group.add(drawPlane(normal, sd.plane.d, COLORS.plane1));

        // 示例 3：画线段
        group.add(drawLine(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 2, 3),
            0xffffff
        ));

        // 示例 4：画发光点
        group.add(drawPoint(new THREE.Vector3(1, 1, 0), COLORS.solution, 0.1));

        // 示例 5：自定义几何体
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...]), 3));
        const mat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0, side: THREE.DoubleSide });
        group.add(new THREE.Mesh(geom, mat));
    }
}
```

**不需要写的代码**：
- ❌ 矩阵显示 → 后端返回 `matrices` 字段，基类自动处理
- ❌ 参数面板 → 后端 `get_meta()` 定义，基类自动生成滑块
- ❌ 预设按钮 → 基类 `_buildPresets()` 自动生成
- ❌ 解信息面板 → 基类 `_updateSolutionInfo()` 自动渲染
- ❌ 讲解面板 → 后端返回 `lecture`，基类自动渲染
- ❌ 验证面板 → 基类 `_updateVerifyPanel()` 自动渲染

### 4.2 动画场景

动画场景需要额外实现动画循环和插值逻辑。完整模板：

```js
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawPoint, COLORS,
         createUpdatableWireframe, createUpdatableFaces, createAnimatableArrow,
         EDGES_QUAD, FACES_QUAD } from '../draw-utils.js';

export class MyAnimRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        // ── 1. 存储动画数据 ──
        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;

        // ── 2. 创建静态对象（不变的部分）──
        // 例如：灰色参考线、标注文字等，直接 add 到 group

        // ── 3. 创建可动画对象 ──
        // 使用 draw-utils.js 的工厂函数，或手动创建并保存引用

        // 方式 A：使用 createAnimatableArrow
        this._arrow = createAnimatableArrow([1, 0, 0], COLORS.vector1, 'v₁');
        group.add(this._arrow);
        this._animArrowSrc = [1, 0, 0];   // 初始状态
        this._animArrowDst = sd.target;    // 目标状态

        // 方式 B：使用 createUpdatableWireframe
        this._wire = createUpdatableWireframe(
            sd.initial_vertices,           // 初始顶点 [[x,y,z], ...]
            EDGES_QUAD,                    // 边索引
            COLORS.vector1,
            0.9
        );
        group.add(this._wire);
        this._animWireSrc = sd.initial_vertices;
        this._animWireDst = sd.target_vertices;

        // ── 4. 添加动画控制 UI ──
        this._addAnimControlUI('la_chXrY_anim_auto');  // localStorage key，全局唯一

        // ── 5. 立即显示最终状态（非动画模式）──
        this._interpolateToT(1.0);
    }

    // ═══ 必须覆写 _computeAndRender ═══
    // 否则每次参数变化后动画按钮会消失
    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI('la_chXrY_anim_auto');
    }

    // ═══ 动画核心方法 ═══

    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);          // 先复位
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;         // 毫秒
        this._updateAnimButton('⟳ 动画中...', true);
        this._animFrame();
    }

    _animFrame() {
        if (!this._animating) return;
        const elapsed = performance.now() - this._animStartTime;
        let t = Math.min(elapsed / this._animDuration, 1.0);
        t = 1 - Math.pow(1 - t, 3);       // ease-out cubic

        this._animT = t;
        this._interpolateToT(t);

        if (t < 1.0) {
            this._animFrameId = requestAnimationFrame(() => this._animFrame());
        } else {
            this._animating = false;
            this._animT = 1.0;
            this._updateAnimButton('🔄 重播动画', false);
        }
    }

    _interpolateToT(t) {
        // 插值箭头
        if (this._arrow && this._animArrowSrc && this._animArrowDst) {
            const interp = [
                this._animArrowSrc[0] + (this._animArrowDst[0] - this._animArrowSrc[0]) * t,
                this._animArrowSrc[1] + (this._animArrowDst[1] - this._animArrowSrc[1]) * t,
                this._animArrowSrc[2] + (this._animArrowDst[2] - this._animArrowSrc[2]) * t,
            ];
            this._arrow.update(interp);
        }

        // 插值线框
        if (this._wire && this._animWireSrc && this._animWireDst) {
            const interp = this._animWireSrc.map((v, i) => [
                v[0] + (this._animWireDst[i][0] - v[0]) * t,
                v[1] + (this._animWireDst[i][1] - v[1]) * t,
                v[2] + (this._animWireDst[i][2] - v[2]) * t,
            ]);
            this._wire.updateVertices(interp);
        }
    }

    /** 直接跳到最终状态（无动画） */
    _setToTarget() {
        this._interpolateToT(1.0);
        this._updateAnimButton('🔄 重播动画', false);
    }
}
```

**动画场景的 localStorage key 命名**：`la_chXrY_anim_auto`（小写、下划线、与场景路由一致）。

### 4.3 前端常见陷阱

| 陷阱 | 症状 | 正确做法 |
|------|------|----------|
| `drawVector().children.forEach(c => group.add(c))` | 箭头锥体丢失 | `group.add(drawVector(...))` 整体添加 |
| 动画场景未覆写 `_computeAndRender()` | 参数变化后动画按钮消失 | 必须覆写，在 `super` 后调用 `_addAnimControlUI()` |
| `buildScene()` 中创建 `CanvasTexture` 未释放 | 内存泄漏 | 无需手动处理——基类 `_disposeRecursive()` 会自动释放所有纹理 |
| 使用 `THREE.Geometry`（已废弃） | Three.js 0.160 报错 | 使用 `THREE.BufferGeometry` |
| `buildScene()` 抛异常 | 场景为空 | 基类已做 try-catch 保护，异常会显示错误遮罩 |
| 在 `buildScene()` 中操作 DOM | 面板内容被意外覆盖 | DOM 操作留给基类，只在 sceneObjects 中操作 3D 对象 |

## 五、draw-utils.js API 参考

所有可用的绘图工具函数。导入方式：

```js
import {
    drawVector, drawPlane, drawLine, drawInfiniteLine,
    drawPoint, drawDashedLine, createLabel,
    createUpdatableWireframe, createUpdatableFaces, createAnimatableArrow,
    EDGES_QUAD, FACES_QUAD, COLORS
} from '../draw-utils.js';
```

### 5.1 基本绘图

| 函数 | 签名 | 说明 |
|------|------|------|
| `drawVector(v, color, label)` | `(THREE.Vector3, number, string) → THREE.Group` | 画从原点出发的箭头。**必须整体 add 到场景** |
| `drawPlane(normal, d, color, opacity?, size?)` | `(THREE.Vector3, number, number, number?, number?) → THREE.Group` | 画平面 ax+by+cz=d，含法向量箭头 |
| `drawLine(start, end, color)` | `(THREE.Vector3, THREE.Vector3, number) → THREE.Line` | 两点间线段 |
| `drawInfiniteLine(point, dir, color, halfLength?)` | `(THREE.Vector3, THREE.Vector3, number, number?) → THREE.Line` | 无限延伸直线 |
| `drawPoint(pos, color?, radius?)` | `(THREE.Vector3, number, number) → THREE.Mesh` | 发光小球，带光晕 |
| `drawDashedLine(start, end, color?)` | `(THREE.Vector3, THREE.Vector3, number?) → THREE.Line` | 虚线 |
| `createLabel(text, pos, color)` | `(string, THREE.Vector3, string) → THREE.Sprite` | 3D 文字标签 |

### 5.2 动画工厂函数

| 函数 | 说明 |
|------|------|
| `createAnimatableArrow(endPos, color, labelText)` | 可动画线段+端点球+标签。返回带 `.update(end)` 方法的 Group |
| `createUpdatableWireframe(vertices, edgePairs, color, opacity)` | 可更新线框。返回带 `.updateVertices(newVerts)` 的 LineSegments |
| `createUpdatableFaces(vertices, faceIndices, color, opacity)` | 可更新半透明面。返回带 `.updateVertices(newVerts)` 的 Group |

### 5.3 常量

| 常量 | 值 | 说明 |
|------|-----|------|
| `EDGES_QUAD` | `[[0,1],[1,2],[2,3],[3,0]]` | 四边形边索引 |
| `FACES_QUAD` | `[[0,1,2],[0,2,3]]` | 四边形三角面索引 |
| `COLORS.axisX` | `0xff4444` | X 轴红 |
| `COLORS.axisY` | `0x44ff44` | Y 轴绿 |
| `COLORS.axisZ` | `0x4488ff` | Z 轴蓝 |
| `COLORS.vector1/2/3` | `0xff6b6b` / `0x4ecdc4` / `0xffd93d` | 三个向量的默认颜色 |
| `COLORS.plane1/2/3` | 同上 | 三个平面的默认颜色 |
| `COLORS.solution` | `0xffd700` | 解/交点的金色 |
| `COLORS.subSpace` | `0x9966ff` | 子空间的紫色 |

## 六、基类 SceneRenderer 速查

### 6.1 你可以使用的属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `this.sceneObjects` | `THREE.Group` | **往这里面加 3D 对象**。基类做双缓冲替换 |
| `this.meta` | `Object` | 场景元信息（来自注册时的 `getSceneMeta()`） |
| `this.params` | `Object` | 当前参数值 `{a11: 1, a12: 0, ...}` |
| `this.camera` | `THREE.Camera` | 当前相机 |
| `this.threeScene` | `THREE.Scene` | 完整的 Three.js 场景（含坐标轴、网格等） |
| `this.renderer` | `THREE.WebGLRenderer` | 渲染器 |

### 6.2 你可以调用的方法

| 方法 | 说明 |
|------|------|
| `this._panel(id)` | 获取面板 `DockPanel` 对象 |
| `this._showPanel(id)` / `this._hidePanel(id)` | 显示/隐藏面板 |
| `this._addAnimControlUI(storageKey)` | 添加动画控制 UI（自动开关+播放按钮） |
| `this._updateAnimButton(text, disabled)` | 更新动画按钮文字和状态 |
| `this._isAnimAutoEnabled(key)` / `this._setAnimAutoEnabled(key, val)` | 读/写动画自动开关 |

### 6.3 子类可以/需要重写的方法

| 方法 | 必须重写？ | 说明 |
|------|-----------|------|
| `buildScene(data)` | **是** | 构建 3D 场景 |
| `_computeAndRender(params, showLoading)` | 动画场景**是** | 需要在 `super` 后调用 `_addAnimControlUI()` |
| `_startAnimation()` | 动画场景**是** | 开启动画循环 |
| `_animFrame()` | 动画场景**是** | rAF 回调，驱动插值 |
| `_interpolateToT(t)` | 动画场景**是** | 根据 t∈[0,1] 插值所有可动画对象 |
| `_setToTarget()` | 动画场景**推荐** | 直接跳到最终状态（`t=1`），无动画过渡 |

### 6.4 生命周期

```
构造函数（new） → buildUI() → initialRender()
                                       ↓
                              _computeAndRender()
                              ├── API 调用
                              ├── buildScene()     ← 你的代码
                              ├── _updateSolutionInfo()
                              ├── _updateLecturePanel()
                              ├── _updateMatrixDisplay()
                              └── _updateVerifyPanel()
                                       ↓
                         用户操作（拖滑块/点预设）
                              → _computeAndRender()
                                       ↓
                         场景切换 → destroy()
                              ├── cancelAnimationFrame
                              ├── clearTimeout
                              └── _disposeRecursive(sceneObjects)
```

## 七、代码风格规范

### 7.1 文件头注释

每个渲染器文件首行必须有 JSDoc 描述：

```js
/**
 * 场景 X.Y 渲染器：场景标题
 * 简要描述这个场景展示什么。
 */
```

每个 Python 文件首行必须有 docstring：

```python
"""
场景 X.Y：场景标题
简要描述。
"""
```

### 7.2 命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| Python 类名 | PascalCase | `Ch1R1DetVolume` |
| Python 文件名 | 蛇形命名，与路由一致 | `ch1_r1_det_volume.py` |
| JS 类名 | PascalCase | `DetVolumeRenderer` |
| JS 文件名 | 与路由一致 | `ch1_r1_det_volume.js` |
| 变量 | camelCase | `faceColor`, `edgeColor` |
| 后端 `scene_data` 字段 | 蛇形命名 | `output_grid_points` |
| 参数 key | 蛇形命名 | `a11`, `vector1_x` |

### 7.3 结构风格

- `buildScene()` 中按逻辑分块，用注释分隔：
  ```js
  // ─── 向量 ──────────────────────────────────
  // ─── 平面 ──────────────────────────────────
  // ─── 标注 ──────────────────────────────────
  ```
- 动画相关方法用 `// ═══` 分隔符
- JS 函数之间空一行
- Python `compute()` 方法用 6 步注释分隔（见 3.4）

### 7.4 后端 scene_data 字段设计

- 坐标统一用 `[x, y, z]` 格式（list，不是 numpy array）
- 颜色用十六进制整数（`0xff6b6b`），不是字符串
- 向量用 `{"components": [x,y,z], "color": 0x..., "label": "v₁"}` 格式
- 避免深层嵌套（最多 3 层）
- 字段命名与数学概念一致（`rank`, `det`, `eigenvalues`）

## 八、提交前自查清单

- [ ] **数学正确性**：前端 `client/js/` 下无手写矩阵运算？
- [ ] **三处注册**：`server/main.py` + `client/js/main.js` SCENE_RENDERERS + 菜单按钮？
- [ ] **`getSceneMeta()` 中 params 和 presets 与后端一致**？
- [ ] **`verification` 字段**：`compute()` 返回了 checks？
- [ ] **NumPy → list**：所有 `scene_data` 中的数组值都调了 `.tolist()`？
- [ ] **LaTeX 转义**：Python f-string 中 `\begin` 写了 `\\begin`？
- [ ] **矩阵数据**：如果需要显示矩阵，后端 `scene_data.matrices` 字段存在？
- [ ] **drawVector 整体 add**：没有 `.children.forEach(c => group.add(c))`？
- [ ] **动画场景**：覆写了 `_computeAndRender`，在 `super` 后调了 `_addAnimControlUI`？
- [ ] **动画场景**：`startAnimation()` 中的 `requestAnimationFrame` ID 存到了 `this._animFrameId`？
- [ ] **预设类型**：`type` 字段是 `unique`/`none`/`infinite`/`degenerate` 之一？
- [ ] **面板引用**：没有 `document.getElementById()` 操作面板？

## 九、参考场景

学习代码风格时，参考以下场景最有效：

| 类型 | 参考场景 | 特点 |
|------|----------|------|
| 简单场景 | `ch1_r1_det_volume` | 向量+面+边+标签，标准模式 |
| 含平面场景 | `ch3_r5_3x3_system` | 三平面相交，含 `drawPlane` |
| 动画-矩阵变换 | `ch3_r0_rank_intuition` | 圆周变形动画，`createUpdatableWireframe` |
| 动画-初等变换 | `ch3_r12_elem_row` | 动画箭头+线框，`createAnimatableArrow` |
| 动画-矩阵乘法 | `ch2_r0_matrix_multiply` | 复合变换动画 |
| 工具类场景 | `matrix_calculator` | 动态矩阵输入，`type: "matrix"` 参数 |
| 含方程组的场景 | `ch3_r4_2x2_system` | 二维方程组，列视图+行视图 |

---

> **最后更新**：2026-08-06 · AI 审计员撰写
> 本文档基于对全部 24 个现有场景的代码审查，提取了共性和最佳实践。
