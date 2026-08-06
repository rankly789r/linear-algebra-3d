# 工作简报：矩阵参数自动生成器

> **执行者**：面板负责人（或任何能改 `server/scenes/base.py` 的 AI）
> **审计**：实现后提交审计
> **日期**：2026-08-06

## 问题

场景开发者在 `get_meta()` 里手写参数定义时，矩阵元素的标签（`a₁₁`、`a₁₂` 等）全靠手动输入 Unicode 下标字符。一个 3×3 矩阵要手写 9 行几乎一样的代码，容易把下标写错（比如把第 2 行第 3 列写成 `a₃₂` 而不是 `a₂₃`）。

而且，代码审查也无法保证正确性——审查者也得逐行核对下标。

## 方案

在 `server/scenes/base.py` 中新增两个工厂函数，将"定义矩阵"变成一行代码：

```python
from server.scenes.base import BaseScene, SceneParams, matrix_params, vector_params

class MyScene(BaseScene):
    @staticmethod
    def get_meta() -> dict:
        return {
            "params": {
                **matrix_params("a", 2, 2, defaults=[2,1, 0,3]),
                **vector_params("b", 2, defaults=[4, 6]),
            },
        }
```

上面的代码自动展开为：

```python
"a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
"a12": {"label": "a₁₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
"a21": {"label": "a₂₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
"a22": {"label": "a₂₂", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
"b1":  {"label": "b₁",  "type": "float", "default": 4, "min": -10, "max": 10, "step": 0.1},
"b2":  {"label": "b₂",  "type": "float", "default": 6, "min": -10, "max": 10, "step": 0.1},
```

## 实现细节

### 1. Unicode 映射

```python
_SUBSCRIPTS = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
}

def _to_subscript(num: int) -> str:
    """将整数转换为 Unicode 下标字符串，如 12 → '₁₂'"""
    return ''.join(_SUBSCRIPTS[d] for d in str(num))
```

### 2. `matrix_params()` 函数

```python
def matrix_params(
    prefix: str,
    rows: int,
    cols: int,
    defaults: Union[float, list, None] = None,
    min: float = -5.0,
    max: float = 5.0,
    step: float = 0.1,
) -> dict:
    """
    为 prefix 前缀的 rows×cols 矩阵生成参数字典。

    参数：
        prefix: 矩阵字母前缀，"a" → 参数名 a11, a12, ...
        rows: 行数
        cols: 列数
        defaults: 默认值，支持三种形式：
            - None: 全部默认 0.0
            - float: 全部使用该值
            - list: 按行主序填充（一维列表，可以 append 补齐或截断）
            - list[list]: 二维列表，defaults[i][j] 是第 i 行第 j 列的默认值
        min, max, step: 滑块的统一范围（所有元素共用）

    返回：
        dict，适合 ** 展开到 params 字典中
    """
```

**defaults 处理逻辑：**
- `None` → 所有元素默认值 `0.0`
- `float` → 所有元素使用该值
- `list[float]` → 按行主序（第 1 行从左到右，然后第 2 行……），不足补 0，超出的忽略
- `list[list[float]]` → `defaults[r][c]` 是第 r 行第 c 列的默认值

建议处理逻辑（伪代码）：

```python
flat = []
if defaults is None:
    flat = [0.0] * (rows * cols)
elif isinstance(defaults, (int, float)):
    flat = [float(defaults)] * (rows * cols)
elif isinstance(defaults, list) and defaults and isinstance(defaults[0], list):
    # 二维列表
    for r in range(rows):
        row = defaults[r] if r < len(defaults) else []
        for c in range(cols):
            flat.append(float(row[c]) if c < len(row) else 0.0)
else:
    # 一维列表
    flat = [float(v) for v in defaults]
    while len(flat) < rows * cols:
        flat.append(0.0)
    flat = flat[:rows * cols]
```

### 3. `vector_params()` 函数

```python
def vector_params(
    prefix: str,
    size: int,
    defaults: Union[float, list, None] = None,
    min: float = -10.0,
    max: float = 10.0,
    step: float = 0.1,
) -> dict:
    """
    为 prefix 前缀的 size 维向量生成参数字典。

    参数：
        prefix: 向量字母前缀，"b" → 参数名 b1, b2, ...
        size: 向量维数
        defaults: 默认值（同 matrix_params 的单值或一维列表形式）
        min, max, step: 滑块的统一范围

    返回：
        dict，适合 ** 展开到 params 字典中

    实现提示：直接调用 matrix_params(prefix, size, 1, defaults, min, max, step)
    因为向量 = size×1 矩阵。
    """
```

### 4. 放到 `base.py` 的位置

放在 `BaseScene` 类定义之后、`# ─── 辅助函数 ──────────────` 分隔线之下。同时更新 `base.py` 顶部 docstring 的参数定义格式说明，补充一条"也可以用工厂函数"。

### 5. `__init__.py` 导出

确保 `from server.scenes.base import matrix_params, vector_params` 可用：

```python
# server/scenes/__init__.py
from .base import BaseScene, SceneParams, matrix_params, vector_params
```

## 使用示例

### 示例 1：2×2 矩阵 + 2 维向量（最常用）

```python
"params": {
    **matrix_params("a", 2, 2, defaults=[2, -1, 1, 1]),
    **vector_params("b", 2, defaults=[1, 3]),
}
```

展开为 6 个参数：`a11` `a12` `a21` `a22` `b1` `b2`，全部 float 类型。

### 示例 2：3×3 矩阵，自定义默认值二维列表

```python
"params": {
    **matrix_params("a", 3, 3, defaults=[[2, -1, 0], [1, 1, 0], [0, 0, 1]]),
}
```

### 示例 3：混合手动参数 + 自动参数

```python
"params": {
    "mode": {"label": "变换维度", "type": "choice", "default": "2x2", "options": ["2x2", "3x3"]},
    **matrix_params("a", 2, 2, defaults=[2, 1, 0, 3]),
}
```

## 存量场景迁移

不要求一次性全改。迁移规则：
- 新场景**必须**用工厂函数
- 已有场景在修改时顺手改（像这次修 `ch3_r4_2x2_system.py` 的场景就适合立刻迁移）
- 审计时发现手写矩阵参数会提示但不算违规

优先改这 5 个有矩阵参数的场景（从简到难）：
1. `ch3_r4_2x2_system.py` — 刚修过，2×2 最简单
2. `ch2_r3_ax_eq_b.py` — 2×2 + 向量
3. `ch3_r0_rank_intuition.py` — 3×2 矩阵
4. `ch1_r1_det_volume.py` — 3×3 矩阵
5. `ch0_r0_matrix_columns.py` — 混合 mode 参数 + 3×3 矩阵

## 不影响的部分

- `SceneParams` 类：无需改动
- `compute()` 方法中 `params.get("a11", ...)` 的用法：完全不变
- 前端任何代码：生成的参数字典格式与手写完全一致
- 预设格式：`"params": {"a11": 2, ...}` 照旧

## 验证方式

```python
# 在 Python 环境中测试
from server.scenes.base import matrix_params, vector_params

# 测试 1：基本展开
params = {**matrix_params("a", 2, 2, defaults=[2, -1, 1, 1])}
assert "a11" in params
assert params["a11"]["label"] == "a₁₁"
assert params["a12"]["label"] == "a₁₂"
assert params["a21"]["label"] == "a₂₁"
assert params["a22"]["label"] == "a₂₂"
assert params["a11"]["default"] == 2

# 测试 2：向量展开
params = {**vector_params("b", 3, defaults=[4, 5, 6])}
assert params["b1"]["label"] == "b₁"
assert params["b3"]["label"] == "b₃"
assert params["b1"]["default"] == 4

# 测试 3：二维 defaults
params = {**matrix_params("a", 2, 2, defaults=[[2, -1], [1, 1]])}
assert params["a11"]["default"] == 2
assert params["a12"]["default"] == -1

# 测试 4：单值 defaults
params = {**matrix_params("a", 2, 2, defaults=0.0)}
assert params["a11"]["default"] == 0.0
assert params["a22"]["default"] == 0.0

print("全部通过")
```
