"""
场景 3.0：秩的直观理解

用一个 3×2 矩阵（把 2D 平面映射到 3D 空间），展示：
- 秩 = 2：平面被嵌入为 3D 空间中的一个 2D 平面
- 秩 = 1：平面被压成一条线
- 秩 = 0：平面被压成一个点

观察分布在输入空间中的点经过矩阵变换后的形状。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R0RankIntuition(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r0_rank_intuition",
            "title": "3.0 秩的直观理解",
            "chapter": "第三章",
            "description": "矩阵作为线性变换，观察它如何改变空间中向量的分布。秩就是变换后「像空间」的维数——也被「压扁」成几维。",
            "params": {
                "a11": {"label": "a₁₁", "type": "float", "default": 1, "min": -2, "max": 2, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 0, "min": -2, "max": 2, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": 0, "min": -2, "max": 2, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": 1, "min": -2, "max": 2, "step": 0.1},
                "a31": {"label": "a₃₁", "type": "float", "default": 0, "min": -2, "max": 2, "step": 0.1},
                "a32": {"label": "a₃₂", "type": "float", "default": 0, "min": -2, "max": 2, "step": 0.1},
            },
            "presets": [
                {"label": "秩=2（满秩）", "type": "unique",
                 "params": {"a11":1,"a12":0, "a21":0,"a22":1, "a31":0,"a32":0}},
                {"label": "秩=1（压扁成线）", "type": "degenerate",
                 "params": {"a11":1,"a12":2, "a21":1,"a22":2, "a31":1,"a32":2}},
                {"label": "秩=0（零矩阵）", "type": "none",
                 "params": {"a11":0,"a12":0, "a21":0,"a22":0, "a31":0,"a32":0}},
                {"label": "倾斜映射", "type": "unique",
                 "params": {"a11":1,"a12":0.5, "a21":0.3,"a22":1, "a31":0.2,"a32":0.4}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [params.get("a11",1), params.get("a12",0)],
            [params.get("a21",0), params.get("a22",1)],
            [params.get("a31",0), params.get("a32",0)],
        ], dtype=float)

        rank = M.matrix_rank(A)

        # 在 2D 输入空间生成圆周上的点
        n_pts = 32
        angles = np.linspace(0, 2*np.pi, n_pts)
        input_circle = np.column_stack([np.cos(angles), np.sin(angles)])
        # 变换到 3D
        output_circle = (A @ input_circle.T).T  # shape (n_pts, 3)

        # 生成输入空间的网格点（中心 + 四个方向）
        input_grid = np.array([
            [0, 0],
            [1, 0], [-1, 0],
            [0, 1], [0, -1],
            [1, 1], [1, -1], [-1, 1], [-1, -1],
        ], dtype=float)
        output_grid = (A @ input_grid.T).T

        # 判断像空间的几何特征
        if rank == 2:
            desc = f"矩阵的秩为 2（满秩），二维输入被映射为三维空间中的一个二维平面。"
            span_desc = "二维平面"
        elif rank == 1:
            desc = f"矩阵的秩为 1，所有输出向量落在同一条直线上——输入空间被「压扁」了。"
            span_desc = "一条直线"
        else:
            desc = f"矩阵的秩为 0，所有输出向量都变为零向量。"
            span_desc = "一个点（原点）"

        scene_data = {
            "rank": rank,
            "output_circle": output_circle.tolist() if rank > 0 else [],
            "output_grid_points": output_grid.tolist(),
            "input_circle": input_circle.tolist(),
            "span_desc": span_desc,
            "matrix": A.tolist(),
            "matrices": [
                {"label": "变换矩阵 A（3×2）", "symbol": "A", "data": A.tolist()},
            ],
        }

        checks = [
            {"label": f"矩阵 [3×2] 的秩 = {rank}", "passed": M.matrix_rank(A) == rank},
            {"label": f"像空间是 {span_desc}", "passed": True},
        ]
        if rank == 1:
            # 验证所有输出共线
            pts = output_grid
            if len(pts) > 0:
                v0 = pts[1] - pts[0] if len(pts) > 1 else np.zeros(3)
                all_collinear = all(
                    np.linalg.norm(np.cross(p - pts[0], v0)) < 1e-6
                    for p in pts[1:] if np.linalg.norm(v0) > 1e-8
                ) if np.linalg.norm(v0) > 1e-8 else True
                checks.append({"label": "验证所有输出共线", "passed": all_collinear})

        # ─── 讲解内容 ─────────────────────────────────────
        nullity = 2 - rank
        lecture_sections = [
            {
                "title": "秩 = 变换后空间的「真实维数」",
                "content": (
                    f"此场景用一个 $3 \\times 2$ 矩阵将二维输入映射到三维空间。\n\n"
                    + f"当前 $r(A) = {rank}$。\n\n"
                    + f"输入空间中的所有点，经过 $A$ 变换后，全部落在三维空间中的一个**{span_desc}**上。\n\n"
                    + "秩告诉你变换后的像空间是「几维」的——不管矩阵有多少行多少列，秩才是真正的「有效维度」。"
                ),
            },
            {
                "title": "秩-零化度定理（Rank-Nullity Theorem）",
                "content": (
                    "线性代数最重要的定理之一：\n\n"
                    + "$$\\dim(\\text{输入空间}) = r(A) + \\dim(\\text{零空间})$$\n\n"
                    + f"当前：$2 = {rank} + {nullity}$\n\n"
                    + "- $r(A) = {rank}$：变换后保留下来的维数\n"
                    + f"- 零空间维数 $= {nullity}$：被「压扁到零」的维数\n\n"
                    + "输入的总维数永远等于「存活」的维数加「死亡」的维数。"
                ),
            },
            {
                "title": "零空间 = 被压缩到原点的方向",
                "content": (
                    "那些满足 $Ax = 0$ 的非零向量构成了**零空间**。\n\n"
                    + f"当 $r(A) = 2 < 3$ 时，存在非零向量被 $A$ 映射到原点。\n"
                    + f"当 $r(A) = 2$ 且输入是二维时，零空间维数为 $0$——只有零向量自身被映射到原点（一对一映射）。\n\n"
                    + "当你看到一个 $m \\times n$ 矩阵时，$n - r(A)$ 就是被变换「消灭」的维数。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(checks),
            "solution_info": {
                "type": "unique" if rank == 2 else ("infinite" if rank == 1 else "none"),
                "description": desc,
                "details": {
                    "秩（像空间维数）": str(rank),
                    "输入空间维数": "2",
                    "零空间维数 (2 - r)": str(2 - rank),
                }
            },
            "lecture": {"sections": lecture_sections},
        }
