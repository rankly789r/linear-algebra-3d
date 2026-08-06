"""
场景 3.7B：列空间与解的存在性
直观展示「r(A)=r(A|b) ⇔ b 在 Col(A) 中 ⇔ 有解」的几何含义。

用 3×2 矩阵 A（3个方程、2个未知数），列空间是 R³ 中过原点的一张平面。
b 在平面上 → 有解；b 在平面外 → 无解。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams, matrix_params, vector_params
from server.math_engine import MathEngine as M


class Ch3R7BColSpace(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r7b_col_space",
            "title": "3.7B 列空间与解的存在性",
            "chapter": "第3章",
            "description": "列空间可视化：b在列空间内⇔有解，b在列空间外⇔无解。r(A)=r(A|b) 就是这个判断的代数表述。",
            "params": {
                **matrix_params("a", 3, 2, defaults=[[1, 0], [0, 1], [0, 0]], min=-5, max=5),
                **vector_params("b", 3, defaults=[2, 3, 0], min=-10, max=10),
            },
            "presets": [
                {"label": "b在列空间内（有解）", "type": "unique", "params": {
                    "a11": 1, "a12": 0, "a21": 0, "a22": 1, "a31": 0, "a32": 0,
                    "b1": 2, "b2": 3, "b3": 0,
                }},
                {"label": "b在列空间外（无解）", "type": "none", "params": {
                    "a11": 1, "a12": 0, "a21": 0, "a22": 1, "a31": 0, "a32": 0,
                    "b1": 2, "b2": 3, "b3": 2,
                }},
                {"label": "秩为1，b在线内（无穷解）", "type": "infinite", "params": {
                    "a11": 1, "a12": 2, "a21": 1, "a22": 2, "a31": 1, "a32": 2,
                    "b1": 3, "b2": 3, "b3": 3,
                }},
                {"label": "秩为1，b在线外（无解）", "type": "none", "params": {
                    "a11": 1, "a12": 2, "a21": 1, "a22": 2, "a31": 1, "a32": 2,
                    "b1": 3, "b2": 3, "b3": 4,
                }},
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        # ── 第 1 步：提取参数 ──
        a11 = float(params.get("a11", 1)); a12 = float(params.get("a12", 0))
        a21 = float(params.get("a21", 0)); a22 = float(params.get("a22", 1))
        a31 = float(params.get("a31", 0)); a32 = float(params.get("a32", 0))
        b1  = float(params.get("b1", 2))
        b2  = float(params.get("b2", 3))
        b3  = float(params.get("b3", 0))

        # ── 第 2 步：数学计算 ──
        A = np.array([[a11, a12], [a21, a22], [a31, a32]], dtype=float)
        b_vec = np.array([b1, b2, b3], dtype=float)

        # 增广矩阵
        Ab = np.column_stack([A, b_vec])

        rank_A = int(M.matrix_rank(A))
        rank_Ab = int(M.matrix_rank(Ab))
        rank_equal = (rank_A == rank_Ab)

        # 列向量
        col1 = A[:, 0]
        col2 = A[:, 1]

        # ── 列空间信息 ──
        col_space = {"dim": rank_A}
        if rank_A == 2:
            normal = np.cross(col1, col2)
            n_norm = float(np.linalg.norm(normal))
            if n_norm > 1e-10:
                normal = normal / n_norm
            col_space["type"] = "plane"
            col_space["normal"] = normal.tolist()
        elif rank_A == 1:
            # 找到非零列作为方向
            if float(np.linalg.norm(col1)) > 1e-10:
                d = col1 / float(np.linalg.norm(col1))
            else:
                d = col2 / float(np.linalg.norm(col2))
            col_space["type"] = "line"
            col_space["direction"] = d.tolist()
        else:
            col_space["type"] = "point"
            col_space["normal"] = None
            col_space["direction"] = None

        # ── b 到列空间的投影 ──
        A_pinv = np.linalg.pinv(A)
        b_proj = A @ A_pinv @ b_vec
        b_res = b_vec - b_proj
        res_norm = float(np.linalg.norm(b_res))
        b_in_col_space = res_norm < 1e-8

        # ── 解信息 ──
        if rank_A < rank_Ab:
            sol_type = "none"
        elif rank_A == 2:
            sol_type = "unique"  # rank = n = 2
        else:
            sol_type = "infinite"  # rank < n

        # ── 第 3 步：构建 scene_data ──
        scene_data = {
            "matrices": [
                {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "常数列 b", "symbol": "b", "data": [[b1], [b2], [b3]]},
                {"label": "增广矩阵 (A|b)", "symbol": "(A|b)", "data": Ab.tolist()},
            ],
            "rank_A": rank_A,
            "rank_Ab": rank_Ab,
            "rank_equal": rank_equal,
            "columns": [
                {"components": col1.tolist(), "label": "a₁ (第1列)"},
                {"components": col2.tolist(), "label": "a₂ (第2列)"},
            ],
            "b_vec": {"components": b_vec.tolist(), "label": "b"},
            "col_space": col_space,
            "projection": {
                "point": b_proj.tolist(),
                "in_col_space": b_in_col_space,
                "residual_norm": res_norm,
            },
        }

        # ── 第 4 步：构建 verification ──
        checks = [
            {"label": f"r(A) = {rank_A}", "passed": True},
            {"label": f"r(A|b) = {rank_Ab}", "passed": True},
            {"label": f"r(A) = r(A|b) → {'有解' if rank_equal else '无解'}",
             "passed": rank_equal == (sol_type != "none")},
        ]
        if rank_A == 2:
            checks.append({
                "label": f"‖b - proj‖ = {res_norm:.4f}" + (" ≈ 0 → b在列空间内" if b_in_col_space else " > 0 → b不在列空间内"),
                "passed": True,
            })
        verification = self.make_verification(checks)

        # ── 第 5 步：构建 solution_info ──
        if sol_type == "unique":
            x = A_pinv @ b_vec
            desc = f"r(A)=r(A|b)={rank_A}=n → 唯一解 x = ({x[0]:.4f}, {x[1]:.4f})"
            details = {"解 x": f"({x[0]:.4f}, {x[1]:.4f})"}
        elif sol_type == "infinite":
            desc = f"r(A)=r(A|b)={rank_A}<n={2} → 无穷多解（{2 - rank_A} 维解空间）"
            null_dim = 2 - rank_A
            details = {"解空间维数": str(null_dim)}
        else:
            desc = f"r(A)={rank_A}<r(A|b)={rank_Ab} → 无解（b 不在列空间中）"
            details = {"残差 ‖b - b_proj‖": f"{res_norm:.4f}"}

        solution_info = {"type": sol_type, "description": desc, "details": details}

        # ── 第 6 步：构建 lecture ──
        lecture = {
            "sections": [
                {
                    "title": "列空间 Col(A) 是什么？",
                    "content": (
                        "**列空间 Col(A)** = 矩阵 A 的所有列的线性组合构成的集合。\n\n"
                        + "几何上：如果 A 有 2 个线性无关的列，Col(A) 是 R³ 中**过原点的一张平面**。\n"
                        + "如果 2 列线性相关，Col(A) 退化为**过原点的一条直线**。\n\n"
                        + "秩 r(A) = Col(A) 的维数（2 = 平面，1 = 直线，0 = 原点）。"
                    ),
                },
                {
                    "title": "Ax = b 在问什么？",
                    "content": (
                        "**Ax = b 的意思是：能否用 A 的各列线性组合出 b？**\n\n"
                        + f"当前：$\\vec{{a}}_1 = ({a11},{a21},{a31})$，$\\vec{{a}}_2 = ({a12},{a22},{a32})$\n\n"
                        + f"$b = ({b1},{b2},{b3})$\n\n"
                        + "如果能找到系数 $x_1, x_2$ 使得 $x_1\\vec{{a}}_1 + x_2\\vec{{a}}_2 = b$，\n"
                        + "那么 b 就在列空间中，方程组有解。"
                    ),
                },
                {
                    "title": "r(A) = r(A|b) 的几何含义",
                    "content": (
                        "**增广矩阵 (A|b)** 比 A 多了一列 b。\n\n"
                        + f"r(A) = **{rank_A}**（列空间的维数）\n"
                        + f"r(A|b) = **{rank_Ab}**（列空间 + b 后的维数）\n\n"
                        + ("r(A) = r(A|b) → **b 在列空间内** → 有解 ✅\n"
                           if rank_equal else
                           "r(A) < r(A|b) → **b 不在列空间内** → 无解 ❌\n")
                        + "\n几何直观：把 b 当作新的一列加进来，如果空间的维数没有变大，\n"
                        + "说明 b 本来就「在里头」。如果变大了，说明 b 是「新方向」。"
                    ),
                },
            ]
        }

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            "lecture": lecture,
        }
