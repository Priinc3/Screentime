using EmployeeMonitor.Services;

namespace EmployeeMonitor;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly SupabaseService _supabaseService;
    private string _lastTitle = string.Empty;
    private string _lastApp = string.Empty;
    private DateTime _startTime;

    public Worker(ILogger<Worker> logger, SupabaseService supabaseService)
    {
        _logger = logger;
        _supabaseService = supabaseService;
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        await _supabaseService.InitializeAsync();
        await base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _startTime = DateTime.UtcNow;
        var lastHeartbeatTime = DateTime.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
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
    }
}
