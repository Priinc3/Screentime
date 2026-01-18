#!/usr/bin/env python3
"""
Screen Time Agent - ActivityWatch-Inspired Activity Tracker
A cross-platform agent for tracking application usage and screen time.

Usage:
    python main.py               # Run the monitor
    python main.py --install     # Install and setup
    python main.py --uninstall   # Remove the agent
    python main.py --status      # Check agent status
    python main.py --config      # Configure database backend
"""

import sys
import argparse
import signal
from pathlib import Path

def parse_args():
    parser = argparse.ArgumentParser(
        description='Screen Time Agent - Activity Tracker',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument('--install', action='store_true',
                        help='Install the agent and configure auto-start')
    parser.add_argument('--uninstall', action='store_true',
                        help='Uninstall the agent and remove auto-start')
    parser.add_argument('--status', action='store_true',
                        help='Check if agent is running')
    parser.add_argument('--config', action='store_true',
                        help='Configure database backend')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose output')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug mode with extra logging')
    
    return parser.parse_args()


def run_install():
    """Interactive installation wizard"""
    from installer import run_installer
    run_installer()


def run_uninstall():
    """Uninstall the agent"""
    from installer import run_uninstaller
    run_uninstaller()


def run_status():
    """Check agent status"""
    from installer import check_status
    check_status()


def run_config():
    """Configure database backend"""
    from config import run_config_wizard
    run_config_wizard()


def run_monitor(verbose: bool = False, debug: bool = False):
    """Main monitoring loop"""
    from service import ScreenTimeService
    
    service = ScreenTimeService(verbose=verbose, debug=debug)
    
    # Handle graceful shutdown
    def signal_handler(signum, frame):
        print("\nReceived shutdown signal, stopping...")
        service.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("=" * 50)
    print("     Screen Time Agent - Starting")
    print("=" * 50)
    
    service.start()


def main():
    args = parse_args()
    
    if args.install:
        run_install()
    elif args.uninstall:
        run_uninstall()
    elif args.status:
        run_status()
    elif args.config:
        run_config()
    else:
        run_monitor(verbose=args.verbose, debug=args.debug)


if __name__ == "__main__":
    main()
