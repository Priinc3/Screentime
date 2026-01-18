/**
 * Database Configuration Manager
 * Handles loading, saving, and switching between database backends
 */

import type { DatabaseConfig, DatabaseProvider, StoredDatabaseConfig, DB_CONFIG_STORAGE_KEY } from './types';

const STORAGE_KEY = 'screentime_db_config';

// Get stored database configuration
export function getStoredConfig(): StoredDatabaseConfig | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        return JSON.parse(stored) as StoredDatabaseConfig;
    } catch {
        return null;
    }
}

// Save database configuration
export function saveConfig(config: DatabaseConfig): void {
    if (typeof window === 'undefined') return;

    const stored: StoredDatabaseConfig = {
        provider: config.provider,
        config,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

// Clear stored configuration (revert to environment defaults)
export function clearConfig(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}

// Get current database provider
export function getCurrentProvider(): DatabaseProvider {
    const stored = getStoredConfig();
    if (stored) return stored.provider;

    // Default to supabase from environment
    return 'supabase';
}

// Check if using custom config (not environment defaults)
export function isUsingCustomConfig(): boolean {
    return getStoredConfig() !== null;
}

// Validate Supabase config
export function validateSupabaseConfig(url: string, anonKey: string): { valid: boolean; error?: string } {
    if (!url || !url.includes('supabase.co')) {
        return { valid: false, error: 'Invalid Supabase URL' };
    }

    if (!anonKey || anonKey.length < 20) {
        return { valid: false, error: 'Invalid Supabase anon key' };
    }

    return { valid: true };
}

// Validate PostgreSQL connection string
export function validatePostgresConfig(connectionString: string): { valid: boolean; error?: string } {
    if (!connectionString) {
        return { valid: false, error: 'Connection string is required' };
    }

    // Basic validation for postgres:// or postgresql:// URL
    if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
        return { valid: false, error: 'Connection string must start with postgres:// or postgresql://' };
    }

    // Check for basic structure
    const regex = /^postgres(ql)?:\/\/[^:]+:[^@]+@[^:\/]+:\d+\/\w+/;
    if (!regex.test(connectionString)) {
        return { valid: false, error: 'Invalid connection string format. Expected: postgres://user:password@host:port/database' };
    }

    return { valid: true };
}

// Get connection info for display (masked password)
export function getMaskedConnectionInfo(): { provider: string; connection: string } | null {
    const stored = getStoredConfig();

    if (!stored) {
        // Using environment defaults
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (url) {
            return {
                provider: 'Supabase (Environment)',
                connection: url,
            };
        }
        return null;
    }

    if (stored.provider === 'supabase') {
        const config = stored.config as { url: string };
        return {
            provider: 'Supabase (Custom)',
            connection: config.url,
        };
    }

    if (stored.provider === 'postgres' || stored.provider === 'rds') {
        const config = stored.config as { connectionString: string };
        // Mask the password
        const masked = config.connectionString.replace(/:[^:@]+@/, ':****@');
        return {
            provider: stored.provider === 'rds' ? 'AWS RDS' : 'PostgreSQL',
            connection: masked,
        };
    }

    return null;
}
