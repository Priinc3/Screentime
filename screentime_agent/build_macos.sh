#!/bin/bash
# Build script for Screen Time Agent (macOS)
# Creates a standalone .app bundle

set -e

echo "========================================"
echo "  Screen Time Agent - macOS Build"
echo "========================================"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check for virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt
pip install -q pyinstaller

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf build dist

# Build the app
echo "Building application..."
python -m PyInstaller screentime_agent.spec --noconfirm

# Check if build succeeded
if [ -d "dist/ScreenTimeAgent.app" ]; then
    echo ""
    echo "========================================"
    echo "  Build Successful!"
    echo "========================================"
    echo ""
    echo "Output: dist/ScreenTimeAgent.app"
    echo ""
    echo "To install:"
    echo "  1. Copy ScreenTimeAgent.app to /Applications"
    echo "  2. Double-click to run"
    echo "  3. Grant Accessibility permissions when prompted"
    echo ""
    
    # Create DMG (optional)
    read -p "Create DMG installer? (y/n): " create_dmg
    if [ "$create_dmg" = "y" ]; then
        echo "Creating DMG..."
        
        # Check for create-dmg tool
        if command -v create-dmg &> /dev/null; then
            create-dmg \
                --volname "Screen Time Agent" \
                --window-pos 200 120 \
                --window-size 600 400 \
                --icon-size 100 \
                --icon "ScreenTimeAgent.app" 150 185 \
                --app-drop-link 450 185 \
                "dist/ScreenTimeAgent-Installer.dmg" \
                "dist/ScreenTimeAgent.app"
            echo "DMG created: dist/ScreenTimeAgent-Installer.dmg"
        else
            echo "Note: Install 'create-dmg' for DMG creation: brew install create-dmg"
            
            # Simple DMG creation fallback
            hdiutil create -volname "ScreenTimeAgent" -srcfolder "dist/ScreenTimeAgent.app" -ov -format UDZO "dist/ScreenTimeAgent.dmg"
            echo "DMG created: dist/ScreenTimeAgent.dmg"
        fi
    fi
else
    echo ""
    echo "Build failed! Check logs above."
    exit 1
fi

echo ""
echo "Done!"
