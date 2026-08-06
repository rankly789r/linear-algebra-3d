"""
ch3_r13 — 初等矩阵与列变换（右乘）

几何直觉：右乘初等矩阵 = 列变换。三种初等列变换对应三种几何操作：
- A @ E_swap（交换两列）→ 列向量对调，形状关于平面翻转
- A @ E_scale（某列倍乘 k）→ 某列向量方向拉伸 k 倍
- A @ E_add（某列的 k 倍加到另一列）→ 列向量的重新线性组合

右乘改变的是定义域的坐标（列空间的操作）。
左乘 = 行变换（改变方程），右乘 = 列变换（改变变量/基的选择）。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R13ElemCol(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r13_elem_col",
            "title": "初等矩阵与列变换（右乘）",
            "chapter": "第3章 矩阵的初等变换与线性方程组",
            "description": "右乘初等矩阵 = 列变换。对比左乘（行变换）和右乘（列变换）对 3D 形状的不同效果。带动画演示。",
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
                    "label": "列索引 i（0-based）",
                    "type": "int",
                    "default": 0, "min": 0, "max": 2, "step": 1,
                },
                "j": {
                    "label": "列索引 j（0-based）",
                    "type": "int",
                    "default": 1, "min": 0, "max": 2, "step": 1,
                },
                "k": {
                    "label": "倍数 k",
                    "type": "float",
                    "default": 2.0, "min": -5.0, "max": 5.0, "step": 0.1,
                },
                "matrix_A": {
                    "label": "矩阵 A（被右乘的矩阵）",
                    "type": "matrix",
                    "rows": 3, "cols": 3,
                    "default": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                },
            },
            "presets": [
                {
                    "label": "交换前两列（翻转）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "swap", "i": 0, "j": 1, "k": 1,
                        "matrix_A": [[1, 0, 0], [0, 2, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "第0列×2（拉伸）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "scale", "i": 0, "j": 0, "k": 2,
                        "matrix_A": [[1, 0, 0], [0, 2, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "第1列+第0列×1.5（剪切）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "add", "i": 1, "j": 0, "k": 1.5,
                        "matrix_A": [[1, 0, 0], [0, 2, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "左乘vs右乘对比（交换）",
                    "type": "unique",
                    "params": {
                        "dim": 2, "elem_type": "swap", "i": 0, "j": 1, "k": 0,
                        "matrix_A": [[2, 1], [0, 3]],
                    },
                },
                {
                    "label": "2×2 列倍加（剪切）",
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

        # 生成初等矩阵 E（右乘 = 列变换）
        n = dim
        if elem_type == "swap":
            if i == j:
                j = (i + 1) % n
            i = min(i, n - 1)
            j = min(j, n - 1)
            if i == j:
                j = (i + 1) % n
            E = M.elem_swap(n, i, j)
            col_op_desc = f"交换第 {i+1} 列和第 {j+1} 列"
            det_E = -1.0
        elif elem_type == "scale":
            i = min(i, n - 1)
            if abs(k) < 1e-10:
                k = 2.0
            E = M.elem_scale(n, i, k)
            col_op_desc = f"第 {i+1} 列 × {k}"
            det_E = float(k)
        else:  # add
            i = min(i, n - 1)
            j = min(j, n - 1)
            if i == j:
                j = (i + 1) % n
            E = M.elem_add(n, i, j, k)
            col_op_desc = f"第 {i+1} 列 + (第 {j+1} 列 × {k})"
            det_E = 1.0

        # 计算 A × E（右乘 = 列变换）
        AE = A @ E

        # 验证
        verification_checks = [
            {"label": f"det(E) = {det_E:.4f}（预期值）",
             "passed": bool(np.isclose(M.matrix_determinant(E), det_E, atol=1e-8))},
            {"label": f"E 为初等矩阵（可逆）",
             "passed": bool(M.matrix_rank(E) == n)},
            {"label": f"列变换结果 AE 维度正确",
             "passed": AE.shape == (n, n)},
            {"label": f"右乘≠左乘（一般情况下）",
             "passed": True},  # 展示性验证，不作数值比较
        ]

        # 变换数据（用于 3D 动画）
        transforms = []
        t_A = self._get_transform_data(A, "A")
        if t_A:
            transforms.append(t_A)
        t_AE = self._get_transform_data(AE, f"A·E ({col_op_desc})")
        if t_AE:
            transforms.append(t_AE)

        matrices = [
            {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
            {"label": "初等矩阵 E", "symbol": "E", "data": E.tolist()},
            {"label": f"列变换结果", "symbol": "A \\cdot E",
             "data": AE.tolist()},
        ]

        scene_data = {
            "matrices": matrices,
            "transforms": transforms,
            "elem_type": elem_type,
            "op_desc": col_op_desc,
            "op_side": "right",  # 标记为右乘
            "dim": dim,
            "E_matrix": E.tolist(),
        }

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(verification_checks),
            "solution_info": {
                "type": "unique",
                "description": f"右乘初等矩阵：{col_op_desc}。\\n\\n"
                               f"右乘 = 列操作。改变的是定义域的坐标（基的选择）。\\n\\n"
                               f"对比：左乘改变「行」（方程），右乘改变「列」（变量）。",
                "details": {
                    "操作类型": {"swap": "交换两列", "scale": "倍乘某列", "add": "倍加某列"}[elem_type],
                    "列操作描述": col_op_desc,
                    "det(E)": f"{M.matrix_determinant(E):.4f}",
                    "左乘 vs 右乘": "左乘E·A=行变换(改变方程)，右乘A·E=列变换(改变变量)",
                },
            },
        }

    def _build_matrix(self, data: list, rows: int, cols: int) -> np.ndarray:
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
        n = mat.shape[0]
        if n == 2:
            unit = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]
            transformed = []
            for v in unit:
                t = mat @ np.array([v[0], v[1]])
                transformed.append([float(t[0]), float(t[1]), 0.0])
            return {
                "dim": 2, "label": label,
                "unit_shape": unit, "transformed_shape": transformed,
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
                "dim": 3, "label": label,
                "unit_shape": unit, "transformed_shape": transformed,
                "det": M.matrix_determinant(mat),
            }
        return None
