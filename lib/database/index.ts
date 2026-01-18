/**
 * Database Abstraction Layer
 * Main entry point for database operations
 * 
 * Usage:
 *   import { getDatabase } from '@/lib/database'
 *   const db = getDatabase()
 *   const employees = await db.getEmployees()
 */

import { SupabaseClient, createSupabaseClientFromEnv } from './supabase-client';
import { PostgresClient, createPostgresClient } from './postgres-client';
import { getStoredConfig, getCurrentProvider } from './config';
import type { DatabaseClient, DatabaseProvider, SupabaseConfig, PostgresConfig } from './types';

// Re-export types
export * from './types';
export * from './config';
export { SupabaseClient } from './supabase-client';
export { PostgresClient } from './postgres-client';

// Singleton instance
let dbInstance: DatabaseClient | null = null;
let currentProvider: DatabaseProvider | null = null;

/**
 * Get the database client instance
 * Uses singleton pattern - creates once, reuses
 */
export function getDatabase(): DatabaseClient {
    const provider = getCurrentProvider();

    // If provider changed, reset instance
    if (currentProvider !== provider) {
        dbInstance = null;
        currentProvider = provider;
    }

    if (dbInstance) return dbInstance;

    // Check for custom config first
    const storedConfig = getStoredConfig();

    if (storedConfig) {
        dbInstance = createClientFromConfig(storedConfig.config);
    } else {
        // Use environment defaults (Supabase)
        dbInstance = createSupabaseClientFromEnv();
    }

    return dbInstance;
}

/**
 * Create a database client from configuration
 */
export function createClientFromConfig(config: SupabaseConfig | PostgresConfig): DatabaseClient {
    switch (config.provider) {
        case 'supabase':
            return new SupabaseClient(config as SupabaseConfig);

        case 'postgres':
        case 'rds':
            return new PostgresClient(config as PostgresConfig);

        default:
            throw new Error(`Unknown database provider: ${(config as { provider: string }).provider}`);
    }
}

/**
 * Force refresh the database connection
 * Call this after changing database configuration
 */
export function refreshDatabase(): void {
    if (dbInstance) {
        dbInstance.close();
    }
    dbInstance = null;
    currentProvider = null;
}

/**
 * Test a database configuration without switching to it
 */
export async function testDatabaseConfig(config: SupabaseConfig | PostgresConfig): Promise<boolean> {
    const testClient = createClientFromConfig(config);
    try {
        return await testClient.testConnection();
    } finally {
        await testClient.close();
    }
}

// Legacy compatibility - createClient from old supabase/client.ts
// This maintains backwards compatibility with existing code
export function createClient() {
    const db = getDatabase();
    if (db instanceof SupabaseClient) {
        return db.getRawClient();
    }
    // For non-Supabase backends, throw an error
    // Code should be migrated to use getDatabase() instead
    throw new Error(
        'createClient() is only available for Supabase backend. ' +
        'Please use getDatabase() for database-agnostic operations.'
    );
}
