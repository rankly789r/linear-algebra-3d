"""
场景 3.6B：齐次方程组的零空间

3×3 齐次方程组 Ax=0。矩阵 A 的每一行定义一张过原点的平面，
所有平面的交集 = 零空间（nullspace）。

核心公式：dim(nullspace) = n - r(A) = 3 - r(A)

几何展示：
- r=3: 三平面仅交于原点 → 零空间 = {0}（只有零解）
- r=2: 三平面交于一条过原点的直线 → 零空间 = 1维（无穷多解）
- r=1: 三平面重合 → 零空间 = 2维（整个平面都是解）
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams, matrix_params
from server.math_engine import MathEngine as M


class Ch3R6BNullspace(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r6b_nullspace",
            "title": "3.6B 零空间（齐次方程组的解）",
            "chapter": "第3章",
            "description": "齐次方程组 Ax=0：三张过原点的平面，交集=零空间。秩越低，零空间越大。dim(nullspace) = 3 - r(A)。",
            "params": {
                **matrix_params("a", 3, 3, defaults=[
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1],
                ], min=-3, max=3, step=0.1),
            },
            "presets": [
                {"label": "r=3 只有零解", "type": "unique", "params": {
                    "a11": 1, "a12": 0, "a13": 0,
                    "a21": 0, "a22": 1, "a23": 0,
                    "a31": 0, "a32": 0, "a33": 1,
                }},
                {"label": "r=2 解是一条直线", "type": "infinite", "params": {
                    "a11": 1, "a12": 0, "a13": 0,
                    "a21": 0, "a22": 1, "a23": 0,
                    "a31": 2, "a32": 3, "a33": 0,
                }},
                {"label": "r=1 解是一个平面", "type": "infinite", "params": {
                    "a11": 1, "a12": 0, "a13": 0,
                    "a21": 2, "a22": 0, "a23": 0,
                    "a31": -1, "a32": 0, "a33": 0,
                }},
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        # ── 第 1 步：提取参数 ──
        a11 = float(params.get("a11", 1)); a12 = float(params.get("a12", 0)); a13 = float(params.get("a13", 0))
        a21 = float(params.get("a21", 0)); a22 = float(params.get("a22", 1)); a23 = float(params.get("a23", 0))
        a31 = float(params.get("a31", 0)); a32 = float(params.get("a32", 0)); a33 = float(params.get("a33", 1))

        # ── 第 2 步：数学计算 ──
        A = np.array([
            [a11, a12, a13],
            [a21, a22, a23],
            [a31, a32, a33],
        ], dtype=float)

        rank_A = int(M.matrix_rank(A))
        nullity = 3 - rank_A

        # 零空间基
        null_basis = M.null_space(A)
        null_dim = 0 if null_basis is None else null_basis.shape[1]

        # 每行作为一个平面的法向量（齐次: d=0，都过原点）
        row_colors = [0xff6b6b, 0x4ecdc4, 0xffd93d]  # 红、青、黄
        planes = []
        for i in range(3):
            normal = A[i, :]
            n_norm = float(np.linalg.norm(normal))
            if n_norm > 1e-10:
                n_unit = normal / n_norm
                planes.append({
                    "normal": n_unit.tolist(),
                    "valid": True,
                    "label": f"π{i + 1}",
                    "equation": (
                        f"{_fmt_coeff(A[i, 0])}x "
                        f"{_fmt_sign(A[i, 1])} {_fmt_abs(A[i, 1])}y "
                        f"{_fmt_sign(A[i, 2])} {_fmt_abs(A[i, 2])}z = 0"
                    ),
                })
            else:
                planes.append({
                    "normal": [0, 0, 0],
                    "valid": False,
                    "label": f"π{i + 1}（无效：全零行）",
                    "equation": "0 = 0",
                })

        # ── 零空间几何 ──
        nullspace_geom = _describe_nullspace(null_basis, nullity, rank_A, A)

        # ── 第 3 步：构建 scene_data ──
        scene_data = {
            "matrices": [
                {"label": "系数矩阵 A", "symbol": "A", "data": A.tolist()},
            ],
            "rank_A": rank_A,
            "nullity": nullity,
            "null_dim": null_dim,
            "planes": planes,
            "nullspace": nullspace_geom,
        }

        # ── 第 4 步：构建 verification ──
        checks = [
            {"label": f"r(A) = {rank_A}", "passed": True},
            {"label": f"nullity = 3 − r(A) = {nullity}", "passed": null_dim == nullity},
            {"label": f"dim(nullspace) = {null_dim}", "passed": True},
        ]
        if nullity > 0:
            checks.append({
                "label": f"零空间维数 = {nullity} > 0 → 存在非零解（无穷多解）",
                "passed": True,
            })
        else:
            checks.append({
                "label": "零空间 = {0} → 只有零解（唯一解）",
                "passed": True,
            })
        verification = self.make_verification(checks)

        # ── 第 5 步：构建 solution_info ──
        if nullity == 0:
            sol_type = "unique"
            desc = f"r(A)={rank_A}=n=3 → 零空间 = {{0}}，齐次方程组只有零解。"
            details = {"零空间维数": "0", "解": "x = (0, 0, 0)"}
        elif nullity == 1:
            sol_type = "infinite"
            desc = f"r(A)={rank_A}<n=3 → 零空间是 1 维直线，齐次方程组有无穷多解。"
            details = {"零空间维数": "1", "解": "一条过原点的直线"}
        elif nullity == 2:
            sol_type = "infinite"
            desc = f"r(A)={rank_A}<n=3 → 零空间是 2 维平面，齐次方程组有无穷多解。"
            details = {"零空间维数": "2", "解": "一张过原点的平面"}
        else:
            sol_type = "infinite"
            desc = f"r(A)={rank_A}=0 → A 是零矩阵，零空间 = R³。任意 x 都是解。"
            details = {"零空间维数": "3", "解": "整个 R³"}

        solution_info = {"type": sol_type, "description": desc, "details": details}

        # ── 第 6 步：构建 lecture ──
        lecture = {
            "sections": [
                {
                    "title": "齐次方程组 Ax=0 永远有解",
                    "content": (
                        "**关键事实：x=0 总是满足 Ax=0，所以齐次方程组至少有一个解（零解）。**\n\n"
                        + "问题是：**有没有非零解？**\n\n"
                        + f"当前：$A$ 是 $3 \\times 3$ 矩阵，$r(A) = {rank_A}$。\n"
                        + f"零空间维数 $= 3 - r(A) = {nullity}$。\n\n"
                        + ("$r(A) = 3 = n$ → 零空间 $= \\{{0\\}}$ → **只有零解** ✅\n"
                           if nullity == 0 else
                           f"$r(A) = {rank_A} < n = 3$ → 零空间维数 $= {nullity}$ → **有无穷多非零解** ✨")
                    ),
                },
                {
                    "title": "几何：每行 = 一张过原点的平面",
                    "content": (
                        "矩阵 $A$ 的**每一行**定义了一个线性方程 $a_{{i1}}x + a_{{i2}}y + a_{{i3}}z = 0$。\n\n"
                        + "因为右端 $=0$，**所有平面都经过原点**。\n\n"
                        + f"π₁：${_fmt_coeff(a11)}x {_fmt_sign(a12)} {_fmt_abs(a12)}y {_fmt_sign(a13)} {_fmt_abs(a13)}z = 0$\n"
                        + f"π₂：${_fmt_coeff(a21)}x {_fmt_sign(a22)} {_fmt_abs(a22)}y {_fmt_sign(a23)} {_fmt_abs(a23)}z = 0$\n"
                        + f"π₃：${_fmt_coeff(a31)}x {_fmt_sign(a32)} {_fmt_abs(a32)}y {_fmt_sign(a33)} {_fmt_abs(a33)}z = 0$\n\n"
                        + "**这三个平面的交集 = Ax=0 的所有解 = 零空间。**"
                    ),
                },
                {
                    "title": "秩决定零空间有多大",
                    "content": (
                        "**零空间维数定理**：$\\dim(\\text{{Null}}(A)) = n - r(A)$\n\n"
                        + "| 秩 r(A) | 零空间维数 | 几何 | 含义 |\n"
                        + "|---------|-----------|------|------|\n"
                        + "| 3 | 0 | 原点 | 三平面仅交于原点 |\n"
                        + "| 2 | 1 | 一条直线 | 三平面共线 |\n"
                        + "| 1 | 2 | 一个平面 | 三平面重合 |\n"
                        + "| 0 | 3 | 整个 R³ | A 是零矩阵 |\n\n"
                        + "**直觉**：矩阵的每一行多一个「独立约束」，解的维数就减 1。\n"
                        + "秩 = 独立约束的数量，零空间维数 = 剩下的自由度。"
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


# ─── 辅助函数 ────────────────────────────────────────────────

def _describe_nullspace(null_basis, nullity, rank_A, A):
    """描述零空间的几何形状和参数。"""
    result = {"dim": nullity}

    if nullity == 0:
        result["type"] = "point"
        result["description"] = "零空间仅含原点"

    elif nullity == 1:
        result["type"] = "line"
        direction = null_basis[:, 0]
        result["direction"] = direction.tolist()
        result["description"] = "零空间是一条过原点的直线"

    elif nullity == 2:
        result["type"] = "plane"
        # 零空间的法向量 = 两个基向量的叉积
        b1 = null_basis[:, 0]
        b2 = null_basis[:, 1]
        normal = np.cross(b1, b2)
        n_norm = float(np.linalg.norm(normal))
        if n_norm > 1e-10:
            normal = normal / n_norm
        result["normal"] = normal.tolist()
        result["description"] = "零空间是一张过原点的平面"

    else:  # nullity == 3
        result["type"] = "space"
        result["description"] = "零空间是整个 R³（A 是零矩阵）"

    return result


def _fmt_coeff(val):
    """格式化系数：省略值为 1 的系数，负号直接写。"""
    v = float(val)
    if abs(v - 1.0) < 1e-10:
        return ""
    if abs(v + 1.0) < 1e-10:
        return "-"
    if abs(v - round(v)) < 1e-10:
        return str(int(round(v)))
    return f"{v:.2f}"


def _fmt_sign(val):
    """格式化符号：正数 +，负数 -。"""
    return "+" if float(val) >= 0 else "-"


def _fmt_abs(val):
    """格式化绝对值：省略值为 1 的系数。"""
    v = abs(float(val))
    if abs(v - 1.0) < 1e-10:
        return ""
    if abs(v - round(v)) < 1e-10:
        return str(int(round(v)))
    return f"{v:.2f}"
