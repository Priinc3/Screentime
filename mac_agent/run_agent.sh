#!/bin/bash
# Wrapper script to run the Mac agent with the correct Python environment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Log file for debugging
LOG_DIR="$HOME/Library/Logs/EmployeeMonitor"
mkdir -p "$LOG_DIR"

# Function to find Python
find_python() {
    local safe_candidates=(
        "$SCRIPT_DIR/venv/bin/python"
        "/opt/homebrew/bin/python3.12" "/opt/homebrew/bin/python3.11" "/opt/homebrew/bin/python3.10" "/opt/homebrew/bin/python3.9" "/opt/homebrew/bin/python3.8"
        "/opt/homebrew/bin/python3"
        "/usr/local/bin/python3"
        "/Library/Frameworks/Python.framework/Versions/3.*/bin/python3"
    )

    # Check safe candidates first (no UI prompts)
    for python_cmd in "${safe_candidates[@]}"; do
        # Handle glob patterns
        for resolved_path in $python_cmd; do
            if [ -x "$resolved_path" ] 2>/dev/null; then
                 # Check version
                local version=$("$resolved_path" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
                local major=$(echo "$version" | cut -d. -f1)
                local minor=$(echo "$version" | cut -d. -f2)
                
                if [ "$major" -eq 3 ] && [ "$minor" -ge 8 ]; then
                    echo "$resolved_path"
                    return 0
                fi
            fi
        done
    done

    # Only check system python if explicitly available or Xcode tools are installed
    if /usr/bin/xcode-select -p &>/dev/null; then
        local system_candidates=("python3" "python" "/usr/bin/python3")
        for python_cmd in "${system_candidates[@]}"; do
            if command -v "$python_cmd" &> /dev/null; then
                 local version=$("$python_cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
                 local major=$(echo "$version" | cut -d. -f1)
                 local minor=$(echo "$version" | cut -d. -f2)
                 
                 if [ "$major" -eq 3 ] && [ "$minor" -ge 8 ]; then
                     echo "$(command -v $python_cmd)"
                     return 0
                 fi
            fi
        done
    else
        # Log to stderr that we skipped check
        echo "Xcode Command Line Tools not detected. Skipping system Python check." >&2
    fi

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
