"""
场景 1.1：三阶行列式与平行六面体

3×3 矩阵的行列式的绝对值 = 三个列向量张成的平行六面体的体积。
det > 0：右手系 | det < 0：左手系 | det = 0：共面（退化）
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch1R1DetVolume(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch1_r1_det_volume",
            "title": "1.1 三阶行列式与平行六面体",
            "chapter": "第1章 行列式",
            "description": "3×3 行列式的几何含义：三个列向量张成的平行六面体的（有向）体积。行列式为零意味着三个向量共面。",
            "params": {
                "a11": {"label": "a₁₁", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a12": {"label": "a₁₂", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a13": {"label": "a₁₃", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a21": {"label": "a₂₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a22": {"label": "a₂₂", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "a23": {"label": "a₂₃", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a31": {"label": "a₃₁", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a32": {"label": "a₃₂", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "a33": {"label": "a₃₃", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {
                    "label": "单位立方体（det=1）",
                    "type": "unique",
                    "params": {"a11": 1, "a12": 0, "a13": 0, "a21": 0, "a22": 1, "a23": 0, "a31": 0, "a32": 0, "a33": 1},
                },
                {
                    "label": "拉伸（det=6）",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 0, "a13": 0, "a21": 0, "a22": 3, "a23": 0, "a31": 0, "a32": 0, "a33": 1},
                },
                {
                    "label": "倾斜六面体",
                    "type": "unique",
                    "params": {"a11": 2, "a12": 0.5, "a13": 0, "a21": 0, "a22": 2, "a23": 0.5, "a31": 0, "a32": 0, "a33": 2},
                },
                {
                    "label": "共面（det=0）",
                    "type": "none",
                    "params": {"a11": 1, "a12": 0, "a13": 0, "a21": 0, "a22": 1, "a23": 0, "a31": 1, "a32": 1, "a33": 0},
                },
                {
                    "label": "左手系（det<0）",
                    "type": "degenerate",
                    "params": {"a11": 2, "a12": 0, "a13": 0, "a21": 0, "a22": 1, "a23": 0, "a31": 0, "a32": 0, "a33": -2},
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
        a33 = float(params.get("a33", 2))

        A = np.array([
            [a11, a12, a13],
            [a21, a22, a23],
            [a31, a32, a33],
        ], dtype=float)

        det = M.matrix_determinant(A)
        volume = abs(det)
        rank = M.matrix_rank(A)

        # 三个列向量
        v1 = A[:, 0]
        v2 = A[:, 1]
        v3 = A[:, 2]

        # 平行六面体的 8 个顶点（从原点出发，由 v1, v2, v3 组合）
        verts = [
            np.array([0, 0, 0]),
            np.array([v1[0], v1[1], v1[2]]),
            np.array([v2[0], v2[1], v2[2]]),
            np.array([v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]]),
            np.array([v3[0], v3[1], v3[2]]),
            np.array([v1[0] + v3[0], v1[1] + v3[1], v1[2] + v3[2]]),
            np.array([v2[0] + v3[0], v2[1] + v3[1], v2[2] + v3[2]]),
            np.array([v1[0] + v2[0] + v3[0], v1[1] + v2[1] + v3[1], v1[2] + v2[2] + v3[2]]),
        ]
        verts_list = [v.tolist() for v in verts]

        # 12 条棱的索引对
        edges = [
            (0, 1), (0, 2), (0, 4),
            (1, 3), (1, 5),
            (2, 3), (2, 6),
            (3, 7),
            (4, 5), (4, 6),
            (5, 7),
            (6, 7),
        ]

        # 6 个面的顶点索引
        faces = [
            [0, 1, 3, 2],  # 底面 z=0
            [4, 5, 7, 6],  # 顶面
            [0, 1, 5, 4],  # 前面
            [2, 3, 7, 6],  # 后面
            [0, 2, 6, 4],  # 左面
            [1, 3, 7, 5],  # 右面
        ]

        # 6 个面的法向量（用于做半透明面）
        face_normals = []
        for fidx in faces:
            fv = [verts[fidx[i]] for i in range(4)]
            edge1 = fv[1] - fv[0]
            edge2 = fv[3] - fv[0]
            normal = np.cross(edge1, edge2)
            n = np.linalg.norm(normal)
            if n > 1e-10:
                normal = normal / n
            face_normals.append(normal.tolist())

        orientation = "右手系（正向）" if det > 1e-8 else ("左手系（负向）" if det < -1e-8 else "共面（退化）")

        scene_data = {
            "vectors": [
                {"components": [float(v1[0]), float(v1[1]), float(v1[2])], "color": 0x4cc9f0, "label": "v₁"},
                {"components": [float(v2[0]), float(v2[1]), float(v2[2])], "color": 0x06d6a0, "label": "v₂"},
                {"components": [float(v3[0]), float(v3[1]), float(v3[2])], "color": 0xffd166, "label": "v₃"},
            ],
            "parallelepiped": {
                "vertices": verts_list,
                "edges": edges,
                "faces": [{"vertices": [verts_list[i] for i in fidx], "normal": face_normals[j]}
                          for j, fidx in enumerate(faces)],
            },
            "det": float(det),
            "volume": float(volume),
            "rank": rank,
            "matrices": [
                {"label": "矩阵 A", "symbol": "A", "data": A.tolist()},
            ],
        }

        verification = self.make_verification([
            {"label": f"det(A) = {det:.4f}", "passed": True},
            {"label": f"体积 = |det| = {volume:.2f}", "passed": True},
            {"label": f"r(A) = {rank}", "passed": True},
            {"label": f"r(A)=3 ⇔ det≠0", "passed": (rank == 3) == (abs(det) > 1e-8)},
        ])

        solution_info = {
            "type": "unique" if abs(det) > 1e-8 else "none",
            "description": f"det(A) = {det:.4f}，方向：{orientation}。平行六面体体积 = |det| = {volume:.2f}。",
            "details": {
                "det(A)": f"{det:.4f}",
                "|det(A)|（体积）": f"{volume:.2f}",
                "r(A)": str(rank),
                "可逆": "是" if abs(det) > 1e-8 else "否",
            },
        }

        # ─── 讲解内容 ─────────────────────────────────────
        det_str = f"{det:.4f}"
        vol_str = f"{volume:.2f}"
        lecture_sections = [
            {
                "title": "从面积到体积：行列式的自然推广",
                "content": (
                    f"$3 \\times 3$ 矩阵的三列 $v_1, v_2, v_3$ 张成一个**平行六面体**。\n\n"
                    + f"$$\\det(A) = {det_str}$$\n\n"
                    + f"其绝对值 $|\\det| = {vol_str}$ 就是这个六面体的**体积**。\n\n"
                    + "行列式 = 线性变换的**体积缩放因子**——单位立方体（体积=1）经过 $A$ 变换后，体积变成 $|\\det(A)|$。"
                ),
            },
            {
                "title": "右手系 vs 左手系",
                "content": (
                    "- **$\\det > 0$**：$v_1, v_2, v_3$ 构成**右手系**（右手定则）\n"
                    + "- **$\\det < 0$**：构成**左手系**，变换翻转了空间方向\n"
                    + "- 类比：镜子里的像是左手系的——行列式为负意味着空间被「镜像翻转」了\n\n"
                    + f"当前：$\\det(A) = {det_str}$，{orientation}。"
                ),
            },
            {
                "title": "$\\det = 0$：空间坍缩的信号",
                "content": (
                    "当三列**共面**时，平行六面体的高为零，体积为 $0$。\n\n"
                    + "此时 $r(A) < 3$，变换将三维空间**压缩**到一个平面、一条线、甚至一个点上。\n\n"
                    + "**核心结论**（同济教材 §1.5）：方阵 $A$ 可逆 $\\iff \\det(A) \\neq 0$。行列式为零意味着降维，信息不可恢复。"
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": solution_info,
            "lecture": {"sections": lecture_sections},
        }
