#!/bin/bash
# Wrapper script to run the Mac agent with the correct Python environment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment and run main.py
source "$SCRIPT_DIR/venv/bin/activate"
exec python main.py "$@"
