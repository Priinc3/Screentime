"""
Installer - Handles LaunchAgent installation for persistence on macOS
Equivalent to Installer.cs in the Windows agent
"""

import os
import sys
import subprocess
from pathlib import Path

LAUNCHAGENT_DIR = Path.home() / "Library" / "LaunchAgents"
PLIST_NAME = "com.employeemonitor.agent.plist"
PLIST_PATH = LAUNCHAGENT_DIR / PLIST_NAME

# Get the absolute path to the main.py script
SCRIPT_DIR = Path(__file__).parent.resolve()
MAIN_SCRIPT = SCRIPT_DIR / "main.py"
VENV_PYTHON = SCRIPT_DIR / "venv" / "bin" / "python"


def get_python_path() -> str:
    """Get the path to the Python interpreter (prefer venv)"""
    if VENV_PYTHON.exists():
        return str(VENV_PYTHON)
    return sys.executable


def create_plist_content() -> str:
    """Generate the LaunchAgent plist XML"""
    run_script = SCRIPT_DIR / "run_agent.sh"
    
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.employeemonitor.agent</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>{run_script}</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>{Path.home()}/Library/Logs/EmployeeMonitor/stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>{Path.home()}/Library/Logs/EmployeeMonitor/stderr.log</string>
    
    <key>WorkingDirectory</key>
    <string>{SCRIPT_DIR}</string>
</dict>
</plist>
"""


def install():
    """Install the LaunchAgent for auto-start"""
    try:
        # 1. Create log directory
        log_dir = Path.home() / "Library" / "Logs" / "EmployeeMonitor"
        log_dir.mkdir(parents=True, exist_ok=True)
        
        # 2. Create LaunchAgents directory if needed
        LAUNCHAGENT_DIR.mkdir(parents=True, exist_ok=True)
        
        # 3. Write plist file
        plist_content = create_plist_content()
        with open(PLIST_PATH, 'w') as f:
            f.write(plist_content)
        
        print(f"Created LaunchAgent: {PLIST_PATH}")
        
        # 4. Load the LaunchAgent
        subprocess.run(['launchctl', 'unload', str(PLIST_PATH)], capture_output=True)  # Unload first if exists
        result = subprocess.run(['launchctl', 'load', str(PLIST_PATH)], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("LaunchAgent loaded successfully!")
            print("The agent will now start automatically on login.")
        else:
            print(f"Warning: Could not load LaunchAgent: {result.stderr}")
            print("You may need to manually load it with:")
            print(f"  launchctl load {PLIST_PATH}")
        
        return True
    
    except Exception as e:
        print(f"Installation error: {e}")
        return False


def uninstall():
    """Uninstall the LaunchAgent"""
    try:
        # 1. Unload the LaunchAgent
        if PLIST_PATH.exists():
            subprocess.run(['launchctl', 'unload', str(PLIST_PATH)], capture_output=True)
            print("LaunchAgent unloaded.")
            
            # 2. Delete plist file
            PLIST_PATH.unlink()
            print(f"Deleted: {PLIST_PATH}")
        else:
            print("LaunchAgent not found.")
        
        # 3. Remove config (optional - ask user?)
        config_dir = Path.home() / "Library" / "Application Support" / "EmployeeMonitor"
        if config_dir.exists():
            import shutil
            shutil.rmtree(config_dir)
            print(f"Deleted config: {config_dir}")
        
        print("Uninstallation complete!")
        return True
    
    except Exception as e:
        print(f"Uninstallation error: {e}")
        return False


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == '--uninstall':
            uninstall()
        else:
            install()
    else:
        print("Usage: python installer.py [--uninstall]")
