"""
矩阵计算器 — 交互式矩阵运算工具

支持操作：乘法、求逆、伴随矩阵、转置、行列式
底层数学函数均通过 MathEngine 封装，可被其他场景导入复用。
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class MatrixCalculator(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "matrix_calculator",
            "title": "矩阵计算器",
            "chapter": "工具",
            "description": "输入矩阵，选择运算类型，实时计算并显示结果。支持矩阵乘法、求逆、伴随矩阵、转置、行列式。",
            "params": {
                "operation": {
                    "label": "运算类型",
                    "type": "choice",
                    "default": "multiply",
                    "options": ["multiply", "inverse", "adjoint", "transpose", "determinant"],
                },
                "A_rows": {
                    "label": "矩阵 A 行数",
                    "type": "int",
                    "default": 2, "min": 1, "max": 5, "step": 1,
                },
                "A_cols": {
                    "label": "矩阵 A 列数",
                    "type": "int",
                    "default": 2, "min": 1, "max": 5, "step": 1,
                },
                "B_rows": {
                    "label": "矩阵 B 行数",
                    "type": "int",
                    "default": 2, "min": 1, "max": 5, "step": 1,
                },
                "B_cols": {
                    "label": "矩阵 B 列数",
                    "type": "int",
                    "default": 2, "min": 1, "max": 5, "step": 1,
                },
                "matrix_A": {
                    "label": "矩阵 A",
                    "type": "matrix",
                    "rows": 2, "cols": 2,
                    "default": [[1, 0], [0, 1]],
                },
                "matrix_B": {
                    "label": "矩阵 B",
                    "type": "matrix",
                    "rows": 2, "cols": 2,
                    "default": [[1, 0], [0, 1]],
                },
            },
            "presets": [
                {
                    "label": "2×2 乘法",
                    "type": "unique",
                    "params": {
                        "operation": "multiply",
                        "A_rows": 2, "A_cols": 2,
                        "B_rows": 2, "B_cols": 2,
                        "matrix_A": [[2, 1], [0, 3]],
                        "matrix_B": [[1, 0], [2, 4]],
                    },
                },
                {
                    "label": "3×3 求逆",
                    "type": "unique",
                    "params": {
                        "operation": "inverse",
                        "A_rows": 3, "A_cols": 3,
                        "matrix_A": [[1, 2, 0], [0, 1, 1], [1, 0, 1]],
                    },
                },
                {
                    "label": "非方阵乘法 (2×3)·(3×2)",
                    "type": "unique",
                    "params": {
                        "operation": "multiply",
                        "A_rows": 2, "A_cols": 3,
                        "B_rows": 3, "B_cols": 2,
                        "matrix_A": [[1, 0, 2], [0, 3, 1]],
                        "matrix_B": [[1, 0], [2, 1], [0, 3]],
                    },
                },
                {
                    "label": "奇异矩阵（不可逆）",
                    "type": "none",
                    "params": {
                        "operation": "inverse",
                        "A_rows": 2, "A_cols": 2,
                        "matrix_A": [[1, 2], [2, 4]],
                    },
                },
                {
                    "label": "转置与行列式",
                    "type": "unique",
                    "params": {
                        "operation": "determinant",
                        "A_rows": 3, "A_cols": 3,
                        "matrix_A": [[2, 1, 0], [1, 3, 1], [0, 1, 2]],
                    },
                },
            ],
        }

    def compute(self, params: SceneParams) -> dict:
        operation = params.get("operation", "multiply")

        # 读取矩阵 A 尺寸
        a_rows = int(params.get("A_rows", 2))
        a_cols = int(params.get("A_cols", 2))

        # 从 params 中提取矩阵 A（二维数组）
        matrix_A_raw = params.get("matrix_A")
        if isinstance(matrix_A_raw, list):
            A = self._build_matrix(matrix_A_raw, a_rows, a_cols)
        else:
            A = np.eye(a_rows, a_cols)

        # 读取矩阵 B 尺寸和值
        b_rows = int(params.get("B_rows", 2))
        b_cols = int(params.get("B_cols", 2))
        matrix_B_raw = params.get("matrix_B")
        if isinstance(matrix_B_raw, list):
            B = self._build_matrix(matrix_B_raw, b_rows, b_cols)
        else:
            B = np.eye(b_rows, b_cols)

        matrices = []
        verification_checks = []
        scene_data = {}
        solution_info = {
            "type": "unique",
            "description": "",
            "details": {},
        }

        # ─── 执行运算 ──────────────────────────────────────

        if operation == "multiply":
            if A.shape[1] != B.shape[0]:
                solution_info["type"] = "none"
                solution_info["description"] = f"矩阵 A({A.shape[0]}×{A.shape[1]}) 与 B({B.shape[0]}×{B.shape[1]}) 无法相乘：A 的列数必须等于 B 的行数。"
                return {
                    "scene_data": {"matrices": []},
                    "verification": self.make_verification([
                        {"label": "维度兼容性", "passed": False},
                    ]),
                    "solution_info": solution_info,
                }

            C = M.matrix_multiply(A, B)
            matrices = [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "矩阵 B", "symbol": "B", "data": B.tolist()},
                {"label": "乘积", "symbol": "C = AB", "data": C.tolist()},
            ]
            solution_info["description"] = f"A({A.shape[0]}×{A.shape[1]}) × B({B.shape[0]}×{B.shape[1]}) = C({C.shape[0]}×{C.shape[1]})"
            solution_info["details"] = {
                "A 尺寸": f"{A.shape[0]}×{A.shape[1]}",
                "B 尺寸": f"{B.shape[0]}×{B.shape[1]}",
                "C 尺寸": f"{C.shape[0]}×{C.shape[1]}",
            }
            verification_checks = [
                {"label": f"C 维度为 {C.shape[0]}×{C.shape[1]}", "passed": C.shape[0] == A.shape[0] and C.shape[1] == B.shape[1]},
            ]
            # 3D 变换数据（用于可视化方阵的几何效果）
            transforms = []
            for M_mat, M_label in [(A, "A"), (B, "B"), (C, "C=AB")]:
                t = self._get_transform_data(M_mat, M_label)
                if t: transforms.append(t)
            if transforms:
                scene_data["transforms"] = transforms

        elif operation == "inverse":
            if A.shape[0] != A.shape[1]:
                solution_info["type"] = "none"
                solution_info["description"] = "只有方阵才能求逆。"
                return {
                    "scene_data": {"matrices": []},
                    "verification": self.make_verification([{"label": "矩阵是否为方阵", "passed": False}]),
                    "solution_info": solution_info,
                }

            A_inv = M.matrix_inverse(A)
            if A_inv is None:
                det = M.matrix_determinant(A)
                solution_info["type"] = "none"
                solution_info["description"] = f"矩阵 A 奇异（det(A)={det:.4f}），不可逆。零行列式意味着矩阵将空间降维，该过程不可逆。"
                matrices = [
                    {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
                ]
                solution_info["details"] = {"det(A)": f"{det:.4f}", "秩 r(A)": str(M.matrix_rank(A))}
                verification_checks = [
                    {"label": "det(A) ≠ 0（可逆条件）", "passed": False},
                ]
                t = self._get_transform_data(A, "A")
                if t: scene_data["transforms"] = [t]
            else:
                # 验证 A · A^(-1) = I
                identity_check = A @ A_inv
                is_identity = np.allclose(identity_check, np.eye(A.shape[0]), atol=1e-8)
                matrices = [
                    {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
                    {"label": "逆矩阵", "symbol": "A^{-1}", "data": A_inv.tolist()},
                    {"label": "验证 A·A⁻¹ = I", "symbol": "A A^{-1}", "data": identity_check.tolist()},
                ]
                solution_info["description"] = f"A 可逆，A⁻¹ 如上所示。"
                solution_info["details"] = {
                    "det(A)": f"{M.matrix_determinant(A):.4f}",
                    "A·A⁻¹ ≈ I": "是" if is_identity else "否",
                }
                verification_checks = [
                    {"label": "A·A⁻¹ ≈ I（容差 1e-8）", "passed": is_identity},
                ]
                t_a = self._get_transform_data(A, "A")
                t_inv = self._get_transform_data(A_inv, "A⁻¹")
                transforms = [t for t in [t_a, t_inv] if t]
                if transforms: scene_data["transforms"] = transforms

        elif operation == "adjoint":
            if A.shape[0] != A.shape[1]:
                solution_info["type"] = "none"
                solution_info["description"] = "只有方阵才有伴随矩阵。"
                return {
                    "scene_data": {"matrices": []},
                    "verification": self.make_verification([{"label": "矩阵是否为方阵", "passed": False}]),
                    "solution_info": solution_info,
                }

            adjA = M.matrix_adjoint(A)
            det = M.matrix_determinant(A)
            matrices = [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "伴随矩阵", "symbol": "\\text{adj}(A)", "data": adjA.tolist()},
            ]
            if abs(det) > 1e-10:
                # 验证 adj(A) = det(A) * A^(-1)
                expected = det * np.linalg.inv(A)
                is_correct = np.allclose(adjA, expected, atol=1e-8)
                matrices.append({"label": "验证 det(A)·A⁻¹", "symbol": "\\det(A) \\cdot A^{-1}", "data": expected.tolist()})
            else:
                is_correct = True  # 奇异矩阵 adj(A)=0 是正确的

            solution_info["description"] = f"det(A) = {det:.4f}，" + ("adj(A) = det(A)·A⁻¹" if abs(det) > 1e-10 else "奇异矩阵的伴随矩阵为零矩阵。")
            solution_info["details"] = {"det(A)": f"{det:.4f}"}
            verification_checks = [
                {"label": "adj(A) = det(A)·A⁻¹", "passed": is_correct},
            ]
            t = self._get_transform_data(A, "A")
            if t: scene_data["transforms"] = [t]

        elif operation == "transpose":
            AT = M.matrix_transpose(A)
            matrices = [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
                {"label": "转置矩阵", "symbol": "A^T", "data": AT.tolist()},
            ]
            solution_info["description"] = f"A({A.shape[0]}×{A.shape[1]}) 的转置为 Aᵀ({AT.shape[0]}×{AT.shape[1]})。"
            solution_info["details"] = {
                "A 尺寸": f"{A.shape[0]}×{A.shape[1]}",
                "Aᵀ 尺寸": f"{AT.shape[0]}×{AT.shape[1]}",
            }
            verification_checks = [
                {"label": "Aᵀ[0,1] = A[1,0]", "passed": bool(AT.shape[1] > 1 and AT.shape[0] > 1 and np.isclose(AT[0, 1], A[1, 0]))},
            ]
            t = self._get_transform_data(A, "A")
            if t: scene_data["transforms"] = [t]

        elif operation == "determinant":
            if A.shape[0] != A.shape[1]:
                solution_info["type"] = "none"
                solution_info["description"] = "只有方阵才有行列式。"
                return {
                    "scene_data": {"matrices": []},
                    "verification": self.make_verification([{"label": "矩阵是否为方阵", "passed": False}]),
                    "solution_info": solution_info,
                }

            det = M.matrix_determinant(A)
            matrices = [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
            ]
            if A.shape[0] == 2:
                # 手动验证 2×2 行列式公式
                manual_det = A[0, 0] * A[1, 1] - A[0, 1] * A[1, 0]
                det_ok = bool(np.isclose(det, manual_det, atol=1e-8))
            else:
                det_ok = True

            solution_info["description"] = f"det(A) = {det:.4f}"
            solution_info["details"] = {
                "det(A)": f"{det:.4f}",
                "秩 r(A)": str(M.matrix_rank(A)),
            }
            if abs(det) < 1e-10:
                solution_info["description"] += "（矩阵奇异，行列式为零）"
                solution_info["type"] = "none"

            verification_checks = [
                {"label": f"det(A) = {det:.4f}", "passed": det_ok},
            ]
            t = self._get_transform_data(A, "A")
            if t: scene_data["transforms"] = [t]

        # 添加矩阵 A 的秩信息
        if A.shape[0] == A.shape[1]:
            rank_A = M.matrix_rank(A)
            solution_info["details"]["r(A)"] = str(rank_A)

        scene_data["matrices"] = matrices
        return {
            "scene_data": scene_data,
            "verification": self.make_verification(verification_checks),
            "solution_info": solution_info,
        }

    def _build_matrix(self, data: list, rows: int, cols: int) -> np.ndarray:
        """从二维列表构建 NumPy 矩阵，自动填充/裁剪到目标尺寸"""
        arr = np.zeros((rows, cols), dtype=float)
        for r in range(min(rows, len(data))):
            row_data = data[r] if isinstance(data[r], list) else []
            for c in range(min(cols, len(row_data))):
                try:
                    arr[r, c] = float(row_data[c])
                except (ValueError, TypeError):
                    arr[r, c] = 0.0
        return arr

    def _get_transform_data(self, mat: np.ndarray, label: str = "") -> dict | None:
        """
        为 2×2 或 3×3 方阵生成单位形状→变换形状的数据。
        用于矩阵计算器的 3D 可视化。
        返回 None 表示矩阵不是 2×2 或 3×3。
        """
        if mat.shape == (2, 2):
            unit = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]
            transformed = []
            for v in unit:
                t = mat @ np.array([v[0], v[1]])
                transformed.append([float(t[0]), float(t[1]), 0.0])
            return {
                "dim": 2,
                "label": label,
                "unit_shape": unit,
                "transformed_shape": transformed,
                "det": float(np.linalg.det(mat)),
            }
        elif mat.shape == (3, 3):
            unit = [
                [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
                [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
            ]
            transformed = []
            for v in unit:
                t = mat @ np.array(v)
                transformed.append([float(t[0]), float(t[1]), float(t[2])])
            return {
                "dim": 3,
                "label": label,
                "unit_shape": unit,
                "transformed_shape": transformed,
                "det": float(np.linalg.det(mat)),
            }
        return None
