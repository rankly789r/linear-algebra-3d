"""
场景 1.0：从方程到平面的几何对应
建立线性方程与三维空间中平面的对应关系。
一个方程 = 一个平面，两个方程 = 两平面相交（交线 = 方程组的解）。

矩阵形式 Ax=b：
    A = [[a₁₁, a₁₂, a₁₃],    b = [b₁,
         [a₂₁, a₂₂, a₂₃]]         b₂]
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams, matrix_params, vector_params
from server.math_engine import MathEngine as M


class Ch1R0EquationToPlane(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch1_r0_equation_to_plane",
            "title": "1.0 从方程到平面的几何对应",
            "chapter": "基础",
            "description": "建立线性方程与平面的对应：一个方程定义一个平面，两个方程求交线。",
            "params": {
                **matrix_params("a", 2, 3, defaults=[[2, 1, 3], [0, 0, 0]], min=-5, max=5),
                **vector_params("b", 2, defaults=[0, 0], min=-10, max=10),
            },
            "presets": [
                {"label": "认识一个平面", "type": "unique", "params": {
                    "a11": 2, "a12": 1, "a13": 3, "b1": 0,
                    "a21": 0, "a22": 0, "a23": 0, "b2": 0,
                }},
                {"label": "平面平移（非齐次）", "type": "unique", "params": {
                    "a11": 2, "a12": 1, "a13": 3, "b1": 4,
                    "a21": 0, "a22": 0, "a23": 0, "b2": 0,
                }},
                {"label": "两平面交于一线", "type": "unique", "params": {
                    "a11": 1, "a12": 0, "a13": 0, "b1": 2,
                    "a21": 0, "a22": 1, "a23": 0, "b2": 3,
                }},
                {"label": "两平面平行无交", "type": "none", "params": {
                    "a11": 1, "a12": 1, "a13": 1, "b1": 2,
                    "a21": 1, "a22": 1, "a23": 1, "b2": 5,
                }},
                {"label": "两平面重合", "type": "infinite", "params": {
                    "a11": 1, "a12": 1, "a13": 1, "b1": 2,
                    "a21": 2, "a22": 2, "a23": 2, "b2": 4,
                }},
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        # ── 第 1 步：提取参数 ──
        a11 = float(params.get("a11", 2))
        a12 = float(params.get("a12", 1))
        a13 = float(params.get("a13", 3))
        b1  = float(params.get("b1", 0))
        a21 = float(params.get("a21", 0))
        a22 = float(params.get("a22", 0))
        a23 = float(params.get("a23", 0))
        b2  = float(params.get("b2", 0))

        # ── 第 2 步：数学计算 ──
        n1 = np.array([a11, a12, a13], dtype=float)
        n2 = np.array([a21, a22, a23], dtype=float)

        norm1 = float(np.linalg.norm(n1))
        norm2 = float(np.linalg.norm(n2))

        plane1_valid = norm1 > 1e-10
        plane2_valid = norm2 > 1e-10

        # 是否全部是齐次（b=0）？
        homogeneous = (abs(b1) < 1e-10) and (abs(b2) < 1e-10)

        intersection = {"type": "none", "description": ""}

        if plane1_valid and plane2_valid:
            cos_angle = float(abs(np.dot(n1, n2)) / (norm1 * norm2))
            parallel = abs(cos_angle - 1.0) < 1e-10

            if parallel:
                # 判断重合还是平行
                # n2 = k * n1 的话，判断 b2 是否也等于 k * b1
                k = norm2 / norm1
                if abs(b2 - k * b1) < 1e-8:
                    intersection = {
                        "type": "plane",
                        "point": None,
                        "direction": [float(n1[0] / norm1), float(n1[1] / norm1), float(n1[2] / norm1)],
                        "description": "两平面重合——整个平面都是交线，方程组有无穷多解。"
                    }
                else:
                    intersection = {
                        "type": "none",
                        "point": None,
                        "direction": None,
                        "description": "两平面平行但不重合——无交点，方程组无解。"
                    }
            else:
                # 两平面相交于一条直线
                direction = np.cross(n1, n2)
                dir_norm = float(np.linalg.norm(direction))
                direction = direction / dir_norm

                # 在交线上找一个点：尝试依次消去一维
                A_mat = np.array([[a11, a12, a13], [a21, a22, a23]], dtype=float)
                b_vec = np.array([b1, b2], dtype=float)
                point = _find_point_on_line(A_mat, b_vec)

                intersection = {
                    "type": "line",
                    "point": point.tolist(),
                    "direction": direction.tolist(),
                    "description": "两平面交于一条直线——方程组有无穷多解（1 维解空间）。"
                }

        elif plane1_valid:
            intersection = {
                "type": "plane",
                "point": None,
                "direction": None,
                "description": "只有一个有效平面 π₁——整个平面上的点都满足方程。"
            }
        elif plane2_valid:
            intersection = {
                "type": "plane",
                "point": None,
                "direction": None,
                "description": "只有一个有效平面 π₂——整个平面上的点都满足方程。"
            }
        else:
            intersection = {
                "type": "none",
                "point": None,
                "direction": None,
                "description": "无有效方程（所有系数均为零）。"
            }

        # ── 第 3 步：构建 scene_data ──
        scene_data = {
            "matrices": [
                {"label": "系数矩阵 A", "symbol": "A", "data": [[a11, a12, a13], [a21, a22, a23]]},
                {"label": "常数列 b", "symbol": "b", "data": [[b1], [b2]]},
            ],
            "planes": [
                {
                    "normal": n1.tolist() if plane1_valid else [0, 0, 0],
                    "d": b1,
                    "valid": plane1_valid,
                    "label": "π₁",
                    "eq": f"{_fmt_coeff(a11)}x {_fmt_sign(a12)} {_fmt_abs(a12)}y {_fmt_sign(a13)} {_fmt_abs(a13)}z = {_fmt_num(b1)}"
                },
                {
                    "normal": n2.tolist() if plane2_valid else [0, 0, 0],
                    "d": b2,
                    "valid": plane2_valid,
                    "label": "π₂",
                    "eq": f"{_fmt_coeff(a21)}x {_fmt_sign(a22)} {_fmt_abs(a22)}y {_fmt_sign(a23)} {_fmt_abs(a23)}z = {_fmt_num(b2)}"
                },
            ],
            "intersection": intersection,
            "homogeneous": homogeneous,
        }

        # ── 第 4 步：构建 verification ──
        checks = [
            {"label": f"π₁: ({a11},{a12},{a13})·(x,y,z) = {_fmt_num(b1)}", "passed": True},
            {"label": f"π₂: ({a21},{a22},{a23})·(x,y,z) = {_fmt_num(b2)}", "passed": True},
        ]
        if plane1_valid and plane2_valid:
            checks.append({
                "label": f"法向量夹角余弦: {cos_angle:.4f}",
                "passed": True
            })
        checks.append({"label": intersection["description"], "passed": True})
        verification = self.make_verification(checks)

        # ── 第 5 步：构建 solution_info ──
        # 解类型的语义：对于方程组 Ax=b，type 表示解的存在性和唯一性
        sol_type_map = {
            "line": "infinite",
            "plane": "infinite",
            "none": "none",
        }
        sol_type = sol_type_map.get(intersection["type"], "unique")
        solution_info = {
            "type": sol_type,
            "description": intersection["description"],
            "details": {
                "平面数": "2" if (plane1_valid and plane2_valid) else "1" if (plane1_valid or plane2_valid) else "0",
                "齐次": "是（所有 b=0）" if homogeneous else "否",
            },
        }
        if intersection["type"] == "line":
            solution_info["details"]["交线方向"] = (
                f"({intersection['direction'][0]:.3f}, {intersection['direction'][1]:.3f}, {intersection['direction'][2]:.3f})"
            )

        # ── 第 6 步：构建 lecture ──
        lecture = {
            "sections": [
                {
                    "title": "方程 ↔ 平面：基本对应",
                    "content": (
                        "**核心直觉：每一个线性方程 $a_{11}x + a_{12}y + a_{13}z = b_1$ 在空间中定义一个平面。**\n\n"
                        + f"当前 π₁：${_fmt_coeff(a11)}x {_fmt_sign(a12)} {_fmt_abs(a12)}y {_fmt_sign(a13)} {_fmt_abs(a13)}z = {_fmt_num(b1)}$\n\n"
                        + f"当前 π₂：${_fmt_coeff(a21)}x {_fmt_sign(a22)} {_fmt_abs(a22)}y {_fmt_sign(a23)} {_fmt_abs(a23)}z = {_fmt_num(b2)}$\n\n"
                        + "- 系数 $(a_{11}, a_{12}, a_{13})$ 组成的向量 $\\vec{{n}}$ 是平面的**法向量**（垂直于平面）\n"
                        + "- 常数 $b_1$ 控制平面沿法向量方向的**平移距离**\n"
                        + "- 平面上的所有点 $(x,y,z)$ 都满足方程"
                    ),
                },
                {
                    "title": "齐次（b=0）：平面过原点",
                    "content": (
                        "**当 $b = 0$ 时，原点 $(0,0,0)$ 一定满足方程，所以平面一定经过原点。**\n\n"
                        + "这就是为什么齐次线性方程组 $Ax = 0$ 一定有解（至少 $x = 0$）。\n\n"
                        + "**多个过原点的平面的交集，一定是过原点的子空间**（原点、直线、或平面）。"
                    ),
                },
                {
                    "title": "两个平面 = 方程组求交线",
                    "content": (
                        "两个方程 $\\Leftrightarrow$ 两个平面，它们的**交线**就是方程组的解。有三种情况：\n\n"
                        + "1. **两平面相交**（法向量不平行）→ 交线是一条直线 → 方程组有**无穷多解**\n"
                        + "   - 两个方程、三个未知数 → 欠定系统 → 1 维解空间\n"
                        + "2. **两平面平行**（法向量平行，方程不成比例）→ 无交点 → 方程组**无解**\n"
                        + "3. **两平面重合**（方程成比例）→ 整个平面都是解 → 方程组有**无穷多解**（2 维解空间）"
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

def _find_point_on_line(A, b):
    """在欠定方程组 Ax=b 的交线上找一个特解点。
    A 是 2×3 矩阵（两平面法向量），b 是 2×1 常数列。
    通过依次尝试消去一维来求解 2×2 子方程组。
    """
    for drop_col in [2, 1, 0]:
        cols = [c for c in range(3) if c != drop_col]
        A_sub = A[:, cols]
        if abs(np.linalg.det(A_sub)) > 1e-10:
            x_sub = np.linalg.solve(A_sub, b)
            pt = np.zeros(3)
            pt[cols[0]] = x_sub[0]
            pt[cols[1]] = x_sub[1]
            pt[drop_col] = 0.0
            return pt
    # 退化情况返回原点
    return np.array([0.0, 0.0, 0.0])


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


def _fmt_num(val):
    """格式化纯数值。"""
    v = float(val)
    if abs(v - round(v)) < 1e-10:
        return str(int(round(v)))
    return f"{v:.2f}"
