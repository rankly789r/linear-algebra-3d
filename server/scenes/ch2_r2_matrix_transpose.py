"""
场景 2.2：转置矩阵的几何含义

转置 Aᵀ 有深层几何意义：⟨Av, w⟩ = ⟨v, Aᵀw⟩。
对称矩阵 A = Aᵀ 保持内积结构。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch2R2MatrixTranspose(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch2_r2_matrix_transpose",
            "title": "2.2 转置与对称矩阵",
            "chapter": "第2章 矩阵及其运算",
            "description": "转置 Aᵀ 的几何本质：⟨Av, w⟩ = ⟨v, Aᵀw⟩。对称矩阵（A=Aᵀ）、正交矩阵（Aᵀ=A⁻¹）的几何特征。",
            "params": {
                "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": -1, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {
                    "label": "对称矩阵 A=Aᵀ",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 1, "a21": 1, "a22": 3},
                },
                {
                    "label": "正交矩阵 Aᵀ=A⁻¹",
                    "type": "unique",
                    "params": {"a11": 0, "a12": -1, "a21": 1, "a22": 0},
                },
                {
                    "label": "非对称一般矩阵",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 3, "a21": -1, "a22": 1},
                },
                {
                    "label": "反对称 Aᵀ=-A",
                    "type": "degenerate",
                    "params": {"a11": 0, "a12": 2, "a21": -2, "a22": 0},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        A = np.array([
            [float(params.get("a11", 2)), float(params.get("a12", 1))],
            [float(params.get("a21", -1)), float(params.get("a22", 3))],
        ], dtype=float)

        AT = M.matrix_transpose(A)
        det_A = M.matrix_determinant(A)
        det_AT = M.matrix_determinant(AT)
        rank = M.matrix_rank(A)

        is_symmetric = np.allclose(A, AT, atol=1e-8)
        is_orthogonal = False
        if abs(det_A) > 1e-10:
            A_inv = M.matrix_inverse(A)
            if A_inv is not None:
                is_orthogonal = np.allclose(AT, A_inv, atol=1e-8)
        is_skew = np.allclose(A, -AT, atol=1e-8)

        # 样本向量对
        v = np.array([1, 0.5])
        w = np.array([-0.5, 1])
        Av = A @ v
        ATw = AT @ w
        inner1 = float(np.dot(Av, w))
        inner2 = float(np.dot(v, ATw))
        inner_match = abs(inner1 - inner2) < 1e-8

        # 类型判定
        if is_orthogonal:
            matrix_type = "正交矩阵（Aᵀ = A⁻¹）"
        elif is_symmetric:
            matrix_type = "对称矩阵（Aᵀ = A）"
        elif is_skew:
            matrix_type = "反对称矩阵（Aᵀ = -A）"
        else:
            matrix_type = "一般矩阵（非对称）"

        scene_data = {
            "vectors": {
                "v": [float(v[0]), float(v[1]), 0],
                "w": [float(w[0]), float(w[1]), 0],
                "Av": [float(Av[0]), float(Av[1]), 0],
                "ATw": [float(ATw[0]), float(ATw[1]), 0],
            },
            "inner_product": {
                "Av_dot_w": float(inner1),
                "v_dot_ATw": float(inner2),
                "match": inner_match,
            },
            "matrix_type": matrix_type,
            "is_symmetric": is_symmetric,
            "is_orthogonal": is_orthogonal,
            "det_A": float(det_A),
            "det_AT": float(det_AT),
            "rank": rank,
            "matrices": [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "转置矩阵 Aᵀ", "symbol": "A^T", "data": AT.tolist()},
            ],
        }

        verification = self.make_verification([
            {"label": f"det(A) = {det_A:.4f}", "passed": True},
            {"label": f"det(Aᵀ) = det(A) = {det_A:.4f}", "passed": abs(det_A - det_AT) < 1e-8},
            {"label": f"⟨Av,w⟩ = ⟨v,Aᵀw⟩", "passed": inner_match},
            {"label": f"类型: {matrix_type}", "passed": True},
        ])

        solution_info = {
            "type": "unique",
            "description": f"矩阵类型：{matrix_type}。⟨Av, w⟩ = {inner1:.4f}，⟨v, Aᵀw⟩ = {inner2:.4f}，两者相等（容差1e-8）。",
            "details": {
                "det(A)": f"{det_A:.4f}",
                "det(Aᵀ)": f"{det_AT:.4f}",
                "r(A)": str(rank),
                "⟨Av, w⟩": f"{inner1:.4f}",
                "⟨v, Aᵀw⟩": f"{inner2:.4f}",
            },
        }

        # ─── 讲解内容 ─────────────────────────────────────
        inner1_str = f"{inner1:.4f}"
        inner2_str = f"{inner2:.4f}"
        lecture_sections = [
            {
                "title": "转置的本质：内积的「搬运工」",
                "content": (
                    "转置 $A^{\\mathsf{T}}$ 的核心性质（同济教材 §2.4）：\n\n"
                    + "$$\\langle Av, w \\rangle = \\langle v, A^{\\mathsf{T}} w \\rangle$$\n\n"
                    + f"验证：$\\langle Av, w \\rangle = {inner1_str}$，$\\langle v, A^{{\\mathsf{{T}}}} w \\rangle = {inner2_str}$ —— "
                    + ("✅ 相等！" if inner_match else "⚠️ 不相等。")
                    + "\n\n"
                    + "这意味着 $A^{\\mathsf{T}}$ 是 $A$ 关于内积的**伴随算子**——"
                    + "它把作用于 $w$ 的效果「搬」到了 $v$ 那边。"
                ),
            },
            {
                "title": f"当前矩阵类型：{matrix_type}",
                "content": (
                    "- **对称矩阵** $A = A^{\\mathsf{T}}$：行列之间对称，特征向量正交\n"
                    + "- **正交矩阵** $A^{\\mathsf{T}} = A^{-1}$：变换保长度、保角度（旋转/反射）\n"
                    + "- **反对称矩阵** $A^{\\mathsf{T}} = -A$：对角线为零，代表「叉积」运算\n\n"
                    + f"当前矩阵的 $\\det(A) = {det_A:.4f}$，$r(A) = {rank}$。"
                ),
            },
            {
                "title": "几何视角：转置 vs 逆",
                "content": (
                    "如果 $A$ 是正交矩阵（$A^{\\mathsf{T}} = A^{-1}$），则：\n\n"
                    + "- $A$ 是旋转（行列式为 $+1$）或反射（行列式为 $-1$）\n"
                    + "- 转置 = 逆变换：旋转的逆就是反方向旋转\n"
                    + "- 正交矩阵的列（行）构成标准正交基\n\n"
                    + "对于一般矩阵，转置 $\\neq$ 逆矩阵。转置更多体现的是**对偶性**——行和列的对称关系。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            "lecture": {"sections": lecture_sections},
        }
