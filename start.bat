@echo off
title Linear Algebra - Starting...

echo ============================================
echo   Linear Algebra Interactive Learning System
echo ============================================
echo.

:: -- Clean up old server on port 8765 --
echo [1/3] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765.*LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: -- Find Python --
set "PYTHON_EXE="

where conda >nul 2>&1
if %errorlevel% equ 0 (
    echo [2/3] Python: conda run -n xianxingdaishu
    set "USE_CONDA_RUN=1"
    goto :start_server
)

if exist "D:\Users\fkl\anaconda3\envs\xianxingdaishu\python.exe" (
    set "PYTHON_EXE=D:\Users\fkl\anaconda3\envs\xianxingdaishu\python.exe"
    echo [2/3] Python: %PYTHON_EXE%
    goto :start_server
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%a in ('where python') do set "PYTHON_EXE=%%a"
    echo [2/3] Python: %PYTHON_EXE%
    goto :start_server
)

echo [ERROR] Python not found. Run setup.bat first.
pause
exit /b 1

:start_server
set "PROJ_ROOT=%~dp0"
if not exist "%PROJ_ROOT%app.py" (
    echo [ERROR] app.py not found.
    pause
    exit /b 1
)

echo [3/3] Starting server...
if "%USE_CONDA_RUN%"=="1" (
    start /MIN "LinearAlgebra" conda run -n xianxingdaishu python "%PROJ_ROOT%app.py"
) else (
    start /MIN "LinearAlgebra" "%PYTHON_EXE%" "%PROJ_ROOT%app.py"
)

:: Wait for server
for /L %%i in (1,1,20) do (
    timeout /t 1 /nobreak >nul
    powershell -Command "try { $c = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 8765); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 goto :ready
)
timeout /t 5 /nobreak >nul

:ready
echo [OK] Server ready!

:: Start cpolar
if exist "D:\Program Files (x86)\cpolar\cpolar.exe" (
    echo [*] Starting cpolar tunnel...
    start "cpolar" "D:\Program Files (x86)\cpolar\cpolar.exe" http 8765
)

:: Open browser
start "" http://localhost:8765

echo.
echo ============================================
echo   Local:   http://localhost:8765
echo   Tablet:  see cpolar window for URL
echo.
echo   Close this window to stop all services.
echo ============================================
echo.
pause
