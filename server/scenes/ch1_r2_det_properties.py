"""
场景 1.2：行列式的性质可视化

可视化验证行列式的核心性质：
- 行交换 → det 变号
- 某行乘以 k → det 乘以 k
- 某行的 k 倍加到另一行 → det 不变
- det(Aᵀ) = det(A)
- det(kA) = kⁿ det(A)
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch1R2DetProperties(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch1_r2_det_properties",
            "title": "1.2 行列式的性质",
            "chapter": "第1章 行列式",
            "description": "可视化验证行列式的核心性质：行交换变号、倍乘缩放、倍加不变、det(Aᵀ)=det(A) 等。",
            "params": {
                "property": {
                    "label": "行列式性质",
                    "type": "choice",
                    "default": "swap_rows",
                    "options": ["swap_rows", "scale_row", "add_row", "transpose", "scalar_multiply"],
                },
                "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a13": {"label": "a₁₃", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a23": {"label": "a₂₃", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a31": {"label": "a₃₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a32": {"label": "a₃₂", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a33": {"label": "a₃₃", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {
                    "label": "交换第1、2行（变号）",
                    "type": "unique",
                    "params": {"property": "swap_rows", "a11": 2, "a12": 0, "a13": 0, "a21": 0, "a22": 3, "a23": 0, "a31": 0, "a32": 0, "a33": 1},
                },
                {
                    "label": "第1行×3（det×3）",
                    "type": "unique",
                    "params": {"property": "scale_row", "a11": 2, "a12": 0, "a13": 0, "a21": 0, "a22": 1, "a23": 0, "a31": 0, "a32": 0, "a33": 1},
                },
                {
                    "label": "倍加不变",
                    "type": "unique",
                    "params": {"property": "add_row", "a11": 2, "a12": 1, "a13": 0, "a21": 0, "a22": 3, "a23": 0, "a31": 0, "a32": 0, "a33": 1},
                },
                {
                    "label": "det(Aᵀ)=det(A)",
                    "type": "unique",
                    "params": {"property": "transpose", "a11": 2, "a12": 1, "a13": 0, "a21": 0, "a22": 3, "a23": 1, "a31": 0, "a32": 0, "a33": 2},
                },
                {
                    "label": "det(2A)=2³det(A)",
                    "type": "unique",
                    "params": {"property": "scalar_multiply", "a11": 1, "a12": 0, "a13": 0, "a21": 0, "a22": 2, "a23": 0, "a31": 0, "a32": 0, "a33": 3},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        a11 = float(params.get("a11", 2))
        a12 = float(params.get("a12", 0))
        a13 = float(params.get("a13", 0))
        a21 = float(params.get("a21", 0))
        a22 = float(params.get("a22", 2))
        a23 = float(params.get("a23", 0))
        a31 = float(params.get("a31", 0))
        a32 = float(params.get("a32", 0))
        a33 = float(params.get("a33", 3))

        A = np.array([
            [a11, a12, a13],
            [a21, a22, a23],
            [a31, a32, a33],
        ], dtype=float)

        prop = params.get("property", "swap_rows")
        det_original = M.matrix_determinant(A)

        # ─── 根据所选性质变换矩阵 ─────────────────────────

        if prop == "swap_rows":
            # 交换第 1 行和第 2 行
            A2 = A.copy()
            A2[[0, 1]] = A2[[1, 0]]
            prop_name = "交换第 1、2 行"
            expected = f"det(A') = -det(A) = {-det_original:.4f}"

        elif prop == "scale_row":
            k = 3.0
            A2 = A.copy()
            A2[0, :] *= k
            prop_name = f"第 1 行 × {k}"
            expected = f"det(A') = {k}·det(A) = {k * det_original:.4f}"

        elif prop == "add_row":
            k = 2.0
            A2 = A.copy()
            A2[0, :] += k * A2[1, :]
            prop_name = f"第 1 行 + {k}× 第 2 行"
            expected = f"det(A') = det(A) = {det_original:.4f}"

        elif prop == "transpose":
            A2 = A.T.copy()
            prop_name = "转置 Aᵀ"
            expected = f"det(Aᵀ) = det(A) = {det_original:.4f}"

        elif prop == "scalar_multiply":
            k = 2.0
            A2 = k * A
            n = A.shape[0]
            prop_name = f"数乘 {k}A"
            expected = f"det({k}A) = {k}³·det(A) = {k**n * det_original:.4f}"

        det_modified = M.matrix_determinant(A2)

        # ─── 生成两个平行六面体的顶点 ─────────────────────

        def make_parallelepiped(mat):
            v1 = mat[:, 0]
            v2 = mat[:, 1]
            v3 = mat[:, 2]
            return [
                [0, 0, 0],
                [float(v1[0]), float(v1[1]), float(v1[2])],
                [float(v2[0]), float(v2[1]), float(v2[2])],
                [float(v1[0] + v2[0]), float(v1[1] + v2[1]), float(v1[2] + v2[2])],
                [float(v3[0]), float(v3[1]), float(v3[2])],
                [float(v1[0] + v3[0]), float(v1[1] + v3[1]), float(v1[2] + v3[2])],
                [float(v2[0] + v3[0]), float(v2[1] + v3[1]), float(v2[2] + v3[2])],
                [float(v1[0] + v2[0] + v3[0]), float(v1[1] + v2[1] + v3[1]), float(v1[2] + v2[2] + v3[2])],
            ]

        edges = [
            (0, 1), (0, 2), (0, 4), (1, 3), (1, 5),
            (2, 3), (2, 6), (3, 7), (4, 5), (4, 6), (5, 7), (6, 7),
        ]

        scene_data = {
            "property_name": prop_name,
            "expected": expected,
            "det_original": float(det_original),
            "det_modified": float(det_modified),
            # 原始矩阵的六面体（白色线框）
            "shape_original": {
                "vertices": make_parallelepiped(A),
                "edges": edges,
            },
            # 变换后矩阵的六面体（彩色半透明）
            "shape_modified": {
                "vertices": make_parallelepiped(A2),
                "edges": edges,
            },
            "matrices": [
                {"label": "原矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": f"变换后矩阵 A'", "symbol": "A'", "data": A2.tolist()},
            ],
        }

        det_match = abs(det_modified - det_original) < 1e-8
        if prop == "swap_rows":
            det_match = abs(det_modified + det_original) < 1e-8
        elif prop == "scale_row":
            det_match = abs(det_modified - 3 * det_original) < 1e-8
        elif prop == "scalar_multiply":
            det_match = abs(det_modified - 8 * det_original) < 1e-8

        verification = self.make_verification([
            {"label": f"原 det(A) = {det_original:.4f}", "passed": True},
            {"label": expected, "passed": det_match},
        ])

        solution_info = {
            "type": "unique",
            "description": f"性质「{prop_name}」：{expected}。实际结果：det(A') = {det_modified:.4f}。",
            "details": {
                "原 det(A)": f"{det_original:.4f}",
                "变换后 det(A')": f"{det_modified:.4f}",
                "性质成立": "是" if det_match else "否",
            },
        }

        # ─── 讲解内容 ─────────────────────────────────────
        det_orig_str = f"{det_original:.4f}"
        det_mod_str = f"{det_modified:.4f}"
        lecture_sections = [
            {
                "title": "行列式的五条核心性质",
                "content": (
                    "同济教材 §1.2 列出了行列式的核心性质，本场景可视化验证其中五条：\n\n"
                    + "1. **行交换**：交换两行，$\\det$ 变号\n"
                    + "2. **倍乘**：某行 $\\times k$，$\\det$ 也 $\\times k$\n"
                    + "3. **倍加**：某行的 $k$ 倍加到另一行，$\\det$ 不变\n"
                    + "4. **转置**：$\\det(A^{\\mathsf{T}}) = \\det(A)$\n"
                    + "5. **数乘**：$\\det(kA) = k^n \\det(A)$（$n$ 是阶数）\n\n"
                    + "从下拉菜单选择一条性质，观察右侧两个六面体如何变化。"
                ),
            },
            {
                "title": f"当前性质：{prop_name}",
                "content": (
                    f"$$\\det(A) = {det_orig_str}$$\n\n"
                    + f"变换后：$\\det(A') = {det_mod_str}$\n\n"
                    + f"预期：{expected}\n\n"
                    + ("✅ 性质成立！" if det_match else "⚠️ 验证失败，请检查参数。")
                ),
            },
            {
                "title": "为什么行列式有这些性质？",
                "content": (
                    "本质原因：行列式 = 平行六面体的**有向体积**。\n\n"
                    + "- **换行变号**：交换两个向量改变手性方向\n"
                    + "- **倍乘**：拉伸一个边，体积等比缩放\n"
                    + "- **倍加不变**：把一个边往另一个边的方向推（剪切），体积不变——底面积相同，高度没变\n"
                    + "- **转置不变**：行和列在体积计算中对称\n\n"
                    + "行列式是**多重线性**的——对每一行（列）都是线性的。这就是为什么消元法能简化行列式计算。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            "lecture": {"sections": lecture_sections},
        }
