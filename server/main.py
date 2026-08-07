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

from server.scenes.base import SceneParams
from server.ai_chat import ask_deepseek, build_system_prompt, build_note_system_prompt

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
from server.scenes.ch2_r4_cramer import Ch2R4Cramer
from server.scenes.ch3_r9_gaussian import Ch3R9Gaussian
from server.scenes.ch1_r3_permutation import Ch1R3Permutation
from server.scenes.ch1_r0_equation_to_plane import Ch1R0EquationToPlane
from server.scenes.ch3_r7b_col_space import Ch3R7BColSpace
from server.scenes.ch3_r6b_nullspace import Ch3R6BNullspace
from server.scenes.ch1_r4_cofactor import Ch1R4Cofactor

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
    "ch1_r3_permutation": Ch1R3Permutation,
    "ch1_r4_cofactor": Ch1R4Cofactor,
    "ch1_r0_equation_to_plane": Ch1R0EquationToPlane,
    "ch3_r7b_col_space": Ch3R7BColSpace,
    "ch3_r6b_nullspace": Ch3R6BNullspace,
    "ch2_r0_matrix_multiply": Ch2R0MatrixMultiply,
    "ch2_r1_matrix_inverse": Ch2R1MatrixInverse,
    "ch2_r2_matrix_transpose": Ch2R2MatrixTranspose,
    "ch2_r3_ax_eq_b": Ch2R3AxEqB,
    "ch2_r4_cramer": Ch2R4Cramer,
    "ch3_r12_elem_row": Ch3R12ElemRow,
    "ch3_r13_elem_col": Ch3R13ElemCol,
    "ch3_r9_gaussian": Ch3R9Gaussian,
}

# ─── FastAPI 应用 ──────────────────────────────────────────

app = FastAPI(title="线性代数学习系统", version="1.0.0")

CLIENT_DIR = Path(__file__).parent.parent / "client"


@app.get("/")
async def root():
    """返回主页面（开发阶段禁用缓存，确保每次刷新获取最新）"""
    headers = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
    }
    return FileResponse(CLIENT_DIR / "index.html", headers=headers)


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


# ─── AI 答疑端点 ──────────────────────────────────────────

@app.post("/api/chat/{scene_name}")
async def ai_chat(scene_name: str, request: Request):
    """
    AI 答疑端点。
    接收用户问题和当前场景参数，先执行场景计算获取数据，
    再将数据作为上下文发送给 DeepSeek AI 进行答疑。

    Body: {params: {...}, message: "...", history: [{role, content}, ...], api_key: "sk-..."}
    """
    # 1. 查找场景
    scene_class = SCENE_REGISTRY.get(scene_name)
    if scene_class is None:
        return JSONResponse({
            "success": False,
            "error": f"未知场景: {scene_name}",
        }, status_code=404)

    # 2. 解析请求体
    try:
        body = await request.json()
        params_dict = body.get("params", {})
        message = body.get("message", "").strip()
        history = body.get("history", [])
        api_key = body.get("api_key", "").strip() or None
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": f"请求解析失败: {str(e)}",
        }, status_code=400)

    if not message:
        return JSONResponse({
            "success": False,
            "error": "问题不能为空",
        }, status_code=400)

    if not api_key:
        return JSONResponse({
            "success": False,
            "error": "请先在设置中填入 DeepSeek API Key（可从 platform.deepseek.com 获取）",
        }, status_code=401)

    # 3. 执行场景计算获取当前数据
    try:
        params = SceneParams(**params_dict) if params_dict else SceneParams()
        scene = scene_class()
        result = scene.compute(params)
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": f"场景计算失败: {str(e)}",
        }, status_code=500)

    # 4. 构建 tool_context（数据源，由 AI 通过工具调用查询，不嵌入 system prompt）
    meta = scene_class.get_meta()
    scene_data = result.get("scene_data", {})
    tool_context = {
        "params_meta": {
            k: {
                "label": v.get("label", k),
                "type": v.get("type", "float"),
                "default": v.get("default"),
                "min": v.get("min"),
                "max": v.get("max"),
                "options": v.get("options"),
            }
            for k, v in meta.get("params", {}).items()
        },
        "params_current": params_dict,
        "matrices": scene_data.get("matrices", []),
        "solution_info": result.get("solution_info", {}),
        "verification": result.get("verification", {}),
    }

    system_prompt = build_system_prompt()

    # 5. 构建消息历史 + 当前问题
    messages = list(history) if history else []
    messages.append({"role": "user", "content": message})

    # 6. 调用 DeepSeek API（带工具调用循环）
    chat_result = await ask_deepseek(
        system_prompt, messages, api_key=api_key, tool_context=tool_context
    )

    if chat_result.get("success"):
        return JSONResponse({
            "success": True,
            "data": {
                "reply": chat_result["reply"],
                "tool_calls": chat_result.get("tool_calls"),
            },
        })
    else:
        return JSONResponse({
            "success": False,
            "error": chat_result.get("error", "AI 调用失败"),
        }, status_code=500)


@app.post("/api/notes/generate")
async def generate_note(request: Request):
    """
    AI 笔记生成端点。
    接收场景名、场景数据、聊天历史，调用 DeepSeek 生成结构化学习笔记。

    Body: {scene_name, params, scene_data, chat_history, api_key}
    """
    try:
        body = await request.json()
        scene_name = body.get("scene_name", "")
        scene_data = body.get("scene_data", {})
        chat_history = body.get("chat_history", [])
        api_key = body.get("api_key", "").strip() or None
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": f"请求解析失败: {str(e)}",
        }, status_code=400)

    if not api_key:
        return JSONResponse({
            "success": False,
            "error": "请先在设置中填入 DeepSeek API Key",
        }, status_code=401)

    # 附加场景元信息
    scene_data["_scene_title"] = scene_data.get("_scene_title", scene_name)
    scene_data["_scene_description"] = scene_data.get("_scene_description", "")

    system_prompt = build_note_system_prompt(scene_data, chat_history)

    result = await ask_deepseek(system_prompt, [
        {"role": "user", "content": "请根据以上信息生成学习笔记。"}
    ], api_key=api_key, max_tokens=4096)

    if result.get("success"):
        return JSONResponse({
            "success": True,
            "data": {"note": result["reply"]},
        })
    else:
        return JSONResponse({
            "success": False,
            "error": result.get("error", "AI 调用失败"),
        }, status_code=500)


# ─── 静态文件 ──────────────────────────────────────────────

@app.get("/client/{file_path:path}")
async def serve_static(file_path: str):
    """提供前端静态文件（JS/CSS 禁用缓存，开发阶段每次刷新获取最新）"""
    full_path = (CLIENT_DIR / file_path).resolve()
    # 防目录遍历：确保解析后的路径仍在 CLIENT_DIR 下
    if not str(full_path).startswith(str(CLIENT_DIR.resolve())):
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    if full_path.exists() and full_path.is_file():
        headers = {}
        if file_path.endswith(('.js', '.css', '.html')):
            headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            headers['Pragma'] = 'no-cache'
            headers['Expires'] = '0'
        return FileResponse(full_path, headers=headers if headers else None)
    return JSONResponse({"error": "File not found"}, status_code=404)
