"""
Database Package
Provides abstraction layer for different database backends
"""

from .base import DatabaseBackend
from .supabase_backend import SupabaseBackend

__all__ = ['DatabaseBackend', 'SupabaseBackend', 'get_database']


def get_database(provider: str = "supabase", **kwargs) -> DatabaseBackend:
    """
    Factory function to create a database backend instance
    
    Args:
        provider: Database provider name ('supabase', 'postgres', 'rds')
        **kwargs: Provider-specific configuration
    
    Returns:
        DatabaseBackend instance
    """
    if provider == "supabase":
        from .supabase_backend import SupabaseBackend
        return SupabaseBackend(
            url=kwargs.get('url', ''),
            key=kwargs.get('key', '')
        )
    elif provider in ("postgres", "rds"):
        from .postgres_backend import PostgresBackend
        return PostgresBackend(
            connection_string=kwargs.get('connection_string', ''),
            ssl=kwargs.get('ssl', True)
        )
    else:
        raise ValueError(f"Unknown database provider: {provider}")
