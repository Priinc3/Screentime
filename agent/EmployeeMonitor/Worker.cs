using EmployeeMonitor.Services;
using System.Runtime.InteropServices;

namespace EmployeeMonitor;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly SupabaseService _supabaseService;
    private string _lastTitle = string.Empty;
    private string _lastApp = string.Empty;
    private DateTime _startTime;
    private DateTime _lastAntiSuspendTime = DateTime.MinValue;

    // Windows API to prevent system from entering sleep/suspend
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern uint SetThreadExecutionState(uint esFlags);

    // Execution state flags
    private const uint ES_CONTINUOUS = 0x80000000;
    private const uint ES_SYSTEM_REQUIRED = 0x00000001;
    private const uint ES_AWAYMODE_REQUIRED = 0x00000040;

    public Worker(ILogger<Worker> logger, SupabaseService supabaseService)
    {
        _logger = logger;
        _supabaseService = supabaseService;
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        // Set process priority to keep it responsive
        try
        {
            System.Diagnostics.Process.GetCurrentProcess().PriorityClass = 
                System.Diagnostics.ProcessPriorityClass.AboveNormal;
            _logger.LogInformation("Process priority set to AboveNormal");
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"Could not set process priority: {ex.Message}");
        }

        // Initial anti-suspend call
        PreventSuspension();

        await _supabaseService.InitializeAsync();
        await base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _startTime = DateTime.UtcNow;
        var lastHeartbeatTime = DateTime.MinValue;

        _logger.LogInformation("Worker started. Anti-suspension measures active.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Anti-suspension: Call every 30 seconds to prevent Windows from suspending us
                if ((DateTime.UtcNow - _lastAntiSuspendTime).TotalSeconds >= 30)
                {
                    PreventSuspension();
                    _lastAntiSuspendTime = DateTime.UtcNow;
                }

                var (title, app) = WindowHelper.GetActiveWindowInfo();

                // 1. Handle Window Changes (Logging)
                if (title != _lastTitle || app != _lastApp)
                {
                    // Window changed, log the previous one
                    if (!string.IsNullOrEmpty(_lastTitle))
                    {
                        var duration = (int)(DateTime.UtcNow - _startTime).TotalSeconds;
                        if (duration > 0)
                        {
                            _logger.LogInformation($"Activity: {_lastApp} - {_lastTitle} ({duration}s)");
                            await _supabaseService.LogActivityAsync(_lastTitle, _lastApp, duration);
                        }
                    }

                    _lastTitle = title;
                    _lastApp = app;
                    _startTime = DateTime.UtcNow;
                    
                    // Force immediate heartbeat on change
                    await _supabaseService.UpdateHeartbeatAsync(title, app);
                    lastHeartbeatTime = DateTime.UtcNow;
                }

                // 2. Handle Periodic Heartbeat (every 10 seconds)
                if ((DateTime.UtcNow - lastHeartbeatTime).TotalSeconds >= 10)
                {
                    await _supabaseService.UpdateHeartbeatAsync(title, app);
                    lastHeartbeatTime = DateTime.UtcNow;
                }

                await Task.Delay(1000, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                // Normal shutdown
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error in main loop: {ex.Message}");
                // Don't crash, just continue
                await Task.Delay(5000, stoppingToken);
            }
        }

        // Clean up: Allow system to sleep again when we stop
        AllowSuspension();
    }

    /// <summary>
    /// Tells Windows NOT to suspend this process or put the system to sleep
    /// This must be called periodically to remain effective
    /// </summary>
    private void PreventSuspension()
    {
        try
        {
            // ES_CONTINUOUS: The state should remain in effect until next call
            // ES_SYSTEM_REQUIRED: Prevents the system from entering sleep
            // ES_AWAYMODE_REQUIRED: Enables away mode (prevents suspend on modern standby systems)
            uint result = SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED);
            
            if (result == 0)
            {
                _logger.LogWarning("SetThreadExecutionState failed");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"PreventSuspension error: {ex.Message}");
        }
    }

    /// <summary>
    /// Allows Windows to suspend the process again (called on shutdown)
    /// </summary>
    private void AllowSuspension()
    {
        try
        {
            SetThreadExecutionState(ES_CONTINUOUS);
        }
        catch { }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        AllowSuspension();
        _logger.LogInformation("Worker stopping");
        await base.StopAsync(cancellationToken);
    }
}
