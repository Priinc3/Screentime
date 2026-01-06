using System.Diagnostics;
using System.Runtime.InteropServices;

namespace AgentWatchdog;

class Program
{
    // Configuration
    private const string MainAgentProcessName = "RuntimeBroker_Helper";
    private const string MainAgentExePath = @"C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe";
    private const int CheckIntervalSeconds = 60;

    static async Task Main(string[] args)
    {
        // Hide console window
        var handle = GetConsoleWindow();
        if (handle != IntPtr.Zero)
        {
            ShowWindow(handle, SW_HIDE);
        }

        Console.WriteLine($"[Watchdog] Started at {DateTime.Now}");
        Console.WriteLine($"[Watchdog] Monitoring: {MainAgentProcessName}");
        Console.WriteLine($"[Watchdog] Check interval: {CheckIntervalSeconds}s");

        // Main monitoring loop
        while (true)
        {
            try
            {
                await CheckAndRestartAgent();
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
            
            if (File.Exists(MainAgentExePath))
            {
                try
                {
                    var psi = new ProcessStartInfo(MainAgentExePath)
                    {
                        UseShellExecute = true,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    
                    Process.Start(psi);
                    Log($"Agent started successfully.");
                    
                    // Wait a moment and verify it started
                    await Task.Delay(3000);
                    var checkAgain = Process.GetProcessesByName(MainAgentProcessName);
                    if (checkAgain.Length > 0)
                    {
                        Log($"Agent verified running (PID: {checkAgain[0].Id})");
                    }
                    else
                    {
                        LogError($"Agent failed to start after launch attempt.");
                    }
                }
                catch (Exception ex)
                {
                    LogError($"Failed to start agent: {ex.Message}");
                }
            }
            else
            {
                LogError($"Agent executable not found at: {MainAgentExePath}");
            }
        }
        else
        {
            // Agent is running, all good
            // Uncomment below for verbose logging:
            // Log($"Agent running (PID: {processes[0].Id})");
        }

        // Cleanup process handles
        foreach (var p in processes)
        {
            p.Dispose();
        }
    }

    static void Log(string message)
    {
        var logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
        Console.WriteLine(logMessage);
        
        try
        {
            var logDir = @"C:\ProgramData\EmployeeMonitor\logs";
            Directory.CreateDirectory(logDir);
            File.AppendAllText(Path.Combine(logDir, "watchdog.log"), logMessage + Environment.NewLine);
        }
        catch { /* Ignore logging errors */ }
    }

    static void LogError(string message)
    {
        Log($"ERROR: {message}");
    }

    // P/Invoke for hiding console
    [DllImport("kernel32.dll")]
    static extern IntPtr GetConsoleWindow();

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    const int SW_HIDE = 0;
}
