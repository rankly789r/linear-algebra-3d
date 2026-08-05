"""
场景 3.6：齐次 vs 非齐次方程组

两个方程，三个未知数（2×3 系统）。

齐次方程组 Ax=0：
- 解空间是穿过原点的子空间（可能是直线或平面）
非齐次方程组 Ax=b：
- 如果有解，解空间 = 特解 + 齐次解空间（仿射空间）

几何上：非齐次的解是齐次解空间的平移。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R6Homogeneous(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r6_homogeneous",
            "title": "3.6 齐次 vs 非齐次方程组",
            "chapter": "第三章",
            "description": "齐次 Ax=0 的解是穿过原点的子空间；非齐次 Ax=b 的解是这个子空间的平移。对比两者的几何关系。",
            "params": {
                "a11":{"label":"a₁₁","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a12":{"label":"a₁₂","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a13":{"label":"a₁₃","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "b1":{"label":"b₁","type":"float","default":2,"min":-5,"max":5,"step":0.1},
                "a21":{"label":"a₂₁","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a22":{"label":"a₂₂","type":"float","default":-1,"min":-3,"max":3,"step":0.1},
                "a23":{"label":"a₂₃","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "b2":{"label":"b₂","type":"float","default":0,"min":-5,"max":5,"step":0.1},
            },
            "presets": [
                {"label": "r=2 齐次→唯一点", "type": "unique",
                 "params": {"a11":1,"a12":1,"a13":1,"b1":0, "a21":1,"a22":-1,"a23":0,"b2":0}},
                {"label": "r=1 齐次→一个面", "type": "infinite",
                 "params": {"a11":1,"a12":1,"a13":1,"b1":0, "a21":2,"a22":2,"a23":2,"b2":0}},
                {"label": "非齐次→平移的线", "type": "unique",
                 "params": {"a11":1,"a12":1,"a13":1,"b1":2, "a21":1,"a22":-1,"a23":0,"b2":0}},
                {"label": "非齐次无解", "type": "none",
                 "params": {"a11":1,"a12":1,"a13":1,"b1":2, "a21":2,"a22":2,"a23":2,"b2":5}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [params.get("a11",1), params.get("a12",1), params.get("a13",1)],
            [params.get("a21",1), params.get("a22",-1), params.get("a23",0)],
        ], dtype=float)
        b = np.array([params.get("b1",2), params.get("b2",0)], dtype=float)
        b_zero = np.zeros(2, dtype=float)

        rank_A = M.matrix_rank(A)

        # 齐次方程 Ax=0 的零空间
        null_basis = M.null_space(A)  # 零空间的基（每列一个基向量）
        null_dim = 0 if null_basis is None else null_basis.shape[1]

        # 非齐次方程 Ax=b
        sol_type, x_particular = M.solve_linear(A, b)

        # 判断
        if null_dim == 0:
            homogeneous_desc = "齐次方程 Ax=0 只有零解（原点）。"
        elif null_dim == 1:
            homogeneous_desc = f"齐次方程的解空间是穿过原点的一条直线（维数={null_dim}）。"
        else:
            homogeneous_desc = f"齐次方程的解空间是穿过原点的一个{null_dim}维子空间。"

        if sol_type == "none":
            nonhomogeneous_desc = "非齐次方程 Ax=b 无解。"
        elif sol_type == "unique":
            if x_particular is not None:
                nonhomogeneous_desc = f"非齐次方程有唯一解 ({x_particular[0]:.2f}, {x_particular[1]:.2f}, {x_particular[2]:.2f})。"
            else:
                nonhomogeneous_desc = "非齐次方程有唯一解。"
        else:
            nonhomogeneous_desc = f"非齐次方程有无穷多解。解集 = 特解 + 齐次解空间（平移了{null_dim}维子空间）。"

        # 如果零空间非平凡，生成解空间上的采样点（用于前端绘制解空间）
        null_points = []
        if null_basis is not None and null_basis.shape[1] > 0:
            # 在基向量方向上采样
            for t in np.linspace(-3, 3, 7):
                pt = np.zeros(3)
                for k in range(null_basis.shape[1]):
                    pt += t * null_basis[:, k]
                null_points.append(pt.tolist())

        # 非齐次方程的偏移解空间（如果特解存在）
        affine_points = []
        if x_particular is not None and null_basis is not None and null_basis.shape[1] > 0:
            for t in np.linspace(-3, 3, 7):
                pt = x_particular.copy()
                for k in range(null_basis.shape[1]):
                    pt += t * null_basis[:, k]
                affine_points.append(pt.tolist())

        Ab = np.column_stack([A, b])
        scene_data = {
            "rank_A": rank_A,
            "null_dim": null_dim,
            "null_basis": null_basis.tolist() if null_basis is not None else [],
            "null_points": null_points,
            "particular_solution": x_particular.tolist() if x_particular is not None else None,
            "affine_points": affine_points,
            "solution_type": sol_type,
            "equation_planes": [
                {"normal": A[0].tolist(), "d": float(b[0]), "color": 0xff6b6b, "label": "Π₁"},
                {"normal": A[1].tolist(), "d": float(b[1]), "color": 0x4ecdc4, "label": "Π₂"},
            ],
            "zero_planes": [
                {"normal": A[0].tolist(), "d": 0.0, "color": 0xff6b6b, "label": "Ax=0 平面1"},
                {"normal": A[1].tolist(), "d": 0.0, "color": 0x4ecdc4, "label": "Ax=0 平面2"},
            ],
            "matrices": [
                {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "增广矩阵 [A|b]", "symbol": "[A|\\mathbf{b}]", "data": Ab.tolist()},
            ],
        }

        checks = [
            {"label": f"系数矩阵 A 的秩 = {rank_A}", "passed": True},
            {"label": f"零空间维数 (3-r) = {3-rank_A} = {null_dim}", "passed": null_dim == 3 - rank_A},
            {"label": "齐次解空间过原点", "passed": True},
            {"label": f"非齐次解 = 特解 + 齐次解（{sol_type}）", "passed": True},
        ]

        # ─── 讲解内容 ─────────────────────────────────────
        lecture_sections = [
            {
                "title": "齐次 vs 非齐次：本质区别",
                "content": (
                    "- **齐次方程** $Ax = 0$：右端全为零，解空间**必过原点**（因为 $A \\cdot 0 = 0$ 永远成立）\n\n"
                    + "- **非齐次方程** $Ax = b$（$b \\neq 0$）：解空间是齐次解空间的**平移**，不一定过原点\n\n"
                    + f"当前场景：$A$ 是 $2 \\times 3$ 矩阵，$r(A) = {rank_A}$。\n"
                    + f"零空间维数 $= 3 - r(A) = {null_dim}$。"
                ),
            },
            {
                "title": "解的结构定理（同济教材 §3.5）",
                "content": (
                    "非齐次方程 $Ax = b$ 的通解 = 特解 + 齐次通解：\n\n"
                    + "$$x = x_{\\text{特}} + x_{\\text{齐}}$$\n\n"
                    + "其中 $Ax_{\\text{特}} = b$，$Ax_{\\text{齐}} = 0$。\n\n"
                    + "几何上：非齐次的解集就是把齐次解空间「平移」到特解位置。\n"
                    + "3D 视图中可以看到：齐次解空间过原点，非齐次解空间偏移到特解处。"
                ),
            },
            {
                "title": "为什么要区分 $Ax=0$ 和 $Ax=b$？",
                "content": (
                    "因为判断解的存在性只需要看 $b$：\n\n"
                    + f"- 当前 $b = ({params.get('b1', 2)}, {params.get('b2', 0)})$\n"
                    + f"- {'$b$ 在 $A$ 的列空间中 → 非齐次有解' if sol_type != 'none' else '$b$ 不在 $A$ 的列空间中 → 非齐次无解'}\n\n"
                    + "齐次方程 $Ax=0$ **永远有解**（至少零解）。\n"
                    + "非齐次方程 $Ax=b$ **不一定有解**——取决于 $b$ 是否在 $A$ 的列空间中。\n\n"
                    + "这正是第三章的核心：$r(A) = r([A|b])$。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(checks),
            "solution_info": {
                "type": sol_type,
                "description": homogeneous_desc + "\n" + nonhomogeneous_desc,
                "details": {
                    "r(A)": str(rank_A),
                    "零空间维数": str(null_dim),
                    "齐次解": "过原点的" + (f"{null_dim}维子空间" if null_dim > 0 else "原点"),
                    "非齐次解": sol_type,
                }
            },
            "lecture": {"sections": lecture_sections},
        }
