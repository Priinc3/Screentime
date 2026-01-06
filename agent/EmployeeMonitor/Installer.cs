using System.Diagnostics;
using Microsoft.Win32;

namespace EmployeeMonitor;

public static class Installer
{
    // Use the actual process name (e.g., RuntimeBroker_Helper)
    private static string AppName => Path.GetFileNameWithoutExtension(Process.GetCurrentProcess().MainModule?.FileName) ?? "EmployeeMonitor";
    private static string InstallDir => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "EmployeeMonitor");
    private static string MainAgentExe => Path.Combine(InstallDir, "RuntimeBroker_Helper.exe");
    private static string WatchdogExe => Path.Combine(InstallDir, "AgentWatchdog.exe");

    public static void Install()
    {
        var currentExePath = Process.GetCurrentProcess().MainModule?.FileName;
        if (string.IsNullOrEmpty(currentExePath))
        {
            Console.WriteLine("Could not determine executable path.");
            return;
        }
        try
        {
            // 1. Create ProgramData Directory
            if (!Directory.Exists(InstallDir))
            {
                Directory.CreateDirectory(InstallDir);
                // Make it hidden
                File.SetAttributes(InstallDir, File.GetAttributes(InstallDir) | FileAttributes.Hidden);
            }

            // Create logs directory
            Directory.CreateDirectory(Path.Combine(InstallDir, "logs"));

            // 2. Copy Files
            var currentDir = AppDomain.CurrentDomain.BaseDirectory;
            var files = Directory.GetFiles(currentDir);
            foreach (var file in files)
            {
                var fileName = Path.GetFileName(file);
                var destFile = Path.Combine(InstallDir, fileName);
                File.Copy(file, destFile, true);
            }

            // 3. Add to Registry (HKLM for All Users) - as backup
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (key != null)
                    {
                        key.SetValue(AppName, MainAgentExe);
                        Console.WriteLine("Added to System Startup (Registry).");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Could not add to registry: {ex.Message}");
            }

            // 4. Create Task Scheduler tasks (MORE RELIABLE)
            CreateScheduledTask("EmployeeMonitorAgent", MainAgentExe, "Main monitoring agent");
            
            // 5. Install Watchdog if available
            if (File.Exists(WatchdogExe))
            {
                CreateScheduledTask("EmployeeMonitorWatchdog", WatchdogExe, "Agent health monitor");
                Console.WriteLine("Watchdog installed.");
            }
            else
            {
                Console.WriteLine("Note: Watchdog not found. Only main agent will be installed.");
            }

            Console.WriteLine("Installation complete!");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Install Error: {ex.Message}");
        }
    }

    private static void CreateScheduledTask(string taskName, string exePath, string description)
    {
        try
        {
            // Delete existing task first
            RunPowerShell($"Unregister-ScheduledTask -TaskName '{taskName}' -Confirm:$false -ErrorAction SilentlyContinue");

            // Create task that runs at logon AND repeats every 5 minutes
            var script = $@"
$action = New-ScheduledTaskAction -Execute '{exePath}'
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Hours 0)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName '{taskName}' -Action $action -Trigger $trigger1,$trigger2 -Settings $settings -Principal $principal -Description '{description}' -Force
";
            RunPowerShell(script);
            Console.WriteLine($"Created scheduled task: {taskName}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not create scheduled task '{taskName}': {ex.Message}");
        }
    }

    private static void RunPowerShell(string script)
    {
        var psi = new ProcessStartInfo("powershell.exe", $"-ExecutionPolicy Bypass -Command \"{script.Replace("\"", "\\\"").Replace("\n", " ")}\"")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        
        using var process = Process.Start(psi);
        process?.WaitForExit(30000);
    }

    public static void Uninstall()
    {
        try
        {
            // 1. Remove scheduled tasks
            RunPowerShell("Unregister-ScheduledTask -TaskName 'EmployeeMonitorAgent' -Confirm:$false -ErrorAction SilentlyContinue");
            RunPowerShell("Unregister-ScheduledTask -TaskName 'EmployeeMonitorWatchdog' -Confirm:$false -ErrorAction SilentlyContinue");
            Console.WriteLine("Removed scheduled tasks.");

            // 2. Remove from Registry
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true);
                key?.DeleteValue(AppName, false);
                
                using var keyLM = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                keyLM?.DeleteValue(AppName, false);
            }
            catch { }
            Console.WriteLine("Removed from startup registry.");

            // 3. Kill Processes
            foreach (var processName in new[] { "RuntimeBroker_Helper", "AgentWatchdog" })
            {
                foreach (var process in Process.GetProcessesByName(processName))
                {
                    try { process.Kill(); } catch { }
                }
            }
            Console.WriteLine("Stopped running processes.");

            // 4. Delete Directory
            if (Directory.Exists(InstallDir))
            {
                try 
                { 
                    Directory.Delete(InstallDir, true); 
                    Console.WriteLine("Removed installation directory.");
                } 
                catch 
                { 
                    Console.WriteLine($"Could not delete directory (files might be in use). Please delete manually: {InstallDir}"); 
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error during uninstall: {ex.Message}");
        }

        Console.WriteLine("Uninstallation complete.");
    }
}
