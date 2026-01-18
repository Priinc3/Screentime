"""
Configuration Module
Handles agent configuration including database backend selection
"""

import os
import json
import platform
from pathlib import Path
from typing import Optional, Dict, Any, Literal
from dataclasses import dataclass, asdict

# Configuration paths by platform
def get_config_dir() -> Path:
    system = platform.system()
    if system == "Darwin":  # macOS
        return Path.home() / "Library" / "Application Support" / "ScreenTimeAgent"
    elif system == "Windows":
        return Path(os.environ.get("APPDATA", "")) / "ScreenTimeAgent"
    else:  # Linux
        return Path.home() / ".config" / "screentime-agent"


def get_log_dir() -> Path:
    system = platform.system()
    if system == "Darwin":
        return Path.home() / "Library" / "Logs" / "ScreenTimeAgent"
    elif system == "Windows":
        return Path(os.environ.get("LOCALAPPDATA", "")) / "ScreenTimeAgent" / "logs"
    else:
        return Path.home() / ".local" / "share" / "screentime-agent" / "logs"


CONFIG_DIR = get_config_dir()
CONFIG_FILE = CONFIG_DIR / "config.json"
LOG_DIR = get_log_dir()


@dataclass
class SupabaseConfig:
    """Supabase database configuration"""
    provider: Literal["supabase"] = "supabase"
    url: str = ""
    anon_key: str = ""
    

@dataclass
class PostgresConfig:
    """PostgreSQL/AWS RDS configuration"""
    provider: Literal["postgres", "rds"] = "postgres"
    connection_string: str = ""
    ssl: bool = True


@dataclass
class AgentConfig:
    """Main agent configuration"""
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    
    # Database settings
    database_provider: str = "supabase"
    supabase_url: str = ""
    supabase_key: str = ""
    postgres_connection: str = ""
    
    # Watcher settings
    poll_interval: float = 1.0  # seconds
    heartbeat_interval: float = 10.0  # seconds
    afk_timeout: float = 300.0  # 5 minutes
    
    # Behavior settings
    exclude_apps: list = None
    exclude_titles: list = None
    
    def __post_init__(self):
        if self.exclude_apps is None:
            self.exclude_apps = []
        if self.exclude_titles is None:
            self.exclude_titles = []


def load_config() -> AgentConfig:
    """Load configuration from file"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r') as f:
                data = json.load(f)
                return AgentConfig(**data)
        except (json.JSONDecodeError, TypeError) as e:
            print(f"Warning: Could not parse config file: {e}")
    
    return AgentConfig()


def save_config(config: AgentConfig) -> None:
    """Save configuration to file"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(CONFIG_FILE, 'w') as f:
        json.dump(asdict(config), f, indent=2)
    
    print(f"Configuration saved to {CONFIG_FILE}")


def is_configured() -> bool:
    """Check if agent is properly configured"""
    config = load_config()
    
    # Must have employee ID
    if not config.employee_id:
        return False
    
    # Must have database credentials
    if config.database_provider == "supabase":
        return bool(config.supabase_url and config.supabase_key)
    elif config.database_provider in ("postgres", "rds"):
        return bool(config.postgres_connection)
    
    return False


def run_config_wizard():
    """Interactive configuration wizard"""
    print("=" * 50)
    print("     Screen Time Agent - Configuration")
    print("=" * 50)
    print()
    
    config = load_config()
    
    # Database provider selection
    print("Select database provider:")
    print("  1. Supabase (recommended)")
    print("  2. PostgreSQL")
    print("  3. AWS RDS")
    
    choice = input("\nEnter choice [1]: ").strip() or "1"
    
    if choice == "1":
        config.database_provider = "supabase"
        print("\n-- Supabase Configuration --")
        
        url = input(f"Supabase URL [{config.supabase_url or 'required'}]: ").strip()
        if url:
            config.supabase_url = url
        
        key = input(f"Supabase Anon Key [{config.supabase_key[:20] + '...' if config.supabase_key else 'required'}]: ").strip()
        if key:
            config.supabase_key = key
    
    elif choice in ("2", "3"):
        config.database_provider = "rds" if choice == "3" else "postgres"
        print(f"\n-- {'AWS RDS' if choice == '3' else 'PostgreSQL'} Configuration --")
        
        conn = input(f"Connection string [{config.postgres_connection or 'postgresql://user:pass@host:5432/db'}]: ").strip()
        if conn:
            config.postgres_connection = conn
    
    # Watcher settings
    print("\n-- Watcher Settings --")
    
    poll = input(f"Poll interval in seconds [{config.poll_interval}]: ").strip()
    if poll:
        config.poll_interval = float(poll)
    
    heartbeat = input(f"Heartbeat interval in seconds [{config.heartbeat_interval}]: ").strip()
    if heartbeat:
        config.heartbeat_interval = float(heartbeat)
    
    afk = input(f"AFK timeout in seconds [{config.afk_timeout}]: ").strip()
    if afk:
        config.afk_timeout = float(afk)
    
    save_config(config)
    
    print("\n✓ Configuration complete!")
    print("Run 'python main.py --install' to register employee and start monitoring.")


# Default Supabase configuration (fallback to environment or hardcoded)
DEFAULT_SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    "https://cvrtaecpuwbyixxxiclt.supabase.co"
)
DEFAULT_SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cnRhZWNwdXdieWl4eHhpY2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDY1MDIsImV4cCI6MjA4MDMyMjUwMn0.7zGRwxySIyUZdgVtnEYxVHxPcksQ5zonmh7Bx-ozbOw"
)
