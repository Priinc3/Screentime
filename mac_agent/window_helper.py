"""
Mac Window Helper - Detects active window and application on macOS
Uses AppleScript via osascript for reliable detection
"""

import subprocess


def get_active_window_info() -> tuple[str, str]:
    """
    Get the currently active window's title and application name.
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
        
        # Try to get window title (may not work for all apps)
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
        print(f"Error getting window info: {e}", flush=True)
        return ("Unknown", "Unknown")


if __name__ == "__main__":
    # Test the function
    import time
    print("Testing window detection (press Ctrl+C to stop)...")
    print("Switch between windows to see updates.\n")
    
    last_info = ("", "")
    while True:
        info = get_active_window_info()
        if info != last_info:
            print(f"App: {info[1]}")
            print(f"Window: {info[0]}")
            print("-" * 40)
            last_info = info
        time.sleep(1)
