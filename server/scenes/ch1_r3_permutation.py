"""
ch1_r3 — 排列、对换与空间定向

核心问题：为什么交换两行（列），行列式变号？

答案：一次对换 = 空间的一次翻转（定向反转）。
- 奇排列 → 奇数次翻转 → det < 0
- 偶排列 → 偶数次翻转 → det > 0

几何可视化：
- 原始平行四边形（列向量 a₁, a₂ 张成）+ 法向量（定向指示）
- 交换两列后 → 平行四边形翻转 → 面积不变但法向量反向 → det 变号
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch1R3Permutation(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch1_r3_permutation",
            "title": "排列、对换与空间定向",
            "chapter": "第1章 行列式",
            "description": "为什么交换两行行列式变号？因为空间被翻了个面！观察对换前后平行四边形的翻转和法向量反向。",
            "params": {
                "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {
                    "label": "对换翻转定向（det=6→-6）",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 1, "a21": 0, "a22": 3},
                },
                {
                    "label": "两列反向（det<0）",
                    "type": "unique",
                    "params": {"a11": 1, "a12": 3, "a21": 2, "a22": 1},
                },
                {
                    "label": "单位阵（det=1）",
                    "type": "unique",
                    "params": {"a11": 1, "a12": 0, "a21": 0, "a22": 1},
                },
                {
                    "label": "两列共线（det=0）",
                    "type": "degenerate",
                    "params": {"a11": 2, "a12": 4, "a21": 1, "a22": 2},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        a11 = float(params.get("a11", 2)); a12 = float(params.get("a12", 1))
        a21 = float(params.get("a21", 0)); a22 = float(params.get("a22", 3))

        # 原始矩阵 A 及交换列后的 A_swapped
        A = np.array([[a11, a12], [a21, a22]], dtype=float)
        A_swapped = np.column_stack([A[:, 1], A[:, 0]])  # 交换两列

        det_A = float(np.linalg.det(A))
        det_swapped = float(np.linalg.det(A_swapped))

        # 平行四边形顶点
        def get_parallelogram(mat):
            origin = np.array([0.0, 0.0])
            c1, c2 = mat[:, 0], mat[:, 1]
            return [
                [0.0, 0.0, 0.0],
                [float(c1[0]), float(c1[1]), 0.0],
                [float(c1[0] + c2[0]), float(c1[1] + c2[1]), 0.0],
                [float(c2[0]), float(c2[1]), 0.0],
            ]

        transforms = [
            {
                "label": "A (原始排列)",
                "dim": 2,
                "vertices": get_parallelogram(A),
                "det": det_A,
                "orientation": "正" if det_A >= 0 else "负",
            },
            {
                "label": "A' (交换两列)",
                "dim": 2,
                "vertices": get_parallelogram(A_swapped),
                "det": det_swapped,
                "orientation": "正" if det_swapped >= 0 else "负",
            },
        ]

        matrices = [
            {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
            {"label": "交换两列后", "symbol": "A'", "data": A_swapped.tolist()},
        ]

        det_flipped = bool(
            (det_A > 1e-10 and det_swapped < -1e-10) or
            (det_A < -1e-10 and det_swapped > 1e-10)
        )
        det_same_mag = bool(np.isclose(abs(det_A), abs(det_swapped), atol=1e-8))

        verification_checks = [
            {"label": f"det(A) = {det_A:.4f}", "passed": True},
            {"label": f"det(A') = {det_swapped:.4f}（交换列后）", "passed": True},
            {"label": "det 变号（定向翻转）", "passed": det_flipped or abs(det_A) < 1e-10},
            {"label": "|det| 不变（面积保持）", "passed": det_same_mag},
        ]

        return {
            "scene_data": {
                "matrices": matrices,
                "transforms": transforms,
                "det_A": det_A,
                "det_swapped": det_swapped,
                "det_flipped": det_flipped,
            },
            "verification": self.make_verification(verification_checks),
            "solution_info": {
                "type": "unique",
                "description": (
                    f"原始矩阵 det(A) = {det_A:.4f}\\n\\n"
                    f"交换两列后 det(A') = {det_swapped:.4f}\\n\\n"
                    f"**结论**：一次对换 = 空间翻转一次 = 行列式变号。"
                    f"面积（|det|）不变，但定向反转。\\n\\n"
                    f"这就是为什么 n 阶行列式定义中每一项的符号由排列的奇偶性决定："
                    f"奇排列（奇数个对换）→ 负号，偶排列 → 正号。"
                ),
                "details": {
                    "det(A)": f"{det_A:.4f}",
                    "det(A')": f"{det_swapped:.4f}",
                    "|det| 不变": "是" if det_same_mag else "否",
                    "定向翻转": "是" if det_flipped else "否（或 det=0）",
                },
            },
        }
