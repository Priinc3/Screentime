using System.Diagnostics;
using Microsoft.Win32;

namespace EmployeeMonitor;

public static class Installer
{
    // Use the actual process name (e.g., RuntimeBroker_Helper)
    private static string AppName => Path.GetFileNameWithoutExtension(Process.GetCurrentProcess().MainModule?.FileName) ?? "EmployeeMonitor";
    private static string InstallDir => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "EmployeeMonitor");

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

            // 2. Copy Files
            var currentDir = AppDomain.CurrentDomain.BaseDirectory;
            var files = Directory.GetFiles(currentDir);
            foreach (var file in files)
            {
                var fileName = Path.GetFileName(file);
                var destFile = Path.Combine(InstallDir, fileName);
                File.Copy(file, destFile, true);
            }

            // 3. Add to Registry (HKLM for All Users)
            // Note: This requires Admin privileges!
            using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true))
            {
                if (key != null)
                {
                    key.SetValue(AppName, Path.Combine(InstallDir, "RuntimeBroker_Helper.exe"));
                    Console.WriteLine("Added to System Startup (HKLM).");
                }
                else
                {
                    Console.WriteLine("Error: Could not open HKLM Run key. Run as Administrator.");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Install Error: {ex.Message}");
        }
    }

    public static void Uninstall()
    {
        try
        {
            // 1. Remove from Registry
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true);
            if (key != null)
            {
                key.DeleteValue(AppName, false);
                Console.WriteLine("Removed from startup registry key.");
            }

            // 2. Kill Process (if running)
            foreach (var process in Process.GetProcessesByName(AppName))
            {
                try { process.Kill(); } catch { }
            }

            // 3. Delete Directory (Optional - might fail if in use, but we try)
            var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            var targetDir = Path.Combine(programData, AppName);
            if (Directory.Exists(targetDir))
            {
                try 
                { 
                    Directory.Delete(targetDir, true); 
                    Console.WriteLine("Hidden directory removed.");
                } 
                catch 
                { 
                    Console.WriteLine("Could not delete directory (files might be in use). Please delete manually: " + targetDir); 
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
