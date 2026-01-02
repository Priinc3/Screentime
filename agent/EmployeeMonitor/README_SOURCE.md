# Windows Agent - Source Code Version

## What's Included
- All C# source code files
- `launcher_source.bat` - Auto-builds and installs
- .NET SDK auto-installer

## Setup Instructions

1. Double-click `launcher_source.bat`
2. If .NET SDK is not installed, it will be installed automatically
3. Select "1. Install Agent (Build + Setup)"
4. Wait for build to complete (2-3 minutes first time)
5. Enter employee name and Supabase credentials when prompted

## Requirements
- Windows 10/11
- Administrator privileges
- Internet connection (for .NET SDK download if needed)

## Build Time
- First build: 2-3 minutes (downloads packages)
- Subsequent builds: 30-60 seconds

## Files After Build
After building, the executable will be at:
```
publish\RuntimeBroker_Helper.exe
```

You can copy this file to other computers for instant install (no build needed).
