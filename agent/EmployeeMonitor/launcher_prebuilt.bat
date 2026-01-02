@echo off
REM ============================================
REM Windows Employee Monitor - PREBUILT VERSION
REM No .NET SDK required - instant install!
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
echo    Employee Monitor - Prebuilt Install
echo         (Running as Administrator)
echo ==========================================
echo.

REM Check if the prebuilt exe exists
if not exist "RuntimeBroker_Helper.exe" (
    echo ERROR: RuntimeBroker_Helper.exe not found!
    echo.
    echo This is the PREBUILT version. The exe should be in the same folder.
    echo If you have the SOURCE version, use launcher_source.bat instead.
    echo.
    pause
    exit /b 1
)

echo 1. Install Agent
echo 2. Uninstall Agent
echo 3. Check Status
echo 4. Run Agent Manually
echo 5. Exit
echo.
set /p choice="Select option (1-5): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
if "%choice%"=="3" goto status
if "%choice%"=="4" goto run
if "%choice%"=="5" goto end
echo Invalid option
goto end

:install
echo.
echo Installing agent...
RuntimeBroker_Helper.exe --install
goto end

:uninstall
echo.
echo Uninstalling agent...
RuntimeBroker_Helper.exe --uninstall
if %errorLevel% neq 0 (
    echo Forcing uninstall...
    reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RuntimeBroker_Helper" /f 2>nul
    taskkill /F /IM RuntimeBroker_Helper.exe 2>nul
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
if exist "C:\ProgramData\EmployeeMonitor\config.json" (
    echo [INSTALLED] Config found:
    type "C:\ProgramData\EmployeeMonitor\config.json"
) else (
    echo [NOT INSTALLED] Run Install first
)
goto end

:run
echo.
echo Starting agent manually...
start "" "RuntimeBroker_Helper.exe"
echo Agent started!
goto end

:end
echo.
pause
