#!/usr/bin/env python3
"""
Screen Time Agent - GUI Entry Point
This is the main entry point when running as a standalone app.
Provides a simple system tray / menu bar interface.
"""

import sys
import os
import threading
import platform

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

from config import load_config, save_config, is_configured, CONFIG_DIR
from service import ScreenTimeService


class AgentGUI:
    """Simple GUI for the Screen Time Agent"""
    
    def __init__(self):
        self.service = None
        self.service_thread = None
        self.running = False
        
    def show_setup_dialog(self):
        """Show initial setup dialog"""
        import tkinter as tk
        from tkinter import messagebox, simpledialog
        
        root = tk.Tk()
        root.withdraw()  # Hide main window
        
        # Welcome message
        messagebox.showinfo(
            "Screen Time Agent",
            "Welcome to Screen Time Agent!\n\n"
            "This application will track your screen time and activity.\n\n"
            "Click OK to set up your employee profile."
        )
        
        # Get employee name
        name = simpledialog.askstring(
            "Employee Setup",
            "Enter your name:",
            parent=root
        )
        
        if not name:
            messagebox.showerror("Setup Cancelled", "Setup was cancelled. The app will exit.")
            root.destroy()
            sys.exit(1)
        
        # Register employee
        try:
            from database import get_database
            from config import DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY
            
            db = get_database("supabase", url=DEFAULT_SUPABASE_URL, key=DEFAULT_SUPABASE_KEY)
            if not db.connect():
                messagebox.showerror("Connection Error", "Failed to connect to database.\n\nPlease check your internet connection.")
                root.destroy()
                sys.exit(1)
            
            # Create employee
            employee = db.create_employee(name)
            
            # Save config
            config = load_config()
            config.employee_id = employee.id
            config.employee_name = employee.full_name
            config.supabase_url = DEFAULT_SUPABASE_URL
            config.supabase_key = DEFAULT_SUPABASE_KEY
            save_config(config)
            
            messagebox.showinfo(
                "Setup Complete",
                f"Welcome, {name}!\n\n"
                f"Your Employee ID: {employee.id[:8]}...\n\n"
                "The agent will now start monitoring in the background.\n"
                "Look for the icon in your menu bar / system tray."
            )
            
        except Exception as e:
            messagebox.showerror("Setup Error", f"Failed to register:\n{e}")
            root.destroy()
            sys.exit(1)
        
        root.destroy()
    
    def start_service(self):
        """Start the monitoring service in background"""
        try:
            self.service = ScreenTimeService()
            self.running = True
            self.service.start()
        except Exception as e:
            print(f"Service error: {e}")
            self.running = False
    
    def stop_service(self):
        """Stop the monitoring service"""
        if self.service:
            self.service.stop()
        self.running = False
    
    def run_macos(self):
        """Run with macOS menu bar icon"""
        try:
            import rumps
        except ImportError:
            # Fallback to no icon
            self.run_headless()
            return
        
        class ScreenTimeApp(rumps.App):
            def __init__(self, agent):
                super().__init__("Screen Time", icon=None, quit_button=None)
                self.agent = agent
                self.menu = [
                    rumps.MenuItem("Status: Running", callback=None),
                    None,  # Separator
                    rumps.MenuItem("Open Dashboard", callback=self.open_dashboard),
                    rumps.MenuItem("View Config", callback=self.view_config),
                    None,
                    rumps.MenuItem("Quit", callback=self.quit_app),
                ]
                
                # Start service in background
                thread = threading.Thread(target=self.agent.start_service, daemon=True)
                thread.start()
            
            def open_dashboard(self, _):
                import webbrowser
                webbrowser.open("http://localhost:3000")
            
            def view_config(self, _):
                config = load_config()
                rumps.alert(
                    title="Configuration",
                    message=f"Employee: {config.employee_name}\n"
                            f"ID: {config.employee_id[:8]}...\n"
                            f"Database: {config.database_provider}\n"
                            f"Config: {CONFIG_DIR}"
                )
            
            def quit_app(self, _):
                self.agent.stop_service()
                rumps.quit_application()
        
        app = ScreenTimeApp(self)
        app.run()
    
    def run_windows(self):
        """Run with Windows system tray icon"""
        try:
            import pystray
            from PIL import Image
        except ImportError:
            # Fallback to no icon
            self.run_headless()
            return
        
        # Create a simple icon (green circle)
        def create_icon():
            size = 64
            image = Image.new('RGB', (size, size), color='white')
            # Simple green circle
            from PIL import ImageDraw
            draw = ImageDraw.Draw(image)
            draw.ellipse([4, 4, size-4, size-4], fill='green')
            return image
        
        def on_quit(icon, item):
            self.stop_service()
            icon.stop()
        
        def on_open_dashboard(icon, item):
            import webbrowser
            webbrowser.open("http://localhost:3000")
        
        # Start service in background
        service_thread = threading.Thread(target=self.start_service, daemon=True)
        service_thread.start()
        
        # Create system tray icon
        icon = pystray.Icon(
            "ScreenTimeAgent",
            create_icon(),
            "Screen Time Agent",
            menu=pystray.Menu(
                pystray.MenuItem("Status: Running", lambda: None, enabled=False),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Open Dashboard", on_open_dashboard),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Quit", on_quit),
            )
        )
        
        icon.run()
    
    def run_headless(self):
        """Run without any GUI (background mode)"""
        print("Running in headless mode...")
        self.start_service()
    
    def run(self):
        """Main entry point"""
        # Check if configured
        if not is_configured():
            self.show_setup_dialog()
        
        # Start based on platform
        system = platform.system()
        
        if system == "Darwin":
            self.run_macos()
        elif system == "Windows":
            self.run_windows()
        else:
            self.run_headless()


def main():
    """Entry point for PyInstaller"""
    app = AgentGUI()
    app.run()


if __name__ == "__main__":
    main()
