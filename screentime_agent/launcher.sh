#!/bin/bash
# Screen Time Agent Launcher for macOS/Linux

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check for virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is required but not installed."
    exit 1
fi

# Menu
echo "========================================"
echo "     Screen Time Agent - Launcher"
echo "========================================"
echo ""
echo "1. Install / Setup"
echo "2. Start Agent"
echo "3. Check Status"
echo "4. Configure Database"
echo "5. Uninstall"
echo "6. Exit"
echo ""
read -p "Select option [1-6]: " choice

case $choice in
    1)
        python3 main.py --install
        ;;
    2)
        python3 main.py --verbose
        ;;
    3)
        python3 main.py --status
        ;;
    4)
        python3 main.py --config
        ;;
    5)
        python3 main.py --uninstall
        ;;
    6)
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac
