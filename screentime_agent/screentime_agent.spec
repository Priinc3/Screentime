# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Screen Time Agent
Builds a standalone executable for macOS and Windows
"""

import sys
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Determine platform
is_macos = sys.platform == 'darwin'
is_windows = sys.platform == 'win32'

# Application metadata
APP_NAME = 'ScreenTimeAgent'
APP_VERSION = '1.0.0'
APP_BUNDLE_ID = 'com.screentime.agent'

# Hidden imports that PyInstaller might miss
hidden_imports = [
    'supabase',
    'postgrest',
    'realtime',
    'storage3',
    'supabase_auth',
    'supabase_functions',
    'httpx',
    'websockets',
    'pydantic',
    'cffi',
    'cryptography',
    # Platform-specific
    'watchers.platform.macos',
    'watchers.platform.windows',
    'watchers.platform.linux',
    'database.supabase_backend',
    'database.postgres_backend',
]

# Collect supabase and related packages
datas = []
datas += collect_data_files('supabase')
datas += collect_data_files('certifi')

# Analysis
a = Analysis(
    ['app_gui.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

# Remove unnecessary files to reduce size
a.binaries = [x for x in a.binaries if not x[0].startswith('libQt')]
a.binaries = [x for x in a.binaries if not x[0].startswith('PyQt')]

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

if is_macos:
    # macOS: Create .app bundle
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name=APP_NAME,
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        console=False,  # No terminal window
        disable_windowed_traceback=False,
        argv_emulation=True,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
    )
    
    coll = COLLECT(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=True,
        upx_exclude=[],
        name=APP_NAME,
    )
    
    app = BUNDLE(
        coll,
        name=f'{APP_NAME}.app',
        icon=None,  # Add icon path here: 'assets/icon.icns'
        bundle_identifier=APP_BUNDLE_ID,
        info_plist={
            'CFBundleName': APP_NAME,
            'CFBundleDisplayName': 'Screen Time Agent',
            'CFBundleVersion': APP_VERSION,
            'CFBundleShortVersionString': APP_VERSION,
            'LSBackgroundOnly': True,  # Run as background app
            'LSUIElement': True,  # No dock icon
            'NSHighResolutionCapable': True,
        },
    )

else:
    # Windows: Create single .exe file
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        [],
        name=APP_NAME,
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,  # No console window (runs silently)
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=None,  # Add icon path here: 'assets/icon.ico'
    )
