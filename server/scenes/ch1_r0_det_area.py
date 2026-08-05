"""
场景 1.0：二阶行列式的几何意义

2×2 矩阵的行列式的绝对值 = 两个列向量张成的平行四边形的面积。
det > 0：逆时针方向 | det < 0：顺时针方向 | det = 0：共线（退化）
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch1R0DetArea(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch1_r0_det_area",
            "title": "1.0 二阶行列式的几何意义",
            "chapter": "第1章 行列式",
            "description": "2×2 行列式的几何含义：两个列向量张成的平行四边形的（有向）面积。det>0为逆时针，det<0为顺时针。",
            "params": {
                "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {
                    "label": "标准矩形（逆时针）",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 0, "a21": 0, "a22": 3},
                },
                {
                    "label": "倾斜平行四边形",
                    "type": "unique",
                    "params": {"a11": 3, "a12": 1, "a21": 1, "a22": 2},
                },
                {
                    "label": "顺时针方向（det<0）",
                    "type": "degenerate",
                    "params": {"a11": 1, "a12": 3, "a21": 2, "a22": 0},
                },
                {
                    "label": "共线（det=0）",
                    "type": "none",
                    "params": {"a11": 2, "a12": 4, "a21": 1, "a22": 2},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        a11 = float(params.get("a11", 2))
        a12 = float(params.get("a12", 0))
        a21 = float(params.get("a21", 0))
        a22 = float(params.get("a22", 3))

        A = np.array([[a11, a12], [a21, a22]], dtype=float)
        det = M.matrix_determinant(A)
        area = abs(det)

        # 两个列向量
        v1 = A[:, 0]  # [a11, a21]
        v2 = A[:, 1]  # [a12, a22]

        # 平行四边形顶点（3D 中放在 XY 平面，z=0）
        origin = np.array([0, 0, 0])
        p1 = np.array([v1[0], v1[1], 0])
        p2 = np.array([v1[0] + v2[0], v1[1] + v2[1], 0])
        p3 = np.array([v2[0], v2[1], 0])

        # 平行四边形的两条对角线
        diag1_start = [0, 0, 0]
        diag1_end = [p2[0], p2[1], p2[2]]

        relation = "independent"
        if abs(det) < 1e-8:
            relation = "collinear"

        # 单位正方形顶点（动画起始状态）
        unit_square = [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
            [0, 1, 0],
        ]

        scene_data = {
            "shape_original": unit_square,  # 单位正方形（动画用）
            "vectors": [
                {"components": [float(v1[0]), float(v1[1]), 0], "color": 0x4cc9f0, "label": "v₁"},
                {"components": [float(v2[0]), float(v2[1]), 0], "color": 0x06d6a0, "label": "v₂"},
            ],
            "parallelogram": {
                "vertices": [
                    [0, 0, 0],
                    [float(p1[0]), float(p1[1]), 0],
                    [float(p2[0]), float(p2[1]), 0],
                    [float(p3[0]), float(p3[1]), 0],
                ],
                "diagonal": {
                    "start": [0, 0, 0],
                    "end": [float(p2[0]), float(p2[1]), 0],
                },
            },
            "det": float(det),
            "area": float(area),
            "relation": relation,
            "matrices": [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
            ],
        }

        verification = self.make_verification([
            {"label": f"det(A) = {det:.4f}", "passed": True},
            {"label": f"面积 = |det| = {area:.4f}", "passed": True},
            {"label": f"rank(A) = {M.matrix_rank(A)}", "passed": True},
        ])

        orientation = "逆时针（正向）" if det > 1e-8 else ("顺时针（负向）" if det < -1e-8 else "共线（退化）")

        solution_info = {
            "type": "unique" if abs(det) > 1e-8 else "none",
            "description": f"det(A) = {det:.4f}，方向：{orientation}。平行四边形面积 = |det| = {area:.2f}。",
            "details": {
                "det(A)": f"{det:.4f}",
                "|det(A)|（面积）": f"{area:.2f}",
                "r(A)": str(M.matrix_rank(A)),
            },
        }

        # ─── 讲解内容 ─────────────────────────────────────
        det_str = f"{det:.4f}"
        area_str = f"{area:.2f}"
        lecture_sections = [
            {
                "title": "行列式 = 平行四边形的有向面积",
                "content": (
                    f"$2 \\times 2$ 矩阵 $A$ 的两列 $v_1, v_2$ 张成一个平行四边形。\n\n"
                    + f"$$\\det(A) = {det_str}$$\n\n"
                    + f"其**绝对值** $|\\det| = {area_str}$ 就是这个平行四边形的**面积**。\n\n"
                    + "行列式是线性变换的**面积缩放因子**——单位正方形（面积=1）经过 $A$ 变换后，面积变成 $|\\det(A)|$。"
                ),
            },
            {
                "title": "符号 = 方向",
                "content": (
                    "- **$\\det > 0$**：$v_1$ 到 $v_2$ 是**逆时针**方向（保持右手系）\n"
                    + "- **$\\det < 0$**：$v_1$ 到 $v_2$ 是**顺时针**方向（翻转了空间）\n"
                    + "- 负行列式意味着变换「翻转」了平面——就像把一张纸翻过来\n\n"
                    + f"当前：$\\det(A) = {det_str}$，方向为**{orientation}**。"
                ),
            },
            {
                "title": "$\\det = 0$ 意味着什么？",
                "content": (
                    "当两列**共线**时，平行四边形坍缩为一条线段，面积为 $0$。\n\n"
                    + "几何含义：变换将整个平面**压缩**到一条线（甚至一个点）上——信息丢失，不可逆。\n\n"
                    + "这就是为什么「$\\det \\neq 0$」等价于「矩阵可逆」：面积不为零，变换才可逆转。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            "lecture": {"sections": lecture_sections},
        }
