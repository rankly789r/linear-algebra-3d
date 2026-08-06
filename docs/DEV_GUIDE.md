# 线性代数交互式学习系统 — 开发者指南

> 如何新增场景、理解面板系统、使用矩阵显示模块

## 一、项目技术栈

| 层 | 技术 | 版本 | 用途 |
|----|------|------|------|
| 后端框架 | FastAPI + uvicorn | — | REST API 服务器 |
| 数学计算 | NumPy + SciPy | — | 矩阵运算、秩、求解、零空间 |
| 3D 渲染 | Three.js | 0.160.0 | 本地文件，`client/js/vendor/` |
| 数学公式 | KaTeX | 0.16.11 | CDN 加载，矩阵和公式渲染 |
| 前端模块 | ES Modules (import map) | — | 无打包工具，原生浏览器加载 |
| Python 环境 | Conda (xianxingdaishu) | Python 3.11 | `D:\Users\fkl\anaconda3` |

## 二、项目启动方式

### 方式一：VSCode F5 调试（推荐）
1. 按 `F5` → 选择 "🚀 启动线性代数学习系统"
2. `Ctrl+Shift+P` → `Simple Browser: Show` → 输入 `http://localhost:8765`
3. 之后 Simple Browser 记住地址，只需回车

### 方式二：终端手动启动
```bash
conda activate xianxingdaishu
python app.py
# 打开 http://localhost:8765
```

### 方式三：双击 start.bat
自动启动服务器 + 打开浏览器。服务器窗口最小化运行。

## 三、新增场景完整步骤

### Step 1：创建后端场景文件

在 `server/scenes/` 下新建 `chX_rY_name.py`：

```python
"""场景 X.Y：场景标题"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class ChXRYName(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "chX_rY_name",
            "title": "X.Y 场景标题",
            "chapter": "第X章",
            "description": "场景的简短描述，显示在场景信息区。",
            "params": {
                # 参数定义：key → {label, type, default, min, max, step}
                "a11": {"label": "a₁₁", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "count": {"label": "数量", "type": "int", "default": 3, "min": 1, "max": 10, "step": 1},
                "mode": {"label": "模式", "type": "choice", "default": "A", "options": ["A", "B", "C"]},
            },
            "presets": [
                # 3-5 个预设情形
                {"label": "预设名称", "type": "unique", "params": {"a11": 1, ...}},
                # type 可选: "unique"(蓝), "none"(红), "infinite"(绿), "degenerate"(橙)
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        # 1. 从 params 提取参数
        a11 = float(params.get("a11", 1))

        # 2. 用 math_engine 做数学计算（不要手写算法！）
        A = np.array([[a11, ...], ...])
        rank = M.matrix_rank(A)

        # 3. 构建 scene_data（前端渲染用）
        scene_data = {
            # 矩阵数据（可选，有此字段则自动显示矩阵面板）
            "matrices": [
                {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
                # symbol 用于 KaTeX 渲染：A = \begin{pmatrix} ...
            ],
            # 场景特定的几何数据
            # ...
        }

        # 4. 构建 verification（独立验算）
        verification = {
            "passed": True,
            "checks": [
                {"label": "矩阵 A 的秩 = 2", "passed": rank == 2},
            ],
        }

        # 5. 构建 solution_info（分析结果）
        solution_info = {
            "type": "unique",  # "unique" | "none" | "infinite"
            "description": "解的类型的中文说明。",
            "details": {"r(A)": str(rank)},
        }

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            # 可选：讲解面板（支持 KaTeX 公式）
            "lecture": {
                "sections": [
                    {"title": "核心直觉", "content": "用 $...$ 写行内公式，用 $$...$$ 写独立公式。"},
                ],
            },
        }
```

### Step 2：创建前端渲染器

在 `client/js/renderers/` 下新建 `chX_rY_name.js`：

```js
/**
 * 场景 X.Y 渲染器：场景标题
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawPlane, drawPoint } from '../draw-utils.js';

export class MySceneRenderer extends SceneRenderer {

    /**
     * 根据后端返回的 data 构建 3D 场景
     * @param {Object} data — API 返回的 result.data
     */
    buildScene(data) {
        const sc = data.scene_data;

        // 在 this.sceneObjects 中添加你的 3D 对象
        // this.sceneObjects 是一个 THREE.Group，会自动做双缓冲替换

        // 示例：画一个向量
        const vec = new THREE.Vector3(1, 2, 0);
        this.sceneObjects.add(drawVector(vec, 0x4cc9f0, 'v₁'));

        // 注意：drawVector 返回 Group，必须整体 add，不要用 .children.forEach！
        // ❌ drawVector(...).children.forEach(c => group.add(c));
        // ✅ group.add(drawVector(...));
    }
}
```

**重要提醒**：
- 不要在本文件实现矩阵渲染——后端返回 `matrices` 字段后自动显示
- 不要用 `document.getElementById()` 操作面板——基类 `SceneRenderer` 已处理
- `drawVector()` 返回的是 `THREE.Group`（包含箭头体+锥体+标签），必须整体添加

### Step 3：注册后端

在 `server/main.py` 中：

```python
# 添加 import
from server.scenes.chX_rY_name import ChXRYName

# 在 SCENE_REGISTRY 中添加
SCENE_REGISTRY = {
    # ...已有场景...
    "chX_rY_name": ChXRYName,
}
```

### Step 4：注册前端

在 `client/js/main.js` 中：

```js
// 1. 添加 import
import { MySceneRenderer } from './renderers/chX_rY_name.js';

// 2. 在 SCENE_RENDERERS 中注册
const SCENE_RENDERERS = {
    // ...已有场景...
    'chX_rY_name': MySceneRenderer,
};

// 3. 在 getSceneMeta() 中添加元信息
function getSceneMeta(sceneName) {
    const metas = {
        // ...已有场景...
        'chX_rY_name': {
            id: 'chX_rY_name',
            title: 'X.Y 场景标题',
            description: '简短描述',
            params: { /* 与后端 get_meta() 中的 params 一致 */ },
            presets: [ /* 与后端一致 */ ],
        },
    };
    return metas[sceneName] || { ... };
}
```

### Step 5：添加场景菜单按钮

在 `main.js` 的 `buildNavPanel()` 函数中，在合适的分类下添加：

```js
<button class="scene-btn" data-scene="chX_rY_name">X.Y 场景标题</button>
```

如果有新的分类，添加：
```js
<div class="menu-label">新分类名</div>
```

### Step 6：验证

1. 重启服务器
2. 刷新浏览器
3. 点击新场景菜单按钮
4. 检查：3D 渲染、矩阵显示、预设按钮、滑块联动、验证面板

## 四、面板系统详解

### 获取面板引用

```js
const panel = window.panelManager.getPanel('matrix');  // 或 this._panel('matrix') 在 SceneRenderer 中
panel.body.innerHTML = '...';   // 填充内容
panel.show();                    // 显示
panel.hide();                    // 隐藏
panel.setTitle('新标题');        // 更新标题
panel.toggle();                  // 折叠/展开
```

### 区域方向

```js
panel.zone.orientation  // 'vertical'（left/right）或 'horizontal'（top/bottom）
```

### 矩阵显示（所有场景统一）

```js
import { updateMatrixDisplay } from './matrix-display.js';
updateMatrixDisplay(panel, matrices);
// matrices 为 null/[] 时自动隐藏面板
```

无需关心面板在哪个区域——排版由 CSS 的 `data-orientation` 属性自动处理。

### 布局持久化

- 面板位置、排序、折叠状态 → `localStorage` key: `la_panel_layout`
- 自定义尺寸 → `localStorage` key: `la_panel_sizes`
- 面板显示/隐藏 → `localStorage` key: `la_panel_visibility`
- 左右栏折叠 → `localStorage` key: `la_sidebar_collapsed`
- 当前场景 → `localStorage` key: `la_current_scene`
- AI API Key → `localStorage` key: `la_deepseek_api_key`
- 讲解子面板折叠 → `localStorage` keys: `la_lecture_basic_collapsed`, `la_lecture_ai_collapsed`
- 讲解子面板排序 → `localStorage` key: `la_lecture_subpanel_order`
- 动画自动播放开关 → `localStorage` keys: `la_ch*_anim_auto`（10个动画场景，由 `scene-base.js` 统一管理）
- 网格设置 → `localStorage` key: `la_grid_settings`
- 颜色主题 → `localStorage` key: `la_color_theme`
- 参数自定义范围 → `localStorage` key: `la_param_ranges`
- 设置菜单折叠状态 → `localStorage` key: `la_settings_collapsed`
- 重置：浏览器控制台执行 `localStorage.clear(); location.reload();`

### 设置菜单

3D 视图右上角有「⚙」设置按钮，点击弹出多级菜单，包含四个分组：
- **面板显示**：勾选/取消各面板的显示状态（二级 checkbox）
- **3D 网格渲染距离**：调节网格范围（2-30）和密度（2-40）
- **滑块区间（当前场景）**：自定义当前场景各参数的 min/max
- **颜色主题**：修改 6 个关键 CSS 颜色变量（accent、背景色等）
- 底部有「恢复默认设置」按钮

所有设置自动保存到 localStorage，刷新后保持。实现位于 `main.js` 的 `initSettingsMenu()` IIFE 中。

## 五、前端文件职责速查

| 文件 | 职责 | 可以被场景渲染器直接使用吗 |
|------|------|--------------------------|
| `main.js` | Three.js 初始化、场景切换、面板初始化 | 否（入口文件） |
| `api.js` | fetch 封装，`computeScene(name, params)` | 是（通过 scene-base.js 间接调用） |
| `scene-base.js` | SceneRenderer 基类，UI 面板填充 | 是（继承它） |
| `draw-utils.js` | 通用 3D 绘图函数 | 是（导入使用） |
| `panel-system.js` | 面板拖拽/停靠/折叠/resize | 否（通过 panelManager 单例使用） |
| `matrix-display.js` | 矩阵 KaTeX 渲染 | 是（但通常由基类自动调用） |

## 六、后端文件职责速查

| 文件 | 职责 |
|------|------|
| `app.py` | uvicorn 入口，启动服务器 |
| `server/main.py` | FastAPI app，路由注册，静态文件服务，场景注册表，AI 答疑端点 |
| `server/math_engine.py` | NumPy/SciPy 封装，所有数学计算必须走这里 |
| `server/ai_chat.py` | DeepSeek Chat API 调用封装，system prompt 构建 |
| `server/scenes/base.py` | BaseScene 基类，SceneParams 参数类 |
| `server/scenes/chX_rY_*.py` | 各场景实现 |

## 七、参数类型参考

| type | 前端控件 | 示例 |
|------|----------|------|
| `float` | 滑块 + 数值输入 | `min: -5, max: 5, step: 0.1` |
| `int` | 整数滑块 + 数值输入 | `min: 1, max: 10, step: 1` |
| `choice` | 下拉选择框 | `options: ["A", "B", "C"]` |
| `matrix` | 动态网格输入（N×M） | 配合 `{name}_rows` / `{name}_cols` int 参数实现动态尺寸 |

## 八、预设类型与样式

| type | 左边框颜色 | 含义 |
|------|-----------|------|
| `unique` | 蓝色 | 唯一解 / 满秩 |
| `none` | 红色 | 无解 / 降秩 |
| `infinite` | 绿色 | 无穷多解 |
| `degenerate` | 橙色 | 退化情形 |

## 九、讲解面板（lecture）—— 含 AI 答疑

后端返回 `lecture.sections` 即可自动渲染到「📖 讲解」面板。

### 子面板架构（v1.9+）

讲解面板内部拆分为两个可拖拽排序的子面板：

1. **📖 基础讲解** — 后端返回的 `lecture.sections` 渲染在这里，可独立折叠
2. **🤖 AI 答疑** — 聊天界面，用户提问后调用 DeepSeek API

两个子面板支持：
- **独立折叠**：分别点击 `▲`/`▼` 收起/展开，状态持久化到 localStorage
- **拖拽排序**：鼠标拖拽交换基础讲解和 AI 答疑的位置（6px 死区防误触）
- **顺序持久化**：`la_lecture_subpanel_order` 记录排列顺序

### 相关 localStorage key

| Key | 内容 |
|-----|------|
| `la_lecture_basic_collapsed` | `'1'`/`'0'` — 基础讲解子面板折叠状态 |
| `la_lecture_ai_collapsed` | `'1'`/`'0'` — AI 答疑子面板折叠状态 |
| `la_lecture_subpanel_order` | `['basic','ai']` 或 `['ai','basic']` — 排列顺序 |

### 实现位置

- `scene-base.js` `_updateLecturePanel()` — 构建/更新讲解面板
- `scene-base.js` `_ensureSubPanels()` — 确保子面板 DOM 结构存在
- `scene-base.js` `_initSubPanelDrag()` — 绑定子面板拖拽排序事件
- 折叠状态在构造函数中从 localStorage 恢复，切换场景时保持不重置

### 后端格式（基础讲解部分）

```python
"lecture": {
    "sections": [
        {
            "title": "核心直觉",
            "content": (
                "**粗体文本**是这样做。\n"
                + "行内公式 $Ae_1 = (2.0, 0.0)$ 这样写。\n"
                + "独立公式用双美元：$$\nA = \\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}\n$$"
            ),
        },
    ],
}
```

### LaTeX 转义规则（重要！）

在 Python f-string 中写 LaTeX 时，反斜杠的转义层级：

| LaTeX 目标 | Python f-string 写法 | 说明 |
|------------|---------------------|------|
| `\begin` | `\\begin` | 单反斜杠命令 |
| `\\` (换行) | `\\\\` | 双反斜杠 = LaTeX 行分隔 |
| `\underbrace` | `\\underbrace` | 花括号用 `{{` `}}` 转义 |
| `\text` | `\\text` | 文本模式 |

**常见错误**：`\\\\begin` 产生 `\\begin`（两个反斜杠），KaTeX 无法解析。正确是 `\\begin`。

## 十、动画场景开发

10 个动画场景（ch0_r0/ch0_r1/ch1_r0/ch2_r0/ch2_r1/ch3_r0/ch3_r3/ch3_r12/ch3_r13/matrix_calculator）共享统一的动画模式。动画控制 UI 由基类 `SceneRenderer` 提供（v2.0+），无需在每个渲染器中重复实现。

### 动画工厂函数（从 draw-utils.js 导入）

```js
import { createUpdatableWireframe, createUpdatableFaces, createAnimatableArrow,
         EDGES_QUAD, FACES_QUAD } from '../draw-utils.js';

// createUpdatableWireframe(vertices, edgePairs, color, opacity)
//   → THREE.LineSegments 带 .updateVertices(newVertices) 方法

// createUpdatableFaces(vertices, faceIndices, color, opacity)
//   → THREE.Group 带 .updateVertices(newVertices) 方法

// createAnimatableArrow(endPos, color, labelText)
//   → THREE.Group（线段+端点球+标签）带 .update(end) 方法
```

### 动画流程（统一模式）

```
buildScene(data)
  ├── 存储: this._animData, this._animT = 1.0, this._animating = false
  ├── 创建可动画对象（wire/face/arrow），保存 src/dst 引用
  ├── this._addAnimControlUI('la_chXrY_anim_auto')  ← 基类方法
  └── this._interpolateToT(1.0)  ← 立即显示最终状态

_startAnimation()                              ← 用户点击「▶ 演示动画」
  ├── _interpolateToT(0)                        ← 先复位到初始状态
  └── _animFrame() → 递归 rAF (1500ms)
        └── _interpolateToT(t)                  ← ease-out cubic
              ├── wire.updateVertices(interp)
              ├── face.updateVertices(interp)
              └── arrow.update(interp)

动画结束: _updateAnimButton('🔄 重播动画', false)

_setToTarget()                                 ← 无动画直接跳最终状态
  ├── _interpolateToT(1.0)
  └── _updateAnimButton('🔄 重播动画', false)
```

### 基类提供的动画 UI 方法

| 方法 | 说明 |
|------|------|
| `this._addAnimControlUI(storageKey)` | 在 solution 面板顶部插入 **[⟳ 自动动画: 开/关] + [▶ 演示动画]** 按钮行。自动开关状态持久化到 `storageKey`（格式 `la_chXrY_anim_auto`） |
| `this._updateAnimButton(text, disabled)` | 更新播放按钮文字和禁用状态 |
| `this._isAnimAutoEnabled(key)` | 读取自动动画开关 |
| `this._setAnimAutoEnabled(key, val)` | 写入自动动画开关 |

### 子类必须实现的动画方法

```js
// 必须覆写：参数变化后重新添加动画 UI
async _computeAndRender(params, showLoading) {
    await super._computeAndRender(params, showLoading);
    this._addAnimControlUI('la_chXrY_anim_auto');
}

_startAnimation() {
    if (this._animating) return;
    this._interpolateToT(0);  // 复位到初始状态
    this._animating = true;
    this._animStartTime = performance.now();
    this._animDuration = 1500;
    this._updateAnimButton('⟳ 动画中...', true);
    this._animFrame();
}

_animFrame() {
    if (!this._animating) return;
    const elapsed = performance.now() - this._animStartTime;
    let t = Math.min(elapsed / this._animDuration, 1.0);
    t = 1 - Math.pow(1 - t, 3);  // ease-out cubic
    this._interpolateToT(t);
    if (t < 1.0) {
        this._animFrameId = requestAnimationFrame(() => this._animFrame());
    } else {
        this._animating = false;
        this._updateAnimButton('🔄 重播动画', false);
    }
}

_interpolateToT(t) {
    // 线性插值所有可动画对象
    // interp[i] = src[i] + (dst[i] - src[i]) * t
}

_setToTarget() {
    this._interpolateToT(1.0);
    this._updateAnimButton('🔄 重播动画', false);
}
```

### 动画 localStorage key 命名

格式：`la_<场景路由>_anim_auto`，如 `la_ch1r0_anim_auto`。共 10 个场景，全部由 `scene-base.js` 的 `_addAnimControlUI()` 统一管理。

## 十一、AI 答疑模块

### 架构

```
浏览器 localStorage           Python 后端                  DeepSeek API
  la_deepseek_api_key  ──→  POST /api/chat/{scene}  ──→  chat/completions
                                   │
                            1. 执行 scene.compute(params)
                            2. 将 scene_data 注入 system prompt
                            3. 调用 ask_deepseek()
                            4. 返回 {reply: "..."}
```

### 关键文件

| 文件 | 职责 |
|------|------|
| `server/ai_chat.py` | `build_system_prompt()` 构建上下文，`ask_deepseek()` 调用 API |
| `server/main.py` | `POST /api/chat/{scene_name}` 端点，组装请求 |
| `client/js/api.js` | `askAI(sceneName, params, message, history, apiKey)` |
| `client/js/scene-base.js` | `_appendChatUI()` 聊天 UI，`_sendChatMessage()` 发送逻辑，`_renderMarkdown()` 格式渲染 |

### API 端点

```
POST /api/chat/{scene_name}
Body: {
    params: {...},         // 当前场景参数
    message: "...",        // 用户问题
    history: [{role, content}, ...],  // 聊天历史
    api_key: "sk-..."      // 用户自己的 DeepSeek Key
}
Response: { success: true, data: { reply: "..." } }

401: 未提供 api_key → 提示设置 Key
500: AI 调用失败 → 错误信息
```

### System Prompt

在 `server/ai_chat.py` 的 `build_system_prompt()` 中构建。包含：
- 当前场景的矩阵数据、解信息、验证结果
- LaTeX 格式约束（`$...$` / `$$...$$`，禁止 `\(...\)` / `\[...\]`）
- 格式示例（few-shot）

前端 `_renderMarkdown()` 额外做了一层格式兼容：将 `\(...\)` → `$...$`、`\[...\]` → `$$...$$`，防止 AI 不遵守 prompt。

### API Key 管理

- Key 由用户自行从 [platform.deepseek.com](https://platform.deepseek.com/api_keys) 获取
- 存储在浏览器 `localStorage`，key: `la_deepseek_api_key`
- 每次请求通过 `api_key` 字段传给后端，后端不存储
- 部署者可通过环境变量 `DEEPSEEK_API_KEY` 设置默认 Key（可选）

## 十二、提交前自查清单

> 每次修改完成后，逐项确认。这些规则来自项目宪章（CLAUDE.md 第二节），不可绕过。

- [ ] **数学正确性**：前端 `client/js/` 下没有手写矩阵运算、消元法、求秩、求逆、求特征值等逻辑？
- [ ] **verification 字段**：后端场景 `compute()` 返回了 `verification: {passed, checks}`？（基类会自动补默认值，但最好显式提供）
- [ ] **场景三处注册**：新增场景在 `server/main.py` SCENE_REGISTRY + `client/js/main.js` SCENE_RENDERERS + 菜单 `buildNavPanel()` 三处都注册了？
- [ ] **矩阵显示复用**：矩阵面板是否通过 `matrix-display.js` 的 `updateMatrixDisplay()` 而非手写 KaTeX？
- [ ] **面板引用规范**：是否使用 `this._panel(id)` 而非 `document.getElementById()` 操作面板？
- [ ] **dispose 完整性**：修改了 `scene-base.js` 的 dispose 逻辑后，确认覆盖了 **geometry / material / texture / animationFrame / timer** 五种资源？
- [ ] **双缓冲安全**：`buildScene()` 中的异常不会导致空 Group 残留？（基类 `_computeAndRender()` 已做 try-catch 保护，但新增渲染器时注意不要在构造函数中做可能抛异常的事）

## 十三、常见陷阱

> 这些是项目中实际踩过的坑。看到类似场景时，先查这里。

| 陷阱 | 症状 | 正确做法 |
|------|------|----------|
| `drawVector().children.forEach(c => group.add(c))` | 箭头锥体丢失 | `forEach` 迭代中 `group.add()` 会从源 Group 移除 child，导致数组移位、索引 1 的 cone 被跳过。**整体**添加：`group.add(drawVector(...))` |
| Canvas 2D 渲染数学符号（如 ᵀ U+1D40） | 显示为方块 □ | Windows 上 Arial / sans-serif 不含 Unicode Plane 1 字符。用 SVG 替代或切换到含该字符的字体 |
| `.bat` 文件用 UTF-8 编码 | 中文乱码 | cmd.exe 按 CP936/GBK 解码。`start.bat` 已改用纯英文 ASCII |
| `requestAnimationFrame` 返回的 ID 不保存 | 场景切换后报错 / 内存泄漏 | 动画场景中 rAF 的 ID 必须存到 `this._animFrameId`，`destroy()` 中 `cancelAnimationFrame()` |
| `conda activate` 在脚本中不可靠 | 脚本执行中断 | 用 `conda run -n xianxingdaishu python ...` 替代 |
| Python f-string 中 LaTeX 反斜杠 | KaTeX 解析失败 | `\\begin` → `\begin`，`\\\\` → `\\`（Python 先转义，LaTeX 再解析） |
| 后端返回的 `matrices` 中 `data` 是 NumPy array | JSON 序列化失败 | 必须 `.tolist()` 转换：`"data": A.tolist()` |
| 面板 `.body` 用 `innerHTML` 整体替换 | 动态添加的 DOM（如动画重播按钮）被覆盖 | 覆写 `_computeAndRender()` 在 `super` 调用后重新添加动态元素 |
| `_restoreSize()` 在 `this.el` 赋值前调用 | 面板尺寸恢复从未生效（整个项目历史） | 确保 `this.el = el` 之后再调用 `_restoreSize()` |
| `THREE.Geometry` 已弃用仍使用 | Three.js 0.160 中报错 | 使用 `THREE.BufferGeometry` |
| `innerHTML` 全量替换覆盖动态子元素 | 讲觧面板的动画重播按钮、AI 聊天 UI 消失 | 使用专用容器（如 `[data-section="solution-info"]`），只替换容器内容不触碰 panel.body 其他子元素 |
| ResizeObserver 打断 CSS transition | 折叠左右栏时 3D 画面跳变无动画 | 废弃 ResizeObserver，将 `resize()` 放入 `animate()` 渲染循环每帧检查。`renderer.setSize()` 尺寸未变时内部短路 |
| 手写 `new THREE.Sprite()` 做 3D 标注 | 黑底、黑边、被几何体遮挡、`\n` 不换行 | **始终**用 `draw-utils.js` 的 `createLabel(text, position, color)`。它已处理：①手动分行（Canvas fillText 不支持 `\n`）② `premultipliedAlpha: false` 消黑边 ③ `depthTest: false` + `depthWrite: false` + `renderOrder: 999` 防遮挡。`drawVector()` 的标签也走此函数 |

