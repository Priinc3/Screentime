# Windows Agent - Prebuilt Version

## What's Included
- `launcher_prebuilt.bat` - Easy installer (double-click to run)
- `RuntimeBroker_Helper.exe` - The agent executable (YOU NEED TO ADD THIS)

## Setup Instructions

### If you already have the exe:
1. Place `RuntimeBroker_Helper.exe` in this folder
2. Double-click `launcher_prebuilt.bat`
3. Select "1. Install Agent"
4. Enter employee name and Supabase credentials when prompted

### If you need to build the exe:
Use the SOURCE version instead, which includes:
- All source code
- Auto-.NET SDK installer
- Build scripts

## The exe should be named: RuntimeBroker_Helper.exe

Get it from:
- Build from source: `agent/EmployeeMonitor/publish/RuntimeBroker_Helper.exe`
- Or download the prebuilt release from GitHub

## Requirements
- Windows 10/11
- Administrator privileges (for auto-start on boot)
- NO .NET SDK required (it's self-contained)
