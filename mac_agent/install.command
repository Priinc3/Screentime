#!/bin/bash
# ===============================================
# Mac Employee Monitor - Double-Click Installer
# ===============================================
# This file can be double-clicked in Finder to start installation

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Make launcher executable
chmod +x "$SCRIPT_DIR/launcher.sh"
chmod +x "$SCRIPT_DIR/run_agent.sh"

# Run the launcher
"$SCRIPT_DIR/launcher.sh"

echo ""
echo "Press any key to close this window..."
read -n 1
