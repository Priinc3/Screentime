using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;

namespace EmployeeMonitor;

public static class AutoUpdater
{
    // IMPORTANT: Update this when releasing new versions!
    private const string CurrentVersion = "1.1.3";
    private const string VersionCheckUrl = "https://raw.githubusercontent.com/Priinc3/Screentime/master/agent/version.json";
    private static readonly HttpClient _httpClient = new HttpClient() { Timeout = TimeSpan.FromMinutes(5) };
    
    // Prevent multiple simultaneous update attempts
    private static bool _isUpdating = false;
    
    public static async Task<bool> CheckAndUpdateAsync()
    {
        // Prevent re-entry
        if (_isUpdating)
        {
            Log("Update already in progress, skipping...");
            return false;
        }
        
        _isUpdating = true;
        
        try
        {
            Log("Checking for updates...");
            
            // 1. Fetch version info from GitHub
            var response = await _httpClient.GetStringAsync(VersionCheckUrl);
            var versionInfo = JsonSerializer.Deserialize<VersionInfo>(response);
            
            if (versionInfo == null || string.IsNullOrEmpty(versionInfo.version))
            {
                Log("Could not parse version info.");
                return false;
            }
            
            Log($"Current version: {CurrentVersion}, Remote version: {versionInfo.version}");
            
            // 2. Compare versions
            if (!IsNewerVersion(versionInfo.version, CurrentVersion))
            {
                Log("Already at latest version.");
                return false;
            }
            
            Log($"New version available: {versionInfo.version}");
            
            // 3. Download new version
            if (string.IsNullOrEmpty(versionInfo.download_url))
            {
                Log("No download URL provided.");
                return false;
            }
            
            var tempDir = Path.Combine(Path.GetTempPath(), "EmployeeMonitorUpdate");
            Directory.CreateDirectory(tempDir);
            
            var newExePath = Path.Combine(tempDir, "RuntimeBroker_Helper_new.exe");
            
            // Delete old temp file if exists
            if (File.Exists(newExePath))
            {
                try { File.Delete(newExePath); } catch { }
            }
            
            Log($"Downloading update from: {versionInfo.download_url}");
            var bytes = await _httpClient.GetByteArrayAsync(versionInfo.download_url);
            await File.WriteAllBytesAsync(newExePath, bytes);
            
            // Verify download
            if (!File.Exists(newExePath) || new FileInfo(newExePath).Length < 1000000) // Should be > 1MB
            {
                Log("Downloaded file seems invalid or too small.");
                return false;
            }
            
            Log($"Downloaded to: {newExePath} ({new FileInfo(newExePath).Length / 1024 / 1024}MB)");
            
            // 4. Create update script that will replace the exe after we exit
            var updateScript = CreateUpdateScript(newExePath);
            Log($"Created update script: {updateScript}");
            
            // 5. Run the script and exit
            Log("Starting update process...");
            var psi = new ProcessStartInfo("cmd.exe", $"/c \"{updateScript}\"")
            {
                CreateNoWindow = true,
                UseShellExecute = true, // UseShellExecute=true so it runs independently
                WindowStyle = ProcessWindowStyle.Hidden
            };
            Process.Start(psi);
            
            Log("Update script launched. Exiting for update...");
            
            // Give the script a moment to start
            await Task.Delay(1000);
            
            return true; // Signal to caller to exit
        }
        catch (Exception ex)
        {
            Log($"Update check failed: {ex.Message}");
            return false;
        }
        finally
        {
            _isUpdating = false;
        }
    }
    
    private static bool IsNewerVersion(string remote, string current)
    {
        try
        {
            var remoteVersion = Version.Parse(remote);
            var currentVersion = Version.Parse(current);
            return remoteVersion > currentVersion;
        }
        catch
        {
            return false;
        }
    }
    
    private static string CreateUpdateScript(string newExePath)
    {
        var installDir = @"C:\ProgramData\EmployeeMonitor";
        var targetExe = Path.Combine(installDir, "RuntimeBroker_Helper.exe");
        var watchdogExe = Path.Combine(installDir, "AgentWatchdog.exe");
        var scriptPath = Path.Combine(Path.GetTempPath(), "update_agent.bat");
        var logFile = Path.Combine(installDir, "logs", "update_script.log");
        
        // Use simple batch file syntax without complex quoting
        var script = $@"@echo off
echo [%date% %time%] Update script started >> ""{logFile}""

echo Waiting for processes to exit...
timeout /t 10 /nobreak > nul

echo Killing processes... >> ""{logFile}""
taskkill /F /IM RuntimeBroker_Helper.exe 2>nul
taskkill /F /IM AgentWatchdog.exe 2>nul

echo Waiting after kill... >> ""{logFile}""
timeout /t 5 /nobreak > nul

echo Backing up old version... >> ""{logFile}""
if exist ""{targetExe}"" (
    copy /Y ""{targetExe}"" ""{targetExe}.bak"" > nul 2>&1
)

echo Copying new version... >> ""{logFile}""
copy /Y ""{newExePath}"" ""{targetExe}"" > nul 2>&1
if errorlevel 1 (
    echo COPY FAILED, retrying... >> ""{logFile}""
    timeout /t 5 /nobreak > nul
    taskkill /F /IM RuntimeBroker_Helper.exe 2>nul
    timeout /t 3 /nobreak > nul
    copy /Y ""{newExePath}"" ""{targetExe}"" > nul 2>&1
)

echo Verifying copy... >> ""{logFile}""
if not exist ""{targetExe}"" (
    echo ERROR: Target exe does not exist after copy! >> ""{logFile}""
    goto :end
)

echo Starting new agent... >> ""{logFile}""
start """" ""{targetExe}""
timeout /t 3 /nobreak > nul

echo Starting watchdog... >> ""{logFile}""
if exist ""{watchdogExe}"" (
    start """" ""{watchdogExe}""
)

echo Cleanup... >> ""{logFile}""
del /F ""{newExePath}"" 2>nul

echo [%date% %time%] Update complete! >> ""{logFile}""

:end
del /F ""%~f0"" 2>nul
";
        
        File.WriteAllText(scriptPath, script);
        return scriptPath;
    }
    
    private static void Log(string message)
    {
        try
        {
            var logDir = @"C:\ProgramData\EmployeeMonitor\logs";
            Directory.CreateDirectory(logDir);
            var logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [AutoUpdater] {message}";
            File.AppendAllText(Path.Combine(logDir, "updater.log"), logMessage + Environment.NewLine);
        }
        catch { }
    }
}

public class VersionInfo
{
    public string? version { get; set; }
    public string? download_url { get; set; }
}
