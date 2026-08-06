# 分发与打包方案

> 状态：方案探讨阶段，尚未执行。待场景全部完工后再实施。

## 一、当前约束

- 后端依赖 Python 3.11 + NumPy + SciPy + FastAPI + httpx + uvicorn
- 前端纯静态文件（Three.js 本地化，KaTeX CDN）
- 通过 `conda` 管理环境，环境名为 `xianxingdaishu`
- 端口 `8765`，`start.bat` 启动

## 二、备选方案对比

| 方案 | 包体 | 用户门槛 | 分发成本 | 适用场景 |
|------|------|----------|----------|----------|
| **A. 便携压缩包** | 150-250MB | 解压双击 .bat | GitHub Releases 免费 | 推荐 |
| **B. PyInstaller EXE** | 200-400MB | 双击运行 | GitHub Releases 免费 | 单文件需求 |
| **C. Docker 镜像** | ~500MB | 需装 Docker | Docker Hub / ghcr.io | 技术用户 |
| **D. 网页部署** | 0 客户端 | 浏览器访问 | 需服务器 | 最大覆盖面 |
| **E. Electron 桌面应用** | ~300MB | 安装即用 | GitHub Releases | 原生体验 |

## 三、推荐方案：A + 备选 B

### 方案 A：便携压缩包（conda-pack）

**原理**：`conda-pack` 把整个 conda 环境打包成一个可移植目录，解压后无需安装任何东西。

**打包流程**：
```bash
# 1. 安装 conda-pack
conda install -c conda-forge conda-pack

# 2. 打包环境
conda pack -n xianxingdaishu -o python_env.tar.gz

# 3. 组装发布包
mkdir dist/线性代数交互学习系统_v1.x/
tar -xzf python_env.tar.gz -C dist/线性代数交互学习系统_v1.x/python/
cp -r server/ client/ app.py start.bat dist/线性代数交互学习系统_v1.x/
```

**目录结构（发布包）**：
```
线性代数交互学习系统_v1.x/
├── python/              ← 便携 Python 环境（conda-pack 解压产物）
├── server/              ← 后端
├── client/              ← 前端
├── app.py               ← 入口
├── start.bat            ← 启动脚本（适配便携 Python 路径）
└── 使用说明.txt          ← 用户文档
```

**start.bat 适配**：便携版不再依赖 conda，直接调用 `python\python.exe`：
```batch
set "PYTHON_EXE=%~dp0python\python.exe"
"%PYTHON_EXE%" "%~dp0app.py"
```

**优势**：
- 用户零依赖：不需要装 Python、Conda、任何包
- 包体可控：SciPy/NumPy 是主要体积来源，约 150-200MB
- 跨机器：同 OS 架构（Windows x64）下可移植
- 分发简单：一个 zip 文件，走 GitHub Releases

**局限**：
- 仅限同 OS（Windows），Mac/Linux 需单独打包
- 首次启动需等待 Python 环境初始化（几秒）
- zip 解压比较慢

### 方案 B：PyInstaller 单文件 EXE

**原理**：PyInstaller 把 Python 解释器 + 所有依赖 + 静态文件打成一个 exe。

**命令**：
```bash
pyinstaller --onefile --add-data "client:client" app.py
```

**优势**：
- 一个文件，用户体验最好
- `--onefile` 模式支持图标嵌入

**局限**：
- 启动慢：每次运行都要解压到临时目录（3-10 秒）
- 杀毒软件误报率高（PyInstaller 签名问题）
- 包体更大：包含完整 Python 运行时
- 前端文件路径需要适配（`sys._MEIPASS`）

## 四、开源策略（GitHub）

### README 结构建议
```
# 线性代数交互式学习系统

[GIF: 3D 场景动图 2-3 张]

## 这是什么
一句话说明 + 适用人群

## 快速开始
### 方式1: 下载即用（推荐）
下载 Releases 中的 zip，解压，双击 start.bat

### 方式2: 从源码运行
git clone + conda env create + python app.py

## 场景列表
24 个场景表格

## 技术栈
Python/NumPy/Three.js

## 贡献指南
```

### 需要补充的材料
- [ ] 2-3 张 GIF 动图（录屏几个核心场景）
- [ ] 英文 README（`README.md` 中文在前，`README_EN.md` 英文在後）
- [ ] 中英双语场景截图

## 五、KaTeX CDN 离线化

当前 KaTeX 走 unpkg CDN，离线环境无法使用。

**方案**：
```bash
# 下载 KaTeX 到本地
npm install katex@0.16.11
cp -r node_modules/katex/dist client/js/vendor/katex/
```

然后在 `index.html` 中把 CDN 引用改为本地路径。Three.js 已经是本地化的，改完 KaTeX 后整个项目可完全离线运行。

## 六、执行清单

| 序号 | 任务 | 优先级 | 状态 |
|------|------|--------|------|
| 1 | KaTeX 本地化（去 CDN） | ⭐⭐⭐ | 待办 |
| 2 | 编写 README.md（中英双语 + 截图位） | ⭐⭐⭐ | 待办 |
| 3 | 录屏核心场景 GIF | ⭐⭐⭐ | 待办 |
| 4 | 安装 conda-pack，测试打包 | ⭐⭐ | 待办 |
| 5 | 编写打包脚本 `scripts/pack.sh` | ⭐⭐ | 待办 |
| 6 | 适配 start.bat 便携路径 | ⭐⭐ | 待办 |
| 7 | 创建 GitHub 仓库，配置 Releases | ⭐⭐ | 待办 |
| 8 | 准备 PyInstaller 备用方案 | ⭐ | 待办 |
| 9 | Mac/Linux 打包 | ⭐ | 远期 |
| 10 | 场景全部完工 | ⭐⭐⭐ | 进行中 |

## 七、不推荐的做法

- **网页部署（方案 D）**：需要服务器运维，不适合个人项目；KaTeX CDN + Three.js 本地化后静态资源虽可托管在 GitHub Pages，但后端 FastAPI 无法在静态托管上运行
- **完全内嵌浏览器**：包体失控（CEF/WebView2 ~150MB 仅浏览器部分）
