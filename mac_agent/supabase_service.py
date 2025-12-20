"""
Supabase Service - Handles all Supabase API interactions
"""

import os
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from supabase import create_client, Client

# Supabase Configuration (same as Windows agent)
SUPABASE_URL = "https://cvrtaecpuwbyixxxiclt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cnRhZWNwdXdieWl4eHhpY2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDY1MDIsImV4cCI6MjA4MDMyMjUwMn0.7zGRwxySIyUZdgVtnEYxVHxPcksQ5zonmh7Bx-ozbOw"

# Config path
CONFIG_DIR = Path.home() / "Library" / "Application Support" / "EmployeeMonitor"
CONFIG_FILE = CONFIG_DIR / "config.json"


class SupabaseService:
    def __init__(self):
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.employee_id: str | None = None
        self._load_config()

    def _load_config(self):
        """Load employee ID from config file"""
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r') as f:
                    config = json.load(f)
                    self.employee_id = config.get('EmployeeId')
        except Exception as e:
            print(f"Error loading config: {e}")

    def _save_config(self, employee_id: str):
        """Save employee ID to config file"""
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            with open(CONFIG_FILE, 'w') as f:
                json.dump({'EmployeeId': employee_id}, f)
            self.employee_id = employee_id
        except Exception as e:
            print(f"Error saving config: {e}")

    def get_employee(self, employee_id: str) -> dict | None:
        """Get employee by ID"""
        try:
            response = self.client.table('employees').select('*').eq('id', employee_id).single().execute()
            return response.data
        except Exception:
            return None

    def register_employee(self, name: str, custom_id: str | None = None) -> str:
        """Register a new employee"""
        new_id = custom_id if custom_id else str(uuid.uuid4())
        
        employee = {
            'id': new_id,
            'full_name': name,
            'email': f"{name.lower().replace(' ', '.')}@example.com",
            'department': 'General',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        try:
            self.client.table('employees').insert(employee).execute()
            self._save_config(new_id)
            return new_id
        except Exception as e:
            print(f"Error registering employee: {e}")
            raise

    def update_heartbeat(self, window_title: str, app_name: str):
        """Update employee heartbeat"""
        if not self.employee_id:
            return
        
        try:
            self.client.table('employees').update({
                'current_window': window_title,
                'current_app': app_name,
                'last_heartbeat': datetime.now(timezone.utc).isoformat()
            }).eq('id', self.employee_id).execute()
        except Exception as e:
            print(f"Error updating heartbeat: {e}")

    def log_activity(self, window_title: str, app_name: str, duration_seconds: int):
        """Log activity to Supabase"""
        if not self.employee_id:
            print("No employee ID configured. Skipping log.")
            return
        
        try:
            now = datetime.now(timezone.utc)
            start_time = datetime.fromtimestamp(now.timestamp() - duration_seconds, tz=timezone.utc)
            
            log = {
                'employee_id': self.employee_id,
                'window_title': window_title,
                'app_name': app_name,
                'start_time': start_time.isoformat(),
                'end_time': now.isoformat(),
                'duration_seconds': duration_seconds
            }
            
            self.client.table('activity_logs').insert(log).execute()
        except Exception as e:
            print(f"Error logging activity: {e}")

    @property
    def is_configured(self) -> bool:
        """Check if agent is configured with an employee ID"""
        return self.employee_id is not None


if __name__ == "__main__":
    # Test the service
    service = SupabaseService()
    print(f"Configured: {service.is_configured}")
    print(f"Employee ID: {service.employee_id}")
