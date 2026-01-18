"""
Database Abstraction Layer for Agent
Provides a unified interface for different database backends
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid

from models import Employee, ActivityLog, Heartbeat


class DatabaseBackend(ABC):
    """Abstract base class for database backends"""
    
    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to the database"""
        pass
    
    @abstractmethod
    def disconnect(self) -> None:
        """Close the database connection"""
        pass
    
    @abstractmethod
    def get_employee(self, employee_id: str) -> Optional[Employee]:
        """Get employee by ID"""
        pass
    
    @abstractmethod
    def create_employee(self, name: str, employee_id: Optional[str] = None) -> Employee:
        """Create a new employee"""
        pass
    
    @abstractmethod
    def update_heartbeat(self, heartbeat: Heartbeat) -> bool:
        """Update employee heartbeat"""
        pass
    
    @abstractmethod
    def log_activity(self, activity: ActivityLog) -> bool:
        """Log an activity session"""
        pass
