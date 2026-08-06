"""
ch3_r12 — 初等矩阵与行变换（左乘）

几何直觉：左乘初等矩阵 = 行变换。三种初等行变换对应三种几何操作：
- E_swap（交换两行）→ 形状关于某平面翻转
- E_scale（某行倍乘 k）→ 某方向拉伸 k 倍
- E_add（某行的 k 倍加到另一行）→ 剪切变换

高斯消元的每一步 = 一个初等矩阵左乘。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R12ElemRow(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r12_elem_row",
            "title": "初等矩阵与行变换（左乘）",
            "chapter": "第3章 矩阵的初等变换与线性方程组",
            "description": "左乘初等矩阵 = 行变换。三种初等矩阵（交换/倍乘/倍加）对 3D 形状的几何效果。带动画演示。",
            "params": {
                "dim": {
                    "label": "矩阵维度",
                    "type": "choice",
                    "default": 3,
                    "options": [2, 3],
                },
                "elem_type": {
                    "label": "初等变换类型",
                    "type": "choice",
                    "default": "swap",
                    "options": ["swap", "scale", "add"],
                },
                "i": {
                    "label": "行索引 i（0-based）",
                    "type": "int",
                    "default": 0, "min": 0, "max": 2, "step": 1,
                },
                "j": {
                    "label": "行索引 j（0-based）",
                    "type": "int",
                    "default": 1, "min": 0, "max": 2, "step": 1,
                },
                "k": {
                    "label": "倍数 k",
                    "type": "float",
                    "default": 2.0, "min": -5.0, "max": 5.0, "step": 0.1,
                },
                "matrix_A": {
                    "label": "矩阵 A（被左乘的矩阵）",
                    "type": "matrix",
                    "rows": 3, "cols": 3,
                    "default": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                },
            },
            "presets": [
                {
                    "label": "交换前两行（翻转）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "swap", "i": 0, "j": 1, "k": 1,
                        "matrix_A": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "第0行×2（拉伸）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "scale", "i": 0, "j": 0, "k": 2,
                        "matrix_A": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "第1行+第0行×1.5（剪切）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "add", "i": 1, "j": 0, "k": 1.5,
                        "matrix_A": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "2×2 行交换",
                    "type": "unique",
                    "params": {
                        "dim": 2, "elem_type": "swap", "i": 0, "j": 1, "k": 0,
                        "matrix_A": [[2, 1], [0, 3]],
                    },
                },
                {
                    "label": "2×2 剪切",
                    "type": "unique",
                    "params": {
                        "dim": 2, "elem_type": "add", "i": 1, "j": 0, "k": 1,
                        "matrix_A": [[2, 1], [0, 3]],
                    },
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        dim = int(params.get("dim", 3))
        elem_type = params.get("elem_type", "swap")
        i = int(params.get("i", 0))
        j = int(params.get("j", 1))
        k = float(params.get("k", 1.0))

        # 读取矩阵 A
        matrix_A_raw = params.get("matrix_A")
        if isinstance(matrix_A_raw, list):
            A = self._build_matrix(matrix_A_raw, dim, dim)
        else:
            A = np.eye(dim, dtype=float)

        # 生成初等矩阵 E（左乘 = 行变换）
        n = dim
        if elem_type == "swap":
            if i == j:
                j = (i + 1) % n
            i = min(i, n - 1)
            j = min(j, n - 1)
            if i == j:
                j = (i + 1) % n
            E = M.elem_swap(n, i, j)
            op_desc = f"交换第 {i+1} 行和第 {j+1} 行"
            det_E = -1.0
        elif elem_type == "scale":
            i = min(i, n - 1)
            if abs(k) < 1e-10:
                k = 2.0  # 不允许零倍乘
            E = M.elem_scale(n, i, k)
            op_desc = f"第 {i+1} 行 × {k}"
            det_E = float(k)
        else:  # add
            i = min(i, n - 1)
            j = min(j, n - 1)
            if i == j:
                j = (i + 1) % n
            E = M.elem_add(n, i, j, k)
            op_desc = f"第 {i+1} 行 + (第 {j+1} 行 × {k})"
            det_E = 1.0

        # 计算 E × A（左乘 = 行变换）
        EA = E @ A

        # 验证
        verification_checks = [
            {"label": f"det(E) = {det_E:.4f}（预期值）",
             "passed": bool(np.isclose(M.matrix_determinant(E), det_E, atol=1e-8))},
            {"label": f"E 为初等矩阵（可逆）",
             "passed": bool(M.matrix_rank(E) == n)},
            {"label": f"行变换结果 EA 维度正确",
             "passed": EA.shape == (n, n)},
        ]

        # 变换数据（用于 3D 动画）
        transforms = []
        t_A = self._get_transform_data(A, "A")
        if t_A:
            transforms.append(t_A)
        t_EA = self._get_transform_data(EA, f"E·A ({op_desc})")
        if t_EA:
            transforms.append(t_EA)

        matrices = [
            {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
            {"label": "初等矩阵 E", "symbol": "E", "data": E.tolist()},
            {"label": f"行变换结果", "symbol": "E \\cdot A",
             "data": EA.tolist()},
        ]

        scene_data = {
            "matrices": matrices,
            "transforms": transforms,
            "elem_type": elem_type,
            "op_desc": op_desc,
            "dim": dim,
            "E_matrix": E.tolist(),
        }

        # ─── 讲解内容 ─────────────────────────────────────
        elem_type_cn = {"swap": "交换", "scale": "倍乘", "add": "倍加"}[elem_type]

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(verification_checks),
            "solution_info": {
                "type": "unique",
                "description": f"左乘初等矩阵：{op_desc}。\\n\\n"
                               f"左乘 = 行操作。改变的是目标空间的坐标。"
                               f"高斯消元的每一步都是一个初等矩阵左乘。",
                "details": {
                    "操作类型": {"swap": "交换两行", "scale": "倍乘某行", "add": "倍加某行"}[elem_type],
                    "行操作描述": op_desc,
                    "det(E)": f"{M.matrix_determinant(E):.4f}",
                    "E 可逆": "是",
                },
            },
            "lecture": {"sections": [
                {
                    "title": "什么是初等矩阵？",
                    "content": (
                        "初等矩阵是由**单位矩阵 $I$ 经过一次初等变换**得到的矩阵。\n\n"
                        + "三种初等矩阵：\n"
                        + "1. **$E_{swap}$（交换矩阵）**：交换 $I$ 的两行 → $\\det(E) = -1$，对应**镜像翻转**\n"
                        + "2. **$E_{scale}$（倍乘矩阵）**：将 $I$ 的某行乘以 $k$ → $\\det(E) = k$，对应**单方向拉伸**\n"
                        + "3. **$E_{add}$（倍加矩阵）**：将 $I$ 的某行加上另一行的 $k$ 倍 → $\\det(E) = 1$，对应**剪切变换**\n\n"
                        + "初等矩阵都是**可逆**的（$\\det \\neq 0$），且逆矩阵仍是初等矩阵。"
                    ),
                },
                {
                    "title": "为什么左乘 = 行变换？",
                    "content": (
                        "**左乘**初等矩阵 $E \\cdot A$ 意味着：用 $E$ 去**重新组合 $A$ 的行向量**。\n\n"
                        + "从矩阵乘法角度看：\n"
                        + "- $E$ 的第 $i$ 行决定了结果矩阵的第 $i$ 行是 $A$ 各行的什么组合\n"
                        + "- 交换 $E$ 的两行 → $A$ 对应两行被交换\n"
                        + "- $E$ 某行乘以 $k$ → $A$ 对应行被乘以 $k$\n"
                        + "- $E$ 第 $i$ 行 = 第 $i$ 行 + $k$·第 $j$ 行 → $A$ 的行发生同样操作\n\n"
                        + "**直觉**：方程组 $Ax = b$ 中，左乘作用于方程（行）——交换两个方程、方程乘常数、方程相加减。"
                    ),
                },
                {
                    "title": "三种行变换的几何效果",
                    "content": (
                        f"当前操作：**{op_desc}**（{elem_type_cn}）\n\n"
                        + "对于 $3 \\times 3$ 矩阵（视为线性变换），左乘初等矩阵的效果：\n\n"
                        + "- **交换两行** → 形状关于某平面对称翻转（改变了手性，$\\det$ 变号）\n"
                        + "- **某行倍乘 $k$** → 在对应坐标轴方向拉伸 $k$ 倍（$\\det$ 乘以 $k$）\n"
                        + "- **某行 + 另一行的 $k$ 倍** → **剪切变换**——形状被「推」成平行四边形（$\\det$ **不变**！）\n\n"
                        + "注意：倍加变换不改变行列式——这是高斯消元「不改变解」的根本原因。"
                    ),
                },
                {
                    "title": "高斯消元 = 一连串初等矩阵左乘",
                    "content": (
                        "高斯消元的过程，就是反复左乘初等矩阵：\n\n"
                        + "$$E_k \\cdots E_2 \\cdot E_1 \\cdot A = U$$\n\n"
                        + "其中 $U$ 是行阶梯形矩阵（上三角）。\n\n"
                        + "**每消去一个元素，就是一次左乘 $E_{add}$。** 消元完成后通过回代得到最简形。\n\n"
                        + "如果 $A$ 可逆，最终得到 $E_{total} \\cdot A = I$，即 **$E_{total} = A^{-1}$**。\n"
                        + "这就是「用初等变换求逆矩阵」的数学原理。"
                    ),
                },
            ]},
        }

    def _build_matrix(self, data: list, rows: int, cols: int) -> np.ndarray:
        """从二维列表构建 NumPy 矩阵"""
        arr = np.zeros((rows, cols), dtype=float)
        for r in range(min(rows, len(data))):
            row_data = data[r] if isinstance(data[r], list) else []
            for c in range(min(cols, len(row_data))):
                try:
                    arr[r, c] = float(row_data[c])
                except (ValueError, TypeError):
                    arr[r, c] = 0.0
        return arr

    def _get_transform_data(self, mat: np.ndarray, label: str = "") -> dict | None:
        """为 2×2 或 3×3 方阵生成单位形状→变换形状的数据"""
        n = mat.shape[0]
        if n == 2:
            unit = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]
            transformed = []
            for v in unit:
                t = mat @ np.array([v[0], v[1]])
                transformed.append([float(t[0]), float(t[1]), 0.0])
            return {
                "dim": 2,
                "label": label,
                "unit_shape": unit,
                "transformed_shape": transformed,
                "det": M.matrix_determinant(mat),
            }
        elif n == 3:
            unit = [
                [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
                [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
            ]
            transformed = []
            for v in unit:
                t = mat @ np.array(v)
                transformed.append([float(t[0]), float(t[1]), float(t[2])])
            return {
                "dim": 3,
                "label": label,
                "unit_shape": unit,
                "transformed_shape": transformed,
                "det": M.matrix_determinant(mat),
            }
        return None
