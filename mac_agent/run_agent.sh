#!/bin/bash
# Wrapper script to run the Mac agent with the correct Python environment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Log file for debugging
LOG_DIR="$HOME/Library/Logs/EmployeeMonitor"
mkdir -p "$LOG_DIR"

# Function to find Python
find_python() {
    local python_paths=(
        "$SCRIPT_DIR/venv/bin/python"
        "python3"
        "/opt/homebrew/bin/python3"
        "/usr/local/bin/python3"
        "/usr/bin/python3"
    )
    
    for python_cmd in "${python_paths[@]}"; do
        if [ -x "$python_cmd" ] 2>/dev/null || command -v "$python_cmd" &> /dev/null; then
            echo "$python_cmd"
            return 0
        fi
    done
    return 1
}

# Function to install pip fallback
install_pip_fallback() {
    local python_cmd="$1"
    # Download get-pip.py
    if curl -sSL https://bootstrap.pypa.io/get-pip.py -o get-pip.py 2>/dev/null; then
        "$python_cmd" get-pip.py --user
        rm get-pip.py
        return 0
    else
        return 1
    fi
}

# Try to activate virtual environment first
if [ -f "$SCRIPT_DIR/venv/bin/activate" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
    exec python main.py "$@"
else
    # Fallback: find system Python
    PYTHON_CMD=$(find_python)
    
    if [ -z "$PYTHON_CMD" ]; then
        echo "ERROR: Python not found. Please run launcher.sh to install." >> "$LOG_DIR/stderr.log"
        exit 1
    fi
    
    # Check if dependencies are installed
    if ! "$PYTHON_CMD" -c "import supabase" 2>/dev/null; then
        echo "WARNING: Dependencies not installed. Installing..." >> "$LOG_DIR/stdout.log"
        
        # Ensure pip is installed
        if ! "$PYTHON_CMD" -m pip --version &>/dev/null; then
            if ! "$PYTHON_CMD" -m ensurepip --upgrade --default-pip 2>/dev/null; then
                 install_pip_fallback "$PYTHON_CMD"
            fi
        fi

        "$PYTHON_CMD" -m pip install -r "$SCRIPT_DIR/requirements.txt" --user -q 2>/dev/null
    fi
    
    exec "$PYTHON_CMD" main.py "$@"
fi
