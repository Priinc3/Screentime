# How to Get Supabase Credentials

To run the agent and dashboard, you need your **Project URL** and **Anon Key**.

1.  **Log in to Supabase**: Go to [supabase.com/dashboard](https://supabase.com/dashboard).
2.  **Select Project**: Click on your project.
3.  **Go to Settings**: Click the **Settings** icon (cogwheel) at the bottom of the left sidebar.
4.  **API Keys**: Click on **API** in the settings menu.
5.  **Copy Values**:
    *   **Project URL**: Look for the "Project URL" field.
    *   **Anon Key**: Look for the "Project API keys" section and copy the `anon` `public` key.

## Where to put them?

### 1. Dashboard
Update `dashboard/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Windows Agent
Update `agent/EmployeeMonitor/Services/SupabaseService.cs`:
```csharp
private const string SupabaseUrl = "your-project-url";
private const string SupabaseKey = "your-anon-key";
```
