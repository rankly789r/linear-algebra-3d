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
