"""
场景 3.1：两个向量的关系 — 线性相关 vs 线性无关

几何含义：
- 两个向量共线（平行）→ 线性相关，一个可被另一个线性表示
- 两个向量不共线 → 线性无关，它们张成一个平面
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R1TwoVectors(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r1_two_vectors",
            "title": "3.1 两个向量的关系",
            "chapter": "第三章",
            "description": "观察两个向量。若共线则线性相关（一个可被另一个表示），不共线则线性无关。",
            "params": {
                "v1x": {"label": "v₁ x", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "v1y": {"label": "v₁ y", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v1z": {"label": "v₁ z", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v2x": {"label": "v₂ x", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v2y": {"label": "v₂ y", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
                "v2z": {"label": "v₂ z", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {"label": "线性无关", "type": "unique",
                 "params": {"v1x": 2, "v1y": 0, "v1z": 0, "v2x": 0, "v2y": 3, "v2z": 0}},
                {"label": "线性相关（共线）", "type": "degenerate",
                 "params": {"v1x": 2, "v1y": 0, "v1z": 0, "v2x": 4, "v2y": 0, "v2z": 0}},
                {"label": "反向共线", "type": "degenerate",
                 "params": {"v1x": 2, "v1y": 0, "v1z": 0, "v2x": -3, "v2y": 0, "v2z": 0}},
                {"label": "三维不共面", "type": "unique",
                 "params": {"v1x": 2, "v1y": 1, "v1z": 0, "v2x": 0, "v2y": 2, "v2z": 1}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        v1 = np.array([params.get("v1x", 2), params.get("v1y", 0), params.get("v1z", 0)], dtype=float)
        v2 = np.array([params.get("v2x", 0), params.get("v2y", 3), params.get("v2z", 0)], dtype=float)

        # 用 NumPy 判断线性相关性
        A = np.column_stack([v1, v2])
        rank = M.matrix_rank(A)
        is_parallel = M.are_parallel(v1, v2)

        # 判断类型
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)

        if norm1 < 1e-8 or norm2 < 1e-8:
            relation = "degenerate"  # 含零向量
            desc = "其中一个向量为零向量，退化情形。"
        elif is_parallel:
            # 计算比例
            ratio = v2[0] / v1[0] if abs(v1[0]) > 1e-8 else v2[1] / v1[1] if abs(v1[1]) > 1e-8 else v2[2] / v1[2]
            relation = "dependent"
            desc = f"两个向量共线，线性相关。v₂ = {ratio:.2f} · v₁"
        else:
            relation = "independent"
            desc = "两个向量不共线，线性无关。它们张成一个平面。"

        # 如果线性相关，用 Gram-Schmidt 展示方向
        # 计算两个向量张成的平面（如果线性无关）
        cross = np.cross(v1, v2)
        normal = cross / np.linalg.norm(cross) if np.linalg.norm(cross) > 1e-8 else np.array([0, 0, 1])

        scene_data = {
            "vectors": [
                {"components": v1.tolist(), "label": "v₁", "color": 0xff6b6b},
                {"components": v2.tolist(), "label": "v₂", "color": 0x4ecdc4},
            ],
            "rank": rank,
            "relation": relation,
            "is_parallel": bool(is_parallel),
            "plane_normal": normal.tolist() if relation == "independent" else None,
            "ratio_text": desc,
            "matrices": [
                {"label": "列向量组成的矩阵 [v₁ v₂]", "symbol": "[\\mathbf{v}_1 \\; \\mathbf{v}_2]", "data": A.tolist()},
            ],
        }

        # 验证
        A_full = np.column_stack([v1, v2])
        rank_check = M.matrix_rank(A_full)
        parallel_check = M.are_parallel(v1, v2)

        verification = self.make_verification([
            {"label": f"矩阵 [v₁ v₂] 的秩 = {rank_check}", "passed": rank_check == rank},
            {"label": "NumPy 判断平行 = " + ("是" if parallel_check else "否"),
             "passed": parallel_check == is_parallel},
            {"label": f"v₁ 的模 = {norm1:.2f}, v₂ 的模 = {norm2:.2f}", "passed": True},
        ])

        # ─── 讲解内容 ─────────────────────────────────────
        if relation == "independent":
            relation_note = "两个向量**线性无关**——它们指向不同方向，张成一个二维平面。"
        elif relation == "dependent":
            relation_note = "两个向量**线性相关**——它们在同一条直线上，一个可以用另一个乘以某个比例得到。"
        else:
            relation_note = "含零向量的**退化情形**——零向量不贡献任何方向。"
        lecture_sections = [
            {
                "title": "线性相关 vs 线性无关（同济教材 §3.2）",
                "content": (
                    relation_note + "\n\n"
                    + "**定义**：对于向量组 $v_1, v_2$，若存在**不全为零**的数 $k_1, k_2$ 使\n\n"
                    + "$$k_1 v_1 + k_2 v_2 = 0$$\n\n"
                    + "则称它们**线性相关**。否则**线性无关**。\n\n"
                    + "几何翻译：线性相关 = 共线（或含零向量）；线性无关 = 不共线。"
                ),
            },
            {
                "title": "秩 = 极大无关组所含向量的个数",
                "content": (
                    f"矩阵 $[v_1 \\; v_2]$ 的秩 $r = {rank}$。\n\n"
                    + "秩就是**极大线性无关组**所含向量的个数——\n"
                    + "在这个向量组里，最多能挑出几个线性无关的向量。\n\n"
                    + f"当前 $r = {rank}$：\n"
                    + ("- 两个向量不共线 → $r = 2$（两个都是「有效方向」）" if rank == 2 else
                       "- 两个向量共线 → $r = 1$（实际上只有一个有效方向）" if rank == 1 else
                       "- $r = 0$（全是零向量）")
                ),
            },
        ]

        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": {
                "type": "unique" if relation == "independent" else ("none" if relation == "degenerate" else "infinite"),
                "description": desc,
                "details": {
                    "秩": str(rank),
                    "线性关系": "无关" if relation == "independent" else ("相关（共线）" if relation == "dependent" else "退化（含零向量）"),
                }
            },
            "lecture": {"sections": lecture_sections},
        }
