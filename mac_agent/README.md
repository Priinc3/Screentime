# Mac Employee Monitor Agent

A macOS version of the Employee Monitor agent that tracks active window usage and reports to Supabase.

## Requirements

- macOS 10.14+
- Python 3.8+ (will be installed automatically if missing)
- Accessibility permissions (for window tracking)

## Quick Installation (Recommended)

### Option 1: Double-Click Installer
1. Download the `mac_agent` folder
2. Double-click **`install.command`**
3. Follow the on-screen prompts

### Option 2: Terminal
```bash
cd mac_agent
chmod +x launcher.sh
./launcher.sh
```

The installer will:
- ✅ Check if Python is installed
- ✅ Offer to install Python via Homebrew if missing
- ✅ Create a virtual environment
- ✅ Install all dependencies
- ✅ Prompt for your employee name
- ✅ Register you in the database
- ✅ Set up auto-start on login

## Python Not Found?

The installer will detect if Python is missing and show installation options:

1. **Homebrew** (Recommended):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew install python3
   ```

2. **Download from python.org**:
   Visit https://www.python.org/downloads/macos/

3. **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```

## Grant Accessibility Permissions

After installation, grant Accessibility access:
1. Go to **System Settings → Privacy & Security → Accessibility**
2. Click the **+** button
3. Add **Terminal** (or the application running the agent)
4. Toggle it **ON**

## Uninstallation

```bash
./launcher.sh
# Select option 2
```

## Manual Run (for testing)

```bash
./launcher.sh
# Select option 1
```
Or directly:
```bash
source venv/bin/activate
python main.py
```

## Troubleshooting

### "Python not found"
Run the installer again - it will offer to install Python automatically via Homebrew.

### "Not getting window titles"
Ensure Accessibility permissions are granted for Terminal/Python.

### "Agent not starting on login"
Check if the LaunchAgent is loaded:
```bash
launchctl list | grep employeemonitor
```

Load it manually:
```bash
launchctl load ~/Library/LaunchAgents/com.employeemonitor.agent.plist
```

### View Logs
```bash
./launcher.sh
# Select option 3
```
Or directly:
```bash
tail -f ~/Library/Logs/EmployeeMonitor/stdout.log
```
