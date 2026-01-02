#!/bin/bash
# Mac Employee Monitor Launcher
# Run this script to install or uninstall the agent

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ============================================
# Python Detection Functions
# ============================================

find_python() {
    # Check multiple Python paths in priority order
    # We explicitly check versions 3.12 down to 3.8 to find the newest compatible one
    local python_candidates=(
        "python3.12" "python3.11" "python3.10" "python3.9" "python3.8"
        "python3"
        "python"
        "/opt/homebrew/bin/python3"
        "/usr/local/bin/python3"
        "/Library/Frameworks/Python.framework/Versions/3.*/bin/python3"
        "/usr/bin/python3"
    )
    
    for python_cmd in "${python_candidates[@]}"; do
        # Handle glob patterns if present
        for resolved_path in $python_cmd; do
            if command -v "$resolved_path" &> /dev/null; then
                # Check if it's actually Python 3.8+
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
    return 1
}

install_pip_fallback() {
    local python_cmd="$1"
    echo -e "${BLUE}Attempting to install pip via get-pip.py...${NC}"
    
    # Download get-pip.py
    if curl -sSL https://bootstrap.pypa.io/get-pip.py -o get-pip.py; then
        "$python_cmd" get-pip.py --user
        rm get-pip.py
        return 0
    else
        echo -e "${RED}Failed to download get-pip.py${NC}"
        return 1
    fi
}

install_python_homebrew() {
    echo -e "${BLUE}Attempting to install Python via Homebrew...${NC}"
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo -e "${YELLOW}Homebrew not found. Installing Homebrew first...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for this session
        if [ -f "/opt/homebrew/bin/brew" ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -f "/usr/local/bin/brew" ]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    fi
    
    # Install Python
    brew install python3
    
    # Verify installation
    if command -v python3 &> /dev/null; then
        echo -e "${GREEN}✅ Python installed successfully!${NC}"
        # Return path to installed python
        echo $(command -v python3)
        return 0
    else
        echo -e "${RED}❌ Python installation failed${NC}"
        return 1
    fi
}

show_python_install_instructions() {
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ Python 3.8+ is required but not found on your system  ${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Please install Python using one of these methods:${NC}"
    echo ""
    echo -e "${BLUE}Option 1: Install via Homebrew (Recommended)${NC}"
    echo "  1. Open Terminal"
    echo "  2. Run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "  3. Run: brew install python3"
    echo ""
    echo -e "${BLUE}Option 2: Download from python.org${NC}"
    echo "  Visit: https://www.python.org/downloads/macos/"
    echo "  Download and run the macOS installer"
    echo ""
    echo -e "${BLUE}Option 3: Install Xcode Command Line Tools${NC}"
    echo "  Run: xcode-select --install"
    echo ""
    echo -e "${YELLOW}After installing Python, run this script again.${NC}"
    echo ""
}

check_python_version() {
    local python_cmd="$1"
    local version=$("$python_cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    
    if [ "$major" -ge 3 ] && [ "$minor" -ge 8 ]; then
        return 0
    fi
    return 1
}

# ============================================
# Main Script
# ============================================

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}   Mac Employee Monitor Launcher${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Check for Python
PYTHON_CMD=$(find_python)

if [ -z "$PYTHON_CMD" ]; then
    show_python_install_instructions
    
    # Offer to install via Homebrew
    echo -e "${YELLOW}Would you like to automatically install Python via Homebrew? (y/n)${NC}"
    read -p "> " install_choice
    
    if [[ "$install_choice" =~ ^[Yy]$ ]]; then
        install_python_homebrew
        PYTHON_CMD=$(find_python)
        
        if [ -z "$PYTHON_CMD" ]; then
            echo -e "${RED}Installation failed. Please install Python manually and try again.${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Please install Python manually and run this script again.${NC}"
        exit 1
    fi
fi

# Verify Python version (double check)
if ! check_python_version "$PYTHON_CMD"; then
    echo -e "${RED}❌ Python version too old. Python 3.8+ is required.${NC}"
    echo -e "${YELLOW}Current: $($PYTHON_CMD --version 2>&1)${NC}"
    echo -e "${YELLOW}Please upgrade Python and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python found: $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))${NC}"
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
        echo -e "${BLUE}Setting up virtual environment...${NC}"
        
        # Create venv with found Python
        "$PYTHON_CMD" -m venv venv 2>/dev/null
        if [ $? -ne 0 ]; then
            echo -e "${YELLOW}Installing venv module...${NC}"
            "$PYTHON_CMD" -m pip install --user virtualenv 2>/dev/null
            "$PYTHON_CMD" -m virtualenv venv 2>/dev/null
        fi
        
        if [ ! -f "venv/bin/activate" ]; then
            echo -e "${RED}❌ Failed to create virtual environment${NC}"
            echo -e "${YELLOW}Trying without virtual environment...${NC}"
            
            # Ensure pip is installed
            if ! "$PYTHON_CMD" -m pip --version &>/dev/null; then
                echo -e "${BLUE}Installing pip...${NC}"
                if ! "$PYTHON_CMD" -m ensurepip --upgrade --default-pip 2>/dev/null; then
                     install_pip_fallback "$PYTHON_CMD"
                fi
            fi
            
            echo "Installing dependencies..."
            "$PYTHON_CMD" -m pip install -r requirements.txt --user -q
            
            echo "Running installer..."
            "$PYTHON_CMD" main.py --install
        else
            source venv/bin/activate
            
            # Ensure pip in venv (sometimes venv creation skips it)
            if ! python -m pip --version &>/dev/null; then
                echo -e "${BLUE}Installing pip in virtual environment...${NC}"
                if ! python -m ensurepip --upgrade --default-pip 2>/dev/null; then
                    install_pip_fallback "python"
                fi
            fi
            
            echo -e "${BLUE}Installing dependencies...${NC}"
            python -m pip install -r requirements.txt -q
            
            echo -e "${BLUE}Running installer...${NC}"
            python main.py --install
        fi
        
        echo ""
        echo -e "${GREEN}✅ Installation complete!${NC}"
        ;;
    2)
        echo ""
        if [ -f "venv/bin/activate" ]; then
            source venv/bin/activate
            python main.py --uninstall
        else
            "$PYTHON_CMD" main.py --uninstall
        fi
        ;;
    3)
        echo ""
        echo "Press Ctrl+C to stop viewing logs..."
        LOG_FILE=~/Library/Logs/EmployeeMonitor/stdout.log
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo -e "${YELLOW}No log file found at: $LOG_FILE${NC}"
            echo "The agent may not have run yet."
        fi
        ;;
    4)
        echo ""
        echo -e "${BLUE}Checking agent status...${NC}"
        if pgrep -f "mac_agent/main.py" > /dev/null; then
            echo -e "${GREEN}✅ Agent is RUNNING${NC}"
            ps aux | grep "mac_agent/main.py" | grep -v grep
        else
            echo -e "${YELLOW}⚠️  Agent is NOT running${NC}"
        fi
        echo ""
        echo "Recent logs:"
        tail -5 ~/Library/Logs/EmployeeMonitor/stdout.log 2>/dev/null || echo -e "${YELLOW}No logs found${NC}"
        ;;
    5)
        echo "Bye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac
