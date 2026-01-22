using Supabase;
using System.Text.Json;
using System.Collections.Concurrent;

namespace EmployeeMonitor.Services;

public class SupabaseService
{
    private readonly Client _client;
    private readonly ILogger<SupabaseService>? _logger;

    // TODO: Load these from configuration
    private const string SupabaseUrl = "https://cvrtaecpuwbyixxxiclt.supabase.co";
    private const string SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cnRhZWNwdXdieWl4eHhpY2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDY1MDIsImV4cCI6MjA4MDMyMjUwMn0.7zGRwxySIyUZdgVtnEYxVHxPcksQ5zonmh7Bx-ozbOw";

    private const string ConfigPath = @"C:\ProgramData\EmployeeMonitor\config.json";
    private const string QueuePath = @"C:\ProgramData\EmployeeMonitor\pending_logs.json";
    private string? _employeeId;

    // Offline queue for failed logs
    private readonly ConcurrentQueue<ActivityLog> _offlineQueue = new();
    private bool _isRetryingQueue = false;

    public SupabaseService(ILogger<SupabaseService>? logger = null)
    {
        _logger = logger;
        var options = new SupabaseOptions
        {
            AutoRefreshToken = true,
            AutoConnectRealtime = true
        };
        _client = new Client(SupabaseUrl, SupabaseKey, options);
    }

    public async Task InitializeAsync()
    {
        await _client.InitializeAsync();
        _employeeId = LoadConfig();
        
        // Load pending logs from disk
        LoadQueueFromDisk();
        
        // Try to send any queued logs
        _ = Task.Run(RetryQueuedLogsAsync);
    }

    public async Task<Employee?> GetEmployeeAsync(string id)
    {
        try
        {
            var response = await _client.From<Employee>().Where(x => x.Id == id).Single();
            return response;
        }
        catch
        {
            return null;
        }
    }

    public async Task<string> RegisterEmployeeAsync(string name, string? customId = null)
    {
        var newId = !string.IsNullOrEmpty(customId) ? customId : Guid.NewGuid().ToString();
        
        var employee = new Employee
        {
            Id = newId,
            FullName = name,
            Email = $"{name.ToLower().Replace(" ", ".")}@example.com",
            Department = "General",
            CreatedAt = DateTime.UtcNow
        };

        await _client.From<Employee>().Insert(employee);
        
        _employeeId = newId;
        SaveConfig(newId);
        
        return newId;
    }

    public void SaveConfig(string employeeId)
    {
        try
        {
            var dir = Path.GetDirectoryName(ConfigPath);
            if (dir != null && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(ConfigPath, JsonSerializer.Serialize(new { EmployeeId = employeeId }));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to save config: {ex.Message}");
        }
    }

    private string? LoadConfig()
    {
        try
        {
            if (File.Exists(ConfigPath))
            {
                var json = File.ReadAllText(ConfigPath);
                var config = JsonSerializer.Deserialize<Config>(json);
                return config?.EmployeeId;
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError($"Failed to load config: {ex.Message}");
            Console.WriteLine($"Failed to load config: {ex.Message}");
        }
        return null;
    }

    public async Task UpdateHeartbeatAsync(string windowTitle, string appName)
    {
        try
        {
            if (string.IsNullOrEmpty(_employeeId)) return;

            await _client.From<Employee>()
                         .Where(x => x.Id == _employeeId)
                         .Set(x => x.CurrentWindow, windowTitle)
                         .Set(x => x.CurrentApp, appName)
                         .Set(x => x.LastHeartbeat, DateTime.UtcNow)
                         .Update();
        }
        catch (Exception ex)
        {
            _logger?.LogWarning($"Failed to send heartbeat: {ex.Message}");
        }
    }

    public async Task LogActivityAsync(string windowTitle, string appName, int durationSeconds)
    {
        if (string.IsNullOrEmpty(_employeeId))
        {
            _logger?.LogWarning("No Employee ID found. Skipping log.");
            return;
        }

        var model = new ActivityLog
        {
            EmployeeId = _employeeId,
            WindowTitle = windowTitle,
            AppName = appName,
            StartTime = DateTime.UtcNow.AddSeconds(-durationSeconds),
            EndTime = DateTime.UtcNow,
            DurationSeconds = durationSeconds
        };

        try
        {
            await _client.From<ActivityLog>().Insert(model);
            _logger?.LogInformation($"Activity logged: {appName} ({durationSeconds}s)");
        }
        catch (Exception ex)
        {
            _logger?.LogError($"Failed to log activity, queuing for retry: {ex.Message}");
            
            // Add to offline queue
            _offlineQueue.Enqueue(model);
            SaveQueueToDisk();
            
            // Try to send queue in background
            _ = Task.Run(RetryQueuedLogsAsync);
        }
    }

    private async Task RetryQueuedLogsAsync()
    {
        if (_isRetryingQueue || _offlineQueue.IsEmpty) return;
        
        _isRetryingQueue = true;
        
        try
        {
            _logger?.LogInformation($"Retrying {_offlineQueue.Count} queued logs...");
            
            var successCount = 0;
            var failCount = 0;
            
            while (_offlineQueue.TryPeek(out var log))
            {
                try
                {
                    await _client.From<ActivityLog>().Insert(log);
                    _offlineQueue.TryDequeue(out _);
                    successCount++;
                }
                catch
                {
                    // Still offline or error, stop retrying for now
                    failCount++;
                    break;
                }
            }
            
            if (successCount > 0)
            {
                _logger?.LogInformation($"Successfully sent {successCount} queued logs.");
                SaveQueueToDisk();
            }
            
            if (failCount > 0)
            {
                _logger?.LogWarning($"Still offline, {_offlineQueue.Count} logs remain queued.");
            }
        }
        finally
        {
            _isRetryingQueue = false;
        }
    }

    private void SaveQueueToDisk()
    {
        try
        {
            var logs = _offlineQueue.ToArray();
            var json = JsonSerializer.Serialize(logs);
            File.WriteAllText(QueuePath, json);
        }
        catch (Exception ex)
        {
            _logger?.LogError($"Failed to save queue to disk: {ex.Message}");
        }
    }

    private void LoadQueueFromDisk()
    {
        try
        {
            if (File.Exists(QueuePath))
            {
                var json = File.ReadAllText(QueuePath);
                var logs = JsonSerializer.Deserialize<ActivityLog[]>(json);
                
                if (logs != null)
                {
                    foreach (var log in logs)
                    {
                        _offlineQueue.Enqueue(log);
                    }
                    
                    _logger?.LogInformation($"Loaded {logs.Length} queued logs from disk.");
                }
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError($"Failed to load queue from disk: {ex.Message}");
        }
    }
}

public class Config
{
    public string? EmployeeId { get; set; }
    public string? TargetWindowsUser { get; set; }
}

[Supabase.Postgrest.Attributes.Table("employees")]
public class Employee : Supabase.Postgrest.Models.BaseModel
{
    [Supabase.Postgrest.Attributes.Column("id")]
    public string? Id { get; set; }

    [Supabase.Postgrest.Attributes.Column("full_name")]
    public string? FullName { get; set; }

    [Supabase.Postgrest.Attributes.Column("email")]
    public string? Email { get; set; }

    [Supabase.Postgrest.Attributes.Column("department")]
    public string? Department { get; set; }

    [Supabase.Postgrest.Attributes.Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Supabase.Postgrest.Attributes.Column("current_window")]
    public string? CurrentWindow { get; set; }

    [Supabase.Postgrest.Attributes.Column("current_app")]
    public string? CurrentApp { get; set; }

    [Supabase.Postgrest.Attributes.Column("last_heartbeat")]
    public DateTime? LastHeartbeat { get; set; }
}

[Supabase.Postgrest.Attributes.Table("activity_logs")]
public class ActivityLog : Supabase.Postgrest.Models.BaseModel
{
    [Supabase.Postgrest.Attributes.Column("employee_id")]
    public string? EmployeeId { get; set; }

    [Supabase.Postgrest.Attributes.Column("window_title")]
    public string? WindowTitle { get; set; }

    [Supabase.Postgrest.Attributes.Column("app_name")]
    public string? AppName { get; set; }

    [Supabase.Postgrest.Attributes.Column("start_time")]
    public DateTime StartTime { get; set; }

    [Supabase.Postgrest.Attributes.Column("end_time")]
    public DateTime EndTime { get; set; }

    [Supabase.Postgrest.Attributes.Column("duration_seconds")]
    public int DurationSeconds { get; set; }
}
