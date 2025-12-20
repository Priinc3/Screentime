#!/bin/bash
# Mac Employee Monitor Launcher
# Run this script to install or uninstall the agent

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "   Mac Employee Monitor Launcher"
echo "=========================================="
echo ""
echo "1. Install (First Time Setup)"
echo "2. Uninstall"
echo "3. View Logs"
echo "4. Check Status"
echo "5. Exit"
echo ""
read -p "Select option (1-5): " choice

case $choice in
    1)
        echo ""
        echo "Setting up virtual environment..."
        python3 -m venv venv 2>/dev/null
        source venv/bin/activate
        
        echo "Installing dependencies..."
        pip install -r requirements.txt -q
        
        echo "Running installer..."
        python main.py --install
        ;;
    2)
        echo ""
        source venv/bin/activate
        python main.py --uninstall
        ;;
    3)
        echo ""
        echo "Press Ctrl+C to stop viewing logs..."
        tail -f ~/Library/Logs/EmployeeMonitor/stdout.log
        ;;
    4)
        echo ""
        echo "Checking agent status..."
        if pgrep -f "mac_agent/main.py" > /dev/null; then
            echo "✅ Agent is RUNNING"
            ps aux | grep "mac_agent/main.py" | grep -v grep
        else
            echo "❌ Agent is NOT running"
        fi
        echo ""
        echo "Recent logs:"
        tail -5 ~/Library/Logs/EmployeeMonitor/stdout.log 2>/dev/null || echo "No logs found"
        ;;
    5)
        echo "Bye!"
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac
