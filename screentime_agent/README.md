# Screen Time Agent

A cross-platform activity tracking agent inspired by [ActivityWatch](https://activitywatch.net/).

## 📦 Quick Install

### macOS
1. Download `ScreenTimeAgent.dmg` from the `dist/` folder
2. Open the DMG and drag `ScreenTimeAgent.app` to Applications
3. Launch the app - it will appear in your menu bar
4. Grant Accessibility permissions when prompted

### Windows
1. Build using `build_windows.bat` (see Building section)
2. Run `ScreenTimeAgent.exe`
3. Follow the setup wizard

---

## 🏗️ Building from Source

### Prerequisites
- Python 3.9+
- macOS 10.15+ / Windows 10+ / Ubuntu 20.04+

### Build macOS App (.app + .dmg)

```bash
cd screentime_agent

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install build dependencies
pip install -r requirements-build.txt

# Build the app
python -m PyInstaller screentime_agent.spec --noconfirm

# Create DMG (optional)
hdiutil create -volname "ScreenTimeAgent" -srcfolder "dist/ScreenTimeAgent.app" -ov -format UDZO "dist/ScreenTimeAgent.dmg"
```

Output: `dist/ScreenTimeAgent.app` and `dist/ScreenTimeAgent.dmg`

### Build Windows Executable (.exe)

```powershell
cd screentime_agent

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install build dependencies
pip install -r requirements-build.txt

# Build the exe
python -m PyInstaller screentime_agent.spec --noconfirm
```

Output: `dist/ScreenTimeAgent.exe`

---

## 💻 Development Mode

For development/testing without building:

```bash
cd screentime_agent
python3 -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run CLI mode
python main.py --install   # First time setup
python main.py --verbose   # Run with logging

# Run GUI mode
python app_gui.py
```

---

## 📁 Project Structure

```
screentime_agent/
├── app_gui.py           # GUI entry point (for standalone app)
├── main.py              # CLI entry point
├── config.py            # Configuration management
├── models.py            # Data models
├── service.py           # Core monitoring service
├── installer.py         # Platform installers
├── screentime_agent.spec # PyInstaller configuration
├── build_macos.sh       # macOS build script
├── build_windows.bat    # Windows build script
├── requirements.txt     # Runtime dependencies
├── requirements-build.txt # Build dependencies
├── database/            # Database abstraction
│   ├── base.py
│   ├── supabase_backend.py
│   └── postgres_backend.py
├── watchers/            # Activity watchers
│   ├── window_watcher.py
│   ├── afk_watcher.py
│   └── platform/
│       ├── macos.py
│       ├── windows.py
│       └── linux.py
└── dist/                # Built executables
    ├── ScreenTimeAgent.app
    └── ScreenTimeAgent.dmg
```

---

## ⚙️ CLI Commands

| Command | Description |
|---------|-------------|
| `python main.py` | Run the monitoring agent |
| `python main.py --install` | Interactive setup wizard |
| `python main.py --uninstall` | Remove agent and auto-start |
| `python main.py --status` | Check if agent is running |
| `python main.py --config` | Configure database settings |
| `python main.py --verbose` | Run with verbose output |
| `python main.py --debug` | Run with debug logging |

---

## 🔐 Permissions

### macOS
Grant Accessibility permissions for full window title detection:
1. System Preferences → Security & Privacy → Privacy → Accessibility
2. Add `ScreenTimeAgent.app` (or Terminal if running from source)

### Windows
For full functionality, run as Administrator the first time.

---

## 🗄️ Database Configuration

The agent connects to **Supabase** by default. To use a different database:

```bash
python main.py --config
```

Supported backends:
- Supabase (default)
- PostgreSQL
- AWS RDS

---

## 📍 Configuration Location

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/ScreenTimeAgent/config.json` |
| Windows | `%APPDATA%\ScreenTimeAgent\config.json` |
| Linux | `~/.config/screentime-agent/config.json` |

---

## 📊 Dashboard

View your activity data at: **http://localhost:3000**

Run the dashboard:
```bash
cd ..  # Go to project root
npm run dev
```
