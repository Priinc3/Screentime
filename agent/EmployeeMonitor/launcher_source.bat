@echo off
setlocal EnableDelayedExpansion

REM ============================================
REM Windows Employee Monitor - SOURCE CODE VERSION
REM Requires .NET 8 SDK (will auto-install if missing)
REM ============================================

REM ===== ADMIN CHECK =====
REM Check if running as admin
>nul 2>&1 net session
if %errorLevel% neq 0 (
    echo.
    echo ================================================
    echo    ADMINISTRATOR PRIVILEGES REQUIRED
    echo ================================================
    echo.
    echo This installer needs to run as Administrator.
    echo A UAC prompt will appear - please click "Yes".
    echo.
    echo If the window closes immediately after clicking Yes,
    echo right-click this file and select "Run as administrator"
    echo.
    pause
    
    REM Try to elevate - use a VBS script for more reliable elevation
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~f0", "", "%~dp0", "runas", 1 >> "%temp%\getadmin.vbs"
    cscript //nologo "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /b
)

REM ===== WE ARE ADMIN - START MAIN SCRIPT =====
cd /d "%~dp0"
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

cls
echo ==========================================
echo    Employee Monitor - Source Install
echo         (Running as Administrator)
echo ==========================================
echo.
echo Script Directory: %SCRIPT_DIR%
echo.

REM ===== CHECK .NET SDK =====
echo Checking for .NET SDK...
where dotnet >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [WARNING] .NET SDK not found in PATH!
    echo.
    echo Attempting to install .NET 8 SDK automatically...
    echo This may take a few minutes...
    echo.
    
    REM Download .NET 8 SDK installer using PowerShell
    powershell -ExecutionPolicy Bypass -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile 'dotnet-install.ps1' -ErrorAction Stop; Write-Host 'Download successful' } catch { Write-Host 'Download failed:' $_.Exception.Message; exit 1 } }"
    
    if exist "dotnet-install.ps1" (
        echo Installing .NET 8 SDK...
        powershell -ExecutionPolicy Bypass -File dotnet-install.ps1 -Channel 8.0
        
        REM Add to PATH for current session
        set "PATH=%USERPROFILE%\.dotnet;%PATH%"
        setx PATH "%USERPROFILE%\.dotnet;%PATH%" >nul 2>&1
        
        del dotnet-install.ps1 2>nul
        echo.
        echo .NET SDK installed successfully!
        echo.
        echo IMPORTANT: Please CLOSE this window and run the script again.
        echo.
        pause
        exit /b 0
    ) else (
        echo.
        echo [ERROR] Failed to download .NET installer.
        echo.
        echo Please install .NET 8 SDK manually from:
        echo https://dotnet.microsoft.com/download/dotnet/8.0
        echo.
        pause
        exit /b 1
    )
)

REM Show .NET version
echo .NET SDK found!
for /f "tokens=*" %%i in ('dotnet --version 2^>nul') do set "DOTNET_VER=%%i"
echo Version: %DOTNET_VER%
echo.

REM ===== MAIN MENU =====
:menu
echo ==========================================
echo              MAIN MENU
echo ==========================================
echo.
echo   1. Install Agent (Build + Setup)
echo   2. Uninstall Agent
echo   3. Check Status
echo   4. Build Only (no install)
echo   5. Exit
echo.
set /p choice="Select option (1-5): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
if "%choice%"=="3" goto status
if "%choice%"=="4" goto buildonly
if "%choice%"=="5" goto exit_script

echo.
echo [ERROR] Invalid option. Please enter 1-5.
echo.
goto menu

REM ===== INSTALL =====
:install
echo.
echo ==========================================
echo          BUILDING MAIN AGENT
echo ==========================================
echo.
echo This may take 2-3 minutes on first run...
echo.

cd /d "%SCRIPT_DIR%"
echo Building from: %CD%
echo.

dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish
if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Main agent build failed!
    echo.
    echo Possible causes:
    echo   - Missing source files
    echo   - .NET SDK not properly installed
    echo   - Build errors in code
    echo.
    pause
    goto menu
)

echo.
echo [OK] Main agent build successful!
echo.

REM Try to build watchdog
echo ==========================================
echo         BUILDING WATCHDOG
echo ==========================================
echo.

set "WATCHDOG_DIR=%SCRIPT_DIR%\..\AgentWatchdog"
if exist "%WATCHDOG_DIR%\AgentWatchdog.csproj" (
    echo Watchdog project found at: %WATCHDOG_DIR%
    echo.
    
    pushd "%WATCHDOG_DIR%"
    dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o "%SCRIPT_DIR%\publish"
    set "WATCHDOG_RESULT=%errorLevel%"
    popd
    
    if !WATCHDOG_RESULT! neq 0 (
        echo.
        echo [WARNING] Watchdog build failed!
        echo Continuing with main agent only...
        echo.
    ) else (
        echo.
        echo [OK] Watchdog build successful!
        echo.
    )
) else (
    echo [WARNING] Watchdog project not found at:
    echo %WATCHDOG_DIR%
    echo.
    echo Continuing with main agent only...
    echo.
)

REM Run installer
echo ==========================================
echo         RUNNING INSTALLER
echo ==========================================
echo.

cd /d "%SCRIPT_DIR%"
if exist "publish\RuntimeBroker_Helper.exe" (
    echo Starting installer...
    echo.
    publish\RuntimeBroker_Helper.exe --install
    echo.
    echo [OK] Installation command completed.
) else (
    echo [ERROR] RuntimeBroker_Helper.exe not found in publish folder!
    echo Build may have failed silently.
)

echo.
pause
goto menu

REM ===== UNINSTALL =====
:uninstall
echo.
echo ==========================================
echo           UNINSTALLING AGENT
echo ==========================================
echo.

cd /d "%SCRIPT_DIR%"

if exist "publish\RuntimeBroker_Helper.exe" (
    echo Using local uninstaller...
    publish\RuntimeBroker_Helper.exe --uninstall
) else if exist "C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe" (
    echo Using installed uninstaller...
    C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe --uninstall
) else (
    echo No installed agent found. Performing manual cleanup...
    echo.
    
    echo Removing scheduled tasks...
    schtasks /Delete /TN "EmployeeMonitorAgent" /F 2>nul
    schtasks /Delete /TN "EmployeeMonitorWatchdog" /F 2>nul
    
    echo Removing from registry...
    reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RuntimeBroker_Helper" /f 2>nul
    
    echo Killing processes...
    taskkill /F /IM RuntimeBroker_Helper.exe 2>nul
    taskkill /F /IM AgentWatchdog.exe 2>nul
    
    echo Removing files...
    rmdir /s /q "C:\ProgramData\EmployeeMonitor" 2>nul
    
    echo.
    echo [OK] Manual uninstall complete.
)

echo.
pause
goto menu

REM ===== STATUS =====
:status
echo.
echo ==========================================
echo              AGENT STATUS
echo ==========================================
echo.

echo --- Processes ---
tasklist /FI "IMAGENAME eq RuntimeBroker_Helper.exe" 2>NUL | find /I "RuntimeBroker_Helper.exe" >NUL
if %errorLevel%==0 (
    echo [RUNNING] Main agent is currently running
) else (
    echo [STOPPED] Main agent is NOT running
)

tasklist /FI "IMAGENAME eq AgentWatchdog.exe" 2>NUL | find /I "AgentWatchdog.exe" >NUL
if %errorLevel%==0 (
    echo [RUNNING] Watchdog is currently running
) else (
    echo [STOPPED] Watchdog is NOT running
)

echo.
echo --- Scheduled Tasks ---
schtasks /query /TN "EmployeeMonitorAgent" >NUL 2>&1
if %errorLevel%==0 (
    echo [OK] Main agent scheduled task exists
) else (
    echo [MISSING] Main agent scheduled task NOT found
)

schtasks /query /TN "EmployeeMonitorWatchdog" >NUL 2>&1
if %errorLevel%==0 (
    echo [OK] Watchdog scheduled task exists
) else (
    echo [MISSING] Watchdog scheduled task NOT found
)

echo.
echo --- Installation ---
if exist "C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe" (
    echo [OK] Agent installed at C:\ProgramData\EmployeeMonitor
) else (
    echo [MISSING] Agent not installed
)

if exist "C:\ProgramData\EmployeeMonitor\config.json" (
    echo [OK] Config file exists
    echo.
    echo Config contents:
    type "C:\ProgramData\EmployeeMonitor\config.json"
    echo.
) else (
    echo [MISSING] Config file not found
)

echo.
pause
goto menu

REM ===== BUILD ONLY =====
:buildonly
echo.
echo ==========================================
echo          BUILD ONLY MODE
echo ==========================================
echo.

cd /d "%SCRIPT_DIR%"

echo Building main agent...
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish
if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Main agent build failed!
    pause
    goto menu
)
echo [OK] Main agent: publish\RuntimeBroker_Helper.exe

echo.
set "WATCHDOG_DIR=%SCRIPT_DIR%\..\AgentWatchdog"
if exist "%WATCHDOG_DIR%\AgentWatchdog.csproj" (
    echo Building watchdog...
    pushd "%WATCHDOG_DIR%"
    dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o "%SCRIPT_DIR%\publish"
    set "WATCHDOG_RESULT=%errorLevel%"
    popd
    
    if !WATCHDOG_RESULT! neq 0 (
        echo [ERROR] Watchdog build failed!
    ) else (
        echo [OK] Watchdog: publish\AgentWatchdog.exe
    )
) else (
    echo [WARNING] Watchdog project not found
)

echo.
echo ==========================================
echo          BUILD COMPLETE
echo ==========================================
echo.
echo Output folder: %SCRIPT_DIR%\publish
echo.
dir /b "%SCRIPT_DIR%\publish\*.exe" 2>nul
echo.

pause
goto menu

REM ===== EXIT =====
:exit_script
echo.
echo Goodbye!
echo.
endlocal
exit /b 0
