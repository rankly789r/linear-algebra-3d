@echo off
title Linear Algebra - Starting...

echo ============================================
echo   Linear Algebra Interactive Learning System
echo   http://localhost:8765
echo ============================================
echo.

:: -- Clean up old server on port 8765 --
echo [*] Cleaning up old server processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765.*LISTENING" 2^>nul') do (
    echo     Killing process on port 8765 (PID=%%a)
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: -- Find Python --
set "PYTHON_EXE="

:: Method 1: conda run (portable, works on any machine with conda on PATH)
where conda >nul 2>&1
if %errorlevel% equ 0 (
    echo [*] Using: conda run -n xianxingdaishu python
    set "USE_CONDA_RUN=1"
    goto :start_server
)

:: Method 2: Direct conda env path
if exist "D:\Users\fkl\anaconda3\envs\xianxingdaishu\python.exe" (
    set "PYTHON_EXE=D:\Users\fkl\anaconda3\envs\xianxingdaishu\python.exe"
    echo [*] Python: %PYTHON_EXE%
    goto :start_server
)

:: Method 3: System python (last resort)
where python >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%a in ('where python') do set "PYTHON_EXE=%%a"
    echo [!] Using system python: %PYTHON_EXE%
    echo [!] May lack dependencies -- consider running setup.bat
    goto :start_server
)

echo [ERROR] Python not found. Please run setup.bat first.
pause
exit /b 1

:start_server
set "PROJ_ROOT=%~dp0"
if not exist "%PROJ_ROOT%app.py" (
    echo [ERROR] app.py not found. Check working directory.
    pause
    exit /b 1
)

echo [*] Starting server...

if "%USE_CONDA_RUN%"=="1" (
    start /MIN "LinearAlgebra" conda run -n xianxingdaishu python "%PROJ_ROOT%app.py"
) else (
    start /MIN "LinearAlgebra" "%PYTHON_EXE%" "%PROJ_ROOT%app.py"
)

:: Wait for server to be ready (poll port 8765, up to 20 seconds)
echo [*] Waiting for server...
for /L %%i in (1,1,20) do (
    timeout /t 1 /nobreak >nul
    powershell -Command "try { $c = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 8765); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 goto :ready
)
echo [!] Server is slow to start, waiting 5 more seconds...
timeout /t 5 /nobreak >nul

:ready
echo [OK] Server is ready!

:: Open browser
start "" http://localhost:8765

echo.
echo ============================================
echo   Server running at http://localhost:8765
echo   Close the server window to stop.
echo ============================================
echo.
pause
