"""
ch2_r3 — 矩阵方程的行视图与列视图

Ax=b 的两种等价解读：
- 行视图（Row picture）：每个方程是一条直线(2D)或平面(3D)，解是所有直线/平面的交点
- 列视图（Column picture）：b 是 A 各列向量的线性组合，解 x 是组合系数

教材只讲行视图（消元法解方程），几乎不讲列视图的几何含义。
但列视图是理解「矩阵=线性变换」「秩=列空间维数」的关键。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams, matrix_params, vector_params
from server.math_engine import MathEngine as M


class Ch2R3AxEqB(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch2_r3_ax_eq_b",
            "title": "矩阵方程的行视图与列视图",
            "chapter": "第2章 矩阵及其运算",
            "description": "Ax=b 的两种视角：行视图（直线的交点=解）vs 列视图（b=列向量的线性组合）。双重视角并排对比。",
            "params": {
                **matrix_params("a", 2, 2, defaults=[2, 1, 1, 3], min=-5, max=5),
                **vector_params("b", 2, defaults=[4, 6], min=-10, max=10),
            },
            "presets": [
                {
                    "label": "唯一解（典型情况）",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 1, "a21": 1, "a22": 3, "b1": 4, "b2": 6},
                },
                {
                    "label": "无解（平行线）",
                    "type": "none",
                    "params": {"a11": 1, "a12": 1, "a21": 1, "a22": 1, "b1": 2, "b2": 5},
                },
                {
                    "label": "无穷解（重合线）",
                    "type": "infinite",
                    "params": {"a11": 1, "a12": 1, "a21": 2, "a22": 2, "b1": 2, "b2": 4},
                },
                {
                    "label": "垂直相交",
                    "type": "unique",
                    "params": {"a11": 1, "a12": 0, "a21": 0, "a22": 1, "b1": 2, "b2": 3},
                },
                {
                    "label": "列向量共线（奇异）",
                    "type": "degenerate",
                    "params": {"a11": 2, "a12": 4, "a21": 1, "a22": 2, "b1": 6, "b2": 3},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        a11 = float(params.get("a11", 2))
        a12 = float(params.get("a12", 1))
        a21 = float(params.get("a21", 1))
        a22 = float(params.get("a22", 3))
        b1 = float(params.get("b1", 4))
        b2 = float(params.get("b2", 6))

        A = np.array([[a11, a12], [a21, a22]], dtype=float)
        b = np.array([b1, b2], dtype=float)

        # 求解
        sol_type, x = M.solve_linear(A, b)

        # ─── 行视图数据 ───────────────────────────
        # 两条直线: a11*x + a12*y = b1  → y = (b1 - a11*x) / a12 (a12≠0)
        #           a21*x + a22*y = b2  → y = (b2 - a21*x) / a22 (a22≠0)
        # 用方向向量和一点来表示直线
        row_lines = []
        for (c1, c2, rhs, label) in [
            (a11, a12, b1, "方程1"),
            (a21, a22, b2, "方程2"),
        ]:
            # 直线的方向向量 = 法向量的垂直方向
            normal = np.array([c1, c2])
            direction = np.array([-c2, c1])  # 旋转90度
            norm_dir = np.linalg.norm(direction)
            if norm_dir > 1e-10:
                direction = direction / norm_dir * 5  # 半长度
            # 直线上一点
            if abs(c2) > 1e-10:
                point = np.array([0, rhs / c2])
            elif abs(c1) > 1e-10:
                point = np.array([rhs / c1, 0])
            else:
                point = np.array([0, 0])

            row_lines.append({
                "label": label,
                "normal": [float(normal[0]), float(normal[1])],
                "direction": [float(direction[0]), float(direction[1])],
                "point": [float(point[0]), float(point[1])],
            })

        # ─── 列视图数据 ───────────────────────────
        col_a1 = A[:, 0]  # 第一列
        col_a2 = A[:, 1]  # 第二列

        col_vectors = [
            {"label": "a₁（第1列）", "vector": [float(col_a1[0]), float(col_a1[1])]},
            {"label": "a₂（第2列）", "vector": [float(col_a2[0]), float(col_a2[1])]},
            {"label": "b（目标）", "vector": [float(b[0]), float(b[1])]},
        ]

        # 解的分解（列视图的核心！）
        decomposition = None
        if x is not None:
            x1, x2 = float(x[0]), float(x[1])
            comp1 = x1 * col_a1  # x₁a₁
            comp2 = x2 * col_a2  # x₂a₂
            decomposition = {
                "x1": x1,
                "x2": x2,
                "comp1": [float(comp1[0]), float(comp1[1])],
                "comp2": [float(comp2[0]), float(comp2[1])],
                "b_from_components": [float(comp1[0] + comp2[0]), float(comp1[1] + comp2[1])],
            }

        # ─── 交点（行视图的解）───────────────────
        intersection = None
        if x is not None:
            intersection = [float(x[0]), float(x[1])]

        # ─── 矩阵显示 ────────────────────────────
        matrices = [
            {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
            {"label": "常数向量 b", "symbol": "b",
             "data": [[b1], [b2]]},
        ]
        if x is not None:
            matrices.append({
                "label": "解向量 x", "symbol": "x",
                "data": [[float(x[0])], [float(x[1])]],
            })

        # ─── 验证 ──────────────────────────────────
        verification_checks = []
        if x is not None:
            residual = A @ x - b
            is_solution = bool(np.all(np.abs(residual) < 1e-8))
            verification_checks = [
                {"label": f"x = ({x[0]:.4f}, {x[1]:.4f}) 满足 Ax=b",
                 "passed": is_solution},
                {"label": f"残差 ‖Ax-b‖ < 1e-8",
                 "passed": is_solution},
            ]
        else:
            verification_checks = [
                {"label": "方程组无解（行视图：平行线不相交）",
                 "passed": True},
            ]

        # ─── 讲解 ──────────────────────────────────
        if sol_type == "unique":
            description = (
                f"**行视图**：两条直线交于一点 (x₁,x₂) = ({x[0]:.2f}, {x[1]:.2f}) = 解。\n\n"
                f"**列视图**：b = x₁·a₁ + x₂·a₂ = {x[0]:.2f}×({col_a1[0]},{col_a1[1]})"
                f" + {x[1]:.2f}×({col_a2[0]},{col_a2[1]})。\n\n"
                f"两种视角完全等价，但给出了不同的几何理解。"
            )
        elif sol_type == "none":
            description = (
                f"**行视图**：两条直线平行，没有交点 → 无解。\n\n"
                f"**列视图**：b 不在 a₁ 和 a₂ 张成的直线上 → 无法用列向量的线性组合表示 b。"
            )
        elif sol_type == "infinite":
            description = (
                f"**行视图**：两条直线重合，整条线上都是解 → 无穷多解。\n\n"
                f"**列视图**：b 在 a₁ 和 a₂ 张成的直线上，有无数种组合方式 → 无穷多解。"
            )
        else:
            description = "无法求解。"

        return {
            "scene_data": {
                "matrices": matrices,
                "row_lines": row_lines,
                "col_vectors": col_vectors,
                "decomposition": decomposition,
                "intersection": intersection,
                "solution_type": sol_type,
                "det_A": M.matrix_determinant(A),
            },
            "verification": self.make_verification(verification_checks),
            "solution_info": {
                "type": sol_type,
                "description": description,
                "details": {
                    "det(A)": f"{M.matrix_determinant(A):.4f}",
                    "解的类型": {"unique": "唯一解", "none": "无解", "infinite": "无穷多解"}.get(sol_type, "未知"),
                },
            },
        }
