@echo off
REM Build script for Screen Time Agent (Windows)
REM Creates a standalone .exe file

echo ========================================
echo   Screen Time Agent - Windows Build
echo ========================================
echo.

cd /d "%~dp0"

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check for virtual environment
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -q -r requirements.txt
pip install -q pyinstaller

REM Clean previous builds
echo Cleaning previous builds...
if exist "build" rmdir /s /q build
if exist "dist" rmdir /s /q dist

REM Build the exe
echo Building application...
python -m PyInstaller screentime_agent.spec --noconfirm

REM Check if build succeeded
if exist "dist\ScreenTimeAgent.exe" (
    echo.
    echo ========================================
    echo   Build Successful!
    echo ========================================
    echo.
    echo Output: dist\ScreenTimeAgent.exe
    echo.
    echo To install:
    echo   1. Copy ScreenTimeAgent.exe to any folder
    echo   2. Double-click to run
    echo   3. Follow the setup wizard
    echo.
) else (
    echo.
    echo Build failed! Check logs above.
    pause
    exit /b 1
)

echo.
echo Done!
pause
