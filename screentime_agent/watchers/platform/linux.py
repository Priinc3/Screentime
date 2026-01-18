"""
Linux Platform Implementation
Window detection and idle time using X11 or Wayland
"""

import subprocess
from typing import Tuple


def get_active_window_info() -> Tuple[str, str]:
    """
    Get the currently active window's title and application name on Linux.
    Uses xdotool for X11 or alternatives for Wayland.
    
    Returns:
        tuple: (window_title, app_name)
    """
    try:
        # Try X11 first (xdotool)
        return _get_window_info_x11()
    except Exception:
        try:
            # Try Wayland alternative
            return _get_window_info_wayland()
        except:
            return ("Unknown", "Unknown")


def _get_window_info_x11() -> Tuple[str, str]:
    """Get window info using X11 tools"""
    try:
        # Get active window ID
        active_id = subprocess.run(
            ['xdotool', 'getactivewindow'],
            capture_output=True, text=True, timeout=2
        )
        window_id = active_id.stdout.strip()
        
        if not window_id:
            return ("Unknown", "Unknown")
        
        # Get window name
        name_result = subprocess.run(
            ['xdotool', 'getwindowname', window_id],
            capture_output=True, text=True, timeout=2
        )
        window_title = name_result.stdout.strip() or "Untitled"
        
        # Get window PID and process name
        pid_result = subprocess.run(
            ['xdotool', 'getwindowpid', window_id],
            capture_output=True, text=True, timeout=2
        )
        pid = pid_result.stdout.strip()
        
        if pid:
            # Get process name from /proc
            try:
                with open(f'/proc/{pid}/comm', 'r') as f:
                    app_name = f.read().strip()
            except:
                app_name = "Unknown"
        else:
            app_name = "Unknown"
        
        return (window_title, app_name)
    
    except FileNotFoundError:
        raise Exception("xdotool not installed")
    except subprocess.TimeoutExpired:
        return ("Timeout", "Timeout")


def _get_window_info_wayland() -> Tuple[str, str]:
    """Get window info on Wayland (limited support)"""
    # Wayland is more restrictive, try sway/hyprland specific tools
    try:
        # Try swaymsg for sway/i3
        result = subprocess.run(
            ['swaymsg', '-t', 'get_tree'],
            capture_output=True, text=True, timeout=2
        )
        
        if result.returncode == 0:
            import json
            tree = json.loads(result.stdout)
            window = _find_focused_window(tree)
            if window:
                return (window.get('name', 'Unknown'), window.get('app_id', 'Unknown'))
    except:
        pass
    
    # Fallback
    return ("Unknown (Wayland)", "Unknown")


def _find_focused_window(node: dict) -> dict:
    """Recursively find the focused window in sway tree"""
    if node.get('focused'):
        return node
    
    for child in node.get('nodes', []) + node.get('floating_nodes', []):
        result = _find_focused_window(child)
        if result:
            return result
    
    return None


def get_idle_time() -> float:
    """
    Get the number of seconds since the last user input on Linux.
    Uses xprintidle or other X11 tools.
    
    Returns:
        float: Seconds since last input
    """
    try:
        # Try xprintidle (most common)
        result = subprocess.run(
            ['xprintidle'],
            capture_output=True, text=True, timeout=2
        )
        
        if result.returncode == 0:
            millis = int(result.stdout.strip())
            return millis / 1000.0
        
        return 0.0
    
    except FileNotFoundError:
        # xprintidle not installed, try alternative
        try:
            return _get_idle_time_xssstate()
        except:
            return 0.0
    except subprocess.TimeoutExpired:
        return 0.0
    except Exception as e:
        print(f"Error getting idle time: {e}")
        return 0.0


def _get_idle_time_xssstate() -> float:
    """Get idle time using xssstate (from xorg-xss-utils)"""
    try:
        result = subprocess.run(
            ['xssstate', '-i'],
            capture_output=True, text=True, timeout=2
        )
        
        if result.returncode == 0:
            millis = int(result.stdout.strip())
            return millis / 1000.0
        
        return 0.0
    except:
        return 0.0


if __name__ == "__main__":
    # Test the functions
    import time
    
    print("Testing Linux platform functions...")
    print("-" * 40)
    
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
