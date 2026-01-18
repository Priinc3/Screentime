"""
PostgreSQL/AWS RDS Database Backend
Alternative database implementation for direct PostgreSQL connections
"""

from typing import Optional
from datetime import datetime, timezone
import uuid

from .base import DatabaseBackend
import sys
sys.path.insert(0, '..')
from models import Employee, ActivityLog, Heartbeat


class PostgresBackend(DatabaseBackend):
    """PostgreSQL/AWS RDS implementation of the database backend"""
    
    def __init__(self, connection_string: str, ssl: bool = True):
        self.connection_string = connection_string
        self.ssl = ssl
        self.connection = None
    
    def connect(self) -> bool:
        """Establish connection to PostgreSQL"""
        try:
            import psycopg2
            
            self.connection = psycopg2.connect(
                self.connection_string,
                sslmode='require' if self.ssl else 'prefer'
            )
            return True
        except ImportError:
            print("psycopg2 not installed. Run: pip install psycopg2-binary")
            return False
        except Exception as e:
            print(f"Failed to connect to PostgreSQL: {e}")
            return False
    
    def disconnect(self) -> None:
        """Close PostgreSQL connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
    
    def _execute(self, query: str, params: tuple = None, fetch: bool = False):
        """Execute a query"""
        if not self.connection:
            raise RuntimeError("Database not connected")
        
        cursor = self.connection.cursor()
        try:
            cursor.execute(query, params)
            
            if fetch:
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            
            self.connection.commit()
            return True
        except Exception as e:
            self.connection.rollback()
            raise e
        finally:
            cursor.close()
    
    def get_employee(self, employee_id: str) -> Optional[Employee]:
        """Get employee by ID"""
        try:
            result = self._execute(
                "SELECT * FROM employees WHERE id = %s",
                (employee_id,),
                fetch=True
            )
            if result:
                return Employee.from_dict(result[0])
            return None
        except Exception as e:
            print(f"Error getting employee: {e}")
            return None
    
    def create_employee(self, name: str, employee_id: Optional[str] = None) -> Employee:
        """Create a new employee"""
        new_id = employee_id or str(uuid.uuid4())
        
        employee_data = {
            'id': new_id,
            'full_name': name,
            'email': f"{name.lower().replace(' ', '.')}@example.com",
            'department': 'General',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        try:
            self._execute(
                """INSERT INTO employees (id, full_name, email, department, created_at) 
                   VALUES (%s, %s, %s, %s, %s)""",
                (new_id, name, employee_data['email'], 'General', employee_data['created_at'])
            )
            return Employee.from_dict(employee_data)
        except Exception as e:
            print(f"Error creating employee: {e}")
            raise
    
    def update_heartbeat(self, heartbeat: Heartbeat) -> bool:
        """Update employee heartbeat"""
        try:
            self._execute(
                """UPDATE employees 
                   SET current_window = %s, current_app = %s, last_heartbeat = %s 
                   WHERE id = %s""",
                (heartbeat.current_window, heartbeat.current_app, 
                 heartbeat.timestamp.isoformat(), heartbeat.employee_id)
            )
            return True
        except Exception as e:
            print(f"Error updating heartbeat: {e}")
            return False
    
    def log_activity(self, activity: ActivityLog) -> bool:
        """Log an activity session"""
        try:
            self._execute(
                """INSERT INTO activity_logs 
                   (employee_id, app_name, window_title, start_time, end_time, duration_seconds) 
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (activity.employee_id, activity.app_name, activity.window_title,
                 activity.start_time.isoformat(), activity.end_time.isoformat(),
                 activity.duration_seconds)
            )
            return True
        except Exception as e:
            print(f"Error logging activity: {e}")
            return False
