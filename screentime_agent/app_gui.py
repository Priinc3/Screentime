#!/usr/bin/env python3
"""
Screen Time Agent - GUI Entry Point
This is the main entry point when running as a standalone app.
Uses web-based setup (no tkinter) and system tray/menu bar.
"""

import sys
import os
import threading
import platform
import time
import logging

# Ensure we can find our modules when running as a frozen app
if getattr(sys, 'frozen', False):
    # Running as compiled
    base_path = sys._MEIPASS
    os.chdir(os.path.dirname(sys.executable))
else:
    # Running as script
    base_path = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_path)

sys.path.insert(0, base_path)

# Setup logging
from config import LOG_DIR, CONFIG_DIR
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, 'agent.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class AgentGUI:
    """Main application class for the Screen Time Agent"""
    
    def __init__(self):
        self.service = None
        self.service_thread = None
        self.running = False
        
    def show_setup_dialog(self) -> bool:
        """Show web-based setup dialog"""
        logger.info("Starting setup wizard...")
        
        try:
            from setup_server import run_setup_wizard
            
            success, result = run_setup_wizard()
            
            if success and result and result.get('success'):
                logger.info(f"Setup complete: {result.get('name')}")
                return True
            else:
                logger.error("Setup was cancelled or failed")
                return False
                
        except Exception as e:
            logger.error(f"Setup error: {e}")
            self._show_error_dialog(f"Setup failed: {e}")
            return False
    
    def _show_error_dialog(self, message: str):
        """Show error dialog - cross platform"""
        system = platform.system()
        
        if system == "Darwin":
            # macOS
            os.system(f'''osascript -e 'display dialog "{message}" with title "Screen Time Agent Error" buttons {{"OK"}} default button "OK"' ''')
        elif system == "Windows":
            # Windows - use ctypes
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(0, message, "Screen Time Agent Error", 0x10)
            except:
                print(f"ERROR: {message}")
        else:
            print(f"ERROR: {message}")
    
    def _show_info_dialog(self, title: str, message: str):
        """Show info dialog - cross platform"""
        system = platform.system()
        
        if system == "Darwin":
            os.system(f'''osascript -e 'display dialog "{message}" with title "{title}" buttons {{"OK"}} default button "OK"' ''')
        elif system == "Windows":
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(0, message, title, 0x40)
            except:
                print(f"INFO: {message}")
        else:
            print(f"INFO: {message}")
    
    def start_service(self):
        """Start the monitoring service in background"""
        try:
            from service import ScreenTimeService
            self.service = ScreenTimeService()
            self.running = True
            logger.info("Starting monitoring service...")
            self.service.start()
        except Exception as e:
            logger.error(f"Service error: {e}")
            self.running = False
    
    def stop_service(self):
        """Stop the monitoring service"""
        logger.info("Stopping service...")
        if self.service:
            self.service.stop()
        self.running = False
    
    def run_macos(self):
        """Run with macOS menu bar icon"""
        from config import load_config, CONFIG_DIR
        
        try:
            import rumps
            
            class ScreenTimeApp(rumps.App):
                def __init__(self, agent):
                    super().__init__("⏱", quit_button=None)
                    self.agent = agent
                    self.menu = [
                        rumps.MenuItem("✓ Monitoring Active", callback=None),
                        None,  # Separator
                        rumps.MenuItem("Open Dashboard", callback=self.open_dashboard),
                        rumps.MenuItem("View Status", callback=self.view_status),
                        None,
                        rumps.MenuItem("Quit", callback=self.quit_app),
                    ]
                    
                    # Start service in background
                    thread = threading.Thread(target=self.agent.start_service, daemon=True)
                    thread.start()
                    logger.info("macOS menu bar app started")
                
                def open_dashboard(self, _):
                    import webbrowser
                    webbrowser.open("http://localhost:3000")
                
                def view_status(self, _):
                    config = load_config()
                    pending = 0
                    try:
                        from offline_queue import OfflineQueue
                        queue = OfflineQueue()
                        pending = queue.get_pending_count()
                    except:
                        pass
                    
                    rumps.alert(
                        title="Agent Status",
                        message=f"Employee: {config.employee_name}\n"
                                f"ID: {config.employee_id[:8] if config.employee_id else 'N/A'}...\n"
                                f"Database: {config.database_provider}\n"
                                f"Pending sync: {pending} activities\n"
                                f"Config: {CONFIG_DIR}"
                    )
                
                def quit_app(self, _):
                    self.agent.stop_service()
                    rumps.quit_application()
            
            app = ScreenTimeApp(self)
            app.run()
            
        except ImportError:
            logger.warning("rumps not available, running headless")
            self.run_headless()
    
    def run_windows(self):
        """Run with Windows system tray icon"""
        from config import load_config, CONFIG_DIR
        
        try:
            import pystray
            from PIL import Image, ImageDraw
            
            # Create a simple icon (green circle)
            def create_icon():
                size = 64
                image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
                draw = ImageDraw.Draw(image)
                draw.ellipse([4, 4, size-4, size-4], fill=(76, 175, 80, 255))
                return image
            
            def on_open_dashboard(icon, item):
                import webbrowser
                webbrowser.open("http://localhost:3000")
            
            def on_view_status(icon, item):
                config = load_config()
                pending = 0
                try:
                    from offline_queue import OfflineQueue
                    queue = OfflineQueue()
                    pending = queue.get_pending_count()
                except:
                    pass
                
                self._show_info_dialog(
                    "Agent Status",
                    f"Employee: {config.employee_name}\n"
                    f"ID: {config.employee_id[:8] if config.employee_id else 'N/A'}...\n"
                    f"Database: {config.database_provider}\n"
                    f"Pending sync: {pending}"
                )
            
            def on_quit(icon, item):
                self.stop_service()
                icon.stop()
            
            # Start service in background
            service_thread = threading.Thread(target=self.start_service, daemon=True)
            service_thread.start()
            
            # Create system tray icon
            icon = pystray.Icon(
                "ScreenTimeAgent",
                create_icon(),
                "Screen Time Agent - Running",
                menu=pystray.Menu(
                    pystray.MenuItem("✓ Monitoring Active", lambda: None, enabled=False),
                    pystray.Menu.SEPARATOR,
                    pystray.MenuItem("Open Dashboard", on_open_dashboard),
                    pystray.MenuItem("View Status", on_view_status),
                    pystray.Menu.SEPARATOR,
                    pystray.MenuItem("Quit", on_quit),
                )
            )
            
            logger.info("Windows system tray app started")
            icon.run()
            
        except ImportError as e:
            logger.warning(f"pystray/pillow not available ({e}), running headless")
            self.run_headless()
    
    def run_headless(self):
        """Run without any GUI (background mode)"""
        logger.info("Running in headless mode...")
        print("\n" + "="*50)
        print("  Screen Time Agent - Running")
        print("="*50)
        print("\nPress Ctrl+C to stop.\n")
        
        self.start_service()
    
    def run(self):
        """Main entry point"""
        from config import is_configured
        
        logger.info("Screen Time Agent starting...")
        
        # Check if already configured
        if not is_configured():
            logger.info("First run - showing setup wizard")
            if not self.show_setup_dialog():
                logger.error("Setup not completed, exiting")
                sys.exit(1)
        
        # Re-check after setup
        if not is_configured():
            self._show_error_dialog(
                "Setup was not completed.\n\n"
                "Please run the agent again to complete setup."
            )
            sys.exit(1)
        
        # Start based on platform
        system = platform.system()
        logger.info(f"Running on {system}")
        
        try:
            if system == "Darwin":
                self.run_macos()
            elif system == "Windows":
                self.run_windows()
            else:
                self.run_headless()
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt")
            self.stop_service()
        except Exception as e:
            logger.error(f"Fatal error: {e}")
            self._show_error_dialog(f"Agent crashed: {e}")
            sys.exit(1)


def main():
    """Entry point for PyInstaller"""
    try:
        app = AgentGUI()
        app.run()
    except Exception as e:
        logger.error(f"Startup error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
