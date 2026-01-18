"""
Windows Platform Implementation
Window detection and idle time using Win32 API
"""

import ctypes
from ctypes import wintypes
from typing import Tuple


# Win32 API structures
class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ('cbSize', wintypes.UINT),
        ('dwTime', wintypes.DWORD),
    ]


# Load Win32 libraries
try:
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
except AttributeError:
    # Not on Windows, these will fail gracefully
    user32 = None
    kernel32 = None


def get_active_window_info() -> Tuple[str, str]:
    """
    Get the currently active window's title and application name on Windows.
    Uses Win32 API GetForegroundWindow and related functions.
    
    Returns:
        tuple: (window_title, app_name)
    """
    if not user32:
        return ("Unknown", "Unknown")
    
    try:
        # Get the foreground window handle
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return ("No Window", "Unknown")
        
        # Get window title
        length = user32.GetWindowTextLengthW(hwnd)
        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buffer, length + 1)
        window_title = buffer.value or "Untitled"
        
        # Get process ID
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        
        # Get process name
        app_name = _get_process_name(pid.value)
        
        return (window_title, app_name)
    
    except Exception as e:
        print(f"Error getting window info: {e}")
        return ("Unknown", "Unknown")


def _get_process_name(pid: int) -> str:
    """Get the process name from a process ID"""
    try:
        import psutil
        process = psutil.Process(pid)
        return process.name().replace('.exe', '')
    except ImportError:
        # Fallback: use ctypes
        try:
            PROCESS_QUERY_INFORMATION = 0x0400
            PROCESS_VM_READ = 0x0010
            
            handle = kernel32.OpenProcess(
                PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
                False,
                pid
            )
            
            if handle:
                buffer = ctypes.create_unicode_buffer(260)
                size = wintypes.DWORD(260)
                kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size))
                kernel32.CloseHandle(handle)
                
                # Extract just the filename
                path = buffer.value
                if path:
                    import os
                    return os.path.basename(path).replace('.exe', '')
            
            return "Unknown"
        except:
            return "Unknown"
    except Exception:
        return "Unknown"


def get_idle_time() -> float:
    """
    Get the number of seconds since the last user input on Windows.
    Uses GetLastInputInfo from Win32 API.
    
    Returns:
        float: Seconds since last input
    """
    if not user32:
        return 0.0
    
    try:
        last_input_info = LASTINPUTINFO()
        last_input_info.cbSize = ctypes.sizeof(LASTINPUTINFO)
        
        if user32.GetLastInputInfo(ctypes.byref(last_input_info)):
            millis = kernel32.GetTickCount() - last_input_info.dwTime
            return millis / 1000.0
        
        return 0.0
    
    except Exception as e:
        print(f"Error getting idle time: {e}")
        return 0.0


def is_windows() -> bool:
    """Check if running on Windows"""
    import platform
    return platform.system() == "Windows"


if __name__ == "__main__":
    # Test the functions
    import time
    
    print("Testing Windows platform functions...")
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
