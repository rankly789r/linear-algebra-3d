"""
ch2_r4 — 克拉默法则的几何含义

克拉默法则说：xᵢ = det(Aᵢ) / det(A)
其中 Aᵢ 是把 A 的第 i 列替换为 b 得到的矩阵。

几何直觉：
- 2×2：det(A) = 以 a₁, a₂ 为边的平行四边形面积
- det(A₁) = 以 b, a₂ 为边的平行四边形面积
- x₁ = det(A₁)/det(A) = 面积比！
- 同理 x₂ = det(A₂)/det(A) = 以 a₁, b 为边的平行四边形面积 ÷ 原面积

克拉默法则不是公式巧合——它说「解 = 体积（面积）的比值」。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch2R4Cramer(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch2_r4_cramer",
            "title": "克拉默法则的几何含义",
            "chapter": "第2章 矩阵及其运算",
            "description": "克拉默法则的几何：x₁=面积₁/面积, x₂=面积₂/面积。解 = 体积比！",
            "params": {
                "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
                "b1": {"label": "b₁", "type": "float", "default": 4, "min": -10, "max": 10, "step": 0.1},
                "b2": {"label": "b₂", "type": "float", "default": 6, "min": -10, "max": 10, "step": 0.1},
            },
            "presets": [
                {
                    "label": "标准案例",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 1, "a21": 1, "a22": 3, "b1": 4, "b2": 6},
                },
                {
                    "label": "b 与 a₁ 同方向",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 1, "a21": 1, "a22": 3, "b1": 4, "b2": 2},
                },
                {
                    "label": "b 与 a₂ 同方向",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 1, "a21": 1, "a22": 3, "b1": 1, "b2": 3},
                },
                {
                    "label": "det(A)=0（不可用克拉默法则）",
                    "type": "none",
                    "params": {"a11": 1, "a12": 2, "a21": 2, "a22": 4, "b1": 3, "b2": 6},
                },
                {
                    "label": "正交基（面积=1）",
                    "type": "unique",
                    "params": {"a11": 1, "a12": 0, "a21": 0, "a22": 1, "b1": 2, "b2": 3},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        a11 = float(params.get("a11", 2)); a12 = float(params.get("a12", 1))
        a21 = float(params.get("a21", 1)); a22 = float(params.get("a22", 3))
        b1 = float(params.get("b1", 4)); b2 = float(params.get("b2", 6))

        A = np.array([[a11, a12], [a21, a22]], dtype=float)
        b = np.array([b1, b2], dtype=float)

        det_A = float(np.linalg.det(A))

        # 构造 A₁（第1列替换为b）和 A₂（第2列替换为b）
        A1 = np.column_stack([b, A[:, 1]])  # [b, a₂]
        A2 = np.column_stack([A[:, 0], b])  # [a₁, b]

        det_A1 = float(np.linalg.det(A1))
        det_A2 = float(np.linalg.det(A2))

        # 求解
        sol_type, x = M.solve_linear(A, b)

        # 变换数据：三个平行四边形的顶点
        def get_parallelogram(mat, label_str):
            """返回 2×2 矩阵对应的平行四边形顶点（列向量作为边）"""
            origin = np.array([0.0, 0.0])
            col1 = mat[:, 0]
            col2 = mat[:, 1]
            v1 = origin + col1
            v2 = origin + col1 + col2
            v3 = origin + col2
            verts = [origin, v1, v2, v3]
            return {
                "label": label_str,
                "vertices": [[float(v[0]), float(v[1]), 0.0] for v in verts],
                "area": abs(float(np.linalg.det(mat))),
                "det": float(np.linalg.det(mat)),
            }

        transforms = [
            get_parallelogram(A, "A (原始)"),
            get_parallelogram(A1, "A₁ (b替换第1列)"),
            get_parallelogram(A2, "A₂ (b替换第2列)"),
        ]

        matrices = [
            {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
            {"label": "A₁（b替换第1列）", "symbol": "A_1", "data": A1.tolist()},
            {"label": "A₂（b替换第2列）", "symbol": "A_2", "data": A2.tolist()},
        ]
        if x is not None:
            matrices.append({
                "label": "解向量 x", "symbol": "x",
                "data": [[float(x[0])], [float(x[1])]],
            })

        # 验证
        verification_checks = []
        if abs(det_A) > 1e-10 and x is not None:
            x1_cramer = det_A1 / det_A
            x2_cramer = det_A2 / det_A
            x1_ok = bool(np.isclose(x[0], x1_cramer, atol=1e-8))
            x2_ok = bool(np.isclose(x[1], x2_cramer, atol=1e-8))
            verification_checks = [
                {"label": f"x₁ = det(A₁)/det(A) = {det_A1:.4f}/{det_A:.4f} = {x1_cramer:.4f}",
                 "passed": x1_ok},
                {"label": f"x₂ = det(A₂)/det(A) = {det_A2:.4f}/{det_A:.4f} = {x2_cramer:.4f}",
                 "passed": x2_ok},
            ]
        elif abs(det_A) < 1e-10:
            verification_checks = [
                {"label": "det(A)=0，克拉默法则不适用", "passed": True},
            ]

        if sol_type == "unique" and x is not None:
            desc = (
                f"**克拉默法则**：\\n\\n"
                f"x₁ = det(A₁)/det(A) = {det_A1:.4f}/{det_A:.4f} = **{x[0]:.4f}**\\n\\n"
                f"x₂ = det(A₂)/det(A) = {det_A2:.4f}/{det_A:.4f} = **{x[1]:.4f}**\\n\\n"
                f"**几何含义**：把 b 放进第 i 列后，平行四边形的面积变为原来的 xᵢ 倍。"
            )
        else:
            desc = "det(A)=0，列向量共线，无法用克拉默法则。"

        return {
            "scene_data": {
                "matrices": matrices,
                "transforms": transforms,
                "det_A": det_A,
                "det_A1": det_A1,
                "det_A2": det_A2,
                "solution_type": sol_type,
            },
            "verification": self.make_verification(verification_checks),
            "solution_info": {
                "type": sol_type if sol_type else "none",
                "description": desc,
                "details": {
                    "det(A)": f"{det_A:.4f}",
                    "det(A₁)": f"{det_A1:.4f}",
                    "det(A₂)": f"{det_A2:.4f}",
                    "x₁ = det(A₁)/det(A)": f"{det_A1/det_A:.4f}" if abs(det_A) > 1e-10 else "无定义",
                    "x₂ = det(A₂)/det(A)": f"{det_A2/det_A:.4f}" if abs(det_A) > 1e-10 else "无定义",
                },
            },
        }
