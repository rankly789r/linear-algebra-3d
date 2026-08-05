@echo off
chcp 65001 >nul
title 线性代数学习系统 — 启动中...

echo ============================================
echo   线性代数交互式学习系统
echo ============================================
echo.

:: 查找 Python 可执行文件
set PYTHON_EXE=D:\Users\fkl\anaconda3\envs\xianxingdaishu\python.exe
set PYTHON_EXE_FALLBACK=D:\Users\fkl\anaconda3\python.exe

if exist "%PYTHON_EXE%" (
    echo [✓] Python 环境: xianxingdaishu
    goto :found_python
)

if exist "%PYTHON_EXE_FALLBACK%" (
    echo [!] 未找到 xianxingdaishu 环境，使用 base 环境
    set PYTHON_EXE=%PYTHON_EXE_FALLBACK%
    goto :found_python
)

:: 尝试在 PATH 中找 python
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] 使用 PATH 中的 Python
    set PYTHON_EXE=python
    goto :found_python
)

echo [✗] 未找到 Python！请先运行 setup.bat 安装环境。
echo.
pause
exit /b 1

:found_python
echo [✓] Python: %PYTHON_EXE%
echo.

:: 检查 app.py 是否存在
if not exist "%~dp0app.py" (
    echo [✗] 未找到 app.py，请检查工作目录。
    pause
    exit /b 1
)

echo [→] 正在启动服务器 http://localhost:8765 ...
echo.
echo     提示：在 VSCode 中按 Ctrl+Shift+P
echo     输入 Simple Browser: Show 然后输入
echo     http://localhost:8765 即可在 VSCode 内浏览
echo.

:: 启动服务器（新窗口，可见，方便查看日志和关闭）
start "线性代数 — 服务器 (关闭此窗口停止服务)" /MIN cmd /c "cd /d "%~dp0" && "%PYTHON_EXE%" app.py"

:: 等待服务器就绪（轮询端口，最多等 10 秒）
echo [→] 等待服务器就绪...
set TRIES=0
:wait_loop
timeout /t 1 /nobreak >nul
set /a TRIES+=1

:: 用 PowerShell 检测端口是否在监听
powershell -Command "try { $c = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 8765); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] 服务器已就绪！
    goto :open_browser
)

if %TRIES% lss 10 goto :wait_loop

echo [!] 服务器启动较慢，继续等待...
timeout /t 5 /nobreak >nul

:open_browser
:: 尝试用 VSCode 内置浏览器打开（如果安装了 VSCode）
where code >nul 2>&1
if %errorlevel% equ 0 (
    echo [→] 尝试在 VSCode 内置浏览器中打开...
    :: VSCode 的 Simple Browser 通过命令面板打开，这里用默认浏览器作为后备
)

:: 用默认浏览器打开
start "" http://localhost:8765

echo.
echo ============================================
echo   系统已启动！
echo   浏览器: http://localhost:8765
echo   停止服务: 关闭 "线性代数 — 服务器" 窗口
echo ============================================
echo.
pause
