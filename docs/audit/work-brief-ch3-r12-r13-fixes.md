# 工作简报：ch3_r12 / ch3_r13 初等矩阵场景问题清单

> **日期**：2026-08-06
> **来源**：用户反馈——「左乘右乘场景不直观，动画不好，讲觧面板没内容」
> **场景文件**：
> - `server/scenes/ch3_r12_elem_row.py` + `client/js/renderers/ch3_r12_elem_row.js`
> - `server/scenes/ch3_r13_elem_col.py` + `client/js/renderers/ch3_r13_elem_col.js`
> - 创建于 `c8400c3`（今天早上），一次提交，未经迭代打磨

---

## 问题总览

| # | 问题 | 严重度 | 归谁 |
|---|------|--------|------|
| S1 | 讲觧面板完全空白——无 `lecture` 内容 | 🔴 高 | 🎓 场景开发者 |
| S2 | 后端 `_build_matrix()` / `_get_transform_data()` 三份重复 | 🟡 中 | 🎓 场景开发者 |
| S3 | 参数标签对学生不友好（0-based、英文选项） | 🟡 中 | 🎓 场景开发者 |
| S4 | `matrix_A` 参数没用工厂函数 | 🟡 中 | 🎓 场景开发者 |
| P1 | 两个 JS 渲染器 ~95% 重复（~200行×2） | 🔴 高 | 🖥️ 面板负责人 |
| P2 | CUBE_EDGES / CUBE_FACES 常量重复定义 | 🟢 低 | 🖥️ 面板负责人 |
| P3 | Canvas Sprite 标签创建逻辑重复 | 🟢 低 | 🖥️ 面板负责人 |
| UX1 | 动画设计不直观——两个并排形状而非一个形状被变换 | 🔴 高 | 🎓 场景开发者 |
| UX2 | 交换变换的动画无「翻转」感 | 🟡 中 | 🎓 场景开发者 |

---

## 场景开发者（🎓）的问题

### S1 · 讲觧面板完全空白

**现状**：两个场景的 `compute()` 返回值中都没有 `"lecture"` 字段。SceneRenderer 基类在 `scene-base.js:557` 检查 `data.lecture.sections`，没有就什么都不渲染。学生看到的讲觧面板是空的。

**对比**：`ch3_r4_2x2_system.py` 有 3 节讲觧内容（方程组=直线的交点 / 解的三种情形 / 核心判定 r(A) vs r(A|b)），每节有标题+LaTeX 内容。

**要求**：为每个场景至少写 3-4 节讲觧内容，覆盖：

ch3_r12（左乘/行变换）：
- 什么是初等矩阵？（三种类型：交换/倍乘/倍加）
- 为什么左乘 = 行变换？（从线性方程组的角度理解：左乘改变的是方程）
- 三种初等行变换的几何效果（各对应什么形状变化）
- 高斯消元 = 一连串初等矩阵左乘

ch3_r13（右乘/列变换）：
- 右乘与左乘的区别（改变方程 vs 改变变量/基）
- 为什么右乘 = 列变换？（列向量的重新线性组合）
- 左乘 vs 右乘对比表格
- 实际应用：什么时候用左乘？什么时候用右乘？

参考 `ch3_r4_2x2_system.py` 的 `lecture_sections` 格式：
```python
lecture_sections = [
    {
        "title": "标题",
        "content": "Markdown + LaTeX 内容...",
    },
]
# 最后放到返回值里：
"lecture": {"sections": lecture_sections},
```

---

### S2 · 后端辅助方法三份重复

**现状**：`_build_matrix()` 和 `_get_transform_data()` 在三个文件中一字不差地重复：

| 文件 | 方法 |
|------|------|
| `server/scenes/ch3_r12_elem_row.py` | `_build_matrix()` + `_get_transform_data()` |
| `server/scenes/ch3_r13_elem_col.py` | `_build_matrix()` + `_get_transform_data()` |
| `server/scenes/matrix_calculator.py` | `_build_matrix()` + `_get_transform_data()` |

**要求**：
1. 把这两个方法移到 `server/scenes/base.py` 的 `BaseScene` 类中
2. 三个场景文件删除各自的拷贝，改用继承的 `self._build_matrix(...)` / `self._get_transform_data(...)`
3. 如果 `matrix_calculator.py` 也用了相同的 `_build_matrix`，一并改

---

### S3 · 参数标签对学生不友好

**现状问题**：

| 参数 | 当前标签 | 问题 |
|------|---------|------|
| `i` | `行索引 i（0-based）` | 教材里行列从 1 开始编号，学生不理解 0-based |
| `j` | `行索引 j（0-based）` | 同上 |
| `elem_type` | 选项 `["swap", "scale", "add"]` | 英文程序员术语，无中文标签 |

类似问题在 ch3_r13 中也存在（`列索引 i（0-based）`）。

**要求**：
1. `i`/`j` 标签改为 1-based：`起始行号（从1开始）`，计算时内部 `-1`
2. `elem_type` 改为 choice 类型加 display 映射，或直接用中文选项：
   ```
   "options": [
       {"value": "swap", "label": "交换两行"},
       {"value": "scale", "label": "倍乘某行"},
       {"value": "add", "label": "某行+另一行的k倍"},
   ]
   ```
   注意：当前参数系统是否支持 `{"value", "label"}` 格式的 options 需确认。如果不支持，至少把 label 翻译成中文提示。

---

### S4 · 矩阵参数没用工厂函数

**现状**：`matrix_A` 用自定义 `"type": "matrix"` 和手写的 `rows`/`cols`/`default`。

**要求**：如果这个场景的矩阵 A 确实需要用户编辑（这是个合理的需求——让学生看到不同矩阵被变换），保持现状也可以。但如果改成标准参数格式，应该用 `matrix_params("a", 3, 3, ...)` 让 A 的 9 个元素各自有独立的滑块。这个由场景开发者判断哪种交互方式更适合教学。

---

### UX1 · 动画设计不直观

**现状**：画两个并排的形状——左边是 A 变换的形状，右边是 E·A 变换的形状。动画只是顶点从「单位方形」插值到「最终形状」。

**问题**：学生想看的是**同一个形状被行/列变换操作改变的过程**。两个并排形状让人困惑——到底哪个是变换前的、哪个是变换后的？

**建议方向**：
- 显示**一个形状**（A 变换后的形状），旁边用虚线 ghost 显示单位形状作为参考
- 动画展示 E 逐步作用于这个形状——比如倍加变换，形状像被「推」成平行四边形
- 交换变换（swap）可以用镜像翻转动画，而不是简单顶点插值
- 左乘场景加一步展示：先看原始形状（A），再看行变换后的形状（E·A），突出「行变换改变了行」
- 右乘场景同理：A → A·E，突出「列变换改变了列」

---

### UX2 · 交换变换无翻转感

**现状**：交换两行/列的动画跟倍乘、倍加一样是线性顶点插值。但从几何上看，交换变换对应的是关于某平面的镜像翻转，应该有翻转的过程感。

**建议**：交换操作的动画可以走弧形路径（绕对称轴旋转），而不是直线插值。

---

## 面板负责人（🖥️）的问题

### P1 · 两个 JS 渲染器 ~95% 重复

**现状**：[ch3_r12_elem_row.js](client/js/renderers/ch3_r12_elem_row.js)（210 行）和 [ch3_r13_elem_col.js](client/js/renderers/ch3_r13_elem_col.js)（202 行）只有三处不同：

| 差异点 | ch3_r12（左乘） | ch3_r13（右乘） |
|--------|----------------|----------------|
| 颜色常量 | `[0x4cc9f0, 0xffd166]`（蓝/黄） | `[0x06d6a0, 0xef476f]`（绿/红） |
| 箭头标签 | `左乘 E` | `右乘 E` |
| storage key | `la_ch3r12_anim_auto` | `la_ch3r13_anim_auto` |

其余代码——`buildScene()` 的结构、`_startAnimation()`、`_animFrame()`、`_interpolateToT()`、`_setToTarget()`——完全一样。

**要求**（二选一）：

**方案 A（推荐）**：提取共享渲染器 `elem_transform_common.js`，两个场景的渲染器变成薄包装：
```js
// ch3_r12_elem_row.js (~15行)
import { ElemTransformRenderer } from './elem_transform_common.js';
export class Ch3R12ElemRowRenderer extends ElemTransformRenderer {
    static COLORS = [0x4cc9f0, 0xffd166];
    static ARROW_LABEL = '左乘 E';
    static STORAGE_KEY = 'la_ch3r12_anim_auto';
}
```

**方案 B**：合并为一个渲染器，根据 `scene_data.op_side`（已有 `"left"` / `"right"` 字段）动态切换颜色和标签文字。

---

### P2 · 常量重复定义

`CUBE_EDGES` 和 `CUBE_FACES` 在两个渲染器里各定义了一份（共 4 处）。应该放到 `draw-utils.js` 中，和已有的 `EDGES_QUAD`、`FACES_QUAD` 放在一起：

```js
// draw-utils.js 新增
export const CUBE_EDGES = [...];
export const CUBE_FACES = [...];
```

两个渲染器改为 `import { ..., CUBE_EDGES, CUBE_FACES } from '../draw-utils.js';`

---

### P3 · Canvas Sprite 标签创建重复

`buildScene()` 中有两段几乎一样的 Canvas → Sprite 创建代码（标签 sprite + 箭头 sprite），每个渲染器写了两遍。如果以后有第四个场景需要并排展示形状+箭头，又会复制一份。

**建议**：在 `draw-utils.js` 中加一个 `createCanvasSprite(text, subtext, color, width, height)` 工具函数。不紧急——等第三个场景需要时再提取也行。

---

## 改动优先级

| 顺序 | 条目 | 谁干 | 预估工作量 |
|------|------|------|-----------|
| 1 | S1 讲觧面板填内容 | 🎓 场景开发者 | 1h（两个场景各 3-4 节） |
| 2 | UX1 重做动画设计 | 🎓 场景开发者 | 2-3h（需重新思考展示方式） |
| 3 | S2 提取重复方法到 base.py | 🎓 场景开发者 | 30min |
| 4 | S3 参数标签中文化 | 🎓 场景开发者 | 30min |
| 5 | P1 合并 JS 渲染器 | 🖥️ 面板负责人 | 1h |
| 6 | P2 提取常量到 draw-utils | 🖥️ 面板负责人 | 15min |
| 7 | UX2 交换动画走弧形路径 | 🎓 场景开发者 | 1h（依赖 UX1 设计确定） |

---

## 验证方式

1. 启动项目，打开 ch3_r12 和 ch3_r13 场景
2. 讲觧面板有内容，每个子节可折叠
3. 参数滑块标签用中文、行列从 1 开始
4. 点击 5 个预设，全部正常工作
5. 动画：点击重播，看到直观的形状变换过程
6. 两个场景切换到对方的预设参数，行为不同（左乘≠右乘）
7. F12 Console 无报错
8. matrix_calculator 场景不受影响
