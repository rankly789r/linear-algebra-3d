"""
场景 0.0：矩阵的列向量——线性变换的密码

核心直觉：
  矩阵 A 的第 j 列 = A · e_j（标准基向量 e_j 经过变换 A 后的像）

2×2 模式：在 XY 平面上展示单位正方形如何变成平行四边形
3×3 模式：在 3D 空间中展示单位立方体如何变成平行六面体

这是理解「矩阵 = 线性变换」最关键的一步。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams, matrix_params
from server.math_engine import MathEngine as M


class Ch0R0MatrixColumns(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch0_r0_matrix_columns",
            "title": "矩阵的列——线性变换的密码",
            "chapter": "基础概念",
            "description": (
                "矩阵的每一列，就是对应标准基向量变换后的坐标。"
                "看到 e₁→第1列、e₂→第2列，你就看懂了矩阵。"
                "点击「▶ 演示动画」观看基向量从原始位置滑翔到变换后位置。"
            ),
            "params": {
                "mode": {
                    "label": "变换维度",
                    "type": "choice",
                    "default": "2x2",
                    "options": ["2x2", "3x3"],
                },
                **matrix_params("a", 3, 3, defaults=[[2,1,0],[0,3,0],[0,0,2]], min=-5, max=5),
            },
            "presets": [
                # ── 2×2 预设 ──
                {
                    "label": "2×2 恒等变换",
                    "type": "unique",
                    "params": {"mode": "2x2", "a11": 1, "a12": 0, "a21": 0, "a22": 1},
                },
                {
                    "label": "2×2 旋转 90°",
                    "type": "unique",
                    "params": {"mode": "2x2", "a11": 0, "a12": -1, "a21": 1, "a22": 0},
                },
                {
                    "label": "2×2 剪切变换",
                    "type": "unique",
                    "params": {"mode": "2x2", "a11": 1, "a12": 1.5, "a21": 0, "a22": 1},
                },
                {
                    "label": "2×2 降维（秩=1）",
                    "type": "degenerate",
                    "params": {"mode": "2x2", "a11": 1, "a12": 2, "a21": 1, "a22": 2},
                },
                # ── 3×3 预设 ──
                {
                    "label": "3×3 恒等变换",
                    "type": "unique",
                    "params": {
                        "mode": "3x3",
                        "a11": 1, "a12": 0, "a13": 0,
                        "a21": 0, "a22": 1, "a23": 0,
                        "a31": 0, "a32": 0, "a33": 1,
                    },
                },
                {
                    "label": "3×3 各向拉伸",
                    "type": "unique",
                    "params": {
                        "mode": "3x3",
                        "a11": 2, "a12": 0, "a13": 0,
                        "a21": 0, "a22": 1.5, "a23": 0,
                        "a31": 0, "a32": 0, "a33": 3,
                    },
                },
                {
                    "label": "3×3 降维到平面（秩=2）",
                    "type": "degenerate",
                    "params": {
                        "mode": "3x3",
                        "a11": 1, "a12": 0, "a13": 0,
                        "a21": 0, "a22": 1, "a23": 0,
                        "a31": 1, "a32": 1, "a33": 0,
                    },
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        mode = params.get("mode", "2x2")
        is_3d = mode == "3x3"

        # 构建矩阵
        if is_3d:
            A = np.array([
                [float(params.get("a11", 1)), float(params.get("a12", 0)), float(params.get("a13", 0))],
                [float(params.get("a21", 0)), float(params.get("a22", 1)), float(params.get("a23", 0))],
                [float(params.get("a31", 0)), float(params.get("a32", 0)), float(params.get("a33", 1))],
            ], dtype=float)
        else:
            # 2×2 矩阵嵌入 3D（z=0 平面上的变换，z 分量不变）
            A_2x2 = np.array([
                [float(params.get("a11", 1)), float(params.get("a12", 0))],
                [float(params.get("a21", 0)), float(params.get("a22", 1))],
            ], dtype=float)
            A = np.eye(3, dtype=float)
            A[0:2, 0:2] = A_2x2

        det = M.matrix_determinant(A)
        rank = int(M.matrix_rank(A))

        # ─── 标准基向量 ───────────────────────────────────
        e1 = np.array([1, 0, 0], dtype=float)
        e2 = np.array([0, 1, 0], dtype=float)
        e3 = np.array([0, 0, 1], dtype=float)

        # ─── 变换后的基向量（= 矩阵的列！） ──────────────
        col1 = A @ e1  # = A 的第 1 列
        col2 = A @ e2  # = A 的第 2 列
        col3 = A @ e3  # = A 的第 3 列

        # ─── 单位正方形/立方体的顶点 ──────────────────────
        if is_3d:
            shape_original = [
                np.array([0, 0, 0]), np.array([1, 0, 0]), np.array([1, 1, 0]),
                np.array([0, 1, 0]), np.array([0, 0, 1]), np.array([1, 0, 1]),
                np.array([1, 1, 1]), np.array([0, 1, 1]),
            ]
        else:
            # 2D 正方形在 z=0 平面上
            shape_original = [
                np.array([0, 0, 0]), np.array([1, 0, 0]),
                np.array([1, 1, 0]), np.array([0, 1, 0]),
            ]

        shape_transformed = [(A @ v).astype(float) for v in shape_original]

        # ─── 构建列向量信息 ──────────────────────────────
        if is_3d:
            columns_info = [
                {
                    "label": "第1列 = Ae₁",
                    "start": e1.tolist(),
                    "end": col1.tolist(),
                    "color": "vector1",
                },
                {
                    "label": "第2列 = Ae₂",
                    "start": e2.tolist(),
                    "end": col2.tolist(),
                    "color": "vector2",
                },
                {
                    "label": "第3列 = Ae₃",
                    "start": e3.tolist(),
                    "end": col3.tolist(),
                    "color": "vector3",
                },
            ]
        else:
            columns_info = [
                {
                    "label": "第1列 = Ae₁",
                    "start": e1.tolist(),
                    "end": col1.tolist(),
                    "color": "vector1",
                },
                {
                    "label": "第2列 = Ae₂",
                    "start": e2.tolist(),
                    "end": col2.tolist(),
                    "color": "vector2",
                },
            ]

        # ─── 矩阵显示 ─────────────────────────────────────
        # 显示恒等矩阵（起点）和变换矩阵（终点），帮助理解"从哪→到哪"
        if is_3d:
            identity = np.eye(3, dtype=float).tolist()
            matrices = [
                {"label": "起点：恒等矩阵 I（变换前）", "symbol": "I", "data": identity},
                {"label": "终点：变换矩阵 A（变换后）", "symbol": "A", "data": A.tolist()},
            ]
        else:
            identity_2d = np.eye(2, dtype=float).tolist()
            matrices = [
                {"label": "起点：恒等矩阵 I（变换前）", "symbol": "I", "data": identity_2d},
                {"label": "终点：变换矩阵 A（变换后）", "symbol": "A", "data": A[0:2, 0:2].tolist()},
            ]

        # ─── 验证 ─────────────────────────────────────────
        verification_checks = []
        if is_3d:
            verification_checks = [
                {"label": f"第1列 ({col1[0]:.1f},{col1[1]:.1f},{col1[2]:.1f})ᵀ = A·e₁", "passed": True},
                {"label": f"第2列 ({col2[0]:.1f},{col2[1]:.1f},{col2[2]:.1f})ᵀ = A·e₂", "passed": True},
                {"label": f"第3列 ({col3[0]:.1f},{col3[1]:.1f},{col3[2]:.1f})ᵀ = A·e₃", "passed": True},
                {"label": f"det(A) = {det:.4f}", "passed": True},
                {"label": f"r(A) = {rank}", "passed": True},
            ]
        else:
            verification_checks = [
                {"label": f"第1列 ({col1[0]:.1f},{col1[1]:.1f})ᵀ = A·e₁", "passed": True},
                {"label": f"第2列 ({col2[0]:.1f},{col2[1]:.1f})ᵀ = A·e₂", "passed": True},
                {"label": f"面积 = |det(A)| = {abs(det):.4f}", "passed": True},
                {"label": f"r(A) = {rank}", "passed": True},
            ]

        # ─── 解的说明 ─────────────────────────────────────
        # 重点解释：列 = 基向量的像
        if is_3d:
            col1_str = f"({col1[0]:.1f}, {col1[1]:.1f}, {col1[2]:.1f})"
            col2_str = f"({col2[0]:.1f}, {col2[1]:.1f}, {col2[2]:.1f})"
            col3_str = f"({col3[0]:.1f}, {col3[1]:.1f}, {col3[2]:.1f})"
            desc = (
                f"矩阵的每一列，就是对应标准基向量变换后的坐标。"
                f"第1列 {col1_str} 即 Ae₁；"
                f"第2列 {col2_str} 即 Ae₂；"
                f"第3列 {col3_str} 即 Ae₃。"
            )
            if rank < 3:
                desc += f" 秩={rank}，变换将空间压缩到{rank}维。"
        else:
            col1_str = f"({col1[0]:.1f}, {col1[1]:.1f})"
            col2_str = f"({col2[0]:.1f}, {col2[1]:.1f})"
            desc = (
                f"第1列 {col1_str} = Ae₁（e₁=[1,0]被A送到这里）；"
                f"第2列 {col2_str} = Ae₂（e₂=[0,1]被A送到这里）。"
                f"竖着读列 = 基向量的终点坐标；横着读行 = 各基向量在此坐标轴上的分量。"
            )
            if rank < 2:
                desc += f" 秩=1，正方形被压成线段。"

        return {
            "scene_data": {
                "mode": "3x3" if is_3d else "2x2",
                "matrix": A.tolist(),
                "columns": columns_info,
                "shape_original": [v.tolist() for v in shape_original],
                "shape_transformed": [v.tolist() for v in shape_transformed],
                "basis_original": [e1.tolist(), e2.tolist(), e3.tolist()] if is_3d else [e1.tolist(), e2.tolist()],
                "basis_transformed": [col1.tolist(), col2.tolist(), col3.tolist()] if is_3d else [col1.tolist(), col2.tolist()],
                "det": float(det),
                "rank": rank,
                "matrices": matrices,
            },
            "verification": self.make_verification(verification_checks),
            "solution_info": {
                "type": "none" if rank < (3 if is_3d else 2) else "unique",
                "description": desc,
                "details": {
                    "det(A)": f"{det:.4f}",
                    "r(A)": str(rank),
                    "关键直觉": "矩阵的列 = 基向量的像",
                },
            },
            "lecture": {
                "sections": [
                    {
                        "title": "核心直觉",
                        "content": (
                            "动画展示了标准基向量 **$e_1$**、**$e_2$**"
                            + ("、**$e_3$**" if is_3d else "")
                            + " 从原始位置（灰色虚线箭头）滑翔到变换后位置（彩色实线箭头）的过程。\n\n"
                            + "**变换后的基向量恰好就是矩阵 $A$ 的列向量。**"
                        ),
                    },
                    {
                        "title": "竖着读：列 = 基向量的「目的地」",
                        "content": (
                            f"矩阵 $A$ 的**第 1 列**是 $Ae_1$，即 $e_1$ 被送到 **${col1_str}**。\n"
                            + f"矩阵 $A$ 的**第 2 列**是 $Ae_2$，即 $e_2$ 被送到 **${col2_str}**。"
                            + (f"\n矩阵 $A$ 的**第 3 列**是 $Ae_3$，即 $e_3$ 被送到 **${col3_str}**。" if is_3d else "")
                            + "\n\n换句话说：**第 $j$ 列的第 $i$ 个分量，就是第 $j$ 个基向量被变换后在第 $i$ 个坐标轴上的坐标。**"
                        ),
                    },
                    {
                        "title": "横着读：行 = 各基向量的「影子」",
                        "content": (
                            "矩阵 $A$ 的**第 1 行**给出了所有基向量变换后的 **$x$ 坐标**。\n"
                            + "矩阵 $A$ 的**第 2 行**给出了所有基向量变换后的 **$y$ 坐标**。"
                            + ("\n矩阵 $A$ 的**第 3 行**给出了所有基向量变换后的 **$z$ 坐标**。" if is_3d else "")
                            + "\n\n所以：**行向量描述了每个输出维度上，各基向量的贡献分量。**"
                        ),
                    },
                    {
                        "title": "形状为什么这样变形？",
                        "content": (
                            "单位正方形/立方体的每个顶点都是基向量的组合（如 $(1,1,0) = e_1 + e_2$）。\n"
                            + "由于线性变换保持向量加法，顶点被变换后依然是相应基向量像的**同样组合**。\n\n"
                            + "所以：**基向量去哪儿，整个形状就跟着怎么变。**"
                        ),
                    },
                ],
            },
        }
