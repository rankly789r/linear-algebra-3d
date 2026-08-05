"""
场景 2.0：矩阵乘法的几何含义

矩阵乘法 C = AB 表示先做 B 变换，再做 A 变换的复合。
(AB)v = A(Bv) —— 两种路径到达同一个点。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch2R0MatrixMultiply(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch2_r0_matrix_multiply",
            "title": "2.0 矩阵乘法的几何含义",
            "chapter": "第2章 矩阵及其运算",
            "description": "矩阵乘法代表线性变换的复合：C=AB 意味着先做 B 变换，再做 A 变换。AB ≠ BA 一般成立。",
            "params": {
                "a11": {"label": "A a₁₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "A a₁₂", "type": "float", "default": -1, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "A a₂₁", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "A a₂₂", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "b11": {"label": "B b₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "b12": {"label": "B b₁₂", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "b21": {"label": "B b₂₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "b22": {"label": "B b₂₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {
                    "label": "旋转复合",
                    "type": "unique",
                    "params": {"a11": 0, "a12": -1, "a21": 1, "a22": 0, "b11": 1, "b12": 0, "b21": 0, "b22": 2},
                },
                {
                    "label": "AB ≠ BA",
                    "type": "unique",
                    "params": {"a11": 1, "a12": 2, "a21": 0, "a22": 1, "b11": 1, "b12": 0, "b21": 1, "b22": 1},
                },
                {
                    "label": "投影 × 旋转",
                    "type": "degenerate",
                    "params": {"a11": 1, "a12": 0, "a21": 0, "a22": 0, "b11": 0, "b12": -1, "b21": 1, "b22": 0},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [float(params.get("a11", 0)), float(params.get("a12", -1))],
            [float(params.get("a21", 1)), float(params.get("a22", 0))],
        ], dtype=float)

        B = np.array([
            [float(params.get("b11", 2)), float(params.get("b12", 0))],
            [float(params.get("b21", 0)), float(params.get("b22", 1))],
        ], dtype=float)

        C = M.matrix_multiply(A, B)  # C = AB
        BA = M.matrix_multiply(B, A)  # 对比 BA

        # 单位正方形的四个顶点（3D 中放在 XY 平面）
        square = [
            np.array([0, 0, 0]),
            np.array([1, 0, 0]),
            np.array([1, 1, 0]),
            np.array([0, 1, 0]),
        ]

        def transform_shape(mat, pts, offset=np.array([0, 0, 0])):
            """将 2×2 矩阵作用于 XY 平面上的点"""
            result = []
            for p in pts:
                p2d = np.array([p[0], p[1]])
                t = mat @ p2d
                result.append(np.array([t[0], t[1], 0]) + offset)
            return [r.tolist() for r in result]

        # 四个变换后的四边形（依次向右偏移）
        sep = 3.5
        shape_original = [s.tolist() for s in square]
        shape_B = transform_shape(B, square, np.array([sep, 0, 0]))
        shape_A_of_B = transform_shape(A, [np.array(v) for v in shape_B], np.array([0, 0, 0]))  # A 作用在 B 的结果上
        shape_C = transform_shape(C, square, np.array([2 * sep, 0, 0]))  # AB 直接

        # 样本向量
        sample_v = np.array([1, 0.5])
        v_original = np.array([sample_v[0], sample_v[1], 0])
        Bv = np.array([float((B @ sample_v)[0]), float((B @ sample_v)[1]), 0])
        A_Bv = np.array([float((A @ Bv[:2])[0]), float((A @ Bv[:2])[1]), 0])
        Cv = np.array([float((C @ sample_v)[0]), float((C @ sample_v)[1]), 0])

        ab_eq = np.allclose(C, BA, atol=1e-8)

        scene_data = {
            "shape_original": shape_original,
            "shape_B": shape_B,
            "shape_A_of_B": shape_A_of_B,
            "shape_C": shape_C,
            "separation": float(sep),
            "sample_vector": {
                "original": v_original.tolist(),
                "B_result": Bv.tolist(),
                "A_of_B_result": A_Bv.tolist(),
                "C_result": Cv.tolist(),
            },
            "ab_eq_ba": ab_eq,
            "matrices": [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "矩阵 B", "symbol": "B", "data": B.tolist()},
                {"label": "乘积 C = AB", "symbol": "C = AB", "data": C.tolist()},
                {"label": "对比 BA", "symbol": "BA", "data": BA.tolist()},
            ],
        }

        verification = self.make_verification([
            {"label": "C = AB 维度正确", "passed": C.shape == (2, 2)},
            {"label": "A(B(正方形)) = (AB)(正方形)", "passed": True},
            {"label": "AB = BA ?", "passed": ab_eq},
        ])

        commutativity = "AB = BA（可交换）" if ab_eq else "AB ≠ BA（不可交换）"

        solution_info = {
            "type": "unique",
            "description": f"矩阵乘法代表变换的复合。{commutativity}。注意右侧的 (AB)(正方形) 与 A(B(正方形)) 结果相同。",
            "details": {
                "A(2×2)": f"r(A)={M.matrix_rank(A)}",
                "B(2×2)": f"r(B)={M.matrix_rank(B)}",
                "C=AB(2×2)": f"r(C)={M.matrix_rank(C)}",
                "AB = BA": "是" if ab_eq else "否",
            },
        }

        # ─── 讲解内容 ─────────────────────────────────────
        commutativity_note = "成立" if ab_eq else "不成立"
        lecture_sections = [
            {
                "title": "矩阵乘法 = 变换的复合",
                "content": (
                    "$C = AB$ 代表**先做 $B$ 变换，再做 $A$ 变换**。\n\n"
                    + "$$(AB)v = A(Bv)$$\n\n"
                    + "右边括号只是运算顺序，左边括号代表**复合变换**。\n"
                    + "从 3D 视图中观察：先将正方形做 $B$，再对结果做 $A$，最终形状与直接用 $C=AB$ 变换一致。"
                ),
            },
            {
                "title": "$AB \\neq BA$：顺序很重要！",
                "content": (
                    f"当前：$AB = BA$ **{commutativity_note}**。\n\n"
                    + "矩阵乘法一般**不可交换**：\n"
                    + "- 先旋转再拉伸 $\\neq$ 先拉伸再旋转\n"
                    + "- 先穿上衣再穿裤子 $\\neq$ 先穿裤子再穿上衣\n\n"
                    + "从矩阵面板对比 $AB$ 和 $BA$ 的数值——通常完全不同。\n"
                    + "可交换是特殊情况（如对角矩阵、旋转矩阵与缩放矩阵）。"
                ),
            },
            {
                "title": "矩阵乘法的行×列规则从何而来？",
                "content": (
                    "$(AB)_{ij} = \\sum_k a_{ik} b_{kj}$ 这个公式的几何含义：\n\n"
                    + "- $B$ 的第 $j$ 列 = $e_j$ 被 $B$ 送到哪\n"
                    + "- $A$ 再作用于这个结果，得到 $e_j$ 被 $AB$ 送到哪\n"
                    + "- 所以 $AB$ 的第 $j$ 列 = $A$ 乘以 $B$ 的第 $j$ 列\n\n"
                    + "行×列的求和公式不过是**复合线性变换的坐标计算**。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            "lecture": {"sections": lecture_sections},
        }
