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
├── docs/                    ← ARCHITECTURE / DEV_GUIDE / SCENE_ANALYSIS
├── server/                  ← Python 后端（FastAPI + NumPy，唯一事实来源）
│   ├── main.py              ← 场景注册表 + AI 答疑端点
│   ├── math_engine.py       ← NumPy/SciPy 封装
│   └── scenes/              ← 26 个场景
├── client/                  ← 浏览器前端（Three.js，只负责画）
│   ├── index.html           ← 三栏布局 + 4 个 dock zone
│   └── js/
│       ├── main.js          ← 入口：Three.js 初始化 + 场景切换
│       ├── scene-base.js    ← SceneRenderer 基类
│       ├── panel-system.js  ← 可拖拽停靠面板
│       ├── matrix-display.js← 矩阵 KaTeX 渲染（唯一出口）
│       ├── draw-utils.js    ← 通用 3D 绘图
│       └── renderers/       ← 26 个场景渲染器
├── .vscode/                 ← F5 调试配置
├── app.py / start.bat / setup.bat
└── notebooks/
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

POST /api/chat/{scene_name}
Body: { params, message, history: [{role, content}], api_key: "sk-..." }
Response: { success, data: { reply: "..." } }
说明：后端先执行场景计算获取当前数据，再作为上下文调用 DeepSeek API。
      api_key 由前端从 localStorage 读取并传入，不存储在后端。

## 五、面板速查

| 面板 ID | 标题 | 默认区域 | 默认折叠 |
|---------|------|----------|----------|
| `scenenav` | 📐 场景目录 | left | 否 |
| `presets` | 📌 预设情形 | right | 否 |
| `params` | 🎚 参数调节 | right | 否 |
| `camera` | 📷 视角控制 | right | 否 |
| `solution` | 📊 分析结果 | right | 否 |
| `lecture` | 📖 讲解（含 AI 答疑） | right | 否 |
| `verify` | 🔍 数学验证 | right | **是** |
| `matrix` | 📋 矩阵数据 | top | 否 |

4 个停靠区：`left`(vertical) / `right`(vertical) / `top`(horizontal) / `bottom`(horizontal)

## 六、场景清单（26个）🟢 = 有动画

| 章 | 路由 | 标题 |
|----|------|------|
| 基础 | `ch0_r0_matrix_columns` | 矩阵的列——线性变换的密码 🟢 |
| 基础 | `ch0_r1_column_decompose` | 逐列拆解——行与列的几何含义 🟢 |
| 基础 | `ch1_r0_equation_to_plane` | 从方程到平面的几何对应 |
| Ch1 | `ch1_r0_det_area` | 2阶行列式的几何意义 🟢 |
| Ch1 | `ch1_r1_det_volume` | 3阶行列式与平行六面体 |
| Ch1 | `ch1_r2_det_properties` | 行列式的性质 |
| Ch1 | `ch1_r3_permutation` | 排列、对换与空间定向 |
| Ch2 | `ch2_r0_matrix_multiply` | 矩阵乘法的几何含义 🟢 |
| Ch2 | `ch2_r1_matrix_inverse` | 逆矩阵 🟢 |
| Ch2 | `ch2_r2_matrix_transpose` | 转置与内积保持 |
| Ch2 | `ch2_r3_ax_eq_b` | 行视图与列视图 |
| Ch2 | `ch2_r4_cramer` | 克拉默法则：解=体积比 |
| Ch3 | `ch3_r0_rank_intuition` | 秩的直观理解 🟢 |
| Ch3 | `ch3_r1_two_vectors` | 两个向量的关系 |
| Ch3 | `ch3_r2_three_vectors` | 三个向量与张成空间 |
| Ch3 | `ch3_r3_matrix_rank` | 矩阵的秩（立方体变换） 🟢 |
| Ch3 | `ch3_r4_2x2_system` | 2×2 方程组 |
| Ch3 | `ch3_r5_3x3_system` | 3×3 方程组（三平面） |
| Ch3 | `ch3_r6_homogeneous` | 齐次 vs 非齐次 |
| Ch3 | `ch3_r7_rank_solution` | 秩与解的关系 |
| Ch3 | `ch3_r7b_col_space` | 列空间与解的存在性 |
| Ch3 | `ch3_r8_rank_properties` | 秩的性质 |
| Ch3 | `ch3_r9_gaussian` | 高斯消元法的几何过程 |
| Ch3 | `ch3_r12_elem_row` | 初等矩阵·行变换(左乘) 🟢 |
| Ch3 | `ch3_r13_elem_col` | 初等矩阵·列变换(右乘) 🟢 |
| 工具 | `matrix_calculator` | 矩阵计算器 🟢 |

## 七、环境信息

- **Conda 环境**：`xianxingdaishu`（Python 3.11）
- **Conda 路径**：`D:\Users\fkl\anaconda3`
- **端口**：`http://localhost:8765`
- **Three.js**：0.160.0（本地文件 `client/js/vendor/`）
- **KaTeX**：0.16.11（CDN，需网络）

## 八、常见操作

> 详细步骤见 [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)。

⚠️ **关键警告**：禁用 Edge 鼠标手势；禁止 VSCode Simple Browser（GPU 花屏）。

### 新增场景（5 步速查）

> 详细代码模板和风格规范见 [docs/AI_SCENE_DEV_GUIDE.md](docs/AI_SCENE_DEV_GUIDE.md)（AI 审计员撰写，提取了全部 26 个场景的共性模式）。

1. `server/scenes/chX_rY_name.py` — 继承 BaseScene，实现 `get_meta()` + `compute()`
2. `client/js/renderers/chX_rY_name.js` — 继承 SceneRenderer，实现 `buildScene()`
3. `server/main.py` — import + `SCENE_REGISTRY` 注册
4. `client/js/main.js` — import + `SCENE_RENDERERS` + `getSceneMeta()`
5. `main.js` `buildNavPanel()` — 菜单按钮

**参数命名铁律**：矩阵元素用行列下标 `a11`/`a12`/`a21`/`a22`（标签 `a₁₁` 等），禁止方程系数记法 `a₁`/`b₁`/`c₁`。

### 动画场景
参考 ch0_r0/ch2_r0/ch3_r0 等 10 个已有动画场景。工厂函数已提取到 `draw-utils.js`（`createUpdatableWireframe`、`createUpdatableFaces`、`createAnimatableArrow`），新场景从 `draw-utils.js` 导入即可。详见 [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md) 第十节。

### 调试
后端：VSCode 终端 · 前端：F12 · API：`curl -X POST ...` · 重置面板：`localStorage.clear(); location.reload();`

## 九、待扩展

### 第1~3章待建场景（详见 docs/SCENE_ANALYSIS.md — 逐节详尽分析）

> ⚠️ **教材纠正**：克拉默法则在教材Ch2§4（非Ch1）；初等矩阵在教材Ch3§2（非Ch2）；Ch3有4小节。

| 优先级 | 场景（共10个待建） | 教材位置 |
|--------|-------------------|---------|
| ⭐⭐⭐ | ch1_r4_cofactor — 按行列展开的几何 | Ch1§5 |
| ⭐⭐ | ch1_r5_orientation — 行列式与定向 | Ch1§2/§4 |
| ⭐⭐ | ch1_r6_det_dependence — 行列式与线性相关性 | Ch1§4 |
| ⭐⭐ | ch2_r5_det_product — det(AB)=det(A)det(B) | Ch2§2 |
| ⭐ | ch2_r6_matrix_power — Aⁿ的几何 | Ch2§2 |
| ⭐ | ch2_r7_block — 分块矩阵的几何 | Ch2§5 |
| ⭐⭐⭐ | ch3_r10_row_echelon — 行阶梯形与主元 | Ch3§1 |
| ⭐ | ch3_r11_equivalence — 等价矩阵与标准形 | Ch3§1 |
| ⭐⭐⭐ | ch3_r14_solution_structure — 解的结构：特解+零空间 | Ch3§4/Ch4§5 |
| ⭐⭐ | ch3_r15_least_squares — 最小二乘的几何 | Ch3§4 延伸 |

### 远期（第4~6章）
- [ ] 第四章：向量组的线性相关性（极大无关组、基与维数）
- [ ] 第五章：特征值与二次型（特征向量方向、对角化、二次型曲面）
- [ ] 第六章：线性空间与线性变换（基变换、像空间与核空间）

### 基础设施
- [ ] 向量拖拽交互（直接拖拽箭头端点修改向量）
- [ ] 矩阵参数自动生成器（`matrix_params` / `vector_params` 工厂函数，见 [docs/audit/work-brief-matrix-params.md](docs/audit/work-brief-matrix-params.md)）
- [x] 将动画工厂函数提取到 `draw-utils.js`~~（当前各场景各有一份拷贝）~~ ✅ 已完成（c378041）
- [x] 将动画控制 UI 提取到 `scene-base.js`（`_addAnimControlUI` 等） ✅ 已完成（c05b012）
- [ ] 场景标题栏菜单按钮：右上角 `#scene-info-header` 旁加一个图标按钮，点击弹出下拉菜单（主题切换、捐赠码等）

## 十、用户偏好

- 界面全中文 · 数学公式 LaTeX（兼容 Obsidian） · 参数：滑块+数值输入双向联动
- 每场景 3-5 个预设 · 验证面板默认折叠 · 笔记交 Obsidian AI 管家整理

## 十一、AI 角色分工

本项目有 4 个专职 AI 角色，各自维护独立的提示词文件：

| 角色 | 提示词 | 技术参考 | 职责 |
|------|--------|----------|------|
| 🔍 AI 审计员 | [docs/audit/AI_AUDITOR_PROMPT.md](docs/audit/AI_AUDITOR_PROMPT.md) | — | 代码审查、安全审计、质量把关 |
| 🖥️ AI 面板负责人 | [docs/AI_PANEL_LEAD_PROMPT.md](docs/AI_PANEL_LEAD_PROMPT.md) | — | 所有 UI/面板/CSS/持久化 |
| 🎓 AI 场景开发者 | [docs/AI_SCENE_DEV_PROMPT.md](docs/AI_SCENE_DEV_PROMPT.md) | [AI_SCENE_DEV_GUIDE.md](docs/AI_SCENE_DEV_GUIDE.md) | 新增/修改数学场景，理解用户困惑并搭建 3D 可视化 |
| 📦 AI 发版顾问 | — | — | 打包发布规划（待激活） |

> 修改此项目前，必须阅读：
> - **架构约束与已知陷阱** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（第六节「已知问题与注意事项」）
> - **开发规范与自查清单** → [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)（第十二节「提交前自查清单」+ 第十三节「常见陷阱」）
> - **场景规划** → [docs/SCENE_ANALYSIS.md](docs/SCENE_ANALYSIS.md)
>
> 修改完成后：在 `docs/` 下写工作日志；发现新陷阱则更新 DEV_GUIDE.md 第十三节。
