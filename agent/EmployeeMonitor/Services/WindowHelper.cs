using System.Runtime.InteropServices;
using System.Text;

namespace EmployeeMonitor.Services;

public static class WindowHelper
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static (string Title, string ProcessName) GetActiveWindowInfo()
    {
        try
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                return ("Non-Windows OS", "SimulatedApp");
            }

            var handle = GetForegroundWindow();
            if (handle == IntPtr.Zero) return ("Unknown", "Unknown");

            // Get Window Title
            const int nChars = 256;
            StringBuilder buff = new StringBuilder(nChars);
            if (GetWindowText(handle, buff, nChars) > 0)
            {
                var title = buff.ToString();
                
                // Get Process Name
                GetWindowThreadProcessId(handle, out uint pid);
                var process = System.Diagnostics.Process.GetProcessById((int)pid);
                
                return (title, process.ProcessName);
            }
        }
        catch (Exception)
        {
            // Ignore errors for now
        }

        return ("Unknown", "Unknown");
    }
}
