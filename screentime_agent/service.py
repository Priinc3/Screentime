"""
Screen Time Service - Core Monitoring Logic
The main service that orchestrates watchers and database logging
Includes offline queue and sleep/wake detection
"""

import time
import signal
import logging
from datetime import datetime, timezone
from typing import Optional
import threading

from config import load_config, is_configured, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY
from models import WindowEvent, ActivityLog, Heartbeat
from watchers import WindowWatcher, AFKWatcher
from database import get_database
from offline_queue import OfflineQueue, OfflineSyncManager

logger = logging.getLogger(__name__)


class ScreenTimeService:
    """
    Main monitoring service that:
    1. Polls active window using WindowWatcher
    2. Tracks AFK status using AFKWatcher
    3. Logs activities to database (with offline fallback)
    4. Sends periodic heartbeats
    5. Handles sleep/wake events
    """
    
    def __init__(self, verbose: bool = False, debug: bool = False):
        self.verbose = verbose
        self.debug = debug
        self.running = False
        self._lock = threading.Lock()
        
        # Load configuration
        self.config = load_config()
        
        # Initialize offline queue first (always works)
        self.queue = OfflineQueue()
        
        # Initialize database
        self.db = None
        self.db_connected = False
        self._init_database()
        
        # Initialize offline sync manager
        self.sync_manager = None
        if self.db and self.db_connected:
            self.sync_manager = OfflineSyncManager(self.db, self.queue)
        
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
        
        # Sleep/wake detection
        self.last_activity_time: datetime = datetime.now(timezone.utc)
        self.was_sleeping = False
        
        # Setup signal handlers (only works in main thread)
        try:
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)
        except ValueError:
            # Not in main thread, signals will be handled by parent
            pass
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down...")
        self.stop()
    
    def _init_database(self):
        """Initialize database connection"""
        config = self.config
        
        try:
            # Use stored config or defaults
            if config.database_provider == "supabase":
                url = config.supabase_url or DEFAULT_SUPABASE_URL
                key = config.supabase_key or DEFAULT_SUPABASE_KEY
                self.db = get_database("supabase", url=url, key=key)
            elif config.database_provider in ("postgres", "rds"):
                self.db = get_database(config.database_provider, 
                                connection_string=config.postgres_connection)
            else:
                # Default to Supabase
                self.db = get_database("supabase", 
                                url=DEFAULT_SUPABASE_URL, 
                                key=DEFAULT_SUPABASE_KEY)
            
            # Try to connect
            self.db_connected = self.db.connect()
            if not self.db_connected:
                logger.warning("Database connection failed - running in offline mode")
            else:
                logger.info("Database connected successfully")
                
        except Exception as e:
            logger.error(f"Database init error: {e}")
            self.db_connected = False
    
    def _check_reconnect(self):
        """Try to reconnect if disconnected"""
        if not self.db_connected and self.db:
            try:
                self.db_connected = self.db.connect()
                if self.db_connected:
                    logger.info("Reconnected to database")
                    # Start sync manager if not running
                    if not self.sync_manager:
                        self.sync_manager = OfflineSyncManager(self.db, self.queue)
                        self.sync_manager.start()
            except:
                pass
    
    def _is_online(self) -> bool:
        """Check internet connectivity"""
        try:
            import socket
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except OSError:
            return False
    
    def _detect_sleep_wake(self, now: datetime) -> bool:
        """
        Detect if the system was sleeping.
        If time gap > 2x poll interval, assume sleep occurred.
        """
        if self.last_activity_time:
            gap = (now - self.last_activity_time).total_seconds()
            expected_gap = self.config.poll_interval * 2
            
            if gap > max(60, expected_gap):  # At least 60 seconds gap
                return True
        
        return False
    
    def start(self):
        """Start the monitoring loop"""
        if not is_configured():
            logger.error("Agent not configured. Run with --install first.")
            return
        
        self.running = True
        employee_id = self.config.employee_id
        
        # Start sync manager
        if self.sync_manager:
            self.sync_manager.start()
        
        # Status output
        status_lines = [
            f"Monitoring as Employee ID: {employee_id}",
            f"Database: {self.config.database_provider} ({'connected' if self.db_connected else 'OFFLINE'})",
            f"Poll interval: {self.config.poll_interval}s",
            f"Heartbeat interval: {self.config.heartbeat_interval}s",
            f"AFK timeout: {self.config.afk_timeout}s"
        ]
        
        for line in status_lines:
            logger.info(line)
            print(line)
        
        print()
        print("Press Ctrl+C to stop.")
        print("=" * 50)
        
        loop_count = 0
        reconnect_check_interval = 60  # Check reconnection every 60 loops
        
        while self.running:
            loop_count += 1
            now = datetime.now(timezone.utc)
            
            try:
                # Check for sleep/wake
                if self._detect_sleep_wake(now):
                    logger.info("Detected wake from sleep")
                    # Log final activity before sleep
                    if self.last_window_event and self.window_start_time:
                        duration = int((self.last_activity_time - self.window_start_time).total_seconds())
                        if duration > 0:
                            self._log_activity(
                                self.last_window_event,
                                self.window_start_time,
                                self.last_activity_time,
                                duration
                            )
                    # Reset tracking
                    self.last_window_event = None
                    self.window_start_time = None
                
                self.last_activity_time = now
                
                # Periodic reconnection check
                if loop_count % reconnect_check_interval == 0 and not self.db_connected:
                    self._check_reconnect()
                
                # 1. Get current window
                current_window = self.window_watcher.get_current_window()
                
                # 2. Get AFK status
                afk_status = self.afk_watcher.get_afk_status()
                
                # Debug output
                if self.debug and loop_count <= 5:
                    logger.debug(f"Loop {loop_count}: "
                          f"app={current_window.app_name if current_window else 'None'}, "
                          f"afk={afk_status.is_afk}")
                
                # 3. Handle window change
                if current_window and self._has_window_changed(current_window):
                    self._on_window_change(current_window, now, afk_status.is_afk)
                
                # 4. Periodic heartbeat
                if self._should_send_heartbeat(now):
                    self._send_heartbeat(current_window, afk_status.is_afk, now)
                
                # 5. Verbose status
                if self.verbose and loop_count % 30 == 0:
                    app = current_window.app_name if current_window else "Unknown"
                    pending = self.queue.get_pending_count()
                    status = "online" if self.db_connected else f"offline ({pending} queued)"
                    print(f"[{loop_count}] {app} | AFK: {afk_status.is_afk} | {status}")
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                if self.debug:
                    import traceback
                    traceback.print_exc()
            
            # Sleep for poll interval
            time.sleep(self.config.poll_interval)
        
        # Final cleanup
        self._shutdown()
    
    def stop(self):
        """Stop the monitoring loop"""
        logger.info("Stopping service...")
        self.running = False
    
    def _shutdown(self):
        """Clean shutdown"""
        # Log final activity
        self._log_final_activity()
        
        # Stop sync manager
        if self.sync_manager:
            self.sync_manager.stop()
        
        # Cleanup queue
        self.queue.cleanup_old(days=30)
        
        pending = self.queue.get_pending_count()
        if pending > 0:
            logger.info(f"Note: {pending} activities pending sync")
        
        print("\nMonitoring stopped.")
    
    def _has_window_changed(self, current: WindowEvent) -> bool:
        """Check if the window has changed"""
        if self.last_window_event is None:
            return True
        return current != self.last_window_event
    
    def _on_window_change(self, new_window: WindowEvent, now: datetime, is_afk: bool = False):
        """Handle a window change event"""
        # Log the previous window's activity
        if self.last_window_event and self.window_start_time:
            duration = int((now - self.window_start_time).total_seconds())
            
            if duration > 0:
                self._log_activity(
                    self.last_window_event,
                    self.window_start_time,
                    now,
                    duration,
                    is_afk
                )
                
                if self.verbose:
                    print(f"[LOGGED] {self.last_window_event.app_name}: "
                          f"{self.last_window_event.window_title[:50]} ({duration}s)")
        
        # Update tracking
        self.last_window_event = new_window
        self.window_start_time = now
        
        # Immediate heartbeat on change
        self._send_heartbeat(new_window, is_afk, now)
    
    def _log_activity(
        self, 
        event: WindowEvent, 
        start: datetime, 
        end: datetime, 
        duration: int,
        is_afk: bool = False
    ):
        """Log an activity to the database (with offline fallback)"""
        if not self.config.employee_id:
            return
        
        employee_id = self.config.employee_id
        
        # Try direct database logging
        if self.db_connected and self.db:
            try:
                activity = ActivityLog(
                    employee_id=employee_id,
                    app_name=event.app_name,
                    window_title=event.window_title,
                    start_time=start,
                    end_time=end,
                    duration_seconds=duration
                )
                
                if self.db.log_activity(activity=activity):
                    return  # Success
                else:
                    self.db_connected = False
                    
            except Exception as e:
                logger.warning(f"Database log failed: {e}")
                self.db_connected = False
        
        # Fallback to offline queue
        self.queue.add_activity(
            employee_id=employee_id,
            app_name=event.app_name,
            window_title=event.window_title,
            start_time=start,
            end_time=end,
            duration_seconds=duration,
            is_afk=is_afk
        )
    
    def _should_send_heartbeat(self, now: datetime) -> bool:
        """Check if we should send a heartbeat"""
        elapsed = (now - self.last_heartbeat_time).total_seconds()
        return elapsed >= self.config.heartbeat_interval
    
    def _send_heartbeat(self, window: Optional[WindowEvent], is_afk: bool, now: datetime):
        """Send a heartbeat to the database"""
        if not self.config.employee_id:
            return
        
        if self.db_connected and self.db:
            try:
                heartbeat = Heartbeat(
                    employee_id=self.config.employee_id,
                    current_window=window.window_title if window else "",
                    current_app=window.app_name if window else "",
                    timestamp=now,
                    is_afk=is_afk
                )
                
                self.db.update_heartbeat(heartbeat)
            except Exception as e:
                logger.warning(f"Heartbeat failed: {e}")
        
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
