"""
Supabase Database Backend
Primary database implementation using Supabase
"""

from typing import Optional
from datetime import datetime, timezone
import uuid

from supabase import create_client, Client

from .base import DatabaseBackend
import sys
sys.path.insert(0, '..')
from models import Employee, ActivityLog, Heartbeat


class SupabaseBackend(DatabaseBackend):
    """Supabase implementation of the database backend"""
    
    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key
        self.client: Optional[Client] = None
    
    def connect(self) -> bool:
        """Establish connection to Supabase"""
        try:
            self.client = create_client(self.url, self.key)
            # Test connection
            self.client.table('employees').select('id').limit(1).execute()
            return True
        except Exception as e:
            print(f"Failed to connect to Supabase: {e}")
            return False
    
    def disconnect(self) -> None:
        """Close Supabase connection (no-op for Supabase)"""
        self.client = None
    
    def get_employee(self, employee_id: str) -> Optional[Employee]:
        """Get employee by ID"""
        if not self.client:
            return None
        
        try:
            response = self.client.table('employees').select('*').eq('id', employee_id).single().execute()
            if response.data:
                return Employee.from_dict(response.data)
            return None
        except Exception as e:
            print(f"Error getting employee: {e}")
            return None
    
    def create_employee(self, name: str, employee_id: Optional[str] = None) -> Employee:
        """Create a new employee (basic)"""
        return self.create_employee_full(name, None, None, employee_id)
    
    def create_employee_full(
        self, 
        name: str, 
        email: Optional[str] = None,
        department: Optional[str] = None,
        employee_id: Optional[str] = None
    ) -> Employee:
        """Create a new employee with full details"""
        if not self.client:
            raise RuntimeError("Database not connected")
        
        new_id = employee_id or str(uuid.uuid4())
        
        # Generate email if not provided
        if not email:
            email = f"{name.lower().replace(' ', '.')}@example.com"
        
        employee_data = {
            'id': new_id,
            'full_name': name,
            'email': email,
            'department': department or 'General',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        try:
            response = self.client.table('employees').insert(employee_data).execute()
            return Employee.from_dict(response.data[0] if response.data else employee_data)
        except Exception as e:
            print(f"Error creating employee: {e}")
            raise
    
    def update_heartbeat(self, heartbeat: Heartbeat) -> bool:
        """Update employee heartbeat"""
        if not self.client:
            return False
        
        try:
            self.client.table('employees').update(heartbeat.to_dict()).eq('id', heartbeat.employee_id).execute()
            return True
        except Exception as e:
            print(f"Error updating heartbeat: {e}")
            return False
    
    def log_activity(
        self, 
        activity: Optional[ActivityLog] = None,
        employee_id: Optional[str] = None,
        app_name: Optional[str] = None,
        window_title: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None
    ) -> bool:
        """Log an activity session - accepts either ActivityLog or raw params"""
        if not self.client:
            return False
        
        try:
            if activity:
                data = activity.to_dict()
            else:
                # Build from raw params (used by offline sync)
                data = {
                    'employee_id': employee_id,
                    'app_name': app_name,
                    'window_title': window_title,
                    'duration': duration_seconds,
                    'start_time': start_time,
                    'end_time': end_time
                }
            
            self.client.table('activity_logs').insert(data).execute()
            return True
        except Exception as e:
            print(f"Error logging activity: {e}")
            return False
