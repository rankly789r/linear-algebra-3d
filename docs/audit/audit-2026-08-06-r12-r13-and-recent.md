# 审计报告 — 2026-08-06（ch3_r12/r13 + 近期改动）

**审计范围**：ch3_r12/r13 初等矩阵场景 + 最近 3 次 commit 的全部改动 + 全量文档一致性检查
**审计时间**：2026-08-06 下午
**依据**：CLAUDE.md、ARCHITECTURE.md、DEV_GUIDE.md、AI_AUDITOR_PROMPT.md

---

## 问题汇总

| # | 严重度 | 位置 | 简述 |
|---|--------|------|------|
| 1 | 🔴 | [draw-utils.js:34](client/js/draw-utils.js#L34) | `createBaseScene()` 死代码——全项目无调用 |
| 2 | 🔴 | [ch1_r0_equation_to_plane.py:24-33](server/scenes/ch1_r0_equation_to_plane.py#L24-L33) | 新场景手写参数，违反工厂函数规则 |
| 3 | 🔴 | [DEV_GUIDE.md:275](docs/DEV_GUIDE.md#L275) | 文档过期：设置菜单位置仍写 `main.js` |
| 4 | 🔴 | [AI_PANEL_LEAD_PROMPT.md:88-91](docs/AI_PANEL_LEAD_PROMPT.md#L88-L91) | 文档过期：3 处 `main.js initSettingsMenu()` 引用 |
| 5 | 🔴 | [CLAUDE.md:46-55](CLAUDE.md) | 场景数量过期：写 24 实际 26，缺 2 个场景 |
| 6 | 🔴 | [CLAUDE.md:101-144](CLAUDE.md) | ch1_r0_equation_to_plane / ch3_r7b_col_space 未列入场景清单 |
| 7 | 🔴 | [ch3_r12_elem_row.py](server/scenes/ch3_r12_elem_row.py) / [ch3_r13_elem_col.py](server/scenes/ch3_r13_elem_col.py) | 两个场景均无 `lecture` 内容，讲觧面板为空 |
| 8 | 🟡 | [ch3_r12_elem_row.py:201-214](server/scenes/ch3_r12_elem_row.py#) / ch3_r13 | `_build_matrix()` + `_get_transform_data()` 三份重复（含 matrix_calculator） |
| 9 | 🟡 | [ch3_r12_elem_row.js:27-209](client/js/renderers/ch3_r12_elem_row.js) / ch3_r13 | 两个 JS 渲染器 ~95% 重复（200行×2） |
| 10 | 🟡 | [ch3_r12_elem_row.py:38-43](server/scenes/ch3_r12_elem_row.py#L38-L43) | 参数标签对学生不友好（0-based、英文选项） |
| 11 | 🟡 | [settings-menu.js:84-93](client/js/settings-menu.js#L84-L93) | `panelDefs` 与 main.js 面板配置存在耦合（两份独立列表需手动同步） |
| 12 | 🟢 | [SCENE_ANALYSIS.md](docs/SCENE_ANALYSIS.md) / [SCENE_PLAN.md](docs/SCENE_PLAN.md) | 2 个新场景未列入规划文档 |

> 注：#7-10 的详细分析和修复建议见 [docs/audit/work-brief-ch3-r12-r13-fixes.md](docs/audit/work-brief-ch3-r12-r13-fixes.md)，此处不重复展开。

---

## 详细分析

### 🔴 严重问题

#### #1 · `createBaseScene()` — 死代码

- **位置**：[draw-utils.js:34](client/js/draw-utils.js#L34)
- **症状**：函数定义但全项目无任何调用（grep 搜索 `createBaseScene` 仅匹配到定义行）
- **根因**：可能是旧版本遗留下的初始化函数，被 inline 代码替代后忘记删除
- **修复**：删除该函数（约 14 行，含光照初始化等）
- **验证**：`grep -r "createBaseScene" client/js/` 仅匹配到定义行

#### #2 · 新场景手写参数，违反工厂函数规则

- **位置**：[ch1_r0_equation_to_plane.py:24-33](server/scenes/ch1_r0_equation_to_plane.py#L24-L33)
- **症状**：这是本次 commit 中新增的场景，但 8 个参数全部手写 Unicode 下标标签。而 `matrix_params` 和 `vector_params` 工厂函数已在 `base.py` 中可用，其他 5 个存量场景也已迁移。
- **根因**：该场景可能是与工厂函数并行的另一个分支开发的，未同步。
- **修复**：
  ```python
  # 改前（24-33行）：
  "params": {
      "a11": {"label": "a₁₁", "type": "float", "default": 2, ...},
      # ... 8 个手写参数 ...
  },
  
  # 改后：
  "params": {
      **matrix_params("a", 2, 3, defaults=[[2,1,3],[0,0,0]], min=-5, max=5),
      **vector_params("b", 2, defaults=[0, 0], min=-10, max=10),
  },
  ```
- **验证**：重启服务，确认参数面板滑块标签正确、预设加载正常

#### #3 · DEV_GUIDE.md 文档过期

- **位置**：[DEV_GUIDE.md:275](docs/DEV_GUIDE.md#L275)
- **症状**：「实现位于 `main.js` 的 `initSettingsMenu()` IIFE 中」——实际上 `initSettingsMenu()` 已提取到 `settings-menu.js`
- **修复**：改为「实现位于 `client/js/settings-menu.js` 的 `initSettingsMenu()` 函数中」

#### #4 · AI_PANEL_LEAD_PROMPT.md 文档过期

- **位置**：[AI_PANEL_LEAD_PROMPT.md:88-91](docs/AI_PANEL_LEAD_PROMPT.md#L88-L91)
- **症状**：localStorage 速查表中 3 处引用 `main.js` `initSettingsMenu()`：
  - `la_grid_settings`（行 88）
  - `la_color_theme`（行 89）
  - `la_settings_collapsed`（行 91）
- **修复**：将 `main.js` 改为 `settings-menu.js`

#### #5 · CLAUDE.md 场景数量过期

- **位置**：[CLAUDE.md:46](CLAUDE.md)（`24 个场景`）、[CLAUDE.md:55](CLAUDE.md)（`24 个场景渲染器`）、[CLAUDE.md:101](CLAUDE.md)（`场景清单（24个）`）、[CLAUDE.md:146](CLAUDE.md)（`全部 24 个场景`）
- **症状**：文件系统实际有 26 个场景（25 个教学场景 + 1 个矩阵计算器）。缺少的 2 个：`ch1_r0_equation_to_plane` 和 `ch3_r7b_col_space`
- **修复**：将 24 改为 26（共 4 处），并在场景清单中补上这两个场景

#### #6 · CLAUDE.md 场景清单缺项

- **位置**：[CLAUDE.md §6](CLAUDE.md)
- **症状**：场景清单表中缺少以下两个已存在的场景：
  - `ch1_r0_equation_to_plane` — 从方程到平面的几何对应（基础章节）
  - `ch3_r7b_col_space` — 列空间与解的存在性（Ch3）
- **修复**：在场景清单对应的章节分类中补上这两行

#### #7 · ch3_r12 / ch3_r13 无讲觧内容

- **位置**：[ch3_r12_elem_row.py](server/scenes/ch3_r12_elem_row.py)、[ch3_r13_elem_col.py](server/scenes/ch3_r13_elem_col.py)
- **症状**：`compute()` 返回值中无 `lecture` 字段，`scene-base.js:557` 检查 `data.lecture.sections` 为空，讲觧面板不渲染任何内容
- **对比**：`ch1_r0_equation_to_plane.py`（同样是新场景）有完整的 3 节 lecture 内容
- **详细修复建议**：见 [work-brief-ch3-r12-r13-fixes.md](docs/audit/work-brief-ch3-r12-r13-fixes.md) §S1

---

### 🟡 中等问题

#### #8 · 后端辅助方法三份重复

- **位置**：`ch3_r12_elem_row.py` / `ch3_r13_elem_col.py` / `matrix_calculator.py`
- **症状**：`_build_matrix()` 和 `_get_transform_data()` 三个文件中一字不差
- **修复**：移到 `base.py` 的 `BaseScene` 类中
- **详细修复建议**：见 [work-brief-ch3-r12-r13-fixes.md](docs/audit/work-brief-ch3-r12-r13-fixes.md) §S2

#### #9 · JS 渲染器 95% 重复

- **位置**：[ch3_r12_elem_row.js](client/js/renderers/ch3_r12_elem_row.js)（210行） / [ch3_r13_elem_col.js](client/js/renderers/ch3_r13_elem_col.js)（202行）
- **症状**：仅 3 处不同（颜色常量、箭头标签文字、storage key），其余代码一字不差
- **修复**：合并为共享渲染器或提取公共基类
- **详细修复建议**：见 [work-brief-ch3-r12-r13-fixes.md](docs/audit/work-brief-ch3-r12-r13-fixes.md) §P1

#### #10 · 参数标签对学生不友好

- **位置**：[ch3_r12_elem_row.py:38-43](server/scenes/ch3_r12_elem_row.py#L38-L43)
- **症状**：行列索引标「0-based」、变换类型选项为英文 `swap`/`scale`/`add`
- **修复**：改为 1-based + 中文
- **详细修复建议**：见 [work-brief-ch3-r12-r13-fixes.md](docs/audit/work-brief-ch3-r12-r13-fixes.md) §S3

#### #11 · panelDefs 与 main.js 面板配置耦合

- **位置**：[settings-menu.js:84-93](client/js/settings-menu.js#L84-L93)
- **症状**：`panelDefs` 硬编码了 8 个面板的列表，与 `main.js:22-29` 中的 `panels` 配置完全独立。如果日后增删面板（如新增一个教学面板），需要在两处同步修改，容易遗漏。
- **根因**：设置菜单模块需要知道有哪些可管理的面板，但 PanelManager 未暴露「列出所有面板」的 API
- **修复建议**（非紧急）：在 PanelManager 上加一个 `getPanels()` 方法返回面板列表，settings-menu.js 动态读取而非硬编码

---

### 🟢 低优先级

#### #12 · 规划文档未列入新场景

- **位置**：[SCENE_ANALYSIS.md](docs/SCENE_ANALYSIS.md)、[SCENE_PLAN.md](docs/SCENE_PLAN.md)
- **症状**：`ch1_r0_equation_to_plane` 和 `ch3_r7b_col_space` 已存在但规划文档中未提及
- **修复**：在 SCENE_ANALYSIS.md 中将对应章节的场景标记为 ✅，在 SCENE_PLAN.md 中补上条目

---

## 正面发现

1. **`base.py` 工厂函数实现质量高**：`_flatten_defaults()` 优雅地处理了 None/float/list/2D-list 四种 defaults 格式，`matrix_params()` 和 `vector_params()` 的 API 简洁直观
2. **5 个存量场景已迁移到工厂函数**：ch0_r0、ch1_r1、ch2_r3、ch3_r0、ch3_r4 全部从手写参数改为 `**matrix_params(...)`，迁移质量好
3. **`settings-menu.js` 提取干净**：从 main.js 的 400 行 IIFE 变为独立模块，注入依赖清晰，边界明确。`window._refreshParamRangeUI` 全局回调保持了向后兼容
4. **`ch1_r0_equation_to_plane.py` 整体质量高**：有完整的 lecture 内容、丰富的预设、清晰的代码注释，唯一不足是参数没用工厂函数
5. **资源管理正确**：`updateGridRenderer()` 正确 dispose 旧 geometry/materials 再创建新的；scene-base destroy 正确 cancelAnimationFrame
6. **`__init__.py` 导出正确**：工厂函数已通过 `from .base import ...` 导出

---

## 建议优先级

**本次必须修（🔴）**：
- #1 删除 `createBaseScene()` 死代码
- #2 `ch1_r0_equation_to_plane.py` 迁移到工厂函数
- #3 DEV_GUIDE.md 修正设置菜单位置
- #4 AI_PANEL_LEAD_PROMPT.md 修正 3 处引用
- #5 CLAUDE.md 场景数量 24→26
- #6 CLAUDE.md 场景清单补 2 个场景
- #7 ch3_r12/r13 补充 lecture 内容（已有详细 work-brief）

**建议尽快修（🟡）**：
- #8 提取重复的 `_build_matrix` / `_get_transform_data` 到 base.py
- #9 合并 ch3_r12/r13 JS 渲染器
- #10 ch3_r12/r13 参数标签中文化

**可以以后修（🟢）**：
- #11 panelDefs 与 main.js 解耦
- #12 规划文档更新
