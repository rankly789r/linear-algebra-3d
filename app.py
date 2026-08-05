"""
线性代数交互式学习系统 — 启动入口

用法：python app.py
然后浏览器打开 http://localhost:8765
"""
import sys
import os

# 确保项目根目录在 Python 路径中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import uvicorn
    from server.main import app

    print("=" * 50)
    print("  线性代数交互式学习系统")
    print("  打开浏览器访问: http://localhost:8765")
    print("=" * 50)

    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
