@echo off
title Linear Algebra - Starting...

echo ============================================
echo   Linear Algebra Interactive Learning System
echo   http://localhost:8765
echo ============================================
echo.

:: ── Clean up old server processes (three layers, most→least specific) ──
echo [*] Cleaning up old server processes...

set "PROJ_ROOT=%~dp0"
set "PID_FILE=%PROJ_ROOT%.server.pid"

:: Layer 1: Kill process from PID file (exact match, won't touch other projects)
if exist "%PID_FILE%" (
    for /f %%a in (%PID_FILE%) do (
        echo     Killing server from PID file (PID=%%a)
        taskkill /F /PID %%a >nul 2>&1
    )
    del "%PID_FILE%" >nul 2>&1
)

:: Layer 2: Kill anything on port 8765 (port-specific, unlikely to conflict)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765.*LISTENING" 2^>nul') do (
    echo     Killing process on port 8765 (PID=%%a)
    taskkill /F /PID %%a >nul 2>&1
)

:: Layer 3: Kill stray python processes whose command line contains THIS project path
:: Uses project directory as filter — much safer than matching "app.py" generically
set "PROJ_PATH=%PROJ_ROOT:\=\\%"
powershell -Command ^
    "$procs = Get-WmiObject Win32_Process -Filter \"name='python.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('%PROJ_ROOT%') }; ^
     if ($procs) { $procs | ForEach-Object { Write-Host \"    Killing stray python PID=$($_.ProcessId)\"; Stop-Process -Id $_.ProcessId -Force } }" 2>nul

timeout /t 2 /nobreak >nul

:: ── Find Python ──
:: Try conda run first (portable), then direct path (fallback), then system python (last resort)
set "PYTHON_EXE="

:: Method 1: conda run (works on any machine with conda on PATH)
where conda >nul 2>&1
if %errorlevel% equ 0 (
    echo [*] Using: conda run -n xianxingdaishu python
    set "USE_CONDA_RUN=1"
    goto :start_server
)

:: Method 2: Direct conda env path (user-specific fallback)
if exist "D:\Users\fkl\anaconda3\envs\xianxingdaishu\python.exe" (
    set "PYTHON_EXE=D:\Users\fkl\anaconda3\envs\xianxingdaishu\python.exe"
    echo [*] Python: %PYTHON_EXE%
    goto :start_server
)

:: Method 3: System python (last resort — may lack numpy/scipy)
where python >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%a in ('where python') do set "PYTHON_EXE=%%a"
    echo [!] Using system python: %PYTHON_EXE%
    echo [!] May lack dependencies — consider running setup.bat
    goto :start_server
)

echo [ERROR] Python not found. Please run setup.bat first.
pause
exit /b 1

:start_server
if not exist "%PROJ_ROOT%app.py" (
    echo [ERROR] app.py not found. Check working directory.
    pause
    exit /b 1
)

echo [*] Starting server...

:: Start server + capture PID for clean shutdown next time
if "%USE_CONDA_RUN%"=="1" (
    :: conda run approach — start via PowerShell to capture PID
    powershell -Command ^
        "$p = Start-Process -FilePath 'conda' -ArgumentList 'run','-n','xianxingdaishu','python','app.py' -WorkingDirectory '%PROJ_ROOT%' -WindowStyle Minimized -PassThru; ^
         $p.Id | Out-File -FilePath '%PID_FILE%' -Encoding ASCII -NoNewline"
) else (
    powershell -Command ^
        "$p = Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList 'app.py' -WorkingDirectory '%PROJ_ROOT%' -WindowStyle Minimized -PassThru; ^
         $p.Id | Out-File -FilePath '%PID_FILE%' -Encoding ASCII -NoNewline"
)

:: Wait for server to be ready (poll port 8765, up to 15 seconds)
echo [*] Waiting for server...
for /L %%i in (1,1,15) do (
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
