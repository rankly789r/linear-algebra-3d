"""
FastAPI 应用 — 路由注册与静态文件服务

新增场景步骤：
1. 在 server/scenes/ 下创建 chX_rY_name.py
2. 在下方 SCENE_REGISTRY 中添加注册
3. 前端 main.js 的 SCENE_MENU 中添加对应菜单项
"""
import traceback
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from server.math_engine import MathEngine
from server.scenes.base import SceneParams

# ─── 场景注册表 ───────────────────────────────────────────
# 格式: "route_name" -> SceneClass
# 新增场景时在此处添加一行即可

from server.scenes.ch0_r0_matrix_columns import Ch0R0MatrixColumns
from server.scenes.ch0_r1_column_decompose import Ch0R1ColumnDecompose
from server.scenes.ch3_r1_two_vectors import Ch3R1TwoVectors
from server.scenes.ch3_r4_2x2_system import Ch3R42x2System
from server.scenes.ch3_r2_three_vectors import Ch3R2ThreeVectors
from server.scenes.ch3_r5_3x3_system import Ch3R53x3System
from server.scenes.ch3_r0_rank_intuition import Ch3R0RankIntuition
from server.scenes.ch3_r3_matrix_rank import Ch3R3MatrixRank
from server.scenes.ch3_r6_homogeneous import Ch3R6Homogeneous
from server.scenes.ch3_r7_rank_solution import Ch3R7RankSolution
from server.scenes.ch3_r8_rank_properties import Ch3R8RankProperties
from server.scenes.matrix_calculator import MatrixCalculator
from server.scenes.ch1_r0_det_area import Ch1R0DetArea
from server.scenes.ch1_r1_det_volume import Ch1R1DetVolume
from server.scenes.ch1_r2_det_properties import Ch1R2DetProperties
from server.scenes.ch2_r0_matrix_multiply import Ch2R0MatrixMultiply
from server.scenes.ch2_r1_matrix_inverse import Ch2R1MatrixInverse
from server.scenes.ch2_r2_matrix_transpose import Ch2R2MatrixTranspose
from server.scenes.ch3_r12_elem_row import Ch3R12ElemRow
from server.scenes.ch3_r13_elem_col import Ch3R13ElemCol
from server.scenes.ch2_r3_ax_eq_b import Ch2R3AxEqB

SCENE_REGISTRY = {
    "ch0_r0_matrix_columns": Ch0R0MatrixColumns,
    "ch0_r1_column_decompose": Ch0R1ColumnDecompose,
    "ch3_r1_two_vectors": Ch3R1TwoVectors,
    "ch3_r4_2x2_system": Ch3R42x2System,
    "ch3_r2_three_vectors": Ch3R2ThreeVectors,
    "ch3_r5_3x3_system": Ch3R53x3System,
    "ch3_r0_rank_intuition": Ch3R0RankIntuition,
    "ch3_r3_matrix_rank": Ch3R3MatrixRank,
    "ch3_r6_homogeneous": Ch3R6Homogeneous,
    "ch3_r7_rank_solution": Ch3R7RankSolution,
    "ch3_r8_rank_properties": Ch3R8RankProperties,
    "matrix_calculator": MatrixCalculator,
    "ch1_r0_det_area": Ch1R0DetArea,
    "ch1_r1_det_volume": Ch1R1DetVolume,
    "ch1_r2_det_properties": Ch1R2DetProperties,
    "ch2_r0_matrix_multiply": Ch2R0MatrixMultiply,
    "ch2_r1_matrix_inverse": Ch2R1MatrixInverse,
    "ch2_r2_matrix_transpose": Ch2R2MatrixTranspose,
    "ch2_r3_ax_eq_b": Ch2R3AxEqB,
    "ch3_r12_elem_row": Ch3R12ElemRow,
    "ch3_r13_elem_col": Ch3R13ElemCol,
}

# ─── FastAPI 应用 ──────────────────────────────────────────

app = FastAPI(title="线性代数学习系统", version="1.0.0")

CLIENT_DIR = Path(__file__).parent.parent / "client"


@app.get("/")
async def root():
    """返回主页面"""
    return FileResponse(CLIENT_DIR / "index.html")


# ─── 动态路由：根据注册表自动生成 API 端点 ─────────────────

@app.post("/api/scene/{scene_name}")
async def compute_scene(scene_name: str, request: Request):
    """
    通用场景计算端点。
    根据 scene_name 查找注册的场景类，调用其 compute 方法。
    返回统一格式: {success, data, error}
    """
    # 1. 查找场景
    scene_class = SCENE_REGISTRY.get(scene_name)
    if scene_class is None:
        return JSONResponse({
            "success": False,
            "error": f"未知场景: {scene_name}",
            "data": None
        }, status_code=404)

    # 2. 解析参数
    try:
        body = await request.json()
        params = SceneParams(**body) if body else SceneParams()
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": f"参数解析失败: {str(e)}",
            "data": None
        }, status_code=400)

    # 3. 场景级隔离：单个场景崩溃不影响其他
    try:
        scene = scene_class()
        result = scene.compute(params)

        # 确保返回值包含必要字段
        if "verification" not in result:
            result["verification"] = {"passed": True, "checks": []}

        return JSONResponse({
            "success": True,
            "data": result,
            "error": None
        })
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({
            "success": False,
            "error": f"场景计算失败: {str(e)}",
            "data": None
        }, status_code=500)


@app.get("/api/scenes")
async def list_scenes():
    """返回所有已注册场景的元信息"""
    scenes = []
    for name, cls in SCENE_REGISTRY.items():
        meta = cls.get_meta()
        meta["route"] = name
        scenes.append(meta)
    return JSONResponse({"success": True, "data": scenes, "error": None})


# ─── 静态文件 ──────────────────────────────────────────────

@app.get("/client/{file_path:path}")
async def serve_static(file_path: str):
    """提供前端静态文件"""
    full_path = CLIENT_DIR / file_path
    if full_path.exists() and full_path.is_file():
        return FileResponse(full_path)
    return JSONResponse({"error": "File not found"}, status_code=404)
