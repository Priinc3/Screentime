"""
Offline Queue - SQLite-based queue for offline activity storage
Syncs with database when internet connection is restored
"""

import sqlite3
import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from config import LOG_DIR, CONFIG_DIR


class OfflineQueue:
    """
    SQLite-based queue for storing activities when offline.
    Automatically syncs when connection is restored.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize the offline queue"""
        if db_path is None:
            os.makedirs(CONFIG_DIR, exist_ok=True)
            db_path = os.path.join(CONFIG_DIR, "offline_queue.db")
        
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()
    
    def _init_db(self):
        """Initialize the SQLite database"""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create tables
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS activity_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id TEXT NOT NULL,
                    app_name TEXT NOT NULL,
                    window_title TEXT,
                    start_time TEXT NOT NULL,
                    end_time TEXT NOT NULL,
                    duration_seconds INTEGER NOT NULL,
                    is_afk INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    synced INTEGER DEFAULT 0,
                    sync_attempts INTEGER DEFAULT 0,
                    last_error TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS heartbeat_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    current_app TEXT,
                    is_afk INTEGER DEFAULT 0,
                    synced INTEGER DEFAULT 0
                )
            ''')
            
            # Create indexes
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_activity_synced 
                ON activity_queue(synced)
            ''')
            
            conn.commit()
            conn.close()
    
    def add_activity(
        self,
        employee_id: str,
        app_name: str,
        window_title: str,
        start_time: datetime,
        end_time: datetime,
        duration_seconds: int,
        is_afk: bool = False
    ) -> int:
        """Add an activity to the queue"""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO activity_queue 
                (employee_id, app_name, window_title, start_time, end_time, 
                 duration_seconds, is_afk, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                employee_id,
                app_name,
                window_title,
                start_time.isoformat(),
                end_time.isoformat(),
                duration_seconds,
                1 if is_afk else 0,
                datetime.now().isoformat()
            ))
            
            row_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return row_id
    
    def add_heartbeat(
        self,
        employee_id: str,
        current_app: str,
        is_afk: bool = False
    ) -> int:
        """Add a heartbeat to the queue"""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO heartbeat_queue 
                (employee_id, timestamp, current_app, is_afk)
                VALUES (?, ?, ?, ?)
            ''', (
                employee_id,
                datetime.now().isoformat(),
                current_app,
                1 if is_afk else 0
            ))
            
            row_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return row_id
    
    def get_pending_activities(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get activities that haven't been synced"""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM activity_queue 
                WHERE synced = 0 AND sync_attempts < 5
                ORDER BY created_at ASC
                LIMIT ?
            ''', (limit,))
            
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            return rows
    
    def mark_synced(self, ids: List[int]):
        """Mark activities as synced"""
        if not ids:
            return
        
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            placeholders = ','.join('?' * len(ids))
            cursor.execute(f'''
                UPDATE activity_queue 
                SET synced = 1 
                WHERE id IN ({placeholders})
            ''', ids)
            
            conn.commit()
            conn.close()
    
    def mark_failed(self, id: int, error: str):
        """Mark an activity sync as failed"""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE activity_queue 
                SET sync_attempts = sync_attempts + 1, last_error = ?
                WHERE id = ?
            ''', (error, id))
            
            conn.commit()
            conn.close()
    
    def get_pending_count(self) -> int:
        """Get count of pending activities"""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT COUNT(*) FROM activity_queue WHERE synced = 0
            ''')
            
            count = cursor.fetchone()[0]
            conn.close()
            
            return count
    
    def cleanup_old(self, days: int = 30):
        """Remove old synced activities"""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cutoff = datetime.now().timestamp() - (days * 24 * 60 * 60)
            cutoff_str = datetime.fromtimestamp(cutoff).isoformat()
            
            cursor.execute('''
                DELETE FROM activity_queue 
                WHERE synced = 1 AND created_at < ?
            ''', (cutoff_str,))
            
            cursor.execute('''
                DELETE FROM heartbeat_queue 
                WHERE synced = 1 AND timestamp < ?
            ''', (cutoff_str,))
            
            conn.commit()
            conn.close()


class OfflineSyncManager:
    """
    Manages syncing offline queue with the database.
    Runs in background and detects connectivity changes.
    """
    
    def __init__(self, database, queue: OfflineQueue, sync_interval: int = 30):
        self.database = database
        self.queue = queue
        self.sync_interval = sync_interval
        self._running = False
        self._thread = None
    
    def start(self):
        """Start the background sync thread"""
        self._running = True
        self._thread = threading.Thread(target=self._sync_loop, daemon=True)
        self._thread.start()
    
    def stop(self):
        """Stop the background sync thread"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
    
    def _sync_loop(self):
        """Background sync loop"""
        while self._running:
            try:
                self._sync_pending()
            except Exception as e:
                print(f"Sync error: {e}")
            
            # Wait for next sync
            for _ in range(self.sync_interval):
                if not self._running:
                    break
                time.sleep(1)
    
    def _sync_pending(self):
        """Sync pending activities to database"""
        pending = self.queue.get_pending_activities(limit=50)
        
        if not pending:
            return
        
        synced_ids = []
        
        for activity in pending:
            try:
                # Try to log to database
                success = self.database.log_activity(
                    employee_id=activity['employee_id'],
                    app_name=activity['app_name'],
                    window_title=activity['window_title'],
                    duration_seconds=activity['duration_seconds'],
                    start_time=activity['start_time'],
                    end_time=activity['end_time']
                )
                
                if success:
                    synced_ids.append(activity['id'])
                else:
                    self.queue.mark_failed(activity['id'], "Database returned False")
                    
            except Exception as e:
                self.queue.mark_failed(activity['id'], str(e))
        
        if synced_ids:
            self.queue.mark_synced(synced_ids)
            print(f"Synced {len(synced_ids)} offline activities")
    
    def is_online(self) -> bool:
        """Check if we have internet connectivity"""
        try:
            import socket
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except OSError:
            return False
