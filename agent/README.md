# Employee Monitor Agent (Windows)

This is a .NET 8 Worker Service that runs in the background, monitors the active window, and logs activity to Supabase.

## Prerequisites

1.  **Windows OS**: This agent uses `user32.dll` and only works on Windows.
2.  **.NET 8 SDK**: [Download here](https://dotnet.microsoft.com/en-us/download/dotnet/8.0).
3.  **Supabase Project**: You need the URL and Anon Key.

## Configuration

Open `Services/SupabaseService.cs` and update the constants with your Supabase credentials:

```csharp
private const string SupabaseUrl = "YOUR_SUPABASE_URL";
private const string SupabaseKey = "YOUR_SUPABASE_ANON_KEY";
```

*Note: In a production app, use `appsettings.json` or User Secrets.*

## How to Run

1.  Open a terminal in this directory.
2.  Run the application:
    ```bash
    dotnet run
    ```
3.  To install as a Windows Service (requires Admin):
    ```bash
    sc create "EmployeeMonitor" binPath= "C:\path\to\EmployeeMonitor.exe"
    sc start "EmployeeMonitor"
    ```

## Publishing (Single File)

To create a single `.exe` file that contains everything:

```bash
cd agent/EmployeeMonitor
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
```

The output file will be in:
`agent/EmployeeMonitor/bin/Release/net8.0/win-x64/publish/EmployeeMonitor.exe`

## Installation

1.  **Copy** `EmployeeMonitor.exe` to the target machine.
2.  **Open Command Prompt as Administrator**.
3.  **Install**:
    *   **Command Prompt**:
        ```cmd
        EmployeeMonitor.exe --install
        ```
    *   **PowerShell**:
        ```powershell
        .\EmployeeMonitor.exe --install
        ```
    This will register it as a Windows Service and start it automatically.

4.  **Uninstall**:
    ```cmd
    EmployeeMonitor.exe --uninstall
    ```

## How to Verify it's Running

1.  Open **Task Manager** (`Ctrl+Shift+Esc`).
2.  Go to the **Services** tab.
3.  Look for **EmployeeMonitor**.
    *   Status should be **Running**.
4.  Alternatively, open a terminal and run:
    ```cmd
    sc query EmployeeMonitor
    ```
