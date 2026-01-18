"""
Screen Time Service - Core Monitoring Logic
The main service that orchestrates watchers and database logging
"""

import time
from datetime import datetime, timezone
from typing import Optional

from config import load_config, is_configured, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY
from models import WindowEvent, ActivityLog, Heartbeat
from watchers import WindowWatcher, AFKWatcher
from database import get_database


class ScreenTimeService:
    """
    Main monitoring service that:
    1. Polls active window using WindowWatcher
    2. Tracks AFK status using AFKWatcher
    3. Logs activities to database
    4. Sends periodic heartbeats
    """
    
    def __init__(self, verbose: bool = False, debug: bool = False):
        self.verbose = verbose
        self.debug = debug
        self.running = False
        
        # Load configuration
        self.config = load_config()
        
        # Initialize database
        self.db = self._init_database()
        
        # Initialize watchers
        self.window_watcher = WindowWatcher(
            exclude_apps=self.config.exclude_apps,
            exclude_titles=self.config.exclude_titles
        )
        self.afk_watcher = AFKWatcher(
            afk_timeout=self.config.afk_timeout
        )
        
        # Tracking state
        self.last_window_event: Optional[WindowEvent] = None
        self.window_start_time: Optional[datetime] = None
        self.last_heartbeat_time: datetime = datetime.min.replace(tzinfo=timezone.utc)
    
    def _init_database(self):
        """Initialize database connection"""
        config = self.config
        
        # Use stored config or defaults
        if config.database_provider == "supabase":
            url = config.supabase_url or DEFAULT_SUPABASE_URL
            key = config.supabase_key or DEFAULT_SUPABASE_KEY
            db = get_database("supabase", url=url, key=key)
        elif config.database_provider in ("postgres", "rds"):
            db = get_database(config.database_provider, 
                            connection_string=config.postgres_connection)
        else:
            # Default to Supabase
            db = get_database("supabase", 
                            url=DEFAULT_SUPABASE_URL, 
                            key=DEFAULT_SUPABASE_KEY)
        
        # Connect
        if not db.connect():
            raise RuntimeError("Failed to connect to database")
        
        return db
    
    def start(self):
        """Start the monitoring loop"""
        if not is_configured():
            print("Error: Agent not configured. Run with --install first.")
            return
        
        self.running = True
        employee_id = self.config.employee_id
        
        print(f"Monitoring as Employee ID: {employee_id}")
        print(f"Database: {self.config.database_provider}")
        print(f"Poll interval: {self.config.poll_interval}s")
        print(f"Heartbeat interval: {self.config.heartbeat_interval}s")
        print(f"AFK timeout: {self.config.afk_timeout}s")
        print()
        print("Press Ctrl+C to stop.")
        print("=" * 50)
        
        loop_count = 0
        
        while self.running:
            loop_count += 1
            now = datetime.now(timezone.utc)
            
            try:
                # 1. Get current window
                current_window = self.window_watcher.get_current_window()
                
                # 2. Get AFK status
                afk_status = self.afk_watcher.get_afk_status()
                
                # Debug output
                if self.debug and loop_count <= 5:
                    print(f"[DEBUG] Loop {loop_count}: "
                          f"app={current_window.app_name if current_window else 'None'}, "
                          f"afk={afk_status.is_afk}")
                
                # 3. Handle window change
                if current_window and self._has_window_changed(current_window):
                    self._on_window_change(current_window, now)
                
                # 4. Periodic heartbeat
                if self._should_send_heartbeat(now):
                    self._send_heartbeat(current_window, now)
                
                # 5. Verbose status
                if self.verbose and loop_count % 30 == 0:
                    app = current_window.app_name if current_window else "Unknown"
                    print(f"[{loop_count}] Current: {app} | AFK: {afk_status.is_afk}")
                
            except Exception as e:
                print(f"Error in monitoring loop: {e}")
                if self.debug:
                    import traceback
                    traceback.print_exc()
            
            # Sleep for poll interval
            time.sleep(self.config.poll_interval)
        
        # Final cleanup - log last activity
        self._log_final_activity()
        print("\nMonitoring stopped.")
    
    def stop(self):
        """Stop the monitoring loop"""
        self.running = False
    
    def _has_window_changed(self, current: WindowEvent) -> bool:
        """Check if the window has changed"""
        if self.last_window_event is None:
            return True
        return current != self.last_window_event
    
    def _on_window_change(self, new_window: WindowEvent, now: datetime):
        """Handle a window change event"""
        # Log the previous window's activity
        if self.last_window_event and self.window_start_time:
            duration = int((now - self.window_start_time).total_seconds())
            
            if duration > 0:
                self._log_activity(
                    self.last_window_event,
                    self.window_start_time,
                    now,
                    duration
                )
                
                if self.verbose:
                    print(f"[LOGGED] {self.last_window_event.app_name}: "
                          f"{self.last_window_event.window_title[:50]} ({duration}s)")
        
        # Update tracking
        self.last_window_event = new_window
        self.window_start_time = now
        
        # Immediate heartbeat on change
        self._send_heartbeat(new_window, now)
    
    def _log_activity(self, event: WindowEvent, start: datetime, end: datetime, duration: int):
        """Log an activity to the database"""
        if not self.config.employee_id:
            return
        
        activity = ActivityLog(
            employee_id=self.config.employee_id,
            app_name=event.app_name,
            window_title=event.window_title,
            start_time=start,
            end_time=end,
            duration_seconds=duration
        )
        
        self.db.log_activity(activity)
    
    def _should_send_heartbeat(self, now: datetime) -> bool:
        """Check if we should send a heartbeat"""
        elapsed = (now - self.last_heartbeat_time).total_seconds()
        return elapsed >= self.config.heartbeat_interval
    
    def _send_heartbeat(self, window: Optional[WindowEvent], now: datetime):
        """Send a heartbeat to the database"""
        if not self.config.employee_id:
            return
        
        heartbeat = Heartbeat(
            employee_id=self.config.employee_id,
            current_window=window.window_title if window else "",
            current_app=window.app_name if window else "",
            timestamp=now
        )
        
        self.db.update_heartbeat(heartbeat)
        self.last_heartbeat_time = now
    
    def _log_final_activity(self):
        """Log the final activity when stopping"""
        if self.last_window_event and self.window_start_time:
            now = datetime.now(timezone.utc)
            duration = int((now - self.window_start_time).total_seconds())
            
            if duration > 0:
                self._log_activity(
                    self.last_window_event,
                    self.window_start_time,
                    now,
                    duration
                )
