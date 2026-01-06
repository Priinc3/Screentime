using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;

namespace EmployeeMonitor;

public static class AutoUpdater
{
    private const string CurrentVersion = "1.0.0";
    private const string VersionCheckUrl = "https://raw.githubusercontent.com/Priinc3/Screentime/master/agent/version.json";
    private static readonly HttpClient _httpClient = new HttpClient();
    
    public static async Task<bool> CheckAndUpdateAsync()
    {
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
            
            Log($"Downloading update from: {versionInfo.download_url}");
            var bytes = await _httpClient.GetByteArrayAsync(versionInfo.download_url);
            await File.WriteAllBytesAsync(newExePath, bytes);
            
            Log($"Downloaded to: {newExePath}");
            
            // 4. Create update script that will replace the exe after we exit
            var updateScript = CreateUpdateScript(newExePath);
            
            // 5. Run the script and exit
            Log("Starting update process...");
            var psi = new ProcessStartInfo("cmd.exe", $"/c \"{updateScript}\"")
            {
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            Process.Start(psi);
            
            return true; // Signal to caller to exit
        }
        catch (Exception ex)
        {
            Log($"Update check failed: {ex.Message}");
            return false;
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
        var scriptPath = Path.Combine(Path.GetTempPath(), "update_agent.bat");
        
        var script = $@"@echo off
REM Wait for main process to exit
timeout /t 5 /nobreak > nul

REM Kill any remaining instances
taskkill /F /IM RuntimeBroker_Helper.exe 2>nul
taskkill /F /IM AgentWatchdog.exe 2>nul
timeout /t 2 /nobreak > nul

REM Backup old version
if exist ""{targetExe}"" (
    copy /Y ""{targetExe}"" ""{targetExe}.bak""
)

REM Copy new version
copy /Y ""{newExePath}"" ""{targetExe}""

REM Restart agent
start """" ""{targetExe}""

REM Restart watchdog
if exist ""{Path.Combine(installDir, "AgentWatchdog.exe")}"" (
    start """" ""{Path.Combine(installDir, "AgentWatchdog.exe")}""
)

REM Cleanup
del /F ""{newExePath}"" 2>nul
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
