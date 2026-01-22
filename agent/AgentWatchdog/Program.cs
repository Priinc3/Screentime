using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Net.Http;
using System.Text.Json;

namespace AgentWatchdog;

class Program
{
    // Configuration
    private const string MainAgentProcessName = "RuntimeBroker_Helper";
    private const string MainAgentExePath = @"C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe";
    private const int CheckIntervalSeconds = 60;
    private const int ForceRestartIntervalMinutes = 60; // Force restart every hour
    private const int UpdateCheckIntervalHours = 2; // Check for updates every 2 hours
    
    private static DateTime _lastForceRestart = DateTime.MinValue;
    private static DateTime _lastUpdateCheck = DateTime.MinValue;
    private static readonly HttpClient _httpClient = new HttpClient();

    // Windows API for anti-suspension
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern uint SetThreadExecutionState(uint esFlags);

    private const uint ES_CONTINUOUS = 0x80000000;
    private const uint ES_SYSTEM_REQUIRED = 0x00000001;
    private const uint ES_AWAYMODE_REQUIRED = 0x00000040;

    static async Task Main(string[] args)
    {
        // Hide console window
        var handle = GetConsoleWindow();
        if (handle != IntPtr.Zero)
        {
            ShowWindow(handle, SW_HIDE);
        }

        // Set our own priority high
        try
        {
            Process.GetCurrentProcess().PriorityClass = ProcessPriorityClass.High;
        }
        catch { }

        Log($"Watchdog v1.1.1 started at {DateTime.Now}");
        Log($"Monitoring: {MainAgentProcessName}");
        Log($"Check interval: {CheckIntervalSeconds}s");
        Log($"Force restart interval: {ForceRestartIntervalMinutes}min");
        Log($"Update check interval: {UpdateCheckIntervalHours}h");

        _lastForceRestart = DateTime.Now;
        _lastUpdateCheck = DateTime.Now;

        // Main monitoring loop
        while (true)
        {
            try
            {
                // Keep watchdog itself from being suspended
                PreventSuspension();

                // Check for updates every 2 hours
                if ((DateTime.Now - _lastUpdateCheck).TotalHours >= UpdateCheckIntervalHours)
                {
                    await CheckForUpdates();
                    _lastUpdateCheck = DateTime.Now;
                }

                // Force restart every hour (prevents Windows suspension/blocking)
                if ((DateTime.Now - _lastForceRestart).TotalMinutes >= ForceRestartIntervalMinutes)
                {
                    Log($"Performing hourly force restart (prevents Windows suspension)...");
                    await ForceRestartAgent();
                    _lastForceRestart = DateTime.Now;
                }
                else
                {
                    // Normal check
                    await CheckAndRestartAgent();
                }
            }
            catch (Exception ex)
            {
                LogError($"Error in monitoring loop: {ex.Message}");
            }

            await Task.Delay(TimeSpan.FromSeconds(CheckIntervalSeconds));
        }
    }

    static async Task CheckAndRestartAgent()
    {
        var processes = Process.GetProcessesByName(MainAgentProcessName);
        
        if (processes.Length == 0)
        {
            Log($"Agent not running. Attempting to start...");
            await StartAgent();
        }
        else
        {
            // Check if the process is suspended/not responding
            foreach (var proc in processes)
            {
                try
                {
                    bool isSuspended = IsProcessSuspended(proc);
                    bool isResponding = proc.Responding;

                    if (isSuspended || !isResponding)
                    {
                        Log($"Agent appears suspended or not responding (PID: {proc.Id}, Suspended: {isSuspended}, Responding: {isResponding})");
                        
                        // Kill and restart
                        Log($"Killing suspended process...");
                        try
                        {
                            proc.Kill();
                            proc.WaitForExit(5000);
                        }
                        catch (Exception ex)
                        {
                            LogError($"Failed to kill process: {ex.Message}");
                        }

                        await Task.Delay(2000);
                        await StartAgent();
                    }
                }
                catch (Exception ex)
                {
                    Log($"Error checking process state: {ex.Message}");
                }
            }
        }

        // Cleanup process handles
        foreach (var p in processes)
        {
            try { p.Dispose(); } catch { }
        }
    }

    static async Task ForceRestartAgent()
    {
        Log("Force restart: Killing all agent processes...");
        
        var processes = Process.GetProcessesByName(MainAgentProcessName);
        foreach (var proc in processes)
        {
            try
            {
                Log($"Killing PID {proc.Id}...");
                proc.Kill();
                proc.WaitForExit(5000);
            }
            catch (Exception ex)
            {
                LogError($"Failed to kill PID {proc.Id}: {ex.Message}");
            }
            finally
            {
                try { proc.Dispose(); } catch { }
            }
        }

        // Extra cleanup with taskkill
        try
        {
            var psi = new ProcessStartInfo("taskkill", $"/F /IM {MainAgentProcessName}.exe")
            {
                UseShellExecute = false,
                CreateNoWindow = true
            };
            Process.Start(psi)?.WaitForExit(3000);
        }
        catch { }

        await Task.Delay(3000);
        await StartAgent();
        
        Log("Force restart complete with new PID.");
    }

    static bool IsProcessSuspended(Process process)
    {
        try
        {
            foreach (ProcessThread thread in process.Threads)
            {
                if (thread.ThreadState == System.Diagnostics.ThreadState.Wait &&
                    thread.WaitReason == ThreadWaitReason.Suspended)
                {
                    return true;
                }
            }

            try
            {
                var _ = process.TotalProcessorTime;
            }
            catch
            {
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    static async Task StartAgent()
    {
        if (!File.Exists(MainAgentExePath))
        {
            LogError($"Agent executable not found at: {MainAgentExePath}");
            return;
        }

        try
        {
            var psi = new ProcessStartInfo(MainAgentExePath)
            {
                UseShellExecute = true,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            
            var proc = Process.Start(psi);
            Log($"Agent process started (PID: {proc?.Id ?? 0})");
            
            // Wait and verify
            await Task.Delay(5000);
            var checkAgain = Process.GetProcessesByName(MainAgentProcessName);
            if (checkAgain.Length > 0)
            {
                Log($"Agent verified running (PID: {checkAgain[0].Id})");
                foreach (var p in checkAgain) { try { p.Dispose(); } catch { } }
            }
            else
            {
                LogError($"Agent failed to start. Check C:\\ProgramData\\EmployeeMonitor\\logs for errors.");
            }
        }
        catch (Exception ex)
        {
            LogError($"Failed to start agent: {ex.Message}");
        }
    }

    static async Task CheckForUpdates()
    {
        try
        {
            Log("Checking for agent updates...");
            
            var versionUrl = "https://raw.githubusercontent.com/Priinc3/Screentime/master/agent/version.json";
            var response = await _httpClient.GetStringAsync(versionUrl);
            var versionInfo = JsonSerializer.Deserialize<VersionInfo>(response);
            
            if (versionInfo?.version != null)
            {
                Log($"Remote version: {versionInfo.version}");
                // The agent will check and update itself on next restart
                // We just log that updates are available
            }
        }
        catch (Exception ex)
        {
            Log($"Update check failed: {ex.Message}");
        }
    }

    static void PreventSuspension()
    {
        try
        {
            SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED);
        }
        catch { }
    }

    static void Log(string message)
    {
        var logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
        Console.WriteLine(logMessage);
        
        try
        {
            var logDir = @"C:\ProgramData\EmployeeMonitor\logs";
            Directory.CreateDirectory(logDir);
            
            var logFile = Path.Combine(logDir, "watchdog.log");
            
            // Rotate log if too large (> 5MB)
            if (File.Exists(logFile) && new FileInfo(logFile).Length > 5 * 1024 * 1024)
            {
                var backupFile = Path.Combine(logDir, "watchdog.log.old");
                if (File.Exists(backupFile)) File.Delete(backupFile);
                File.Move(logFile, backupFile);
            }
            
            File.AppendAllText(logFile, logMessage + Environment.NewLine);
        }
        catch { }
    }

    static void LogError(string message)
    {
        Log($"ERROR: {message}");
    }

    [DllImport("kernel32.dll")]
    static extern IntPtr GetConsoleWindow();

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    const int SW_HIDE = 0;
}

class VersionInfo
{
    public string? version { get; set; }
}
