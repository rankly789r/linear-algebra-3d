"""
场景 3.7：秩与解的关系 — r(A) vs r(A|b) 的几何含义

教材第三章核心定理：方程组有解 ⇔ r(A) = r(A|b)

本场景让你用 3×3 矩阵观察：
- r(A) = r(A|b) = 3：唯一解（三平面交于一点）
- r(A) = r(A|b) = 2：无穷解（三平面交于一条线）
- r(A) = 2, r(A|b) = 3：无解（b 不在 A 的列空间中）

同时高亮显示 A 的列空间和 b 向量之间的关系。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R7RankSolution(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r7_rank_solution",
            "title": "3.7 秩与解的关系",
            "chapter": "第三章",
            "description": "r(A) vs r(A|b) 的几何含义。当 b 在 A 的列空间中时（r(A)=r(A|b)），方程组有解；否则无解。",
            "params": {
                "a11":{"label":"a₁₁","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a12":{"label":"a₁₂","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a13":{"label":"a₁₃","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "b1":{"label":"b₁","type":"float","default":2,"min":-5,"max":5,"step":0.1},
                "a21":{"label":"a₂₁","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a22":{"label":"a₂₂","type":"float","default":-1,"min":-3,"max":3,"step":0.1},
                "a23":{"label":"a₂₃","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "b2":{"label":"b₂","type":"float","default":0,"min":-5,"max":5,"step":0.1},
                "a31":{"label":"a₃₁","type":"float","default":2,"min":-3,"max":3,"step":0.1},
                "a32":{"label":"a₃₂","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "a33":{"label":"a₃₃","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "b3":{"label":"b₃","type":"float","default":2,"min":-5,"max":5,"step":0.1},
            },
            "presets": [
                {"label": "r(A)=r(A|b)=3 唯一解", "type": "unique",
                 "params": {"a11":1,"a12":0,"a13":0,"b1":2, "a21":0,"a22":1,"a23":0,"b2":2, "a31":0,"a32":0,"a33":1,"b3":2}},
                {"label": "r(A)=r(A|b)=2 无穷解", "type": "infinite",
                 "params": {"a11":1,"a12":1,"a13":0,"b1":2, "a21":1,"a22":-1,"a23":0,"b2":0, "a31":0,"a32":0,"a33":0,"b3":0}},
                {"label": "r(A)=2 < r(A|b)=3 无解", "type": "none",
                 "params": {"a11":1,"a12":0,"a13":0,"b1":2, "a21":0,"a22":1,"a23":0,"b2":2, "a31":1,"a32":1,"a33":0,"b3":5}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [params.get("a11",1), params.get("a12",0), params.get("a13",0)],
            [params.get("a21",0), params.get("a22",1), params.get("a23",0)],
            [params.get("a31",0), params.get("a32",0), params.get("a33",1)],
        ], dtype=float)
        b = np.array([params.get("b1",2), params.get("b2",2), params.get("b3",2)], dtype=float)

        rank_A = M.matrix_rank(A)
        Ab = np.column_stack([A, b])
        rank_Ab = M.matrix_rank(Ab)
        sol_type, x_sol = M.solve_linear(A, b)

        # 列空间信息
        col_space_dim = rank_A

        # 判断 b 是否在 A 的列空间中
        b_in_col_space = (rank_A == rank_Ab)

        # 尝试将 b 投影到 A 的列空间
        # 用最小二乘得到 b 在列空间中的投影
        x_ls = M.solve_least_squares(A, b)
        b_proj = A @ x_ls
        b_residual = b - b_proj

        # 方程平面
        planes = []
        colors = [0xff6b6b, 0x4ecdc4, 0xffd93d]
        for i in range(3):
            planes.append({
                "normal": A[i].tolist(),
                "d": float(b[i]),
                "color": colors[i],
                "label": f"Π{i+1}",
            })

        if b_in_col_space:
            desc = f"r(A) = r(A|b) = {rank_A}。b 在 A 的列空间中，方程组有解。"
            if rank_A == 3:
                desc += " 三个平面交于一点（唯一解）。"
            else:
                desc += f" n - r(A) = {3-rank_A} 维解空间（无穷多解）。"
        else:
            desc = f"r(A) = {rank_A} < r(A|b) = {rank_Ab}。b 不在 A 的列空间中，方程组无解。"

        scene_data = {
            "planes": planes,
            "rank_A": rank_A,
            "rank_Ab": rank_Ab,
            "b_in_col_space": b_in_col_space,
            "solution_point": x_sol.tolist() if x_sol is not None else None,
            "b_vector": b.tolist(),
            "b_projection": b_proj.tolist(),
            "b_residual": b_residual.tolist(),
            "col_space_dim": col_space_dim,
            "solution_type": sol_type,
            # A 的列向量
            "col_vectors": [A[:, j].tolist() for j in range(3)],
            "matrices": [
                {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "增广矩阵 [A|b]", "symbol": "[A|\\mathbf{b}]", "data": Ab.tolist()},
            ],
        }

        checks = [
            {"label": f"r(A) = {rank_A}", "passed": True},
            {"label": f"r(A|b) = {rank_Ab}", "passed": True},
            {"label": f"r(A) = r(A|b) → {'有解' if b_in_col_space else '无解'}",
             "passed": b_in_col_space == (sol_type != "none")},
        ]
        if x_sol is not None and sol_type == "unique":
            checks.append({"label": "解满足方程", "passed": M.verify_solution(A, x_sol, b)})

        # ─── 讲解内容 ─────────────────────────────────────
        lecture_sections = [
            {
                "title": "第三章最重要的定理：$r(A) = r([A|b])$",
                "content": (
                    "同济教材 §3.6 的核心结论：\n\n"
                    + "$$\\text{方程组 } Ax = b \\text{ 有解} \\iff r(A) = r([A|b])$$\n\n"
                    + f"当前：$r(A) = {rank_A}$，$r([A|b]) = {rank_Ab}$。\n\n"
                    + ("✅ **有解**：$b$ 在 $A$ 的列空间中。从 3D 视图可以看到三个平面有公共交点。" if b_in_col_space else
                       "❌ **无解**：$b$ 不在 $A$ 的列空间中，不管怎么组合列向量都到不了 $b$。")
                ),
            },
            {
                "title": "「$b$ 在 $A$ 的列空间中」是什么意思？",
                "content": (
                    "$Ax = b$ 展开来就是：\n\n"
                    + "$$x_1 \\cdot (\\text{第1列}) + x_2 \\cdot (\\text{第2列}) + x_3 \\cdot (\\text{第3列}) = b$$\n\n"
                    + "所以「有解」=「$b$ 可以被 $A$ 的列向量线性表示」。\n\n"
                    + "换句话说：$b$ 必须落在 $A$ 的**列空间**（所有列向量的线性组合构成的集合）里。\n\n"
                    + f"当前 $A$ 的列空间是 ${col_space_dim}$ 维的。"
                    + ("$b$ 恰好在这个空间中。" if b_in_col_space else "$b$ 在这个空间之外——所以无解。")
                ),
            },
            {
                "title": "有解时，解空间的维数 = $n - r(A)$",
                "content": (
                    "有解时（$r(A) = r([A|b])$），解的个数取决于 $n - r(A)$：\n\n"
                    + f"当前：$n = 3$（未知数个数），$r(A) = {rank_A}$，$n - r(A) = {3 - rank_A}$。\n\n"
                    + ("- $n - r(A) = 0$ → **唯一解**（三平面交于一点）" if rank_A == 3 else
                       f"- $n - r(A) = {3 - rank_A}$ → **无穷多解**（解空间维数为 {3 - rank_A}）")
                    + "\n\n"
                    + "这个数字告诉你：在所有满足方程的 $x$ 中，有几个方向可以自由变动。"
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
                    "b 在 col(A) 中？": "是" if b_in_col_space else "否",
                    "结论": "有解" if b_in_col_space else "无解",
                }
            },
            "lecture": {"sections": lecture_sections},
        }
