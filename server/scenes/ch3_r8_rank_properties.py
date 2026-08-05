"""
场景 3.8：秩的性质可视化验证

展示两个核心性质：
1. r(A) = r(Aᵀ)：矩阵和它的转置有相同的秩
2. r(AB) ≤ min(r(A), r(B))：乘积的秩不超过任因子的秩

用两个矩阵 A(3×2) 和 B(2×3)，对比：
- r(A)、r(Aᵀ)
- r(A)、r(B)、r(AB)、r(BA)
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R8RankProperties(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r8_rank_properties",
            "title": "3.8 秩的性质可视化",
            "chapter": "第三章",
            "description": "可视化验证：r(A)=r(Aᵀ)、r(AB)≤min(r(A),r(B))。观察变换的复合如何影响空间的维数。",
            "params": {
                "a11":{"label":"a₁₁","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a12":{"label":"a₁₂","type":"float","default":2,"min":-3,"max":3,"step":0.1},
                "a21":{"label":"a₂₁","type":"float","default":3,"min":-3,"max":3,"step":0.1},
                "a22":{"label":"a₂₂","type":"float","default":1,"min":-3,"max":3,"step":0.1},
                "a31":{"label":"a₃₁","type":"float","default":0,"min":-3,"max":3,"step":0.1},
                "a32":{"label":"a₃₂","type":"float","default":0,"min":-3,"max":3,"step":0.1},
            },
            "presets": [
                {"label": "r(A)=r(Aᵀ)=2", "type": "unique",
                 "params": {"a11":1,"a12":2, "a21":3,"a22":1, "a31":0,"a32":0}},
                {"label": "r(A)=r(Aᵀ)=1", "type": "degenerate",
                 "params": {"a11":1,"a12":2, "a21":2,"a22":4, "a31":3,"a32":6}},
                {"label": "AB vs r(A),r(B)", "type": "unique",
                 "params": {"a11":1,"a12":0, "a21":0,"a22":1, "a31":0,"a32":0}},
                {"label": "r(AB)严格小于", "type": "degenerate",
                 "params": {"a11":1,"a12":0, "a21":0,"a22":0, "a31":0,"a32":0}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [params.get("a11",1), params.get("a12",2)],
            [params.get("a21",3), params.get("a22",1)],
            [params.get("a31",0), params.get("a32",0)],
        ], dtype=float)

        rank_A = M.matrix_rank(A)
        A_T = A.T  # 2×3
        rank_AT = M.matrix_rank(A_T)

        # 定义一个配套的 B(2×3) 矩阵来展示 r(AB)
        # B 取 A 的前两行构成 2×3 矩阵
        B = np.array([
            [1, 0, 0],
            [0, 1, 0],
        ], dtype=float)
        rank_B = M.matrix_rank(B)

        AB = A @ B  # 3×3
        rank_AB = M.matrix_rank(AB)

        # 用于3D展示的数据
        # 生成圆周上的点，经过 A 变换
        n_pts = 30
        angles = np.linspace(0, 2*np.pi, n_pts)
        circle_2d = np.column_stack([np.cos(angles), np.sin(angles)])
        circle_transformed = (A @ circle_2d.T).T  # 3D

        # A的像空间中的点——用于展示列空间的形状
        desc_parts = []
        desc_parts.append(f"r(A) = {rank_A}，r(Aᵀ) = {rank_AT}。")
        desc_parts.append(f"r(A) = r(Aᵀ) = {rank_A == rank_AT} ✓")

        desc_parts.append(f"\nr(A) = {rank_A}，r(B) = {rank_B}，r(AB) = {rank_AB}。")
        desc_parts.append(f"r(AB) ≤ min(r(A), r(B)): {rank_AB} ≤ {min(rank_A, rank_B)} ✓")

        desc = "\n".join(desc_parts)

        scene_data = {
            "rank_A": rank_A,
            "rank_AT": rank_AT,
            "rank_B": rank_B,
            "rank_AB": rank_AB,
            "circle_transformed": circle_transformed.tolist() if rank_A > 0 else [],
            "matrix_A": A.tolist(),
            "matrix_AT": A_T.tolist(),
            "matrix_AB": AB.tolist(),
            "col_vectors_A": [A[:, j].tolist() for j in range(A.shape[1])],
            "matrices": [
                {"label": "矩阵 A（3×2）", "symbol": "A", "data": A.tolist()},
                {"label": "转置 Aᵀ（2×3）", "symbol": "A^{\\mathsf{T}}", "data": A_T.tolist()},
                {"label": "矩阵 B（2×3）", "symbol": "B", "data": B.tolist()},
                {"label": "乘积 AB（3×3）", "symbol": "AB", "data": AB.tolist()},
            ],
        }

        checks = [
            {"label": f"r(A) = {rank_A}", "passed": True},
            {"label": f"r(Aᵀ) = {rank_AT}", "passed": True},
            {"label": f"r(A) = r(Aᵀ): {rank_A == rank_AT}",
             "passed": rank_A == rank_AT},
            {"label": f"r(AB) = {rank_AB} ≤ min(r(A),r(B)) = {min(rank_A, rank_B)}",
             "passed": rank_AB <= min(rank_A, rank_B)},
        ]

        # ─── 讲解内容 ─────────────────────────────────────
        lecture_sections = [
            {
                "title": "性质一：行秩 = 列秩 = $r(A) = r(A^{\\mathsf{T}})$",
                "content": (
                    "同济教材 §3.3 的核心定理：矩阵的行秩等于列秩。\n\n"
                    + f"当前：$r(A) = {rank_A}$，$r(A^{{\\mathsf{{T}}}}) = {rank_AT}$。\n\n"
                    + ("✅ 相等！" if rank_A == rank_AT else "⚠️ 不相等？")
                    + " 这意味着：\n"
                    + f"- $A$ 的 {A.shape[1]} 个列向量最多挑出 {rank_A} 个线性无关的\n"
                    + f"- $A^{{\\mathsf{{T}}}}$ 的 {A.shape[0]} 个行向量也最多挑出 {rank_AT} 个线性无关的\n"
                    + "- 两者数量相同！\n\n"
                    + "这个结论一点都不显然——为什么行和列的「独立程度」一样？核心原因是秩-零化度定理。"
                ),
            },
            {
                "title": "性质二：$r(AB) \\leq \\min(r(A), r(B))$",
                "content": (
                    "复合变换的秩不超过任何一个因子的秩：\n\n"
                    + f"$$r(AB) = {rank_AB} \\leq \\min(r(A), r(B)) = \\min({rank_A}, {rank_B}) = {min(rank_A, rank_B)}$$\n\n"
                    + ("✅ 成立！" if rank_AB <= min(rank_A, rank_B) else "⚠️ 异常！")
                    + "\n\n"
                    + "**几何含义**：$B$ 先把空间压缩到 $r(B)$ 维，$A$ 再作用于这个已被压缩的空间——"
                    + "最终维数不可能超过 $B$ 的像空间维数，也不可能超过 $A$ 的列空间维数。\n\n"
                    + "变换复合只会「降维或保持」，永远不会「升维」。"
                ),
            },
            {
                "title": "推论：满秩矩阵的乘积仍满秩",
                "content": (
                    "如果 $A$ 和 $B$ 都是满秩方阵：\n\n"
                    + "$$r(A) = r(B) = n \\implies r(AB) = n$$\n\n"
                    + "此时 $\\det(AB) = \\det(A) \\cdot \\det(B) \\neq 0$。\n\n"
                    + "但如果有一个不是满秩（如投影矩阵），乘积的秩会被「拉低」——\n"
                    + "复合变换继承了每个因子可能的降维风险。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(checks),
            "solution_info": {
                "type": "unique",
                "description": desc,
                "details": {
                    "r(A)": str(rank_A),
                    "r(Aᵀ)": str(rank_AT),
                    "r(B)": str(rank_B),
                    "r(AB)": str(rank_AB),
                    "min(r(A), r(B))": str(min(rank_A, rank_B)),
                    "r(A)=r(Aᵀ)？": "是" if rank_A == rank_AT else "否",
                    "r(AB)≤min(r(A),r(B))？": "是" if rank_AB <= min(rank_A, rank_B) else "否",
                }
            },
            "lecture": {"sections": lecture_sections},
        }
