"""
场景 3.4：2×2 线性方程组 — 两直线相交的几何解释

方程组：
    a₁₁x + a₁₂y = b₁
    a₂₁x + a₂₂y = b₂

几何含义：
- 两条直线交于一点 → 唯一解
- 两条直线平行 → 无解
- 两条直线重合 → 无穷多解
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams, matrix_params, vector_params
from server.math_engine import MathEngine as M


class Ch3R42x2System(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r4_2x2_system",
            "title": "3.4 2×2 线性方程组",
            "chapter": "第三章",
            "description": "两个未知数，两个方程——在平面上是两条直线。交于一点（唯一解）、平行（无解）、或重合（无穷解）。",
            "params": {
                **matrix_params("a", 2, 2, defaults=[2, -1, 1, 1], min=-5, max=5),
                **vector_params("b", 2, defaults=[1, 3], min=-10, max=10),
            },
            "presets": [
                {"label": "唯一解", "type": "unique",
                 "params": {"a11": 2, "a12": -1, "b1": 1, "a21": 1, "a22": 1, "b2": 3}},
                {"label": "无解（平行）", "type": "none",
                 "params": {"a11": 1, "a12": 1, "b1": 2, "a21": 1, "a22": 1, "b2": 5}},
                {"label": "无穷解（重合）", "type": "infinite",
                 "params": {"a11": 1, "a12": 1, "b1": 2, "a21": 2, "a22": 2, "b2": 4}},
                {"label": "垂直相交", "type": "unique",
                 "params": {"a11": 1, "a12": 0, "b1": 2, "a21": 0, "a22": 1, "b2": 3}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        a11 = params.get("a11", 2); a12 = params.get("a12", -1); b1 = params.get("b1", 1)
        a21 = params.get("a21", 1); a22 = params.get("a22", 1);  b2 = params.get("b2", 3)

        A = np.array([[a11, a12], [a21, a22]], dtype=float)
        b_vec = np.array([b1, b2], dtype=float)

        # 用 NumPy 求解
        sol_type, x_sol = M.solve_linear(A, b_vec)
        rank_A = M.matrix_rank(A)
        Ab = np.column_stack([A, b_vec])
        rank_Ab = M.matrix_rank(Ab)

        # 为在 3D 中显示，将 2D 直线嵌入 XY 平面
        # 直线 a*x + b*y = c 的几何表示
        lines_3d = []
        for coeff_a, coeff_b, coeff_c, label in [(a11, a12, b1, "L₁"), (a21, a22, b2, "L₂")]:
            pts = self._line_3d_points(coeff_a, coeff_b, coeff_c)
            lines_3d.append({"points": pts, "label": label})

        # 解的信息
        if sol_type == "unique" and x_sol is not None:
            solution_3d = [float(x_sol[0]), float(x_sol[1]), 0.0]
            desc = f"两条直线交于一点 ({x_sol[0]:.2f}, {x_sol[1]:.2f})"
        elif sol_type == "none":
            solution_3d = None
            desc = "两条直线平行，没有交点，方程组无解。"
        elif sol_type == "infinite":
            # 取直线上一点
            x0 = self._point_on_line(a11, a12, b1)
            solution_3d = [float(x0[0]), float(x0[1]), 0.0] if x0 is not None else [0, 0, 0]
            desc = "两条直线重合，直线上每个点都是解，方程组有无穷多解。"
        else:
            solution_3d = None
            desc = ""

        # 验证
        checks = [
            {"label": f"系数矩阵 A 的秩 = {rank_A}", "passed": True},
            {"label": f"增广矩阵 [A|b] 的秩 = {rank_Ab}", "passed": True},
            {"label": f"r(A) = r(A|b) = {rank_A == rank_Ab}", "passed": rank_A == rank_Ab},
        ]

        if x_sol is not None and sol_type == "unique":
            satisfied = M.verify_solution(A, x_sol, b_vec)
            checks.append({
                "label": f"解 ({x_sol[0]:.2f}, {x_sol[1]:.2f}) 满足方程",
                "passed": satisfied
            })

        scene_data = {
            "lines": lines_3d,
            "solution_point": solution_3d,
            "solution_type": sol_type,
            "rank_A": rank_A,
            "rank_Ab": rank_Ab,
            "coefficients": {
                "A": A.tolist(),
                "b": b_vec.tolist(),
            },
            "matrices": [
                {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "增广矩阵 [A|b]", "symbol": "[A|\\mathbf{b}]", "data": Ab.tolist()},
            ],
        }

        # ─── 讲解内容 ─────────────────────────────────────
        lecture_sections = [
            {
                "title": "方程组 = 直线的交点",
                "content": (
                    "二元一次方程组：\n\n"
                    + f"$$\\begin{{cases}} {a11}x + {'+' if a12 >= 0 else ''}{a12}y = {b1} \\\\ {a21}x + {'+' if a22 >= 0 else ''}{a22}y = {b2} \\end{{cases}}$$\n\n"
                    + "每个方程代表平面上的一条直线。\n"
                    + "**方程组的解 = 两条直线的交点**。"
                ),
            },
            {
                "title": "解的三种情形（同济教材 §3.4）",
                "content": (
                    f"当前：$r(A) = {rank_A}$，$r([A|b]) = {rank_Ab}$。\n\n"
                    + ("- **唯一解**：两直线交于一点（$r(A) = r([A|b]) = 2$）\n"
                       + "- 无解：两直线平行不重合（$r(A) = 1, r([A|b]) = 2$）\n"
                       + "- 无穷多解：两直线重合（$r(A) = r([A|b]) = 1$）"
                       if rank_A == rank_Ab == 2 else
                       "- 唯一解：$r(A) = r([A|b]) = 2$\n"
                       + ("- **无解**：两直线平行但没有重合（$r(A) < r([A|b])$）\n"
                          + "- 无穷多解：两直线重合（$r(A) = r([A|b]) < 2$）"
                          if sol_type == "none" else
                          "- 唯一解：$r(A) = r([A|b]) = 2$\n"
                          + "- 无解：$r(A) < r([A|b])$\n"
                          + "- **无穷多解**：两直线重合（$r(A) = r([A|b]) = 1$）"))
                ),
            },
            {
                "title": "核心判定：$r(A)$ vs $r([A|b])$",
                "content": (
                    "同济教材最核心的定理（§3.6）：\n\n"
                    + "$$\\text{方程组有解} \\iff r(A) = r([A|b])$$\n\n"
                    + "- $b$ 在 $A$ 的列空间中 $\\iff$ 增广矩阵不增加秩\n"
                    + "- 有解时：解空间维数 $= n - r(A)$（$n$ 是未知数个数）\n\n"
                    + f"当前 $n - r(A) = {2 - rank_A}$。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(checks),
            "solution_info": {
                "type": sol_type,
                "description": desc,
                "details": {
                    "r(A)": str(rank_A),
                    "r(A|b)": str(rank_Ab),
                    "n（未知数个数）": "2",
                }
            },
            "lecture": {"sections": lecture_sections},
        }

    @staticmethod
    def _line_3d_points(a, b, c):
        """返回直线 ax + by = c 在 3D XY 平面上的两个端点"""
        half_range = 6
        eps = 1e-8
        if abs(b) > eps:
            # y = (c - a*x) / b
            x_vals = [-half_range, half_range]
            return [
                [float(x), float((c - a * x) / b), 0.0]
                for x in x_vals
            ]
        elif abs(a) > eps:
            # x = (c - b*y) / a
            y_vals = [-half_range, half_range]
            return [
                [float((c - b * y) / a), float(y), 0.0]
                for y in y_vals
            ]
        else:
            return [[0, 0, 0], [0, 0, 0]]

    @staticmethod
    def _point_on_line(a, b, c):
        """在直线上任取一点"""
        eps = 1e-8
        if abs(b) > eps:
            return np.array([0.0, c / b])
        elif abs(a) > eps:
            return np.array([c / a, 0.0])
        return None
