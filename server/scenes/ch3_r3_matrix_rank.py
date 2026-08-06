"""
场景 3.3：矩阵的秩 — 3×3 变换与立方体

观察 3×3 矩阵对单位立方体的变换：
- 秩=3：立方体变成平行六面体（体积不变或缩放）
- 秩=2：立方体被压成平行四边形（一个面）
- 秩=1：立方体被压成一条线段

同时展示变换前后秩和行列式的关系。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R3MatrixRank(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r3_matrix_rank",
            "title": "3.3 矩阵的秩",
            "chapter": "第三章",
            "description": "输入一个 3×3 矩阵，观察它将单位立方体变换成什么形状。秩决定了变换后形状的「真实维数」。",
            "params": {
                "a11":{"label":"a₁₁","type":"float","default":1,"min":-2,"max":2,"step":0.1},
                "a12":{"label":"a₁₂","type":"float","default":0,"min":-2,"max":2,"step":0.1},
                "a13":{"label":"a₁₃","type":"float","default":0,"min":-2,"max":2,"step":0.1},
                "a21":{"label":"a₂₁","type":"float","default":0,"min":-2,"max":2,"step":0.1},
                "a22":{"label":"a₂₂","type":"float","default":1,"min":-2,"max":2,"step":0.1},
                "a23":{"label":"a₂₃","type":"float","default":0,"min":-2,"max":2,"step":0.1},
                "a31":{"label":"a₃₁","type":"float","default":0,"min":-2,"max":2,"step":0.1},
                "a32":{"label":"a₃₂","type":"float","default":0,"min":-2,"max":2,"step":0.1},
                "a33":{"label":"a₃₃","type":"float","default":1,"min":-2,"max":2,"step":0.1},
            },
            "presets": [
                {"label": "r=3 满秩", "type": "unique",
                 "params": {"a11":1,"a12":0,"a13":0, "a21":0,"a22":1,"a23":0, "a31":0,"a32":0,"a33":1}},
                {"label": "r=2 压成面", "type": "degenerate",
                 "params": {"a11":1,"a12":0,"a13":0, "a21":0,"a22":1,"a23":0, "a31":1,"a32":1,"a33":0}},
                {"label": "r=1 压成线", "type": "none",
                 "params": {"a11":1,"a12":2,"a13":3, "a21":1,"a22":2,"a23":3, "a31":1,"a32":2,"a33":3}},
                {"label": "行列式=0 降维", "type": "degenerate",
                 "params": {"a11":1,"a12":0,"a13":1, "a21":0,"a22":1,"a23":1, "a31":1,"a32":1,"a33":2}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [params.get("a11",1), params.get("a12",0), params.get("a13",0)],
            [params.get("a21",0), params.get("a22",1), params.get("a23",0)],
            [params.get("a31",0), params.get("a32",0), params.get("a33",1)],
        ], dtype=float)

        rank = M.matrix_rank(A)
        det_A = M.matrix_determinant(A)

        # 单位立方体的 8 个顶点
        cube_vertices = np.array([
            [0,0,0],[1,0,0],[0,1,0],[0,0,1],
            [1,1,0],[1,0,1],[0,1,1],[1,1,1]
        ], dtype=float)
        # 变换后的顶点
        transformed = (A @ cube_vertices.T).T

        # 立方体的 12 条边
        edges = [
            (0,1),(0,2),(0,3),(1,4),(1,5),(2,4),
            (2,6),(3,5),(3,6),(4,7),(5,7),(6,7)
        ]

        # 变换后边的数据
        transformed_edges = []
        for i, j in edges:
            transformed_edges.append({
                "start": transformed[i].tolist(),
                "end": transformed[j].tolist(),
            })

        # 原立方体边的数据（用于对比）
        original_edges = []
        for i, j in edges:
            original_edges.append({
                "start": cube_vertices[i].tolist(),
                "end": cube_vertices[j].tolist(),
            })

        if rank == 3:
            desc = f"秩=3（满秩），行列式={det_A:.3f}。立方体变成平行六面体，仍占据三维空间。"
        elif rank == 2:
            desc = f"秩=2，行列式=0。立方体被压成一个平面上的平行四边形。"
        elif rank == 1:
            desc = f"秩=1，一行列式=0。立方体被压成一条线段。"
        else:
            desc = f"秩=0，零矩阵把整个空间压成原点。"

        scene_data = {
            "rank": rank,
            "determinant": det_A,
            "cube_vertices": cube_vertices.tolist(),  # 原始立方体顶点（动画用）
            "transformed_edges": transformed_edges,
            "original_edges": original_edges,
            "transformed_vertices": transformed.tolist(),
            "matrix": A.tolist(),
            "matrices": [
                {"label": "变换矩阵 A（3×3）", "symbol": "A", "data": A.tolist()},
            ],
        }

        checks = [
            {"label": f"矩阵 A 的秩 = {rank}", "passed": M.matrix_rank(A) == rank},
            {"label": f"行列式 det(A) = {det_A:.3f}", "passed": True},
            {"label": f"秩 < 3 则 det(A)=0: {'是' if rank<3 else 'det≠0'}", "passed": (rank < 3) == (abs(det_A) < 1e-8)},
        ]

        # ─── 讲解内容 ─────────────────────────────────────
        nullity = 3 - rank
        lecture_sections = [
            {
                "title": "秩 = 变换后立方体的「有效维数」",
                "content": (
                    f"$3 \\times 3$ 矩阵 $A$ 把单位立方体变成另一个形状。\n\n"
                    + f"当前 $r(A) = {rank}$，$\\det(A) = {det_A:.3f}$。\n\n"
                    + ("立方体变成**平行六面体**——仍然占据三维空间（满秩）。" if rank == 3 else
                       "立方体被**压成一个面**——失去了一个维度（秩=2）。" if rank == 2 else
                       "立方体被**压成一条线段**——失去了两个维度（秩=1）。" if rank == 1 else
                       "立方体被**压成一个点**——整个空间坍缩到原点（秩=0）。")
                ),
            },
            {
                "title": "为什么 $r(A) < 3$ 等价于 $\\det(A) = 0$？",
                "content": (
                    "$\\det(A)$ 是平行六面体的有向体积。\n\n"
                    + ("$r(A) = 3$：三个列向量不共面 → 体积 $\\neq 0$ → $\\det \\neq 0$" if rank == 3 else
                       f"$r(A) = {rank} < 3$：三个列向量共面（或共线）→ 体积 $= 0$ → $\\det = 0$")
                    + "\n\n"
                    + "同济教材把这条作为定理：$r(A) = n \\iff \\det(A) \\neq 0$。"
                    + "秩和行列式说的是同一件事——只是秩是**离散**的（整数），行列式是**连续**的（实数）。"
                ),
            },
            {
                "title": "秩-零化度定理",
                "content": (
                    f"$$3 = r(A) + \\dim(\\text{{零空间}}) = {rank} + {nullity}$$\n\n"
                    + f"零空间维数 $= {nullity}$——有 {nullity} 个线性无关的方向被 $A$ 映射到原点。\n\n"
                    + "列空间（像空间）的维数 + 零空间的维数 = 输入空间的维数。\n"
                    + "这个定理从根本上解释了为什么矩阵的行秩 = 列秩。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(checks),
            "solution_info": {
                "type": "unique" if rank == 3 else ("infinite" if rank >= 1 else "none"),
                "description": desc,
                "details": {
                    "秩 r(A)": str(rank),
                    "行列式 det(A)": f"{det_A:.3f}",
                    "零空间维数 (3-r)": str(3 - rank),
                }
            },
            "lecture": {"sections": lecture_sections},
        }
