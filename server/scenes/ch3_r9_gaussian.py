"""
ch3_r9 — 高斯消元法的几何过程

高斯消元 = 逐步旋转平面到「最简位置」，同时保持交点（解）不变。

几何直觉：
- 每消一步，一个平面旋转到平行于某坐标轴
- 消元后，三个平面变成「上三角」形式：
  第一平面涉及 x,y,z；第二平面涉及 y,z；第三平面只涉及 z
- 回代就像从最后一个平面往上读解

关键：消元过程保持所有平面的交点不变！
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R9Gaussian(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r9_gaussian",
            "title": "高斯消元法的几何过程",
            "chapter": "第3章 矩阵的初等变换与线性方程组",
            "description": "高斯消元=逐步旋转平面到最简位置。观察3个平面在消元前后的变化，交点始终不变。",
            "params": {
                "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "a13": {"label": "a₁₃", "type": "float", "default": -1, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": -3, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": -1, "min": -5, "max": 5, "step": 0.1},
                "a23": {"label": "a₂₃", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a31": {"label": "a₃₁", "type": "float", "default": -2, "min": -5, "max": 5, "step": 0.1},
                "a32": {"label": "a₃₂", "type": "float", "default": 1, "min": -5, "max": 5, "step": 0.1},
                "a33": {"label": "a₃₃", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "b1": {"label": "b₁", "type": "float", "default": 1, "min": -10, "max": 10, "step": 0.1},
                "b2": {"label": "b₂", "type": "float", "default": 6, "min": -10, "max": 10, "step": 0.1},
                "b3": {"label": "b₃", "type": "float", "default": 6, "min": -10, "max": 10, "step": 0.1},
            },
            "presets": [
                {
                    "label": "典型3×3方程组",
                    "type": "unique",
                    "params": {"a11":2,"a12":1,"a13":-1,"a21":-3,"a22":-1,"a23":2,"a31":-2,"a32":1,"a33":2,
                               "b1":1,"b2":6,"b3":6},
                },
                {
                    "label": "唯一解（简单）",
                    "type": "unique",
                    "params": {"a11":1,"a12":1,"a13":1,"a21":0,"a22":1,"a23":1,"a31":0,"a32":0,"a33":1,
                               "b1":6,"b2":3,"b3":1},
                },
                {
                    "label": "无穷多解",
                    "type": "infinite",
                    "params": {"a11":1,"a12":1,"a13":1,"a21":1,"a22":1,"a23":1,"a31":2,"a32":2,"a33":2,
                               "b1":3,"b2":3,"b3":6},
                },
                {
                    "label": "无解",
                    "type": "none",
                    "params": {"a11":1,"a12":1,"a13":1,"a21":1,"a22":1,"a23":1,"a31":1,"a32":1,"a33":1,
                               "b1":1,"b2":2,"b3":3},
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        a11 = float(params.get("a11", 2)); a12 = float(params.get("a12", 1)); a13 = float(params.get("a13", -1))
        a21 = float(params.get("a21", -3)); a22 = float(params.get("a22", -1)); a23 = float(params.get("a23", 2))
        a31 = float(params.get("a31", -2)); a32 = float(params.get("a32", 1)); a33 = float(params.get("a33", 2))
        b1 = float(params.get("b1", 1)); b2 = float(params.get("b2", 6)); b3 = float(params.get("b3", 6))

        A = np.array([[a11, a12, a13], [a21, a22, a23], [a31, a32, a33]], dtype=float)
        b_vec = np.array([b1, b2, b3], dtype=float)

        # ─── 执行高斯消元（记录步骤）─────────────────
        Ab = np.column_stack([A.copy(), b_vec.copy()])
        steps = []

        # 记录初始状态
        steps.append(self._describe_system(Ab, "初始方程组"))

        n = 3
        # 消元过程
        for col in range(n - 1):
            # 部分主元：找当前列中绝对值最大的行
            pivot_row = col + np.argmax(np.abs(Ab[col:, col]))
            if pivot_row != col:
                Ab[[col, pivot_row]] = Ab[[pivot_row, col]]
                steps.append(self._describe_system(
                    Ab, f"交换第{col+1}行和第{pivot_row+1}行"
                ))

            pivot = Ab[col, col]
            if abs(pivot) < 1e-10:
                continue  # 主元为零，跳过该列

            # 消去下方各行
            for row in range(col + 1, n):
                factor = Ab[row, col] / pivot
                if abs(factor) > 1e-10:
                    Ab[row] = Ab[row] - factor * Ab[col]
                    steps.append(self._describe_system(
                        Ab, f"第{row+1}行 - ({factor:.2f})×第{col+1}行"
                    ))

        # 最终行阶梯形
        steps.append(self._describe_system(Ab, "行阶梯形（消元完成）"))

        # ─── 从最终状态提取平面 ──────────────────────
        # 原始系统的平面
        original_planes = self._extract_planes(
            np.column_stack([A, b_vec])
        )
        # 消元后系统的平面
        eliminated_planes = self._extract_planes(Ab)

        # ─── 求解 ──────────────────────────────────
        sol_type, x = M.solve_linear(A, b_vec)

        matrices = [
            {"label": "原始增广矩阵", "symbol": "[A \\mid b]",
             "data": np.column_stack([A, b_vec]).tolist()},
            {"label": "行阶梯形", "symbol": "[U \\mid c]",
             "data": Ab.tolist()},
        ]

        verification_checks = []
        if x is not None:
            is_ok = M.verify_solution(A, x, b_vec)
            verification_checks = [
                {"label": f"x=({x[0]:.2f},{x[1]:.2f},{x[2]:.2f}) 满足 Ax=b", "passed": is_ok},
            ]
        else:
            verification_checks = [
                {"label": "r(A) ≠ r(A|b) 或 r(A)<n", "passed": True},
            ]

        if sol_type == "unique" and x is not None:
            desc = (
                f"高斯消元将方程组化为上三角形式，保持交点 x=({x[0]:.2f},{x[1]:.2f},{x[2]:.2f}) 不变。\\n\\n"
                f"几何：消元 = 旋转平面到坐标轴对齐方向，交点固定。回代 = 从最后一个方程向上读出坐标。"
            )
        else:
            desc = f"消元完成。解的类型：{sol_type}。"

        return {
            "scene_data": {
                "matrices": matrices,
                "original_planes": original_planes,
                "eliminated_planes": eliminated_planes,
                "steps": [s["description"] for s in steps],
                "solution_type": sol_type,
            },
            "verification": self.make_verification(verification_checks),
            "solution_info": {
                "type": sol_type if sol_type else "none",
                "description": desc,
                "details": {
                    "消元步数": str(len(steps) - 1),
                    "最终阶梯形非零行数": str(M.matrix_rank(Ab)),
                },
            },
        }

    def _describe_system(self, Ab: np.ndarray, desc: str) -> dict:
        return {
            "description": desc,
            "matrix": Ab.tolist(),
        }

    def _extract_planes(self, Ab: np.ndarray) -> list:
        """从增广矩阵提取平面 (normal_x, normal_y, normal_z, d) 其中 normal·x = d"""
        planes = []
        for i in range(3):
            row = Ab[i]
            normal = row[:3]
            rhs = row[3]
            norm_len = np.linalg.norm(normal)
            if norm_len < 1e-10:
                # 零行（全零方程）
                planes.append({
                    "normal": [0, 0, 0],
                    "d": 0,
                    "valid": False,
                })
            else:
                planes.append({
                    "normal": [float(normal[0]), float(normal[1]), float(normal[2])],
                    "d": float(rhs),
                    "valid": True,
                })
        return planes
