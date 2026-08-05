"""
场景 2.1：逆矩阵的几何含义

A⁻¹ 是 A 的逆向变换：A⁻¹(A(v)) = v。
如果 det(A) = 0，变换将空间降维，无法逆转。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch2R1MatrixInverse(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch2_r1_matrix_inverse",
            "title": "2.1 逆矩阵的几何含义",
            "chapter": "第2章 矩阵及其运算",
            "description": "逆矩阵 A⁻¹ 代表 A 变换的逆向操作。可逆的充要条件是 det(A) ≠ 0。当 det(A)=0 时，降维过程不可逆。",
            "params": {
                "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {
                    "label": "缩放（可逆）",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 0, "a21": 0, "a22": 0.5},
                },
                {
                    "label": "旋转（可逆）",
                    "type": "unique",
                    "params": {"a11": 0, "a12": -1, "a21": 1, "a22": 0},
                },
                {
                    "label": "投影（不可逆）",
                    "type": "none",
                    "params": {"a11": 1, "a12": 0, "a21": 0, "a22": 0},
                },
                {
                    "label": "一般可逆矩阵",
                    "type": "unique",
                    "params": {"a11": 1, "a12": 2, "a21": 3, "a22": 4},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [float(params.get("a11", 2)), float(params.get("a12", 0))],
            [float(params.get("a21", 0)), float(params.get("a22", 1))],
        ], dtype=float)

        det = M.matrix_determinant(A)
        rank = M.matrix_rank(A)
        A_inv = M.matrix_inverse(A)

        # 单位正方形
        square = [
            np.array([0, 0, 0]),
            np.array([1, 0, 0]),
            np.array([1, 1, 0]),
            np.array([0, 1, 0]),
        ]

        def transform_2x2(mat, pts):
            result = []
            for p in pts:
                t = mat @ np.array([p[0], p[1]])
                result.append(np.array([t[0], t[1], 0]))
            return [r.tolist() for r in result]

        shape_original = [s.tolist() for s in square]
        shape_after_A = transform_2x2(A, square)

        matrices = [
            {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
        ]

        scene_data = {
            "shape_original": shape_original,
            "shape_after_A": shape_after_A,
            "det": float(det),
            "rank": rank,
            "invertible": A_inv is not None,
        }

        if A_inv is not None:
            A_inv_list = A_inv.tolist()
            matrices.append({"label": "逆矩阵 A⁻¹", "symbol": "A^{-1}", "data": A_inv_list})

            # 还原形状
            shape_restored = transform_2x2(A_inv, [np.array(v) for v in shape_after_A])
            scene_data["shape_restored"] = shape_restored
            scene_data["offset"] = 3.0

            identity_check = np.allclose(A @ A_inv, np.eye(2), atol=1e-8)

        verify_checks = [
            {"label": f"det(A) = {det:.4f}", "passed": True},
            {"label": f"r(A) = {rank}", "passed": True},
        ]

        if A_inv is not None:
            verify_checks.append({"label": "A·A⁻¹ ≈ I", "passed": identity_check})
            solution_desc = f"A 可逆（det={det:.4f}≠0）。右侧展示了 A⁻¹ 将 A 变换后的正方形还原回原位。"
            solution_type = "unique"
        else:
            solution_desc = f"A 不可逆（det={det:.4f}=0，r(A)={rank}<2）。A 将正方形压缩到了低维空间，无法逆转。"
            solution_type = "none"

        # ─── 讲解内容 ─────────────────────────────────────
        det_str = f"{det:.4f}"
        if A_inv is not None:
            invertibility = "**可逆**（非奇异）"
            inv_explanation = (
                f"因为 $\\det(A) = {det_str} \\neq 0$，所以 $A$ 可逆。\n\n"
                + "$$A \\cdot A^{-1} = I$$\n\n"
                + "右侧 3D 视图中，蓝色正方形先被 $A$ 变换（变形），再被 $A^{-1}$ 变换（还原）。"
                + "如果两次变换复合起来，效果与恒等变换 $I$ 完全一样。"
            )
        else:
            invertibility = "**不可逆**（奇异）"
            inv_explanation = (
                f"因为 $\\det(A) = 0$（$r(A) = {rank} < 2$），所以 $A$ **不可逆**。\n\n"
                + "$A$ 将整个二维平面压缩到了一条线（甚至一个点）上。\n"
                + "一旦多个点被映射到同一个像，就无法唯一地「退回去」——逆变换不存在。"
            )
        lecture_sections = [
            {
                "title": f"当前矩阵：{invertibility}",
                "content": inv_explanation,
            },
            {
                "title": "逆矩阵的几何直觉",
                "content": (
                    "如果把矩阵 $A$ 想象成一种「变形操作」：\n\n"
                    + "- **可逆** = 变形是可恢复的（拉伸、旋转、剪切都可以还原）\n"
                    + "- **不可逆** = 变形摧毁了信息（投影、压缩到低维）\n\n"
                    + "同济教材定理（§2.3）：$A$ 可逆 $\\iff \\det(A) \\neq 0 \\iff r(A) = n$。\n"
                    + "这三个条件是**等价的**——它们说的是同一件事：变换没有降维。"
                ),
            },
            {
                "title": "逆矩阵的伴随矩阵公式",
                "content": (
                    "计算上（同济教材 §2.3）：\n\n"
                    + "$$A^{-1} = \\frac{1}{\\det(A)} A^*$$\n\n"
                    + "其中 $A^*$ 是伴随矩阵（各元素的代数余子式组成的矩阵的转置）。\n\n"
                    + "当 $\\det(A) = 0$ 时，分母为零——这就是为什么奇异矩阵没有逆矩阵。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(verify_checks),
            "solution_info": {
                "type": solution_type,
                "description": solution_desc,
                "details": {
                    "det(A)": f"{det:.4f}",
                    "r(A)": str(rank),
                    "可逆": "是" if A_inv is not None else "否",
                },
            },
            "lecture": {"sections": lecture_sections},
        }
