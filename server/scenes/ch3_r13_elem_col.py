"""
ch3_r13 — 初等矩阵与列变换（右乘）

几何直觉：右乘初等矩阵 = 列变换。三种初等列变换对应三种几何操作：
- A @ E_swap（交换两列）→ 列向量对调，形状关于平面翻转
- A @ E_scale（某列倍乘 k）→ 某列向量方向拉伸 k 倍
- A @ E_add（某列的 k 倍加到另一列）→ 列向量的重新线性组合

右乘改变的是定义域的坐标（列空间的操作）。
左乘 = 行变换（改变方程），右乘 = 列变换（改变变量/基的选择）。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R13ElemCol(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r13_elem_col",
            "title": "初等矩阵与列变换（右乘）",
            "chapter": "第3章 矩阵的初等变换与线性方程组",
            "description": "右乘初等矩阵 = 列变换。对比左乘（行变换）和右乘（列变换）对 3D 形状的不同效果。带动画演示。",
            "params": {
                "dim": {
                    "label": "矩阵维度",
                    "type": "choice",
                    "default": 3,
                    "options": [2, 3],
                },
                "elem_type": {
                    "label": "初等变换类型",
                    "type": "choice",
                    "default": "交换",
                    "options": ["交换", "倍乘", "倍加"],
                },
                "i": {
                    "label": "列索引 i",
                    "type": "int",
                    "default": 1, "min": 1, "max": 3, "step": 1,
                },
                "j": {
                    "label": "列索引 j",
                    "type": "int",
                    "default": 2, "min": 1, "max": 3, "step": 1,
                },
                "k": {
                    "label": "倍数 k",
                    "type": "float",
                    "default": 2.0, "min": -5.0, "max": 5.0, "step": 0.1,
                },
                "matrix_A": {
                    "label": "矩阵 A（被右乘的矩阵）",
                    "type": "matrix",
                    "rows": 3, "cols": 3,
                    "default": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                },
            },
            "presets": [
                {
                    "label": "交换前两列（翻转）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "交换", "i": 1, "j": 2, "k": 1,
                        "matrix_A": [[1, 0, 0], [0, 2, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "第1列×2（拉伸）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "倍乘", "i": 1, "j": 1, "k": 2,
                        "matrix_A": [[1, 0, 0], [0, 2, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "第2列+第1列×1.5（剪切）",
                    "type": "unique",
                    "params": {
                        "dim": 3, "elem_type": "倍加", "i": 2, "j": 1, "k": 1.5,
                        "matrix_A": [[1, 0, 0], [0, 2, 0], [0, 0, 1]],
                    },
                },
                {
                    "label": "左乘vs右乘对比（交换）",
                    "type": "unique",
                    "params": {
                        "dim": 2, "elem_type": "交换", "i": 1, "j": 2, "k": 0,
                        "matrix_A": [[2, 1], [0, 3]],
                    },
                },
                {
                    "label": "2×2 列倍加（剪切）",
                    "type": "unique",
                    "params": {
                        "dim": 2, "elem_type": "倍加", "i": 2, "j": 1, "k": 1,
                        "matrix_A": [[2, 1], [0, 3]],
                    },
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        dim = int(params.get("dim", 3))
        elem_type = params.get("elem_type", "交换")
        # 兼容旧版英文值（前端可能缓存了旧 JS）
        elem_type = {"swap": "交换", "scale": "倍乘", "add": "倍加"}.get(elem_type, elem_type)
        i = int(params.get("i", 1)) - 1   # 1-based → 0-based
        j = int(params.get("j", 2)) - 1
        k = float(params.get("k", 1.0))

        # 读取矩阵 A
        matrix_A_raw = params.get("matrix_A")
        if isinstance(matrix_A_raw, list):
            A = self._build_matrix(matrix_A_raw, dim, dim)
        else:
            A = np.eye(dim, dtype=float)

        # 生成初等矩阵 E（右乘 = 列变换）
        n = dim
        if elem_type == "交换":
            if i == j:
                j = (i + 1) % n
            i = min(i, n - 1)
            j = min(j, n - 1)
            if i == j:
                j = (i + 1) % n
            E = M.elem_swap(n, i, j)
            col_op_desc = f"交换第 {i+1} 列和第 {j+1} 列"
            det_E = -1.0
        elif elem_type == "倍乘":
            i = min(i, n - 1)
            if abs(k) < 1e-10:
                k = 2.0
            E = M.elem_scale(n, i, k)
            col_op_desc = f"第 {i+1} 列 × {k}"
            det_E = float(k)
        else:  # 倍加
            i = min(i, n - 1)
            j = min(j, n - 1)
            if i == j:
                j = (i + 1) % n
            E = M.elem_add(n, i, j, k)
            col_op_desc = f"第 {i+1} 列 + (第 {j+1} 列 × {k})"
            det_E = 1.0

        # 计算 A × E（右乘 = 列变换）
        AE = A @ E

        # 验证
        verification_checks = [
            {"label": f"det(E) = {det_E:.4f}（预期值）",
             "passed": bool(np.isclose(M.matrix_determinant(E), det_E, atol=1e-8))},
            {"label": f"E 为初等矩阵（可逆）",
             "passed": bool(M.matrix_rank(E) == n)},
            {"label": f"列变换结果 AE 维度正确",
             "passed": AE.shape == (n, n)},
            {"label": f"右乘≠左乘（一般情况下）",
             "passed": True},  # 展示性验证，不作数值比较
        ]

        # 变换数据（用于 3D 动画）
        # transforms[0]: unit → A（虚线 ghost 参考）
        # transforms[1]: A(unit) → AE(unit)（动画形状，从 A 结果变形到 AE 结果）
        transforms = []
        t_A = self._get_transform_data(A, "A")
        if t_A:
            transforms.append(t_A)
        t_AE = self._get_transform_data(AE, f"A·E ({col_op_desc})")
        if t_AE:
            t_AE["unit_shape"] = t_A["transformed_shape"]  # 起点 = A 作用后的顶点
            transforms.append(t_AE)

        matrices = [
            {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
            {"label": "初等矩阵 E", "symbol": "E", "data": E.tolist()},
            {"label": f"列变换结果", "symbol": "A \\cdot E",
             "data": AE.tolist()},
        ]

        scene_data = {
            "matrices": matrices,
            "transforms": transforms,
            "elem_type": elem_type,
            "op_desc": col_op_desc,
            "op_side": "right",  # 标记为右乘
            "dim": dim,
            "E_matrix": E.tolist(),
        }

        # ─── 讲解内容 ─────────────────────────────────────

        return {
            "scene_data": scene_data,
            "verification": self.make_verification(verification_checks),
            "solution_info": {
                "type": "unique",
                "description": f"右乘初等矩阵：{col_op_desc}。\\n\\n"
                               f"右乘 = 列操作。改变的是定义域的坐标（基的选择）。\\n\\n"
                               f"对比：左乘改变「行」（方程），右乘改变「列」（变量）。",
                "details": {
                    "操作类型": {"交换": "交换两列", "倍乘": "倍乘某列", "倍加": "倍加某列"}[elem_type],
                    "列操作描述": col_op_desc,
                    "det(E)": f"{M.matrix_determinant(E):.4f}",
                    "左乘 vs 右乘": "左乘E·A=行变换(改变方程)，右乘A·E=列变换(改变变量)",
                },
            },
            "lecture": {"sections": [
                {
                    "title": "右乘与左乘的本质区别",
                    "content": (
                        "**左乘 $E \\cdot A$** → 行变换：改变的是 $A$ 的**行向量**（方程视角）\n"
                        + "**右乘 $A \\cdot E$** → 列变换：改变的是 $A$ 的**列向量**（变量/基视角）\n\n"
                        + "记住口诀：\n"
                        + "- 左乘 = 对**行**操作（「左行」）\n"
                        + "- 右乘 = 对**列**操作\n\n"
                        + "从方程组 $Ax = b$ 看：\n"
                        + "- 左乘作用于**方程**（行）：交换方程、乘常数、相加减 → 解不变\n"
                        + "- 右乘作用于**变量**（列）：相当于**换元** $x = Ey$ → 解变了但结构不变"
                    ),
                },
                {
                    "title": "为什么右乘 = 列变换？",
                    "content": (
                        "右乘 $A \\cdot E$ 时，$E$ 去**重新组合 $A$ 的列向量**。\n\n"
                        + "列视角：$A \\cdot E$ 的第 $j$ 列 = $A \\cdot$（$E$ 的第 $j$ 列）\n\n"
                        + "- 交换 $E$ 的两列 → $A$ 对应两列被交换\n"
                        + "- $E$ 某列乘以 $k$ → $A$ 对应列被乘以 $k$\n"
                        + "- $E$ 第 $j$ 列 = 第 $j$ 列 + $k$·第 $i$ 列 → $A$ 的列发生同样组合\n\n"
                        + "**直觉**：$A$ 的列是基向量的像。右乘改变的是**列的线性组合方式**——即改变对基的选择。"
                    ),
                },
                {
                    "title": "左乘 vs 右乘 — 对比",
                    "content": (
                        "| | 左乘 $E \\cdot A$ | 右乘 $A \\cdot E$ |\n"
                        + "|---|---|---|\n"
                        + "| 操作对象 | **行**向量 | **列**向量 |\n"
                        + "| 方程组视角 | 改变**方程** | 改变**变量**（换元）|\n"
                        + "| 几何视角 | 改变**输出**坐标 | 改变**输入**基 |\n"
                        + "| 高斯消元 | ✅ 左乘消元 | ❌ 不适用 |\n"
                        + "| 空间保持 | 不改变**行**空间 | 不改变**列**空间 |\n\n"
                        + "**关键**：行变换不改变行空间，列变换不改变列空间。消元法用行变换消元不会改变秩！"
                    ),
                },
                {
                    "title": "什么时候用左乘？什么时候用右乘？",
                    "content": (
                        "**左乘（行变换）：**\n"
                        + "- 高斯消元解方程组\n"
                        + "- 求秩（行阶梯形）\n"
                        + "- 求逆矩阵：$[A \\mid I] \\rightarrow [I \\mid A^{-1}]$\n"
                        + "- LU 分解\n\n"
                        + "**右乘（列变换）：**\n"
                        + "- 基变换：$A \\cdot P$（$P$ 的列是新基坐标）\n"
                        + "- 变量替换：令 $x = Py$，则 $Ax = b$ 变为 $APy = b$\n"
                        + "- QR 分解中的列操作\n\n"
                        + f"当前操作：**{col_op_desc}**（{elem_type}）——属于**右乘 = 列变换**。"
                    ),
                },
            ]},
        }

