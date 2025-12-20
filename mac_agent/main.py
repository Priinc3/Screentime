#!/usr/bin/env python3
"""
Mac Employee Monitor - Main Entry Point
Equivalent to Program.cs in the Windows agent

Usage:
    python main.py              # Run the monitor (normal mode)
    python main.py --install    # Setup and install
    python main.py --uninstall  # Remove the agent
"""

import sys
from supabase_service import SupabaseService
from installer import install, uninstall
from monitor import run_monitor


def run_install():
    """Interactive installation wizard"""
    print("=" * 50)
    print("     Mac Employee Monitor - Setup")
    print("=" * 50)
    print()
    
    try:
        service = SupabaseService()
        
        # A. Ask for existing ID
        print("Enter existing Employee ID (or press Enter to create new):")
        input_id = input("> ").strip()
        
        employee_id = ""
        
        if input_id:
            print(f"Checking ID: {input_id}...")
            existing = service.get_employee(input_id)
            
            if existing:
                print(f"Found existing employee: {existing.get('full_name', 'Unknown')}")
                employee_id = input_id
                service._save_config(employee_id)
            else:
                print("ID not found.")
                print("Enter Name for this new ID:")
                name = input("> ").strip() or "Unknown Employee"
                
                print("Registering...")
                employee_id = service.register_employee(name, input_id)
                print(f"Registered! ID: {employee_id}")
        else:
            # B. Create New
            print("Enter Employee Name:")
            name = input("> ").strip() or "Unknown Employee"
            
            print("Registering...")
            employee_id = service.register_employee(name)
            print(f"Registered! ID: {employee_id}")
        
        print()
        print("Installing LaunchAgent for auto-start...")
        install()
        
        print()
        print("=" * 50)
        print("     Installation Complete!")
        print("=" * 50)
        print()
        print("The agent is now running and will start automatically on login.")
        print()
        print("IMPORTANT: Grant Accessibility permissions!")
        print("  1. Open System Preferences -> Security & Privacy")
        print("  2. Go to Privacy -> Accessibility")
        print("  3. Add Terminal (or your Python app) to the list")
        print()
        
    except KeyboardInterrupt:
        print("\nInstallation cancelled.")
    except Exception as e:
        print(f"Error during installation: {e}")


def run_uninstall():
    """Uninstall the agent"""
    print("=" * 50)
    print("     Mac Employee Monitor - Uninstall")
    print("=" * 50)
    print()
    
    uninstall()


def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        
        if arg == '--install':
            run_install()
        elif arg == '--uninstall':
            run_uninstall()
        elif arg == '--help':
            print(__doc__)
        else:
            print(f"Unknown argument: {arg}")
            print("Use --help for usage information.")
    else:
        # Normal run mode
        run_monitor()


if __name__ == "__main__":
    main()
