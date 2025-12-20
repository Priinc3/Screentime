"""
Monitor - Background worker that tracks window activity
Equivalent to Worker.cs in the Windows agent
"""

import time
from datetime import datetime, timezone
from window_helper import get_active_window_info
from supabase_service import SupabaseService


def run_monitor():
    """Main monitoring loop"""
    import sys
    print("Starting Employee Monitor...", flush=True)
    
    service = SupabaseService()
    
    if not service.is_configured:
        print("Error: No employee ID configured. Run with --install first.", flush=True)
        return
    
    print(f"Monitoring as Employee ID: {service.employee_id}", flush=True)
    print("Press Ctrl+C to stop.\n", flush=True)
    
    last_title = ""
    last_app = ""
    start_time = datetime.now(timezone.utc)
    last_heartbeat_time = datetime.min.replace(tzinfo=timezone.utc)
    
    try:
        loop_count = 0
        while True:
            title, app = get_active_window_info()
            now = datetime.now(timezone.utc)
            
            loop_count += 1
            
            # Debug: Print first 5 iterations to see all values
            if loop_count <= 5:
                print(f"[DEBUG] Iter={loop_count}, title={title!r}, app={app!r}, last_title={last_title!r}, last_app={last_app!r}", flush=True)
            
            # Debug: Print every 30 loops (30 seconds) to confirm agent is running
            if loop_count % 30 == 0:
                print(f"[Heartbeat] Loop {loop_count}, Current: {app}", flush=True)
            
            # 1. Handle Window Changes (Logging)
            if title != last_title or app != last_app:
                print(f"[SWITCH] Old: {last_app}/{last_title} -> New: {app}/{title}", flush=True)
                
                # Window changed, log the previous one
                if last_title:
                    duration = int((now - start_time).total_seconds())
                    if duration > 0:
                        print(f"Activity: {last_app} - {last_title} ({duration}s)", flush=True)
                        service.log_activity(last_title, last_app, duration)
                    else:
                        print(f"[SKIP] Duration was 0s", flush=True)
                else:
                    print(f"[SKIP] last_title was empty (initial app)", flush=True)
                
                last_title = title
                last_app = app
                start_time = now
                
                # Force immediate heartbeat on change
                service.update_heartbeat(title, app)
                last_heartbeat_time = now
            
            # 2. Handle Periodic Heartbeat (every 10 seconds)
            if (now - last_heartbeat_time).total_seconds() >= 10:
                service.update_heartbeat(title, app)
                last_heartbeat_time = now
            
            time.sleep(1)
    
    except KeyboardInterrupt:
        # Log final activity before exit
        if last_title:
            duration = int((datetime.now(timezone.utc) - start_time).total_seconds())
            if duration > 0:
                service.log_activity(last_title, last_app, duration)
        print("\nMonitor stopped.")


if __name__ == "__main__":
    run_monitor()
