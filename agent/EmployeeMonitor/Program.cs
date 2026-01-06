using EmployeeMonitor;
using EmployeeMonitor.Services;
using System.Runtime.InteropServices;
using System.Text.Json;

// Check for command line arguments
if (args.Contains("--install"))
{
    NativeMethods.AllocConsole();
    Console.WriteLine("--- Employee Monitor Setup ---");

    try
    {
        var supabase = new SupabaseService();
        await supabase.InitializeAsync();

        string employeeId = "";

        // A. Ask for existing ID
        Console.Write("Enter existing Employee ID (or press Enter to create new): ");
        var inputId = Console.ReadLine()?.Trim();

        if (!string.IsNullOrEmpty(inputId))
        {
            Console.WriteLine($"Checking ID: {inputId}...");
            var existing = await supabase.GetEmployeeAsync(inputId);
            
            if (existing != null)
            {
                Console.WriteLine($"Found existing employee: {existing.FullName}");
                employeeId = inputId;
                supabase.SaveConfig(employeeId);
            }
            else
            {
                Console.WriteLine("ID not found.");
                Console.Write("Enter Name for this new ID: ");
                var name = Console.ReadLine();
                if (string.IsNullOrWhiteSpace(name)) name = "Unknown Employee";
                
                Console.WriteLine("Registering...");
                employeeId = await supabase.RegisterEmployeeAsync(name, inputId);
                Console.WriteLine($"Registered! ID: {employeeId}");
            }
        }
        else
        {
            // B. Create New
            Console.Write("Enter Employee Name: ");
            var name = Console.ReadLine();
            if (string.IsNullOrWhiteSpace(name)) name = "Unknown Employee";

            Console.WriteLine("Registering...");
            employeeId = await supabase.RegisterEmployeeAsync(name);
            Console.WriteLine($"Registered! ID: {employeeId}");
        }

    // 3. User-Specific Monitoring Setup
    Console.WriteLine("\n--- User-Specific Monitoring ---");
    Console.WriteLine("Select the Windows User to monitor:");
    
    var usersDirectory = @"C:\Users";
    var users = Directory.GetDirectories(usersDirectory)
                         .Select(Path.GetFileName)
                         .Where(u => !u.Equals("Public", StringComparison.OrdinalIgnoreCase) && 
                                     !u.Equals("Default", StringComparison.OrdinalIgnoreCase) &&
                                     !u.Equals("All Users", StringComparison.OrdinalIgnoreCase))
                         .ToList();

    for (int i = 0; i < users.Count; i++)
    {
        Console.WriteLine($"{i + 1}. {users[i]}");
    }
    Console.WriteLine($"{users.Count + 1}. All Users (Monitor everyone)");

    string targetUser = "";
    while (true)
    {
        Console.Write("Enter number: ");
        if (int.TryParse(Console.ReadLine(), out int choice))
        {
            if (choice > 0 && choice <= users.Count)
            {
                targetUser = users[choice - 1];
                Console.WriteLine($"Selected: {targetUser}");
                break;
            }
            else if (choice == users.Count + 1)
            {
                Console.WriteLine("Selected: All Users");
                break;
            }
        }
        Console.WriteLine("Invalid selection.");
    }

    // Save Target User to Config
    // We need to reload config, update it, and save it back
    // Since SupabaseService.SaveConfig only takes ID, we need to update it or do it manually here.
    // Let's update SupabaseService to handle this better in the future, but for now we can rely on the fact 
    // that SupabaseService.SaveConfig overwrites the file. 
    // Wait, SupabaseService.SaveConfig overwrites the whole file with JUST EmployeeId. 
    // We need to fix SupabaseService.SaveConfig first to preserve other fields or accept them.
    // OR, we can just write the config file manually here since we know the path.
    
    var configPath = @"C:\ProgramData\EmployeeMonitor\config.json";
    var config = new Config { EmployeeId = employeeId, TargetWindowsUser = targetUser };
    var json = JsonSerializer.Serialize(config);
    File.WriteAllText(configPath, json);

    // 4. Install Persistence
    Installer.Install();
    
    // Start the application immediately as a background process
    var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
    if (!string.IsNullOrEmpty(exePath))
    {
         var psi = new System.Diagnostics.ProcessStartInfo(exePath)
         {
             UseShellExecute = true,
             CreateNoWindow = true,
             WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden
         };
         System.Diagnostics.Process.Start(psi);
         Console.WriteLine("Agent started in background.");
    }
    
    Console.WriteLine("Installation Complete! You can close this window.");
    Console.WriteLine("Press any key to exit...");
    Console.ReadKey();
}
catch (Exception ex)
{
    Console.WriteLine($"Error during installation: {ex.Message}");
    Console.WriteLine("Press any key to exit...");
    Console.ReadKey();
}

NativeMethods.FreeConsole();
return;
}

if (args.Contains("--uninstall"))
{
    NativeMethods.AllocConsole();
    Installer.Uninstall();
    Console.WriteLine("Press any key to exit...");
    Console.ReadKey();
    NativeMethods.FreeConsole();
    return;
}

// --- Normal Startup (Background App) ---

// 1. Check User Restriction
var configPathRuntime = @"C:\ProgramData\EmployeeMonitor\config.json";
if (File.Exists(configPathRuntime))
{
    try 
    {
        var json = File.ReadAllText(configPathRuntime);
        var config = JsonSerializer.Deserialize<Config>(json);
        
        if (!string.IsNullOrEmpty(config?.TargetWindowsUser))
        {
            var currentUser = Environment.UserName;
            if (!config.TargetWindowsUser.Equals(currentUser, StringComparison.OrdinalIgnoreCase))
            {
                // Not the target user. Exit silently.
                return;
            }
        }
    }
    catch
    {
        // Ignore config errors, proceed (or exit? Safer to proceed if config is broken to allow debugging, 
        // but for strict monitoring maybe exit? Let's proceed for now).
    }
}

var builder = Host.CreateApplicationBuilder(args);

// No longer a Windows Service
// builder.Services.AddWindowsService(...) 

builder.Services.AddSingleton<SupabaseService>();
builder.Services.AddHostedService<Worker>();

var host = builder.Build();

// Ensure Supabase is initialized before starting the worker
var service = host.Services.GetRequiredService<SupabaseService>();
await service.InitializeAsync();

// Check for updates (non-blocking, but if update found, we exit)
try
{
    var shouldExit = await AutoUpdater.CheckAndUpdateAsync();
    if (shouldExit)
    {
        // Update is being applied, exit to allow update script to replace us
        return;
    }
}
catch
{
    // Update check failed, continue with normal operation
}

host.Run();

// --- P/Invoke Definitions ---
internal static class NativeMethods
{
    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool AllocConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool FreeConsole();
}
