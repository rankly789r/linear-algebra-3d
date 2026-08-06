"""
场景基类 — 所有场景必须继承此类并实现 compute 方法。

每个场景文件只需关心：
1. get_meta() → 返回场景的名称、描述、参数定义
2. compute(params) → 接收参数，返回几何数据 + 验证结果

参数定义格式：
    {
        "param_name": {
            "label": "中文标签",
            "type": "float",       # "float" | "int" | "choice"
            "default": 1.0,
            "min": -5.0,           # float/int 类型需要
            "max": 5.0,
            "step": 0.1,           # float/int 类型需要
            "options": ["a","b"]   # choice 类型需要
        }
    }

预设格式：
    [
        {"label": "唯一解", "params": {"a1": 2, "b1": -1, ...}},
        ...
    ]
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SceneParams:
    """场景参数容器，支持点号访问和字典访问"""
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def to_dict(self) -> dict:
        return self.__dict__


class BaseScene:
    """所有场景的基类"""

    @staticmethod
    def get_meta() -> dict:
        """
        返回场景元信息，必须包含：
        - id: 唯一标识
        - title: 中文标题
        - description: 简短描述
        - chapter: 教材章节
        - params: 参数定义（供前端生成滑块）
        - presets: 预设参数组
        """
        raise NotImplementedError("子类必须实现 get_meta()")

    def compute(self, params: SceneParams) -> dict:
        """
        核心计算方法。接收用户参数，返回几何数据和验证结果。

        返回值必须包含:
        - scene_data: 前端渲染所需的几何数据
        - verification: {passed: bool, checks: [{label: str, passed: bool}]}
        - solution_info: {type: str, description: str}  解的类型的文字说明
        """
        raise NotImplementedError("子类必须实现 compute()")

    @staticmethod
    def make_verification(checks: List[Dict[str, Any]]) -> dict:
        """辅助方法：生成标准验证结构"""
        passed = all(c["passed"] for c in checks)
        return {
            "passed": passed,
            "checks": checks
        }


# ─── 参数工厂函数 ──────────────────────────────────────────

_SUBSCRIPTS = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
}


def _to_subscript(num: int) -> str:
    """将整数转换为 Unicode 下标字符串，如 12 → '₁₂'"""
    return ''.join(_SUBSCRIPTS[d] for d in str(num))


def matrix_params(
    prefix: str,
    rows: int,
    cols: int,
    defaults=None,
    min: float = -5.0,
    max: float = 5.0,
    step: float = 0.1,
) -> dict:
    """
    为 prefix 前缀的 rows×cols 矩阵生成参数字典。

    参数：
        prefix: 矩阵字母前缀，"a" → 参数名 a11, a12, ...
        rows: 行数
        cols: 列数
        defaults: 默认值，支持四种形式：
            - None: 全部默认 0.0
            - float/int: 全部使用该值
            - list[float]: 按行主序填充（一维列表）
            - list[list[float]]: 二维列表，defaults[r][c] 是第 r 行第 c 列的默认值
        min, max, step: 滑块的统一范围（所有元素共用）

    返回：
        dict，适合 ** 展开到 params 字典中
    """
    # 将 defaults 展平为一维列表
    flat = _flatten_defaults(defaults, rows, cols)

    params = {}
    for i in range(rows):
        for j in range(cols):
            key = f"{prefix}{i + 1}{j + 1}"
            params[key] = {
                "label": f"{prefix}{_to_subscript(i + 1)}{_to_subscript(j + 1)}",
                "type": "float",
                "default": round(flat[i * cols + j], 4),
                "min": min,
                "max": max,
                "step": step,
            }
    return params


def vector_params(
    prefix: str,
    size: int,
    defaults=None,
    min: float = -10.0,
    max: float = 10.0,
    step: float = 0.1,
) -> dict:
    """
    为 prefix 前缀的 size 维向量生成参数字典。

    参数：
        prefix: 向量字母前缀，"b" → 参数名 b1, b2, ...
        size: 向量维数
        defaults: 默认值（支持 None / float / list 三种形式）
        min, max, step: 滑块的统一范围

    返回：
        dict，适合 ** 展开到 params 字典中
    """
    flat = _flatten_defaults(defaults, size, 1)
    params = {}
    for i in range(size):
        key = f"{prefix}{i + 1}"
        params[key] = {
            "label": f"{prefix}{_to_subscript(i + 1)}",
            "type": "float",
            "default": round(flat[i], 4),
            "min": min,
            "max": max,
            "step": step,
        }
    return params


def _flatten_defaults(defaults, rows: int, cols: int) -> list:
    """将各种 defaults 形式展平为 rows*cols 长度的一维列表"""
    n = rows * cols
    if defaults is None:
        return [0.0] * n
    if isinstance(defaults, (int, float)):
        return [float(defaults)] * n
    if isinstance(defaults, list):
        if defaults and isinstance(defaults[0], list):
            # 二维列表：defaults[r][c]
            flat = []
            for r in range(rows):
                row = defaults[r] if r < len(defaults) else []
                for c in range(cols):
                    flat.append(float(row[c]) if c < len(row) else 0.0)
            return flat
        else:
            # 一维列表
            flat = [float(v) for v in defaults]
            while len(flat) < n:
                flat.append(0.0)
            return flat[:n]
    raise TypeError(f"defaults 类型不支持: {type(defaults)}")
