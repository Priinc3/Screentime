"""
Data Models
Defines data structures for events, heartbeats, and activity tracking
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid


@dataclass
class WindowEvent:
    """Represents a window/application focus event"""
    app_name: str
    window_title: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "app_name": self.app_name,
            "window_title": self.window_title,
            "timestamp": self.timestamp.isoformat(),
        }
    
    def __eq__(self, other):
        if not isinstance(other, WindowEvent):
            return False
        return self.app_name == other.app_name and self.window_title == other.window_title


@dataclass
class AFKEvent:
    """Represents an AFK (Away From Keyboard) status event"""
    is_afk: bool
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    seconds_since_input: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": "afk" if self.is_afk else "not-afk",
            "timestamp": self.timestamp.isoformat(),
            "seconds_since_input": self.seconds_since_input,
        }


@dataclass
class ActivityLog:
    """Represents a logged activity session"""
    employee_id: str
    app_name: str
    window_title: str
    start_time: datetime
    end_time: datetime
    duration_seconds: int
    id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "employee_id": self.employee_id,
            "app_name": self.app_name,
            "window_title": self.window_title,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "duration_seconds": self.duration_seconds,
        }


@dataclass
class Heartbeat:
    """Represents a heartbeat update for an employee"""
    employee_id: str
    current_window: str
    current_app: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_afk: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "current_window": self.current_window,
            "current_app": self.current_app,
            "last_heartbeat": self.timestamp.isoformat(),
        }


@dataclass
class Employee:
    """Represents an employee record"""
    id: str
    full_name: str
    email: Optional[str] = None
    department: Optional[str] = None
    current_window: Optional[str] = None
    current_app: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Employee':
        return cls(
            id=data.get('id', ''),
            full_name=data.get('full_name', ''),
            email=data.get('email'),
            department=data.get('department'),
            current_window=data.get('current_window'),
            current_app=data.get('current_app'),
            last_heartbeat=data.get('last_heartbeat'),
            created_at=data.get('created_at'),
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "department": self.department,
        }
