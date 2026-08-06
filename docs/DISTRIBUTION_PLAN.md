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
| **A. 便携压缩包** | 150-250MB | 解压双击 .bat | GitHub Releases 免费 | **推荐** · 零依赖 |
| **B. Electron 桌面应用** | 250-400MB | 安装即用（无浏览器地址栏） | GitHub Releases 免费 | **推荐** · 原生体验 |
| **C. PyInstaller EXE** | 200-400MB | 双击运行 | GitHub Releases 免费 | 单文件需求 |
| **D. Docker 镜像** | ~500MB | 需装 Docker | Docker Hub / ghcr.io | 技术用户 |
| **E. 网页部署** | 0 客户端 | 浏览器访问 | 需服务器 | 最大覆盖面 |

## 三、推荐方案：A + B 双版本发布

提供两种发布形态，覆盖不同场景：

### 方案 A：便携压缩包（conda-pack）—— 零依赖，解压即用

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

### 方案 B：Electron 桌面应用 —— 原生窗口，无浏览器地址栏

**原理**：用 Electron 套一个原生窗口，内嵌本地 Web 服务。用户看到的是标准桌面软件——有标题栏、菜单、托盘图标，没有浏览器地址栏和标签页。

**架构**：
```
Electron 主进程
├── spawn Python 后端（localhost:8765，隐藏窗口）
├── 创建 BrowserWindow → 加载 http://localhost:8765
└── 应用关闭时自动 kill Python 进程
```

**打包流程**：
```bash
# 1. 安装 electron-builder
npm install --save-dev electron electron-builder

# 2. 创建 electron/main.js（主进程入口）
#    - 启动 Python 后端
#    - 创建无边框/标准窗口
#    - 窗口关闭时清理子进程

# 3. 打包
npx electron-builder --win portable  # 便携版（单文件夹）
npx electron-builder --win nsis      # 安装包（setup.exe）
```

**优势**：
- 原生桌面体验：无地址栏、无浏览器 UI 干扰
- 窗口管理：最小化到托盘、记住窗口位置/大小
- 全屏独占：3D 场景可占满整个屏幕
- 分发灵活：便携版（绿色免安装）+ 安装版（setup.exe）两种形态
- 跨平台：同一套代码可出 Windows/Mac/Linux 三个版本

**局限**：
- 包体增加 ~150MB（Chromium 内核），总包体 250-400MB
- Mac 平台需 Apple 开发者签名（否则系统提示"无法验证开发者"）
- 需要额外维护 `electron/main.js` 生命周期管理代码

**目录结构（Electron 版发布包）**：
```
线性代数交互学习系统_v1.x_electron/
├── python/                  ← 便携 Python 环境
├── server/                  ← 后端
├── client/                  ← 前端
├── app.py                   ← FastAPI 入口
├── electron/
│   └── main.js              ← Electron 主进程
├── package.json             ← npm 依赖（electron）
└── 线性代数交互学习系统.exe  ← 双击启动（Electron 入口）
```

**与方案 A 的关系**：方案 A 的便携 Python 环境可以直接复用。Electron 版本 = 方案 A 的 Python 层 + Electron 壳。两个版本可以共用一个打包脚本，只是最后一步不同。

### 方案 C：PyInstaller 单文件 EXE（备用）

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

### 方案 D：Docker 镜像

> 略，适用于技术用户自部署。

### 方案 E：网页部署

> 略，需购买服务器，暂不推荐。

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
| 5 | 编写打包脚本 `scripts/pack.py` | ⭐⭐ | 待办 |
| 6 | 适配 start.bat 便携路径 | ⭐⭐ | 待办 |
| 7 | Electron 壳开发（main.js + electron-builder） | ⭐⭐ | 待办 |
| 8 | 创建 GitHub 仓库，配置 Releases | ⭐⭐ | 待办 |
| 9 | 准备 PyInstaller 备用方案 | ⭐ | 待办 |
| 10 | Mac/Linux 打包 | ⭐ | 远期 |
| 11 | 场景全部完工 | ⭐⭐⭐ | 进行中 |

## 七、不推荐的做法

- **网页部署（方案 E）**：需要服务器运维，后端 FastAPI 无法在静态托管（如 GitHub Pages）上运行；若未来场景全部完成且愿意租服务器，可再评估
