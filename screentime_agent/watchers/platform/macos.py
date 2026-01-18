"""
macOS Platform Implementation
Window detection and idle time using AppleScript and Quartz
"""

import subprocess
from typing import Tuple


def get_active_window_info() -> Tuple[str, str]:
    """
    Get the currently active window's title and application name on macOS.
    Uses AppleScript which works reliably without special permissions.
    
    Returns:
        tuple: (window_title, app_name)
    """
    try:
        # Get frontmost application name
        app_script = 'tell application "System Events" to get name of first process whose frontmost is true'
        app_result = subprocess.run(
            ['osascript', '-e', app_script],
            capture_output=True, text=True, timeout=2
        )
        app_name = app_result.stdout.strip() or "Unknown"
        
        # Try to get window title (may not work for all apps without Accessibility permissions)
        title_script = '''
        tell application "System Events"
            set frontApp to first process whose frontmost is true
            set appName to name of frontApp
            try
                tell frontApp
                    set windowTitle to name of front window
                end tell
            on error
                set windowTitle to appName
            end try
            return windowTitle
        end tell
        '''
        title_result = subprocess.run(
            ['osascript', '-e', title_script],
            capture_output=True, text=True, timeout=2
        )
        window_title = title_result.stdout.strip() or app_name
        
        return (window_title, app_name)
    
    except subprocess.TimeoutExpired:
        return ("Timeout", "Timeout")
    except Exception as e:
        print(f"Error getting window info: {e}")
        return ("Unknown", "Unknown")


def get_idle_time() -> float:
    """
    Get the number of seconds since the last user input on macOS.
    Uses the IOKit HIDIdleTime property.
    
    Returns:
        float: Seconds since last input
    """
    try:
        # Use ioreg to get the HID idle time
        result = subprocess.run(
            ['ioreg', '-c', 'IOHIDSystem', '-d', '4'],
            capture_output=True, text=True, timeout=2
        )
        
        # Parse the output to find HIDIdleTime
        for line in result.stdout.split('\n'):
            if 'HIDIdleTime' in line:
                # Extract the numeric value
                # Format: "HIDIdleTime" = 1234567890
                parts = line.split('=')
                if len(parts) >= 2:
                    value = parts[1].strip()
                    # Value is in nanoseconds, convert to seconds
                    return float(value) / 1_000_000_000
        
        return 0.0
    
    except subprocess.TimeoutExpired:
        return 0.0
    except Exception as e:
        print(f"Error getting idle time: {e}")
        return 0.0


def has_accessibility_permissions() -> bool:
    """
    Check if the terminal has Accessibility permissions.
    Required for full window title detection.
    
    Returns:
        bool: True if has permissions
    """
    try:
        # Try to get window title - if it fails, we don't have permissions
        test_script = '''
        tell application "System Events"
            set frontApp to first process whose frontmost is true
            try
                tell frontApp
                    get name of front window
                end tell
                return true
            on error
                return false
            end try
        end tell
        '''
        result = subprocess.run(
            ['osascript', '-e', test_script],
            capture_output=True, text=True, timeout=2
        )
        return result.stdout.strip() == "true"
    except:
        return False


if __name__ == "__main__":
    # Test the functions
    import time
    
    print("Testing macOS platform functions...")
    print("-" * 40)
    
    print(f"Has Accessibility permissions: {has_accessibility_permissions()}")
    print()
    
    print("Monitoring windows (press Ctrl+C to stop)...")
    last_info = ("", "")
    
    while True:
        info = get_active_window_info()
        idle = get_idle_time()
        
        if info != last_info:
            print(f"App: {info[1]}")
            print(f"Window: {info[0]}")
            print(f"Idle: {idle:.1f}s")
            print("-" * 40)
            last_info = info
        
        time.sleep(1)
