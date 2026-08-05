"""
核心数学引擎 — 所有线性代数计算必须通过此模块。

规则：
1. 只能使用 NumPy 和 SciPy 的公开 API。
2. 不得自行实现消元法、求秩、求逆等算法。
3. 所有函数返回 Python 原生类型（可 JSON 序列化）。
"""

import numpy as np
from scipy import linalg
from typing import Optional, Tuple


class MathEngine:
    """封装 NumPy/SciPy 的线性代数计算"""

    @staticmethod
    def matrix_rank(A: np.ndarray) -> int:
        """计算矩阵的秩"""
        return int(np.linalg.matrix_rank(A))

    @staticmethod
    def solve_linear(A: np.ndarray, b: np.ndarray) -> Tuple[str, Optional[np.ndarray]]:
        """
        求解线性方程组 Ax = b

        返回:
            (solution_type, x)
            solution_type: "unique" | "infinite" | "none"
            x: 解向量（unique 时有值，否则为 None 或一个特解）
        """
        n = A.shape[1]

        # 比较秩来判断解的情况
        rank_A = np.linalg.matrix_rank(A)
        Ab = np.column_stack([A, b])
        rank_Ab = np.linalg.matrix_rank(Ab)

        if rank_A < rank_Ab:
            return ("none", None)
        elif rank_A < n:
            return ("infinite", None)
        else:
            # 唯一解
            x = np.linalg.solve(A, b)
            return ("unique", x)

    @staticmethod
    def null_space(A: np.ndarray) -> Optional[np.ndarray]:
        """
        计算齐次方程 Ax = 0 的解空间（零空间）的一组基。
        返回: 基向量组成的矩阵，每列是一个基向量。若只有零解则返回 None。
        """
        # 使用 SVD 计算零空间
        # scipy.linalg.null_space 返回零空间的标准正交基
        try:
            ns = linalg.null_space(A, rcond=1e-10)
            if ns.shape[1] == 0:
                return None
            return ns
        except Exception:
            return None

    @staticmethod
    def solve_least_squares(A: np.ndarray, b: np.ndarray) -> np.ndarray:
        """最小二乘解（用于无解情况下的最佳近似）"""
        x, residuals, rank, s = np.linalg.lstsq(A, b, rcond=None)
        return x

    @staticmethod
    def to_list(arr: np.ndarray) -> list:
        """将 NumPy 数组转为可 JSON 序列化的 Python 列表"""
        return arr.tolist()

    @staticmethod
    def verify_solution(A: np.ndarray, x: np.ndarray, b: np.ndarray, tol: float = 1e-8) -> bool:
        """验证 x 是否满足 Ax = b（在容差范围内）"""
        residual = A @ x - b
        return bool(np.all(np.abs(residual) < tol))

    @staticmethod
    def are_parallel(v1: np.ndarray, v2: np.ndarray, tol: float = 1e-8) -> bool:
        """判断两个向量是否平行（线性相关）"""
        # 使用叉积的模
        cross = np.linalg.norm(np.cross(v1, v2))
        return bool(cross < tol)

    @staticmethod
    def gram_schmidt(vectors: np.ndarray) -> np.ndarray:
        """
        对一组列向量做 Gram-Schmidt 正交化。
        vectors: 每列一个向量
        返回: 正交化后的向量矩阵
        """
        n = vectors.shape[1]
        Q = np.zeros_like(vectors, dtype=float)
        for i in range(n):
            v = vectors[:, i].copy().astype(float)
            for j in range(i):
                q_j = Q[:, j]
                v -= np.dot(v, q_j) * q_j
            norm_v = np.linalg.norm(v)
            if norm_v > 1e-10:
                Q[:, i] = v / norm_v
            else:
                Q[:, i] = v  # 零向量保持为零
        return Q

    @staticmethod
    def projection_onto_plane(point: np.ndarray, normal: np.ndarray) -> np.ndarray:
        """计算点到平面的投影"""
        normal = normal / np.linalg.norm(normal)
        dist = np.dot(point, normal)
        return point - dist * normal

    # ─── 矩阵运算（第2章 + 矩阵计算器） ──────────────────────

    @staticmethod
    def matrix_multiply(A: np.ndarray, B: np.ndarray) -> np.ndarray:
        """矩阵乘法 A @ B"""
        return A @ B

    @staticmethod
    def matrix_inverse(A: np.ndarray) -> Optional[np.ndarray]:
        """
        矩阵的逆 A^(-1)
        若矩阵奇异（不可逆），返回 None
        """
        if np.linalg.matrix_rank(A) < A.shape[0]:
            return None
        return np.linalg.inv(A)

    @staticmethod
    def matrix_adjoint(A: np.ndarray) -> np.ndarray:
        """
        伴随矩阵 adj(A)
        adj(A) = det(A) * A^(-1)，对奇异矩阵返回零矩阵
        """
        det = np.linalg.det(A)
        if abs(det) < 1e-10:
            return np.zeros_like(A, dtype=float)
        return det * np.linalg.inv(A)

    @staticmethod
    def matrix_transpose(A: np.ndarray) -> np.ndarray:
        """矩阵转置 A^T"""
        return A.T

    @staticmethod
    def matrix_determinant(A: np.ndarray) -> float:
        """矩阵的行列式 det(A)"""
        return float(np.linalg.det(A))

    # ─── 初等矩阵（第2章 初等变换） ─────────────────────────

    @staticmethod
    def elem_swap(n: int, i: int, j: int) -> np.ndarray:
        """
        生成交换第 i, j 行(列)的初等矩阵 E_swap。
        n: 矩阵阶数, i, j: 要交换的行/列索引(0-based)
        """
        E = np.eye(n, dtype=float)
        E[i, i] = 0; E[i, j] = 1
        E[j, j] = 0; E[j, i] = 1
        return E

    @staticmethod
    def elem_scale(n: int, i: int, k: float) -> np.ndarray:
        """
        生成第 i 行(列)倍乘 k 的初等矩阵 E_scale。
        n: 矩阵阶数, i: 目标行/列, k: 倍数
        """
        E = np.eye(n, dtype=float)
        E[i, i] = k
        return E

    @staticmethod
    def elem_add(n: int, i: int, j: int, k: float) -> np.ndarray:
        """
        生成第 i 行+(第 j 行×k) 的初等矩阵 E_add。
        n: 矩阵阶数, i: 目标行, j: 源行, k: 倍数
        左乘 E_add @ A = 将 A 的第 j 行×k 加到第 i 行
        右乘 A @ E_add = 将 A 的第 i 列×k 加到第 j 列
        """
        E = np.eye(n, dtype=float)
        E[i, j] = k
        return E
