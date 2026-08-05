"""
场景 3.4：2×2 线性方程组 — 两直线相交的几何解释

方程组：
    a₁x + b₁y = c₁
    a₂x + b₂y = c₂

几何含义：
- 两条直线交于一点 → 唯一解
- 两条直线平行 → 无解
- 两条直线重合 → 无穷多解
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
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
                "a1": {"label": "a₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "b1": {"label": "b₁", "type": "float", "default": -1, "min": -5, "max": 5, "step": 0.1},
                "c1": {"label": "c₁", "type": "float", "default": 1, "min": -10, "max": 10, "step": 0.1},
                "a2": {"label": "a₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "b2": {"label": "b₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "c2": {"label": "c₂", "type": "float", "default": 3, "min": -10, "max": 10, "step": 0.1},
            },
            "presets": [
                {"label": "唯一解", "type": "unique",
                 "params": {"a1": 2, "b1": -1, "c1": 1, "a2": 1, "b2": 1, "c2": 3}},
                {"label": "无解（平行）", "type": "none",
                 "params": {"a1": 1, "b1": 1, "c1": 2, "a2": 1, "b2": 1, "c2": 5}},
                {"label": "无穷解（重合）", "type": "infinite",
                 "params": {"a1": 1, "b1": 1, "c1": 2, "a2": 2, "b2": 2, "c2": 4}},
                {"label": "垂直相交", "type": "unique",
                 "params": {"a1": 1, "b1": 0, "c1": 2, "a2": 0, "b2": 1, "c2": 3}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        a1 = params.get("a1", 2); b1 = params.get("b1", -1); c1 = params.get("c1", 1)
        a2 = params.get("a2", 1); b2 = params.get("b2", 1);  c2 = params.get("c2", 3)

        A = np.array([[a1, b1], [a2, b2]], dtype=float)
        b_vec = np.array([c1, c2], dtype=float)

        # 用 NumPy 求解
        sol_type, x_sol = M.solve_linear(A, b_vec)
        rank_A = M.matrix_rank(A)
        Ab = np.column_stack([A, b_vec])
        rank_Ab = M.matrix_rank(Ab)

        # 为在 3D 中显示，将 2D 直线嵌入 XY 平面
        # 直线 a*x + b*y = c 的几何表示
        lines_3d = []
        for coeff_a, coeff_b, coeff_c, label in [(a1, b1, c1, "L₁"), (a2, b2, c2, "L₂")]:
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
            x0 = self._point_on_line(a1, b1, c1)
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
                    + f"$$\\begin{{cases}} {a1}x + {'+' if b1 >= 0 else ''}{b1}y = {c1} \\\\ {a2}x + {'+' if b2 >= 0 else ''}{b2}y = {c2} \\end{{cases}}$$\n\n"
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
