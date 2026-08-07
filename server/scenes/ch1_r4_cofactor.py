"""
场景 1.4：按行列展开的几何 — 余子式与三重积

展示 3×3 行列式的三重积视角：
det([a, b, c]) = a · (b × c)

b × c 的三个分量恰好是 a 列的代数余子式 C₁₁, C₂₁, C₃₁。
展开公式就是向量点积 a·n。
错行展开得 0 = b·(b×c) = 0（b 垂直于叉积 n）。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams, matrix_params
from server.math_engine import MathEngine as M


class Ch1R4Cofactor(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch1_r4_cofactor",
            "title": "1.4 按行列展开的几何",
            "chapter": "第1章",
            "description": "三重积视角看行列式展开：b×c=余子式向量，a在法向量上的投影×底面积=体积。错行展开得0=垂直。",
            "params": {
                **matrix_params("a", 3, 3, defaults=[
                    [2, 0, 0],
                    [0, 2, 0],
                    [0, 0, 3],
                ], min=-5, max=5, step=0.1),
            },
            "presets": [
                {
                    "label": "标准情形 det≠0",
                    "type": "unique",
                    "params": {
                        "a11": 2, "a12": 0, "a13": 0,
                        "a21": 0, "a22": 2, "a23": 0,
                        "a31": 0, "a32": 0, "a33": 3,
                    },
                },
                {
                    "label": "a 在底面内 det=0",
                    "type": "degenerate",
                    "params": {
                        "a11": 0, "a12": 0, "a13": 0,
                        "a21": 2, "a22": 2, "a23": 0,
                        "a31": 3, "a32": 0, "a33": 3,
                    },
                },
                {
                    "label": "b∥c 底面退化",
                    "type": "degenerate",
                    "params": {
                        "a11": 2, "a12": 0, "a13": 0,
                        "a21": 0, "a22": 2, "a23": 4,
                        "a31": 0, "a32": 0, "a33": 0,
                    },
                },
                {
                    "label": "a∥法向量 体积最大",
                    "type": "unique",
                    "params": {
                        "a11": 3, "a12": 0, "a13": 0,
                        "a21": 0, "a22": 2, "a23": 0,
                        "a31": 0, "a32": 0, "a33": 1,
                    },
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        # ── 第 1 步：提取参数 ──
        a11 = float(params.get("a11", 2)); a12 = float(params.get("a12", 0)); a13 = float(params.get("a13", 0))
        a21 = float(params.get("a21", 0)); a22 = float(params.get("a22", 2)); a23 = float(params.get("a23", 0))
        a31 = float(params.get("a31", 0)); a32 = float(params.get("a32", 0)); a33 = float(params.get("a33", 3))

        A = np.array([
            [a11, a12, a13],
            [a21, a22, a23],
            [a31, a32, a33],
        ], dtype=float)

        # ── 第 2 步：数学计算 ──

        # 列向量（矩阵的列 = 平行六面体的三条棱）
        col_a = A[:, 0]  # a 列
        col_b = A[:, 1]  # b 列
        col_c = A[:, 2]  # c 列

        det_A = float(M.matrix_determinant(A))

        # 法向量 = b × c（三个分量 = col a 的代数余子式 C₁₁, C₂₁, C₃₁）
        n_bc = np.cross(col_b, col_c)

        # 手动计算代数余子式（用于展示对应关系）
        cofactors_a = [
            float(a22 * a33 - a23 * a32),   # C₁₁ = minor(a₁₁) × (+1)
            float(-(a12 * a33 - a13 * a32)), # C₂₁ = minor(a₂₁) × (-1)  → 即 n_bc[1]
            float(a12 * a23 - a13 * a22),    # C₃₁ = minor(a₃₁) × (+1)  → 即 n_bc[2]
        ]

        n_norm = float(np.linalg.norm(n_bc))
        base_area = n_norm  # 底面积 = |b × c|

        if n_norm > 1e-10:
            n_unit = n_bc / n_norm
            height = float(np.dot(col_a, n_unit))  # a 在法向量上的投影（有符号）
            a_proj_n = float(np.dot(col_a, n_unit)) * n_unit  # a 在法向量方向的分量
            a_in_base = col_a - a_proj_n  # a 在底面上的分量
        else:
            n_unit = np.zeros(3)
            height = 0.0
            a_proj_n = np.zeros(3)
            a_in_base = col_a.copy()

        # 验证
        det_via_dot = float(np.dot(col_a, n_bc))  # a · (b×c)
        wrong_exp_b = float(np.dot(col_b, n_bc))  # b · (b×c) 应 = 0
        wrong_exp_c = float(np.dot(col_c, n_bc))  # c · (b×c) 应 = 0

        det_from_formula = (
            a11 * cofactors_a[0] + a21 * cofactors_a[1] + a31 * cofactors_a[2]
        )

        # 平行六面体顶点
        def _v(arr):
            return [float(arr[0]), float(arr[1]), float(arr[2])]

        O = np.zeros(3)
        vertices = [
            _v(O), _v(col_a), _v(col_b), _v(col_a + col_b),
            _v(col_c), _v(col_a + col_c), _v(col_b + col_c), _v(col_a + col_b + col_c),
        ]
        edges = [
            (0, 1), (0, 2), (0, 4), (1, 3), (1, 5),
            (2, 3), (2, 6), (3, 7), (4, 5), (4, 6), (5, 7), (6, 7),
        ]

        # ── 第 3 步：构建 scene_data ──
        scene_data = {
            "matrices": [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
            ],
            "columns": {
                "a": {"components": _v(col_a), "label": "a (第1列)", "color": 0xff6b6b},
                "b": {"components": _v(col_b), "label": "b (第2列)", "color": 0x4ecdc4},
                "c": {"components": _v(col_c), "label": "c (第3列)", "color": 0xffd93d},
            },
            "normal": {
                "components": _v(n_bc),
                "unit": _v(n_unit) if n_norm > 1e-10 else [0, 0, 0],
                "norm": n_norm,
                "label": "n = b×c（余子式向量）",
            },
            "cofactors": cofactors_a,
            "base_area": base_area,
            "height": height,
            "a_proj_n": _v(a_proj_n),
            "a_in_base": _v(a_in_base),
            "det_A": det_A,
            "det_via_dot": det_via_dot,
            "wrong_exp_b": wrong_exp_b,
            "wrong_exp_c": wrong_exp_c,
            "det_from_formula": det_from_formula,
            "shape": {
                "vertices": vertices,
                "edges": edges,
            },
        }

        # ── 第 4 步：构建 verification ──
        checks = [
            {
                "label": f"a·(b×c) = {det_via_dot:.4f} = det(A)",
                "passed": abs(det_via_dot - det_A) < 1e-8,
            },
            {
                "label": f"展开公式 = {det_from_formula:.4f} = det(A)",
                "passed": abs(det_from_formula - det_A) < 1e-8,
            },
            {
                "label": f"b·n = {wrong_exp_b:.6f} ≈ 0（错行展开=0）",
                "passed": abs(wrong_exp_b) < 1e-8,
            },
            {
                "label": f"c·n = {wrong_exp_c:.6f} ≈ 0",
                "passed": abs(wrong_exp_c) < 1e-8,
            },
        ]
        verification = self.make_verification(checks)

        # ── 第 5 步：构建 solution_info ──
        cofactor_strs = [
            f"C₁₁ = a₂₂a₃₃−a₂₃a₃₂ = {a22:.1f}×{a33:.1f}−{a23:.1f}×{a32:.1f} = {cofactors_a[0]:.2f}",
            f"C₂₁ = −(a₁₂a₃₃−a₁₃a₃₂) = −({a12:.1f}×{a33:.1f}−{a13:.1f}×{a32:.1f}) = {cofactors_a[1]:.2f}",
            f"C₃₁ = a₁₂a₂₃−a₁₃a₂₂ = {a12:.1f}×{a23:.1f}−{a13:.1f}×{a22:.1f} = {cofactors_a[2]:.2f}",
        ]

        if abs(det_A) < 1e-8:
            sol_type = "degenerate"
            desc = (
                f"det(A) = {det_A:.4f} = 0。"
                + ("a 在 b、c 张成的底面内，高度为 0。" if n_norm > 1e-10 else "b 和 c 平行，底面退化。")
            )
        else:
            sol_type = "unique"
            desc = (
                f"det(A) = a·(b×c) = {det_A:.4f} ≠ 0。"
                + f"底面积 = {base_area:.2f}，高度 = {height:.2f}，体积 = {det_A:.2f}。"
            )

        solution_info = {
            "type": sol_type,
            "description": desc,
            "details": {
                "det(A)": f"{det_A:.4f}",
                "底面积 |b×c|": f"{base_area:.2f}",
                "高度 a·n̂": f"{height:.2f}",
                "余子式 C₁₁,C₂₁,C₃₁": cofactor_strs,
                "n = b×c": f"[{n_bc[0]:.2f}, {n_bc[1]:.2f}, {n_bc[2]:.2f}]",
            },
        }

        # ── 第 6 步：构建 lecture ──
        lecture = {
            "sections": [
                {
                    "title": "行列式展开 = 三重积 = 点积",
                    "content": (
                        "把 3×3 行列式看成**三个列向量的三重积**：\n\n"
                        + "$$\\det([\\mathbf{a}, \\mathbf{b}, \\mathbf{c}]) = \\mathbf{a} \\cdot (\\mathbf{b} \\times \\mathbf{c})$$\n\n"
                        + "- $\\mathbf{b} \\times \\mathbf{c}$ = 法向量 $\\mathbf{n}$，垂直于 $\\mathbf{b}$ 和 $\\mathbf{c}$\n"
                        + "- $|\\mathbf{n}|$ = $\\mathbf{b}$ 和 $\\mathbf{c}$ 张成的平行四边形面积（底面积）\n"
                        + "- $\\mathbf{a} \\cdot \\mathbf{n}$ = $\\mathbf{a}$ 在法向量上的投影 × 底面积 = **高 × 底 = 体积**\n\n"
                        + f"当前：$\\det(A) = {det_A:.4f}$，底面积 $= {base_area:.2f}$，高度 $= {height:.2f}$。"
                    ),
                },
                {
                    "title": "余子式 = 法向量的分量",
                    "content": (
                        "$\\mathbf{b} \\times \\mathbf{c}$ 的三个分量：\n\n"
                        + f"第 1 分量：$C_{{11}} = a_{{22}}a_{{33}} - a_{{23}}a_{{32}} = {cofactors_a[0]:.2f}$\n"
                        + f"第 2 分量：$C_{{21}} = -(a_{{12}}a_{{33}} - a_{{13}}a_{{32}}) = {cofactors_a[1]:.2f}$\n"
                        + f"第 3 分量：$C_{{31}} = a_{{12}}a_{{23}} - a_{{13}}a_{{22}} = {cofactors_a[2]:.2f}$\n\n"
                        + "**展开公式**就是 $a_{11}C_{11} + a_{21}C_{21} + a_{31}C_{31}$\n"
                        + f"$= {a11:.1f} \\times {cofactors_a[0]:.2f} + {a21:.1f} \\times {cofactors_a[1]:.2f} + {a31:.1f} \\times {cofactors_a[2]:.2f}$\n"
                        + f"$= {det_from_formula:.4f} = \\det(A)$ ✓\n\n"
                        + "**余子式不是孤立的代数对象——它们拼成了一个有几何意义的向量！**"
                    ),
                },
                {
                    "title": "为什么错行展开得 0？",
                    "content": (
                        "用**第 2 列的元素**去乘**第 1 列的代数余子式**：\n\n"
                        + "$a_{12}C_{11} + a_{22}C_{21} + a_{32}C_{31}$\n"
                        + "$= \\mathbf{b} \\cdot (\\mathbf{b} \\times \\mathbf{c})$\n\n"
                        + "**$\\mathbf{b} \\times \\mathbf{c}$ 垂直于 $\\mathbf{b}$，所以点积 = 0！**\n\n"
                        + f"验证：$\\mathbf{{b}} \\cdot \\mathbf{{n}} = ({a12:.1f}, {a22:.1f}, {a32:.1f}) \\cdot ({n_bc[0]:.2f}, {n_bc[1]:.2f}, {n_bc[2]:.2f}) = {wrong_exp_b:.6f} \\approx 0$ ✓\n\n"
                        + "代数上等价于「两行相同的行列式 = 0」。\n"
                        + "几何上就是：**法向量垂直于底面内的所有向量，所以错行点积必为 0。**"
                    ),
                },
            ]
        }

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            "lecture": lecture,
        }
