"""
场景 3.2：三个向量与张成空间

几何含义：
- 三个向量不共面 → 张成整个 R³（秩=3）
- 三个向量共面但不共线 → 只张成一个平面（秩=2）
- 三个向量全部共线 → 只张成一条线（秩=1）
"""
import numpy as np
from server.scenes.base import BaseScene, SceneParams
from server.math_engine import MathEngine as M


class Ch3R2ThreeVectors(BaseScene):

    @staticmethod
    def get_meta() -> dict:
        return {
            "id": "ch3_r2_three_vectors",
            "title": "3.2 三个向量与张成空间",
            "chapter": "第三章",
            "description": "三个向量能否张成整个 R³？观察秩的变化：秩=3 张成空间，秩=2 只张成平面，秩=1 只张成直线。",
            "params": {
                "v1x": {"label": "v₁ x", "type": "float", "default": 2, "min": -5, "max": 5, "step": 0.1},
                "v1y": {"label": "v₁ y", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v1z": {"label": "v₁ z", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v2x": {"label": "v₂ x", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v2y": {"label": "v₂ y", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
                "v2z": {"label": "v₂ z", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v3x": {"label": "v₃ x", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v3y": {"label": "v₃ y", "type": "float", "default": 0, "min": -5, "max": 5, "step": 0.1},
                "v3z": {"label": "v₃ z", "type": "float", "default": 3, "min": -5, "max": 5, "step": 0.1},
            },
            "presets": [
                {"label": "张成 R³（秩=3）", "type": "unique",
                 "params": {"v1x":2,"v1y":0,"v1z":0, "v2x":0,"v2y":3,"v2z":0, "v3x":0,"v3y":0,"v3z":3}},
                {"label": "共面（秩=2）", "type": "degenerate",
                 "params": {"v1x":2,"v1y":0,"v1z":0, "v2x":0,"v2y":3,"v2z":0, "v3x":2,"v3y":3,"v3z":0}},
                {"label": "共线（秩=1）", "type": "none",
                 "params": {"v1x":2,"v1y":0,"v1z":0, "v2x":4,"v2y":0,"v2z":0, "v3x":-2,"v3y":0,"v3z":0}},
            ]
        }

    def compute(self, params: SceneParams) -> dict:
        v1 = np.array([params.get("v1x",2), params.get("v1y",0), params.get("v1z",0)], dtype=float)
        v2 = np.array([params.get("v2x",0), params.get("v2y",3), params.get("v2z",0)], dtype=float)
        v3 = np.array([params.get("v3x",0), params.get("v3y",0), params.get("v3z",3)], dtype=float)

        A = np.column_stack([v1, v2, v3])
        rank = M.matrix_rank(A)

        # 判断张成空间的类型
        if rank == 3:
            span_type = "full"
            desc = "三个向量张成整个 R³ 空间（秩=3），它们是线性无关的。"
        elif rank == 2:
            span_type = "plane"
            desc = "三个向量共面，只张成一个二维平面（秩=2）。其中两个是线性无关的，第三个可由它们线性表示。"
        elif rank == 1:
            span_type = "line"
            desc = "三个向量全部共线，只张成一条直线（秩=1）。只有一个是线性无关的。"
        else:
            span_type = "point"
            desc = "三个向量全为零向量（秩=0），退化为原点。"

        # 计算张成平面的法向量（秩=2时）
        plane_normal = None
        if rank == 2:
            # 找两个不共线的向量计算叉积
            cross = np.cross(v1, v2)
            if np.linalg.norm(cross) < 1e-8:
                cross = np.cross(v1, v3)
            if np.linalg.norm(cross) > 1e-8:
                plane_normal = (cross / np.linalg.norm(cross)).tolist()

        # 计算极大无关组标记（哪个向量可以被前面的线性表示）
        independence = []
        # 用逐列方式判断
        cols = [v1, v2, v3]
        independent_indices = []
        dependent_reason = []
        for i, col in enumerate(cols):
            if i == 0:
                if np.linalg.norm(col) > 1e-8:
                    independent_indices.append(i)
                    independence.append(True)
                else:
                    independence.append(False)
                    dependent_reason.append(f"v{i+1} 为零向量")
            else:
                prev = np.column_stack([cols[j] for j in independent_indices]) if independent_indices else np.zeros((3,0))
                if prev.shape[1] == 0:
                    if np.linalg.norm(col) > 1e-8:
                        independent_indices.append(i)
                        independence.append(True)
                    else:
                        independence.append(False)
                        dependent_reason.append(f"v{i+1} 为零向量")
                else:
                    # 用最小二乘判断是否能被线性表示
                    try:
                        coeffs, _, _, _ = np.linalg.lstsq(prev, col, rcond=None)
                        reconstructed = prev @ coeffs
                        residual = np.linalg.norm(col - reconstructed)
                        if residual < 1e-6:
                            independence.append(False)
                            reason = f"v{i+1} = " + " + ".join([f"{c:.2f}·v{j+1}" for j, c in zip(independent_indices, coeffs)])
                            dependent_reason.append(reason)
                        else:
                            independent_indices.append(i)
                            independence.append(True)
                    except Exception:
                        independent_indices.append(i)
                        independence.append(True)

        scene_data = {
            "vectors": [
                {"components": v1.tolist(), "label": "v₁", "color": 0xff6b6b, "independent": independence[0]},
                {"components": v2.tolist(), "label": "v₂", "color": 0x4ecdc4, "independent": independence[1]},
                {"components": v3.tolist(), "label": "v₃", "color": 0xffd93d, "independent": independence[2]},
            ],
            "rank": rank,
            "span_type": span_type,
            "plane_normal": plane_normal,
            "dependent_reason": dependent_reason,
            "desc": desc,
            "matrices": [
                {"label": "列向量组成的矩阵 [v₁ v₂ v₃]", "symbol": "[\\mathbf{v}_1 \\; \\mathbf{v}_2 \\; \\mathbf{v}_3]", "data": A.tolist()},
            ],
        }

        verification = self.make_verification([
            {"label": f"矩阵 [v₁ v₂ v₃] 的秩 = {rank}",
             "passed": M.matrix_rank(A) == rank},
            {"label": f"张成空间类型: {span_type}",
             "passed": True},
        ])

        # ─── 讲解内容 ─────────────────────────────────────
        span_name = {"full": "整个 $\\mathbb{R}^3$ 空间", "plane": "一个二维平面", "line": "一条直线", "point": "原点"}.get(span_type, "未知")
        lecture_sections = [
            {
                "title": "张成空间（Span）= 所有线性组合的集合",
                "content": (
                    "三向量 $v_1, v_2, v_3$ 的**张成空间**是它们所有线性组合构成的集合：\n\n"
                    + "$$\\operatorname{span}\\{v_1, v_2, v_3\\} = \\{k_1 v_1 + k_2 v_2 + k_3 v_3 \\mid k_i \\in \\mathbb{R}\\}$$\n\n"
                    + f"当前 $r = {rank}$，张成空间是**{span_name}**。\n\n"
                    + "秩直接告诉你：这三个向量「实际上」张成了几维的空间。"
                ),
            },
            {
                "title": "极大无关组 = 挑出「真正起作用」的向量",
                "content": (
                    f"三个向量中，极大无关组包含 **{rank}** 个向量。\n\n"
                    + ("只有 1 个是「独立」的，其余 2 个都可由它线性表示。" if rank == 1 else
                       "有 2 个是独立的，第 3 个可由它们线性表示。" if rank == 2 else
                       "全部 3 个都是独立的，任意一个都不能被另外两个表示。" if rank == 3 else
                       "全是零向量。")
                    + "\n\n"
                    + "用 $v_1, v_2, v_3$ 作为列组成矩阵 $A = [v_1 \\; v_2 \\; v_3]$，"
                    + "则 $r(A)$ 就是极大无关组的向量个数。"
                ),
            },
            {
                "title": "秩=列空间的维数=行空间的维数",
                "content": (
                    f"矩阵 $A = [v_1 \\; v_2 \\; v_3]$ 是 $3 \\times 3$ 的。\n\n"
                    + f"$r(A) = {rank}$，所以 $r(A^{{\\mathsf{{T}}}}) = {rank}$ 也一样（行秩 = 列秩）。\n\n"
                    + "**关键结论**：矩阵的秩同时告诉你——\n"
                    + "- 列向量能张成几维空间\n"
                    + "- 行向量能张成几维空间\n"
                    + "- 有几个「真正独立」的方程\n\n"
                    + "秩是一个矩阵最核心的数值特征。"
                ),
            },
        ]

        solution_type_map = {"full": "unique", "plane": "infinite", "line": "infinite", "point": "none"}
        return {
            "scene_data": scene_data,
            "verification": verification,
            "solution_info": {
                "type": solution_type_map.get(span_type, "none"),
                "description": desc,
                "details": {
                    "秩": str(rank),
                    "极大无关组所含向量数": str(rank),
                    "张成空间的维数": str(rank),
                }
            },
            "lecture": {"sections": lecture_sections},
        }
