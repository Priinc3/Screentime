"""
Window Watcher - Tracks Active Window and Application
Inspired by ActivityWatch's aw-watcher-window
"""

import platform
from typing import Optional, Tuple
from datetime import datetime, timezone

import sys
sys.path.insert(0, '..')
from models import WindowEvent


class WindowWatcher:
    """
    Watches the currently active window and application.
    Uses platform-specific implementations for window detection.
    """
    
    def __init__(self, exclude_apps: list = None, exclude_titles: list = None):
        self.exclude_apps = exclude_apps or []
        self.exclude_titles = exclude_titles or []
        self.last_event: Optional[WindowEvent] = None
        
        # Load platform-specific implementation
        self._get_window_info = self._load_platform_impl()
    
    def _load_platform_impl(self):
        """Load the appropriate platform implementation"""
        system = platform.system()
        
        if system == "Darwin":
            from .platform.macos import get_active_window_info
            return get_active_window_info
        elif system == "Windows":
            from .platform.windows import get_active_window_info
            return get_active_window_info
        elif system == "Linux":
            from .platform.linux import get_active_window_info
            return get_active_window_info
        else:
            raise NotImplementedError(f"Platform {system} is not supported")
    
    def get_current_window(self) -> Optional[WindowEvent]:
        """
        Get the currently active window as a WindowEvent.
        Returns None if unable to detect window.
        """
        try:
            window_title, app_name = self._get_window_info()
            
            if not window_title and not app_name:
                return None
            
            # Check exclusions
            if self._should_exclude(app_name, window_title):
                return None
            
            return WindowEvent(
                app_name=app_name or "Unknown",
                window_title=window_title or app_name or "Unknown",
                timestamp=datetime.now(timezone.utc)
            )
        except Exception as e:
            print(f"Error getting window info: {e}")
            return None
    
    def _should_exclude(self, app_name: str, window_title: str) -> bool:
        """Check if this window should be excluded"""
        if app_name and any(exc.lower() in app_name.lower() for exc in self.exclude_apps):
            return True
        if window_title and any(exc.lower() in window_title.lower() for exc in self.exclude_titles):
            return True
        return False
    
    def has_window_changed(self, current: WindowEvent) -> bool:
        """Check if window has changed from last event"""
        if self.last_event is None:
            return True
        
        return current != self.last_event
    
    def update_last_event(self, event: WindowEvent) -> None:
        """Update the last recorded event"""
        self.last_event = event
