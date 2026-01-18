"""
Installer Module
Handles installation, uninstallation, and agent registration
"""

import os
import sys
import platform
import subprocess
from pathlib import Path

from config import (
    load_config, save_config, AgentConfig, 
    CONFIG_DIR, LOG_DIR,
    DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY
)
from database import get_database


def run_installer():
    """Interactive installation wizard"""
    print("=" * 50)
    print("     Screen Time Agent - Installation")
    print("=" * 50)
    print()
    
    config = load_config()
    
    # Step 1: Database configuration
    print("Step 1: Database Configuration")
    print("-" * 30)
    
    if not config.supabase_url:
        config.supabase_url = DEFAULT_SUPABASE_URL
        config.supabase_key = DEFAULT_SUPABASE_KEY
        print(f"Using default Supabase: {config.supabase_url}")
    else:
        print(f"Using configured database: {config.database_provider}")
    
    # Initialize database
    db = get_database(
        config.database_provider or "supabase",
        url=config.supabase_url,
        key=config.supabase_key,
        connection_string=config.postgres_connection
    )
    
    if not db.connect():
        print("Error: Failed to connect to database.")
        print("Run 'python main.py --config' to configure database settings.")
        return
    
    print("✓ Database connection successful")
    print()
    
    # Step 2: Employee registration
    print("Step 2: Employee Registration")
    print("-" * 30)
    
    existing_id = input("Enter existing Employee ID (or press Enter to create new): ").strip()
    
    if existing_id:
        # Verify existing employee
        employee = db.get_employee(existing_id)
        if employee:
            print(f"✓ Found employee: {employee.full_name}")
            config.employee_id = existing_id
            config.employee_name = employee.full_name
        else:
            print(f"Employee ID not found.")
            name = input("Enter name for this new ID: ").strip() or "Unknown Employee"
            
            try:
                employee = db.create_employee(name, existing_id)
                print(f"✓ Registered: {employee.full_name} (ID: {employee.id})")
                config.employee_id = employee.id
                config.employee_name = employee.full_name
            except Exception as e:
                print(f"Error registering employee: {e}")
                return
    else:
        # Create new employee
        name = input("Enter Employee Name: ").strip() or "Unknown Employee"
        
        try:
            employee = db.create_employee(name)
            print(f"✓ Registered: {employee.full_name} (ID: {employee.id})")
            config.employee_id = employee.id
            config.employee_name = employee.full_name
        except Exception as e:
            print(f"Error registering employee: {e}")
            return
    
    print()
    
    # Step 3: Save configuration
    save_config(config)
    
    # Step 4: Platform-specific installation
    print("Step 3: Auto-Start Setup")
    print("-" * 30)
    
    system = platform.system()
    
    if system == "Darwin":
        _install_macos()
    elif system == "Windows":
        _install_windows()
    elif system == "Linux":
        _install_linux()
    else:
        print(f"Warning: No auto-start setup for {system}")
    
    print()
    print("=" * 50)
    print("     Installation Complete!")
    print("=" * 50)
    print()
    print(f"Employee ID: {config.employee_id}")
    print(f"Config saved to: {CONFIG_DIR}")
    print()
    print("The agent is now running and will start automatically on login.")
    print()
    
    # Permissions reminder for macOS
    if system == "Darwin":
        print("IMPORTANT: Grant Accessibility permissions!")
        print("  1. Open System Preferences -> Security & Privacy")
        print("  2. Go to Privacy -> Accessibility")
        print("  3. Add Terminal (or your Python app) to the list")
        print()


def run_uninstaller():
    """Uninstall the agent"""
    print("=" * 50)
    print("     Screen Time Agent - Uninstall")
    print("=" * 50)
    print()
    
    system = platform.system()
    
    if system == "Darwin":
        _uninstall_macos()
    elif system == "Windows":
        _uninstall_windows()
    elif system == "Linux":
        _uninstall_linux()
    
    print()
    print("✓ Agent uninstalled")
    print("Note: Configuration file preserved at:", CONFIG_DIR)


def check_status():
    """Check if agent is running"""
    print("=" * 50)
    print("     Screen Time Agent - Status")
    print("=" * 50)
    print()
    
    config = load_config()
    
    print(f"Configuration: {CONFIG_DIR}")
    print(f"Employee ID: {config.employee_id or 'Not configured'}")
    print(f"Database: {config.database_provider}")
    print()
    
    system = platform.system()
    
    if system == "Darwin":
        _check_status_macos()
    elif system == "Windows":
        _check_status_windows()
    elif system == "Linux":
        _check_status_linux()


# ============ macOS ============

def _install_macos():
    """Install LaunchAgent for macOS"""
    plist_dir = Path.home() / "Library" / "LaunchAgents"
    plist_file = plist_dir / "com.screentime.agent.plist"
    
    # Create log directory
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    # Get Python path and script path
    python_path = sys.executable
    script_path = Path(__file__).parent.absolute() / "main.py"
    
    plist_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.screentime.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>{python_path}</string>
        <string>{script_path}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{LOG_DIR}/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>{LOG_DIR}/stderr.log</string>
    <key>WorkingDirectory</key>
    <string>{script_path.parent}</string>
</dict>
</plist>
'''
    
    # Write plist file
    plist_dir.mkdir(parents=True, exist_ok=True)
    plist_file.write_text(plist_content)
    
    # Load the agent
    subprocess.run(['launchctl', 'unload', str(plist_file)], 
                   capture_output=True)  # Ignore errors
    result = subprocess.run(['launchctl', 'load', str(plist_file)],
                           capture_output=True)
    
    if result.returncode == 0:
        print(f"✓ LaunchAgent installed: {plist_file}")
    else:
        print(f"Warning: Failed to load LaunchAgent: {result.stderr.decode()}")


def _uninstall_macos():
    """Uninstall LaunchAgent for macOS"""
    plist_file = Path.home() / "Library" / "LaunchAgents" / "com.screentime.agent.plist"
    
    if plist_file.exists():
        subprocess.run(['launchctl', 'unload', str(plist_file)], capture_output=True)
        plist_file.unlink()
        print(f"✓ Removed LaunchAgent: {plist_file}")
    else:
        print("LaunchAgent not found")


def _check_status_macos():
    """Check status on macOS"""
    result = subprocess.run(
        ['launchctl', 'list', 'com.screentime.agent'],
        capture_output=True, text=True
    )
    
    if result.returncode == 0:
        print("Agent Status: ✓ Running")
        # Parse PID from output
        lines = result.stdout.strip().split('\n')
        if lines:
            parts = lines[0].split('\t')
            if parts[0] != '-':
                print(f"Process ID: {parts[0]}")
    else:
        print("Agent Status: ✗ Not running")


# ============ Windows ============

def _install_windows():
    """Install Task Scheduler task for Windows"""
    script_path = Path(__file__).parent.absolute() / "main.py"
    python_path = sys.executable
    
    # Create a scheduled task
    task_name = "ScreenTimeAgent"
    
    cmd = [
        'schtasks', '/Create', '/F',
        '/TN', task_name,
        '/TR', f'"{python_path}" "{script_path}"',
        '/SC', 'ONLOGON',
        '/RL', 'HIGHEST'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"✓ Task Scheduler entry created: {task_name}")
        
        # Also start the task immediately
        subprocess.run(['schtasks', '/Run', '/TN', task_name], capture_output=True)
    else:
        print(f"Warning: Failed to create Task Scheduler entry: {result.stderr}")


def _uninstall_windows():
    """Uninstall Task Scheduler task for Windows"""
    result = subprocess.run(
        ['schtasks', '/Delete', '/F', '/TN', 'ScreenTimeAgent'],
        capture_output=True, text=True
    )
    
    if result.returncode == 0:
        print("✓ Removed Task Scheduler entry")
    else:
        print("Task Scheduler entry not found")


def _check_status_windows():
    """Check status on Windows"""
    result = subprocess.run(
        ['schtasks', '/Query', '/TN', 'ScreenTimeAgent'],
        capture_output=True, text=True
    )
    
    if result.returncode == 0:
        if 'Running' in result.stdout:
            print("Agent Status: ✓ Running")
        else:
            print("Agent Status: Scheduled but not currently running")
    else:
        print("Agent Status: ✗ Not installed")


# ============ Linux ============

def _install_linux():
    """Install systemd user service for Linux"""
    service_dir = Path.home() / ".config" / "systemd" / "user"
    service_file = service_dir / "screentime-agent.service"
    
    python_path = sys.executable
    script_path = Path(__file__).parent.absolute() / "main.py"
    
    service_content = f'''[Unit]
Description=Screen Time Agent
After=graphical-session.target

[Service]
Type=simple
ExecStart={python_path} {script_path}
Restart=always
RestartSec=10
WorkingDirectory={script_path.parent}

[Install]
WantedBy=default.target
'''
    
    service_dir.mkdir(parents=True, exist_ok=True)
    service_file.write_text(service_content)
    
    # Enable and start the service
    subprocess.run(['systemctl', '--user', 'daemon-reload'], capture_output=True)
    subprocess.run(['systemctl', '--user', 'enable', 'screentime-agent'], capture_output=True)
    result = subprocess.run(['systemctl', '--user', 'start', 'screentime-agent'], capture_output=True)
    
    if result.returncode == 0:
        print(f"✓ Systemd service installed: {service_file}")
    else:
        print(f"Warning: Failed to start service: {result.stderr.decode()}")


def _uninstall_linux():
    """Uninstall systemd user service for Linux"""
    service_file = Path.home() / ".config" / "systemd" / "user" / "screentime-agent.service"
    
    subprocess.run(['systemctl', '--user', 'stop', 'screentime-agent'], capture_output=True)
    subprocess.run(['systemctl', '--user', 'disable', 'screentime-agent'], capture_output=True)
    
    if service_file.exists():
        service_file.unlink()
        print("✓ Removed systemd service")
    else:
        print("Systemd service not found")


def _check_status_linux():
    """Check status on Linux"""
    result = subprocess.run(
        ['systemctl', '--user', 'is-active', 'screentime-agent'],
        capture_output=True, text=True
    )
    
    if result.stdout.strip() == 'active':
        print("Agent Status: ✓ Running")
    else:
        print(f"Agent Status: {result.stdout.strip()}")
