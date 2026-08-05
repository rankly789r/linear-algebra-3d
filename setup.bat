@echo off
chcp 65001 >nul
echo ============================================
echo   线性代数交互式学习系统 - 环境安装
echo ============================================
echo.

:: 查找 conda 位置
set CONDA_CMD=
where conda >nul 2>&1
if %errorlevel% equ 0 (
    set CONDA_CMD=conda
) else if exist "D:\Users\fkl\anaconda3\Scripts\conda.exe" (
    set CONDA_CMD=D:\Users\fkl\anaconda3\Scripts\conda.exe
) else (
    echo [错误] 未找到 conda，请确认 Anaconda 的安装路径。
    pause
    exit /b 1
)

echo [1/3] 创建 conda 环境 xianxingdaishu（Python 3.11）...
call %CONDA_CMD% create -n xianxingdaishu python=3.11 -y
if %errorlevel% neq 0 (
    echo [错误] 环境创建失败
    pause
    exit /b 1
)

echo [2/3] 激活环境...
call %CONDA_CMD% activate xianxingdaishu

echo [3/3] 安装 Python 依赖...
pip install -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo ============================================
echo   安装完成！
echo   以后每次学习，双击 start.bat 即可启动。
echo ============================================
pause
