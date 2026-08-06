# 线性代数交互式学习系统 — 项目宪章

> **给未来的 AI（包括失忆后的自己）：阅读此文件以完全恢复项目上下文。**
>
> 详细架构见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，开发指南见 [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)，场景规划见 [docs/SCENE_ANALYSIS.md](docs/SCENE_ANALYSIS.md)（逐节详尽分析），速查见 [docs/SCENE_PLAN.md](docs/SCENE_PLAN.md)。

## 一、项目起源

- **用户**：在学同济大学《线性代数》教材，目前已学完前三章 + 补充了基础概念（矩阵=线性变换的几何直觉）
- **问题**：能做计算但不理解几何含义——为什么要定义秩？r(A)=r(A|b) 到底在说什么？
- **方案**：搭建一个 Python + Three.js 的交互式 3D 可视化系统
- **创建时间**：2025年8月5日 · **最后更新**：2026年8月6日

## 二、核心设计原则（不可违反）

### 2.1 数学正确性
- **Python（NumPy/SciPy）做所有数学计算，前端只负责渲染。**
- `client/js/` 下**不得**实现矩阵运算、消元法、求秩、求逆、求特征值等逻辑
- `server/math_engine.py` **只能**使用 NumPy/SciPy 公开 API，不得手写算法
- 每个场景的 `compute()` 必须返回 `verification` 字段

### 2.2 功能隔离
- 每个场景是独立模块（一个 Python 文件 + 一个 JS 渲染器），崩一个不影响其他
- 三层错误隔离：场景级 try/except → API 级 `{success, data, error}` → 启动级依赖检测

### 2.3 模块化与复用
- **矩阵显示**：统一走 `matrix-display.js` 的 `updateMatrixDisplay(panel, matrices)`，所有场景共用
- **面板系统**：所有 UI 面板由 `panel-system.js`（PanelManager 单例）管理
  - 场景渲染器通过 `this._panel(id)` 获取面板，**禁止** `document.getElementById()` 操作面板
- **CSS 驱动排版**：`panel.body.dataset.orientation` 控制横排/竖排，面板移动后无需 JS 重新渲染

### 2.4 文档原则
- CLAUDE.md 只保留核心原则和快速参考（本文档），控制在 ~150 行
- 架构细节 → `docs/ARCHITECTURE.md`
- 开发指南 → `docs/DEV_GUIDE.md`
- 场景规划 → `docs/SCENE_PLAN.md`

## 三、技术架构

```
xianxingdaishu/
├── CLAUDE.md                ← 项目宪章（本文件）
├── docs/
│   ├── ARCHITECTURE.md      ← 面板系统、矩阵模块、数据流详解
│   ├── DEV_GUIDE.md         ← 如何新增场景、技术栈、参数类型参考
│   ├── SCENE_ANALYSIS.md     ← 第1~3章逐节详尽分析（教材对照，31场景全规划）
│   ├── SCENE_PLAN.md         ← 场景规划速查（已被 SCENE_ANALYSIS.md 取代）
│   └── WORK_LOG_2026-08-06.md ← 近期工作总结
├── .vscode/
│   ├── launch.json          ← F5 启动调试
│   └── tasks.json           ← Ctrl+Shift+B 启动服务器
├── setup.bat / start.bat / app.py / requirements.txt
├── server/                  ← Python 后端（唯一事实来源）
│   ├── main.py              ← FastAPI + 场景注册表
│   ├── math_engine.py       ← NumPy/SciPy 封装
│   └── scenes/              ← 18 个场景（base.py + ch0~ch3 + matrix_calculator）
├── client/                  ← 浏览器前端（只负责画）
│   ├── index.html           ← 三栏布局 + 4 个 dock zone
│   ├── css/style.css        ← 深色主题 + 面板 + 暗色滚动条
│   └── js/
│       ├── main.js          ← Three.js 初始化 + 面板初始化 + 场景切换
│       ├── api.js           ← fetch 封装
│       ├── draw-utils.js    ← 通用 3D 绘图（drawVector/drawPlane/...）
│       ├── scene-base.js    ← SceneRenderer 基类（性能优化：200ms加载门+KaTeX缓存+80ms节流）
│       ├── panel-system.js  ← 可拖拽停靠面板系统
│       ├── matrix-display.js← 矩阵 KaTeX 渲染（唯一出口）
│       ├── vendor/          ← Three.js 0.160.0 本地文件
│       └── renderers/       ← 18 个场景渲染器
└── notebooks/verify.ipynb
```

## 四、API 协议

```
POST /api/scene/{scene_name}
Body: { param1: value1, ... }
Response: {
    success: true/false,
    data: {
        scene_data: {
            matrices: [{label, symbol, data}]  ← 可选，有此字段自动显示矩阵面板
            ...场景特定数据
        },
        verification: { passed, checks: [{label, passed}] },
        solution_info: { type: "unique"|"none"|"infinite", description, details }
    }
}

GET /api/scenes → { success, data: [{id, title, chapter, description, params, presets}] }
```

## 五、面板速查

| 面板 ID | 标题 | 默认区域 | 默认折叠 |
|---------|------|----------|----------|
| `scenenav` | 📐 场景目录 | left | 否 |
| `presets` | 📌 预设情形 | right | 否 |
| `params` | 🎚 参数调节 | right | 否 |
| `camera` | 📷 视角控制 | right | 否 |
| `solution` | 📊 分析结果 | right | 否 |
| `lecture` | 📖 讲解 | right | 否 |
| `verify` | 🔍 数学验证 | right | **是** |
| `matrix` | 📋 矩阵数据 | top | 否 |

4 个停靠区：`left`(vertical) / `right`(vertical) / `top`(horizontal) / `bottom`(horizontal)

## 六、当前已实现场景（18个）🟢 = 有动画

### 基础概念（2个）—— 矩阵 = 线性变换的几何直觉
| 路由 | 标题 | 动画 |
|------|------|------|
| `ch0_r0_matrix_columns` | 矩阵的列——线性变换的密码 | 🟢 基向量滑翔 |
| `ch0_r1_column_decompose` | 逐列拆解——行与列的几何含义 | 🟢 形状变形 |

### 第1章 行列式（3个）
| 路由 | 标题 | 动画 |
|------|------|------|
| `ch1_r0_det_area` | 2阶行列式的几何意义 | 🟢 正方形→平行四边形 |
| `ch1_r1_det_volume` | 3阶行列式与平行六面体 | — |
| `ch1_r2_det_properties` | 行列式的性质 | — |

### 第2章 矩阵及其运算（3个）
| 路由 | 标题 | 动画 |
|------|------|------|
| `ch2_r0_matrix_multiply` | 矩阵乘法的几何含义 | 🟢 四形状+向量同时变形 |
| `ch2_r1_matrix_inverse` | 逆矩阵 | 🟢 可逆还原/不可逆降维 |
| `ch2_r2_matrix_transpose` | 转置与内积保持 | — |

### 第3章 矩阵的秩与线性方程组（9个）
| 路由 | 标题 | 动画 |
|------|------|------|
| `ch3_r0_rank_intuition` | 秩的直观理解 | 🟢 圆周+网格点变形 |
| `ch3_r1_two_vectors` | 两个向量的关系 | — |
| `ch3_r2_three_vectors` | 三个向量与张成空间 | — |
| `ch3_r3_matrix_rank` | 矩阵的秩（立方体变换） | 🟢 立方体变形 |
| `ch3_r4_2x2_system` | 2×2 方程组 | — |
| `ch3_r5_3x3_system` | 3×3 方程组（三平面） | — |
| `ch3_r6_homogeneous` | 齐次 vs 非齐次 | — |
| `ch3_r7_rank_solution` | 秩与解的关系 | — |
| `ch3_r8_rank_properties` | 秩的性质 | — |

### 工具（1个）
| 路由 | 标题 | 动画 |
|------|------|------|
| `matrix_calculator` | 矩阵计算器 | 🟢 2×2/3×3方阵变换 |

## 七、环境信息

- **Conda 环境**：`xianxingdaishu`（Python 3.11）
- **Conda 路径**：`D:\Users\fkl\anaconda3`
- **端口**：`http://localhost:8765`
- **Three.js**：0.160.0（本地文件 `client/js/vendor/`）
- **KaTeX**：0.16.11（CDN，需网络）

## 八、常见操作

### 启动
- **F5**：自动启动服务器 + 等待 uvicorn 就绪 → 系统默认浏览器打开 `localhost:8765`
  - ⚠️ **禁用 Edge 鼠标手势**（`edge://settings/appearance` → 鼠标手势 → 关），否则右键平移失效
  - ⚠️ **禁止在 VSCode Simple Browser 中打开**——会触发 GPU 花屏
- **备选**：双击 `start.bat` 或手动 `conda activate xianxingdaishu && python app.py`

### 右键与滚轮
- **右键**：`#viewer` 上 4 层 JS 拦截，外部浏览器需关闭鼠标手势
- **滚轮**：`.panel-body` 内的滚轮放行，其余 viewer 区域交给 OrbitControls 缩放
- **侧栏折叠**：左栏/右栏边缘有 `◀`/`▶` 按钮，可折叠至 32px，状态持久化到 `localStorage`
- **GPU 花屏**：VSCode（Electron/Chromium）与某些 NVIDIA 驱动冲突。用外部浏览器，和本项目无关

### 渲染优化
- 页面不可见时暂停 `requestAnimationFrame`，释放 GPU
- 加载遮罩 200ms 延迟门（避免快速请求时的闪烁）
- KaTeX 讲解面板渲染缓存（相同内容不重复渲染）
- 滑块节流 80ms（减少拖拽时的 API 调用密度）

### 新增场景（标准流程）

1. **后端**：`server/scenes/chX_rY_name.py`，继承 `BaseScene`，实现 `get_meta()` + `compute()`
2. **渲染器**：`client/js/renderers/chX_rY_name.js`，继承 `SceneRenderer`，实现 `buildScene(data)`
3. **注册后端**：`server/main.py` 添加 import + `SCENE_REGISTRY`
4. **注册前端**：`client/js/main.js` 添加 import + `SCENE_RENDERERS` + `getSceneMeta()` 元信息
5. **菜单**：`main.js` 的 `buildNavPanel()` 中添加 `<button class="scene-btn" data-scene="...">`

### 动画场景开发

若场景需要动画，参考现有 8 个动画场景（ch0_r0, ch0_r1, ch1_r0, ch2_r0, ch2_r1, ch3_r0, ch3_r3, matrix_calculator）的模式：
- **工厂函数**：`createAnimatableArrow()` / `createUpdatableWireframe()` / `createUpdatableFaces()` —— 从已有渲染器复制
- **动画数据**：`buildScene()` 中填充 `this._animShapes` 和 `this._animVectors`
- **动画循环**：`_startAnimation()` → `_animFrame()` → `_interpolateToT(t)`，1.5s ease-out cubic
- **重播按钮**：`_addAnimationButton()` + 覆写 `_computeAndRender()` 防止按钮被 innerHTML 覆盖
- **LaTeX 转义**：Python f-string 中 `\\begin` → `\begin`，`\\\\` → `\\`

### 调试
- 后端日志：VSCode 终端（F5）或服务器窗口
- 前端错误：F12 控制台
- API 测试：`curl -X POST http://localhost:8765/api/scene/ch3_r4_2x2_system -H "Content-Type: application/json" -d '{"a1":2,...}'`
- 重置面板：控制台执行 `localStorage.clear(); location.reload();`

## 九、待扩展

### 第1~3章待建场景（详见 docs/SCENE_ANALYSIS.md — 逐节详尽分析）

> ⚠️ **教材纠正**：克拉默法则在教材Ch2§4（非Ch1）；初等矩阵在教材Ch3§2（非Ch2）；Ch3有4小节。

| 优先级 | 场景（共16个待建） | 教材位置 |
|--------|-------------------|---------|
| ⭐⭐⭐ | ch1_r3_permutation — 排列、对换与空间定向 | Ch1§2 |
| ⭐⭐⭐ | ch1_r4_cofactor — 按行列展开的几何 | Ch1§5 |
| ⭐⭐ | ch1_r5_orientation — 行列式与定向 | Ch1§2/§4 |
| ⭐⭐ | ch1_r6_det_dependence — 行列式与线性相关性 | Ch1§4 |
| ⭐⭐⭐ | ch2_r3_ax_eq_b — 行视图与列视图 | Ch2§1 |
| ⭐⭐⭐ | ch2_r4_cramer — 克拉默法则：解=体积比 | Ch2§4 |
| ⭐⭐ | ch2_r5_det_product — det(AB)=det(A)det(B) | Ch2§2 |
| ⭐ | ch2_r6_matrix_power — Aⁿ的几何 | Ch2§2 |
| ⭐ | ch2_r7_block — 分块矩阵的几何 | Ch2§5 |
| ⭐⭐⭐ | ch3_r9_gaussian — 高斯消元法的几何过程 | Ch3§1 |
| ⭐⭐⭐ | ch3_r10_row_echelon — 行阶梯形与主元 | Ch3§1 |
| ⭐ | ch3_r11_equivalence — 等价矩阵与标准形 | Ch3§1 |
| ⭐⭐⭐ | ch3_r12_elem_row — 初等矩阵·行变换(左乘) | Ch3§2 |
| ⭐⭐⭐ | ch3_r13_elem_col — 初等矩阵·列变换(右乘) | Ch3§2 |
| ⭐⭐⭐ | ch3_r14_solution_structure — 解的结构：特解+零空间 | Ch3§4/Ch4§5 |
| ⭐⭐ | ch3_r15_least_squares — 最小二乘的几何 | Ch3§4 延伸 |

### 远期（第4~6章）
- [ ] 第四章：向量组的线性相关性（极大无关组、基与维数）
- [ ] 第五章：特征值与二次型（特征向量方向、对角化、二次型曲面）
- [ ] 第六章：线性空间与线性变换（基变换、像空间与核空间）

### 基础设施
- [ ] 向量拖拽交互（直接拖拽箭头端点修改向量）
- [ ] 将动画工厂函数提取到 `draw-utils.js`（当前各场景各有一份拷贝）

## 十、用户偏好

- 界面全中文 · 数学公式 LaTeX（兼容 Obsidian） · 参数：滑块+数值输入双向联动
- 每场景 3-5 个预设 · 验证面板默认折叠 · 笔记交 Obsidian AI 管家整理
