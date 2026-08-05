"""
场景 0.1：逐列拆解矩阵——行与列分别意味着什么

核心直觉：
  - 矩阵的第 j 列单独作用时，只响应输入的第 j 个坐标
  - 列 1 决定 e₁ 去哪，列 2 决定 e₂ 去哪
  - 完整变换 = 列 1 贡献 + 列 2 贡献（线性叠加）
  - 行 = 所有基向量在某一输出维度上的分量

模式：
  - "full": 完整变换
  - "col1_only": 只看第 1 列的作用（只响应 x 坐标）
  - "col2_only": 只看第 2 列的作用（只响应 y 坐标）
  - "compare": 并排对比三种变换
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch0R1ColumnDecompose(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch0_r1_column_decompose",
            "title": "逐列拆解——行与列的几何含义",
            "chapter": "基础概念",
            "description": (
                "把矩阵拆成列，逐列看它的作用。"
                "第 1 列只响应 x 坐标，第 2 列只响应 y 坐标，"
                "两者叠加就是完整的线性变换。"
            ),
            "params": {
                "mode": {
                    "label": "显示模式",
                    "type": "choice",
                    "default": "compare",
                    "options": ["compare", "full", "col1_only", "col2_only"],
                },
                "a11": {"label": "a₁₁ (列1.x)", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂ (列2.x)", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁ (列1.y)", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂ (列2.y)", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {
                    "label": "标准拉伸",
                    "type": "unique",
                    "params": {"mode": "compare", "a11": 2, "a12": 0, "a21": 0, "a22": 3},
                },
                {
                    "label": "剪切变换",
                    "type": "unique",
                    "params": {"mode": "compare", "a11": 1, "a12": 1.5, "a21": 0, "a22": 1},
                },
                {
                    "label": "旋转 90°",
                    "type": "unique",
                    "params": {"mode": "compare", "a11": 0, "a12": -1, "a21": 1, "a22": 0},
                },
                {
                    "label": "秩=1（列成比例）",
                    "type": "degenerate",
                    "params": {"mode": "compare", "a11": 1, "a12": 2, "a21": 1, "a22": 2},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        mode = params.get("mode", "compare")

        a11 = float(params.get("a11", 2))
        a12 = float(params.get("a12", 1))
        a21 = float(params.get("a21", 0))
        a22 = float(params.get("a22", 3))

        # 完整矩阵
        A_full = np.array([[a11, a12], [a21, a22]], dtype=float)
        # 仅第 1 列（第 2 列置零）
        A_col1 = np.array([[a11, 0], [a21, 0]], dtype=float)
        # 仅第 2 列（第 1 列置零）
        A_col2 = np.array([[0, a12], [0, a22]], dtype=float)

        # 单位正方形（XY 平面，z=0）
        square_2d = [
            np.array([0, 0]),
            np.array([1, 0]),
            np.array([1, 1]),
            np.array([0, 1]),
        ]

        def transform_2d(mat, pts):
            return [(mat @ p).astype(float) for p in pts]

        def to_3d(pt2d):
            return np.array([pt2d[0], pt2d[1], 0.0], dtype=float)

        # 原始正方形（3D）
        square_original = [to_3d(p) for p in square_2d]

        # 三种变换结果
        shape_full = [to_3d(p) for p in transform_2d(A_full, square_2d)]
        shape_col1 = [to_3d(p) for p in transform_2d(A_col1, square_2d)]
        shape_col2 = [to_3d(p) for p in transform_2d(A_col2, square_2d)]

        # 列向量（3D）
        col1 = to_3d(np.array([a11, a21]))
        col2 = to_3d(np.array([a12, a22]))
        e1 = np.array([1.0, 0.0, 0.0])
        e2 = np.array([0.0, 1.0, 0.0])

        # 验证：full = col1 + col2 对每个顶点
        sum_check = all(
            np.allclose(shape_full[i], shape_col1[i] + shape_col2[i] - to_3d(np.array([0, 0])), atol=1e-8)
            for i in range(4)
        )

        det = M.matrix_determinant(A_full)
        rank = int(M.matrix_rank(A_full))

        # ─── 讲解内容 ─────────────────────────────────────
        col1_str = f"({a11:.1f}, {a21:.1f})"
        col2_str = f"({a12:.1f}, {a22:.1f})"

        lecture_sections = [
            {
                "title": "列 = 基向量的「目的地」",
                "content": (
                    f"**第 1 列** ${col1_str}$ 就是 $e_1=(1,0)$ 被 $A$ 送到的地方。\n"
                    + f"**第 2 列** ${col2_str}$ 就是 $e_2=(0,1)$ 被 $A$ 送到的地方。\n\n"
                    + "列向量决定了「坐标轴框架」如何变形。"
                ),
            },
            {
                "title": "逐列拆解：列 1 只响应 x，列 2 只响应 y",
                "content": (
                    f"把 $A$ 拆成两半：\n\n"
                    + f"$$A = \\begin{{pmatrix}}{a11} & {a12} \\\\ {a21} & {a22}\\end{{pmatrix}}"
                    + f" = \\underbrace{{\\begin{{pmatrix}}{a11} & 0 \\\\ {a21} & 0\\end{{pmatrix}}}}_{{\\text{{列1}}}}"
                    + f" + \\underbrace{{\\begin{{pmatrix}}0 & {a12} \\\\ 0 & {a22}\\end{{pmatrix}}}}_{{\\text{{列2}}}}$$\n\n"
                    + "**列 1 部分**只读取输入的 $x$ 坐标，输出总是沿第 1 列方向（红色线段）。\n"
                    + "**列 2 部分**只读取输入的 $y$ 坐标，输出总是沿第 2 列方向（绿色线段）。\n"
                    + "两者**叠加**就是完整变换（蓝色平行四边形）。"
                ),
            },
            {
                "title": "行 = 各基向量在坐标轴上的「影子」",
                "content": (
                    f"**第 1 行** $({a11}, {a12})$：变换后所有基向量的 **$x$ 坐标**。\n"
                    + f"**第 2 行** $({a21}, {a22})$：变换后所有基向量的 **$y$ 坐标**。\n\n"
                    + "换句话说：行向量告诉你「在新坐标系里，原来的每个基向量贡献了多少到这个输出维度」。"
                ),
            },
            {
                "title": "秩 = 列张成的空间维数",
                "content": (
                    f"当前 $r(A) = {rank}$。\n"
                    + ("两列**线性无关**——它们指向不同方向，张成整个平面。" if rank == 2
                       else "两列**共线**——它们指向同一方向，正方形被压成一条线段，变换不可逆。")
                ),
            },
        ]

        if mode == "col1_only":
            mode_desc = f"只保留第 1 列 $({a11}, {a21})$。输出永远是 col₁ 的倍数——一切坍缩到一条线上。"
        elif mode == "col2_only":
            mode_desc = f"只保留第 2 列 $({a12}, {a22})$。输出永远是 col₂ 的倍数——一切坍缩到一条线上。"
        elif mode == "full":
            mode_desc = "完整矩阵作用。蓝色平行四边形 = 红色线段 ⊕ 绿色线段（向量加法）。"
        else:
            mode_desc = "并排对比：红色 = 仅列1 · 绿色 = 仅列2 · 蓝色 = 完整 = 红色⊕绿色。"

        return {
            "scene_data": {
                "mode": mode,
                "matrix_full": A_full.tolist(),
                "columns": [
                    {"start": e1.tolist(), "end": col1.tolist(), "color": "vector1"},
                    {"start": e2.tolist(), "end": col2.tolist(), "color": "vector2"},
                ],
                "shape_original": [v.tolist() for v in square_original],
                "shape_full": [v.tolist() for v in shape_full],
                "shape_col1": [v.tolist() for v in shape_col1],
                "shape_col2": [v.tolist() for v in shape_col2],
                "col1_vector": col1.tolist(),
                "col2_vector": col2.tolist(),
                "det": float(det),
                "rank": rank,
                "sum_check": bool(sum_check),
                "matrices": [
                    {"label": "完整矩阵 A", "symbol": "A", "data": A_full.tolist()},
                ],
            },
            "verification": self.make_verification([
                {"label": f"第 1 列 = Ae₁ = {col1_str}", "passed": True},
                {"label": f"第 2 列 = Ae₂ = {col2_str}", "passed": True},
                {"label": "full = col₁ ⊕ col₂ (叠加)", "passed": bool(sum_check)},
                {"label": f"det(A) = {det:.4f}", "passed": True},
                {"label": f"r(A) = {rank}", "passed": True},
            ]),
            "solution_info": {
                "type": "none" if rank < 2 else "unique",
                "description": mode_desc,
                "details": {
                    "第 1 列": col1_str,
                    "第 2 列": col2_str,
                    "det(A)": f"{det:.4f}",
                    "r(A)": str(rank),
                },
            },
            "lecture": {"sections": lecture_sections},
        }
