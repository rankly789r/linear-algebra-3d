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
             "passed": bool(np.isclose(np.linalg.det(E), det_E, atol=1e-8))},
            {"label": f"E 为初等矩阵（可逆）",
             "passed": bool(np.linalg.matrix_rank(E) == n)},
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
                    "det(E)": f"{np.linalg.det(E):.4f}",
                    "E 可逆": "是",
                },
            },
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
                "det": float(np.linalg.det(mat)),
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
                "det": float(np.linalg.det(mat)),
            }
        return None
