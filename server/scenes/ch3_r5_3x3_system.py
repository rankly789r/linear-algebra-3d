"""
场景 3.5：3×3 线性方程组 — 三平面相交的几何解释

三个平面（三元一次方程）的公共交点：
- 交于一点 → 唯一解（r(A)=r(A|b)=3）
- 交于一条直线 → 无穷多解（r(A)=r(A|b)=2）
- 交于一个平面 → 无穷多解（r(A)=r(A|b)=1，三平面重合）
- 无公共交点 → 无解（r(A)<r(A|b) 或互相平行）
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R53x3System(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r5_3x3_system",
            "title": "3.5 3×3 线性方程组",
            "chapter": "第三章",
            "description": "三个未知数，三个方程——在空间中是三个平面。交于一点（唯一解）、一条线（无穷解）、或无公共点（无解）。",
            "params": {
                "a11":{"label":"a₁₁","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a12":{"label":"a₁₂","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "a13":{"label":"a₁₃","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "b1":{"label":"b₁","type":"float","default":2,"min":-5,"max":5,"step":0.1},
                "a21":{"label":"a₂₁","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "a22":{"label":"a₂₂","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a23":{"label":"a₂₃","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "b2":{"label":"b₂","type":"float","default":2,"min":-5,"max":5,"step":0.1},
                "a31":{"label":"a₃₁","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "a32":{"label":"a₃₂","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "a33":{"label":"a₃₃","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "b3":{"label":"b₃","type":"float","default":2,"min":-5,"max":5,"step":0.1},
            },
            "presets": [
                {"label": "唯一解（一点）", "type": "unique",
                 "params": {"a11":1,"a12":0,"a13":0,"b1":2, "a21":0,"a22":1,"a23":0,"b2":2, "a31":0,"a32":0,"a33":1,"b3":2}},
                {"label": "无穷解（交于一线）", "type": "infinite",
                 "params": {"a11":1,"a12":0,"a13":0,"b1":2, "a21":0,"a22":1,"a23":0,"b2":2, "a31":1,"a32":1,"a33":0,"b3":4}},
                {"label": "无解（三柱面）", "type": "none",
                 "params": {"a11":1,"a12":0,"a13":0,"b1":2, "a21":0,"a22":1,"a23":0,"b2":2, "a31":1,"a32":1,"a33":0,"b3":0}},
                {"label": "无解（平行平面）", "type": "none",
                 "params": {"a11":1,"a12":1,"a13":1,"b1":2, "a21":1,"a22":1,"a23":1,"b2":5, "a31":0,"a32":0,"a33":1,"b3":2}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [params.get("a11",1), params.get("a12",0), params.get("a13",0)],
            [params.get("a21",0), params.get("a22",1), params.get("a23",0)],
            [params.get("a31",0), params.get("a32",0), params.get("a33",1)],
        ], dtype=float)
        b = np.array([params.get("b1",2), params.get("b2",2), params.get("b3",2)], dtype=float)

        sol_type, x_sol = M.solve_linear(A, b)
        rank_A = M.matrix_rank(A)
        Ab = np.column_stack([A, b])
        rank_Ab = M.matrix_rank(Ab)

        # 生成三个平面的几何数据
        planes = []
        colors = [0xff6b6b, 0x4ecdc4, 0xffd93d]
        for i in range(3):
            normal = A[i]
            const = b[i]
            planes.append({
                "normal": normal.tolist(),
                "d": float(const),
                "color": colors[i],
                "label": f"Π{i+1}",
            })

        # 解信息
        if sol_type == "unique" and x_sol is not None:
            solution_pt = x_sol.tolist()
            desc = f"三个平面交于一点 ({x_sol[0]:.2f}, {x_sol[1]:.2f}, {x_sol[2]:.2f})"
        elif sol_type == "infinite":
            solution_pt = None
            ns = M.null_space(A)
            if ns is not None and ns.shape[1] >= 1:
                # 特解 + 零空间
                x0 = M.solve_least_squares(A, b)
                solution_pt = x0.tolist()
                null_dim = ns.shape[1]
                if null_dim == 1:
                    desc = f"三个平面交于一条直线。解的维数 = {null_dim}（n - r(A) = 3 - {rank_A} = {3-rank_A}）"
                else:
                    desc = f"三个平面交于一个{null_dim}维空间。"
            else:
                x0 = M.solve_least_squares(A, b)
                solution_pt = x0.tolist()
                null_dim = 3 - rank_A
                desc = f"三个平面交于一个{null_dim}维子空间。"
        else:
            solution_pt = None
            desc = "三个平面没有公共交点，方程组无解。"

        scene_data = {
            "planes": planes,
            "solution_point": solution_pt,
            "solution_type": sol_type,
            "rank_A": rank_A,
            "rank_Ab": rank_Ab,
            "coefficients": {"A": A.tolist(), "b": b.tolist()},
            "matrices": [
                {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "增广矩阵 [A|b]", "symbol": "[A|\\mathbf{b}]", "data": Ab.tolist()},
            ],
        }

        checks = [
            {"label": f"系数矩阵 A 的秩 = {rank_A}", "passed": True},
            {"label": f"增广矩阵 [A|b] 的秩 = {rank_Ab}", "passed": True},
            {"label": f"r(A) = r(A|b): {rank_A == rank_Ab}", "passed": rank_A == rank_Ab},
        ]
        if x_sol is not None and sol_type == "unique":
            satisfied = M.verify_solution(A, x_sol, b)
            checks.append({"label": "解满足三个方程", "passed": satisfied})

        # ─── 讲解内容 ─────────────────────────────────────
        lecture_sections = [
            {
                "title": "三元一次方程组 = 三个平面的公共交点",
                "content": (
                    "三元一次方程组中的每个方程代表三维空间中的一个**平面**。\n\n"
                    + "$$\\begin{{cases}} a_{{11}}x + a_{{12}}y + a_{{13}}z = b_1 \\\\ a_{{21}}x + a_{{22}}y + a_{{23}}z = b_2 \\\\ a_{{31}}x + a_{{32}}y + a_{{33}}z = b_3 \\end{{cases}}$$\n\n"
                    + "方程组的解 = 三个平面的**公共交点**。\n"
                    + "3D 视图中，红色、绿色、黄色分别代表三个平面。"
                ),
            },
            {
                "title": "解的四种情形（对应 $r(A)$ 和 $r([A|b])$）",
                "content": (
                    f"当前：$r(A) = {rank_A}$，$r([A|b]) = {rank_Ab}$，$n - r(A) = {3 - rank_A}$。\n\n"
                    + ("- **唯一解**（一点）：三平面交于一点，$r(A)=r([A|b])=3$\n"
                       + "- **无穷多解（一线）**：三平面交于一条直线，$r(A)=r([A|b])=2$\n"
                       + "- **无穷多解（一面）**：三平面重合，$r(A)=r([A|b])=1$\n"
                       + "- **无解**：三平面无公共点，$r(A) < r([A|b])$"
                       if sol_type == "unique" else
                       "- 唯一解：三平面交于一点\n"
                       + "- **无穷多解**：三平面交于一条线或一个面\n"
                       + "- 无解：三平面无公共交点"
                       if sol_type == "infinite" else
                       "- 唯一解：三平面交于一点\n"
                       + "- 无穷多解：三平面交于一条线或一个面\n"
                       + "- **无解**：三平面没有公共交点")
                ),
            },
            {
                "title": "几何解读：$r(A) = r([A|b])$",
                "content": (
                    "$r(A) = r([A|b])$ 的几何含义：\n\n"
                    + "- **$r(A)$** = 三个法向量张成的空间维数（平面的「独立程度」）\n"
                    + "- **$r([A|b])$** = 加上右端项后是否增加了秩\n\n"
                    + f"当前 {'$r(A) = r([A|b])$' if rank_A == rank_Ab else '$r(A) < r([A|b])$'}："
                    + ("三平面有公共交点。" if rank_A == rank_Ab else "三平面无公共交点——$b$ 不在 $A$ 的列空间中。")
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
                    "n（未知数个数）": "3",
                    "n - r(A)": str(3 - rank_A),
                }
            },
            "lecture": {"sections": lecture_sections},
        }
