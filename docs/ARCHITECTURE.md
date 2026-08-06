# 线性代数交互式学习系统 — 架构详解

> 本文档是从 CLAUDE.md 拆分出来的详细架构说明。CLAUDE.md 只保留核心原则和快速参考。

## 一、面板系统（panel-system.js）

### 三个核心类

| 类 | 职责 |
|----|------|
| `DockPanel` | 单个面板：DOM 创建、折叠/展开、双 resize 手柄、自定义尺寸持久化 |
| `DockZone` | 停靠区域：管理面板列表、拖放排序、插入指示线、`data-orientation` 同步 |
| `PanelManager` | 全局单例：初始化所有面板和区域、移动面板、布局持久化（localStorage） |

### 四个停靠区

| 区域 ID | 位置 | 方向 | 特点 |
|---------|------|------|------|
| `left` | 左栏 | vertical | 面板纵向堆叠 |
| `right` | 右栏（场景信息下方） | vertical | 默认承载预设/参数/视角/分析/验证 |
| `top` | 3D 视图顶部（绝对定位叠加） | horizontal | 面板横排，适合矩阵数据 |
| `bottom` | 3D 视图底部（绝对定位叠加） | horizontal | 面板横排 |

### 八个可拖拽面板

| ID | 标题 | 默认区域 | 默认折叠 |
|----|------|----------|----------|
| `scenenav` | 📐 场景目录 | left | 否 |
| `presets` | 📌 预设情形 | right | 否 |
| `params` | 🎚 参数调节 | right | 否 |
| `camera` | 📷 视角控制 | right | 否 |
| `solution` | 📊 分析结果 | right | 否 |
| `lecture` | 📖 讲解 | right | 否 |
| `verify` | 🔍 数学验证 | right | **是** |
| `matrix` | 📋 矩阵数据 | top | 否 |

### 布局持久化

| localStorage Key | 内容 |
|------------------|------|
| `la_panel_layout` | 面板位置、排序、折叠状态 |
| `la_panel_sizes` | 用户拖拽 resize 的自定义尺寸 |
| `la_panel_visibility` | 面板显示/隐藏状态 `{panelId: bool}` |
| `la_current_scene` | 上次打开的场景 |
| `la_sidebar_collapsed` | 左右侧栏折叠状态 `{left: bool, right: bool}` |
| `la_deepseek_api_key` | AI 答疑 DeepSeek API Key |
| `la_lecture_basic_collapsed` | 讲解子面板「基础讲解」折叠状态 `'1'`/`'0'` |
| `la_lecture_ai_collapsed` | 讲解子面板「AI 答疑」折叠状态 `'1'`/`'0'` |
| `la_lecture_subpanel_order` | 讲解子面板排列顺序 `['basic','ai']` 或 `['ai','basic']` |
| `la_*_anim_auto` | 各场景自动动画开关 `'1'`/`'0'`（10 个动画场景，由 `scene-base.js` 管理） |
| `la_grid_settings` | 3D 网格可视范围 `{range}`（半轴单位数，默认5=±5，每格=1单位）（由 `main.js` 设置菜单管理） |
| `la_color_theme` | 颜色主题覆盖 `{accent, bgPrimary, bgSecondary, bgNav, green, red}`（由 `main.js` 设置菜单管理） |
| `la_param_ranges` | 场景参数自定义范围 `{sceneId: {paramKey: {min, max}}}`（由 `main.js` 设置菜单 + `scene-base.js` 共同管理） |
| `la_settings_collapsed` | 设置菜单各分组折叠状态 `{panel-vis: bool, ...}` |

重置布局：浏览器控制台执行 `localStorage.clear(); location.reload();`

### 关键设计模式

- **内容填充**：`panelManager.getPanel(id)` → `DockPanel` → 写入 `panel.body.innerHTML`
- **场景切换**：面板 DOM 不变，只更新 `body` 内容（`SceneRenderer.buildUI()` / `destroy()`）
- **CSS 驱动排版**：`DockZone.addPanel()` 设 `panel.body.dataset.orientation = "horizontal"|"vertical"`，CSS 据此自动选择横排/竖排。面板拖到新区域时无需 JS 重新渲染
- **事件代理**：相机按钮和坐标轴切换通过 `document.addEventListener('click', ...)` 全局代理
- **面板引用**：场景渲染器通过 `this._panel(id)` 获取面板，禁止使用 `document.getElementById()`

### 侧栏折叠

左右栏边缘各有一个折叠按钮（`◀` / `▶`），点击将侧栏缩至 32px。状态持久化到 `la_sidebar_collapsed`，过渡动画 0.25s，折叠后自动触发 Three.js canvas resize。

### Resize 手柄

- **底部手柄**（`_resizeHandleH`）：所有面板都有，拖拽调高度，cursor `ns-resize`
- **右侧手柄**（`_resizeHandleW`）：横向区域显示，拖拽调宽度，cursor `ew-resize`
- **尺寸吸附**：拖到相邻面板 ±10px 内自动对齐，吸附瞬间蓝色光晕反馈
- 尺寸范围：宽度 200~800px，高度 ≥60px
- 自定义尺寸持久化到 `localStorage` key `la_panel_sizes`

## 二、矩阵显示模块（matrix-display.js）

### 设计动机

矩阵 KaTeX 渲染曾散落在 `scene-base.js` 的 `_updateMatrixDisplay()` 中，问题：
- 横向/纵向排版用 JS inline style，面板移动后不更新
- 场景无法复用

### 统一入口

```js
import { updateMatrixDisplay } from './matrix-display.js';
updateMatrixDisplay(panel, matrices);
// matrices: [{ label: "系数矩阵 A", symbol: "A", data: [[1,0],[0,1]] }, ...]
```

- `scene-base.js` 的 `_updateMatrixDisplay()` 只一行调用
- **所有场景的矩阵显示都通过此模块**
- 新增场景只需后端返回 `matrices` 字段，零前端代码

### 排版机制（CSS 驱动，非 JS）

```
updateMatrixDisplay() → 设置 panel.body.dataset.orientation
                                  ↓
DockZone.addPanel() → 面板移动时自动更新 data-orientation
                                  ↓
CSS: .panel-body[data-orientation="horizontal"] → flex-direction: row（横排）
CSS: .panel-body[data-orientation="vertical"]   → flex-direction: column（竖排）
```

面板拖到不同区域后排版即时生效，无需重新计算场景。

## 三、场景渲染器基类（scene-base.js）

```
SceneRenderer
├── buildUI()              ← 填充所有面板内容（预设/参数/视角/解/验证/矩阵）
├── initialRender()        ← 首次计算 + 渲染
├── buildScene(data)       ← 子类重写，构建 3D 场景
├── _computeAndRender()    ← 核心：调 API → 双缓冲替换 3D 对象 → 更新面板
├── _buildPresets()        ← 预设按钮 → panel('presets').body
├── _buildParams()         ← 滑块+数值输入 → panel('params').body
├── _updateMatrixDisplay() ← 委托给 matrix-display.js
├── _updateSolutionInfo()  ← 解的类型和说明 → panel('solution').body
├── _updateLecturePanel()  ← 讲解内容（KaTeX） → panel('lecture').body
├── _updateVerifyPanel()   ← 验证结果 → panel('verify').body
├── _throttleCompute()     ← 80ms 节流，滑块拖动时减少 API 调用
└── destroy()              ← 清空面板 + 递归 dispose 3D 对象
```

关键实现细节：
- **双缓冲**：`_computeAndRender()` 构建新 `THREE.Group`，完成后替换旧 Group，避免闪烁
- **节流**：滑块 `input` 事件节流 80ms，`change` 事件（松手）立即触发
- **错误隔离**：API 失败显示 `#error-overlay`，不影响面板系统

## 四、draw-utils.js 注意事项

### 箭头渲染（重要）

`drawVector()` 返回 `THREE.Group`，包含 `[arrowBody, cone, labelSprite]`。

```js
// ✅ 正确：整体添加
group.add(drawVector(vec, color, label));

// ❌ 错误：会导致箭头锥体丢失！
drawVector(vec, color, label).children.forEach(c => group.add(c));
```

原因：`group.add(c)` 会把 child 从源 Group 中移除，`forEach` 迭代时数组元素移位，索引为 1 的 cone 被跳过。这是一个经典的数组迭代中修改数组的问题。

## 五、数据流

```
用户拖滑块 / 点预设
    ↓
scene-base.js: _throttleCompute() / _computeAndRender()
    ↓
api.js: computeScene(sceneName, params)
    ↓ POST /api/scene/{name}
server/main.py → SCENE_REGISTRY[name].compute(params)
    ↓
server/scenes/chX_rY_name.py: compute() → math_engine.py (NumPy/SciPy)
    ↓ 返回 {scene_data, verification, solution_info}
api.js: 解析 JSON → scene-base.js
    ↓
buildScene(data)     → 3D 场景（新 Group，双缓冲替换）
_updateMatrixDisplay → matrix-display.js → panel('matrix')
_updateSolutionInfo  → panel('solution')
_updateLecturePanel → panel('lecture')
_updateVerifyPanel   → panel('verify')
```

## 六、已知问题与注意事项

1. **箭头渲染 bug**：见第四节
2. **Three.js 版本**：0.160.0 本地文件（`client/js/vendor/`），非 CDN
3. **坐标轴**：Z 轴向上（`camera.up.set(0, 0, 1)`），XY 为地面
4. **网格**：`GridHelper` 旋转 `-π/2` 使其平放在 XY 平面
5. **右键菜单**：VSCode 内置浏览器中右键正常；外部浏览器需关闭鼠标手势（Edge `edge://settings/appearance` → 鼠标手势 → 关），或用 Chrome
6. **KaTeX**：CDN 加载（`unpkg.com`），需网络连接
7. **滚动条**：全局暗色主题（`scrollbar-color: #2a2a45 transparent`），`*` 选择器覆盖所有元素
8. **面板滚轮**：`.panel-body` 内的 wheel 事件不拦截（放行给浏览器），避免 OrbitControls 阻止面板滚动
9. **渲染暂停**：`document.visibilitychange` 时暂停 `requestAnimationFrame`，标签页隐藏时释放 GPU
10. **GPU 花屏**：VSCode（Electron/Chromium）与某些 NVIDIA 驱动有 GPU 合成冲突。使用外部浏览器即可避免，和本项目无关
