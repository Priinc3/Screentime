@echo off
REM ============================================
REM Windows Employee Monitor - SOURCE CODE VERSION
REM Requires .NET 8 SDK (will auto-install if missing)
REM ============================================

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ==========================================
echo    Employee Monitor - Source Install
echo         (Running as Administrator)
echo ==========================================
echo.

REM Check if .NET SDK is installed
dotnet --version >nul 2>&1
if %errorLevel% neq 0 (
    echo .NET SDK not found! Installing automatically...
    echo.
    echo Downloading .NET 8 SDK installer...
    
    REM Download .NET 8 SDK installer using PowerShell
    powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile 'dotnet-install.ps1' }"
    
    if exist "dotnet-install.ps1" (
        echo Installing .NET 8 SDK (this may take a few minutes)...
        powershell -ExecutionPolicy Bypass -File dotnet-install.ps1 -Channel 8.0
        
        REM Add to PATH for current session
        set "PATH=%USERPROFILE%\.dotnet;%PATH%"
        setx PATH "%USERPROFILE%\.dotnet;%PATH%" >nul 2>&1
        
        del dotnet-install.ps1
        echo.
        echo .NET SDK installed successfully!
        echo Please RESTART this script for changes to take effect.
        pause
        exit /b
    ) else (
        echo Failed to download .NET installer.
        echo Please install manually from: https://dotnet.microsoft.com/download/dotnet/8.0
        pause
        exit /b 1
    )
)

echo .NET SDK found: 
dotnet --version
echo.

echo 1. Install Agent (Build + Setup)
echo 2. Uninstall Agent
echo 3. Check Status
echo 4. Build Only (no install)
echo 5. Exit
echo.
set /p choice="Select option (1-5): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
if "%choice%"=="3" goto status
if "%choice%"=="4" goto buildonly
if "%choice%"=="5" goto end
echo Invalid option
goto end

:install
echo.
echo Building from source code...
echo This may take 2-3 minutes on first run.
echo.
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish
if %errorLevel% neq 0 (
    echo Build failed!
    goto end
)
echo.
echo Build complete! Running installer...
publish\RuntimeBroker_Helper.exe --install
goto end

:uninstall
echo.
echo Running uninstaller...
if exist "publish\RuntimeBroker_Helper.exe" (
    publish\RuntimeBroker_Helper.exe --uninstall
) else if exist "C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe" (
    C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe --uninstall
) else (
    echo Removing from registry and killing process...
    reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RuntimeBroker_Helper" /f 2>nul
    taskkill /F /IM RuntimeBroker_Helper.exe 2>nul
    rmdir /s /q "C:\ProgramData\EmployeeMonitor" 2>nul
    echo Uninstall complete.
)
goto end

:status
echo.
echo Checking agent status...
tasklist /FI "IMAGENAME eq RuntimeBroker_Helper.exe" 2>NUL | find /I "RuntimeBroker_Helper.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [RUNNING] Agent is currently running
) else (
    echo [STOPPED] Agent is NOT running
)
echo.
if exist "C:\ProgramData\EmployeeMonitor\config.json" (
    echo [OK] Config file exists
    type "C:\ProgramData\EmployeeMonitor\config.json"
) else (
    echo [NOT FOUND] Agent not installed
)
goto end

:buildonly
echo.
echo Building from source...
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish
if %errorLevel% equ 0 (
    echo Build complete! Executable at: publish\RuntimeBroker_Helper.exe
) else (
    echo Build failed!
)
goto end

:end
echo.
pause
