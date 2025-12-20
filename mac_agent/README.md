# Mac Employee Monitor Agent

A macOS version of the Employee Monitor agent that tracks active window usage and reports to Supabase.

## Requirements

- macOS 10.14+
- Python 3.8+
- Accessibility permissions (for window tracking)

## Installation

1. **Install Dependencies:**
   ```bash
   cd mac_agent
   pip3 install -r requirements.txt
   ```

2. **Grant Accessibility Permissions:**
   - Go to System Preferences → Security & Privacy → Privacy → Accessibility
   - Add Terminal (or your Python executable) to the allowed list

3. **Run Setup:**
   ```bash
   python3 main.py --install
   ```
   This will:
   - Prompt for your employee name
   - Register you in the Supabase database
   - Install a LaunchAgent for auto-start

## Uninstallation

```bash
python3 main.py --uninstall
```

## Manual Run (for testing)

```bash
python3 main.py
```

## Troubleshooting

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
