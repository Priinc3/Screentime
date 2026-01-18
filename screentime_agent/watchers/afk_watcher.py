"""
AFK Watcher - Detects User Away From Keyboard Status
Inspired by ActivityWatch's aw-watcher-afk
"""

import platform
from typing import Optional
from datetime import datetime, timezone

import sys
sys.path.insert(0, '..')
from models import AFKEvent


class AFKWatcher:
    """
    Watches for user input activity to determine AFK status.
    Uses keyboard and mouse input to track activity.
    """
    
    def __init__(self, afk_timeout: float = 300.0):
        """
        Initialize AFK Watcher
        
        Args:
            afk_timeout: Seconds of inactivity before user is considered AFK (default: 5 minutes)
        """
        self.afk_timeout = afk_timeout
        self.is_afk = False
        self.last_input_time = datetime.now(timezone.utc)
        
        # Load platform-specific implementation
        self._get_idle_time = self._load_platform_impl()
    
    def _load_platform_impl(self):
        """Load the appropriate platform implementation"""
        system = platform.system()
        
        if system == "Darwin":
            from .platform.macos import get_idle_time
            return get_idle_time
        elif system == "Windows":
            from .platform.windows import get_idle_time
            return get_idle_time
        elif system == "Linux":
            from .platform.linux import get_idle_time
            return get_idle_time
        else:
            # Fallback: always return 0 (never idle)
            return lambda: 0.0
    
    def get_afk_status(self) -> AFKEvent:
        """
        Get current AFK status.
        
        Returns:
            AFKEvent with current status
        """
        try:
            idle_seconds = self._get_idle_time()
            now = datetime.now(timezone.utc)
            
            was_afk = self.is_afk
            self.is_afk = idle_seconds >= self.afk_timeout
            
            # Update last input time if not idle
            if idle_seconds < 5:  # Some tolerance
                self.last_input_time = now
            
            return AFKEvent(
                is_afk=self.is_afk,
                timestamp=now,
                seconds_since_input=idle_seconds
            )
        except Exception as e:
            print(f"Error getting AFK status: {e}")
            return AFKEvent(
                is_afk=False,
                timestamp=datetime.now(timezone.utc),
                seconds_since_input=0
            )
    
    def has_afk_changed(self, current: AFKEvent) -> bool:
        """Check if AFK status has changed"""
        return current.is_afk != self.is_afk
    
    @property
    def seconds_since_last_input(self) -> float:
        """Get seconds since last detected input"""
        try:
            return self._get_idle_time()
        except:
            return 0.0
