"""
Watchers Package
Contains activity watchers for window tracking and AFK detection
"""

from .window_watcher import WindowWatcher
from .afk_watcher import AFKWatcher

__all__ = ['WindowWatcher', 'AFKWatcher']
