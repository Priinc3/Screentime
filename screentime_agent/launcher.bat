@echo off
REM Screen Time Agent Launcher for Windows

cd /d "%~dp0"

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is required but not installed.
    pause
    exit /b 1
)

:menu
cls
echo ========================================
echo      Screen Time Agent - Launcher
echo ========================================
echo.
echo 1. Install / Setup
echo 2. Start Agent
echo 3. Check Status
echo 4. Configure Database
echo 5. Uninstall
echo 6. Exit
echo.
set /p choice="Select option [1-6]: "

if "%choice%"=="1" (
    python main.py --install
    pause
    goto menu
)
if "%choice%"=="2" (
    python main.py --verbose
    pause
    goto menu
)
if "%choice%"=="3" (
    python main.py --status
    pause
    goto menu
)
if "%choice%"=="4" (
    python main.py --config
    pause
    goto menu
)
if "%choice%"=="5" (
    python main.py --uninstall
    pause
    goto menu
)
if "%choice%"=="6" (
    exit /b 0
)

echo Invalid option
pause
goto menu
