# 通知：矩阵参数工厂函数已上线

> 复制以下内容，发给 AI 场景开发者。建议在开始任何新场景开发之前先发送这段。

---

## 新工具：`matrix_params()` 和 `vector_params()`

`server/scenes/base.py` 新增了两个工厂函数，用于自动生成矩阵和向量的参数定义。**从现在开始，所有新场景必须使用这两个函数来定义矩阵元素参数，禁止手写。**

### 为什么

以前你要手写：

```python
"params": {
    "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
    "a12": {"label": "a₁₂", "type": "float", "default": -1, "min": -5, "max": 5, "step": 0.1},
    "a21": {"label": "a₂₁", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
    "a22": {"label": "a₂₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
    "b1":  {"label": "b₁",  "type": "float", "default": 1, "min": -10, "max": 10, "step": 0.1},
    "b2":  {"label": "b₂",  "type": "float", "default": 3, "min": -10, "max": 10, "step": 0.1},
}
```

9 个 Unicode 下标字符全靠手打，3×3 矩阵要写 9 行几乎一样的代码。人容易写错，审查也审查不过来。

现在只需：

```python
from server.scenes.base import BaseScene, SceneParams, matrix_params, vector_params

"params": {
    **matrix_params("a", 2, 2, defaults=[2, -1, 1, 1], min=-5, max=5),
    **vector_params("b", 2, defaults=[1, 3], min=-10, max=10),
}
```

标签 `a₁₁`、`a₁₂`、`b₁`、`b₂` 全部自动生成，下标是程序算的，永不出错。

### API

#### `matrix_params(prefix, rows, cols, defaults=None, min=-5.0, max=5.0, step=0.1)`

| 参数 | 说明 |
|------|------|
| `prefix` | 矩阵字母前缀，`"a"` → 参数名 `a11`, `a12`, ... |
| `rows` | 行数 |
| `cols` | 列数 |
| `defaults` | 默认值。支持三种形式：`None`（全 0）、`float`（全用该值）、`list`（行主序一维列表）、`list[list]`（二维列表按行列取值） |
| `min`, `max`, `step` | 滑块统一范围 |

#### `vector_params(prefix, size, defaults=None, min=-10.0, max=10.0, step=0.1)`

同 `matrix_params(prefix, size, 1, ...)`，用于向量。

### 示例

```python
# 3×3 矩阵，二维列表指定每个元素的默认值
**matrix_params("a", 3, 3, defaults=[
    [2, -1, 0],
    [1,  1, 0],
    [0,  0, 1],
])

# 2×3 矩阵（如 ch3_r6_homogeneous）
**matrix_params("a", 2, 3, defaults=[1, 0, 0, 0, 1, 0])

# 混合：手动参数 + 自动参数
"params": {
    "mode": {"label": "变换维度", "type": "choice", "default": "2x2", "options": ["2x2", "3x3"]},
    **matrix_params("a", 2, 2, defaults=[2, 1, 0, 3]),
}
```

### 注意事项

1. **`compute()` 里的用法不变**：还是照常用 `params.get("a11", 2)`，工厂函数只影响 `get_meta()` 里的参数定义
2. **预设的 params key 不变**：`"params": {"a11": 2, "a12": -1, ...}` 照旧手写，因为预设值是固定的具体数值
3. **新场景必须用，旧场景改到时顺手迁移**

### 参考

完整设计文档 → `docs/audit/work-brief-matrix-params.md`
相关规范 → `docs/AI_SCENE_DEV_GUIDE.md` §7.2 命名规范
