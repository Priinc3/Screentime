/**
 * PostgreSQL/AWS RDS Database Client Implementation
 * Alternative backend for direct PostgreSQL connections
 * 
 * Note: This implementation is for server-side use only.
 * For client-side, you'll need to proxy through API routes.
 */

import type {
    DatabaseClient,
    Employee,
    ActivityLog,
    DailySummary,
    HeartbeatData,
    DateRangeFilter,
    PaginationOptions,
    PostgresConfig,
} from './types';

// This is a placeholder for direct PostgreSQL integration
// In a real implementation, you would use a library like:
// - pg (node-postgres) for server-side
// - prisma for full ORM
// - drizzle for lightweight ORM

export class PostgresClient implements DatabaseClient {
    private config: PostgresConfig;
    private isConnected: boolean = false;

    constructor(config: PostgresConfig) {
        this.config = config;
        console.log('PostgreSQL client initialized (using API proxy)');
    }

    // All operations proxy through API routes for client-side usage
    private async apiRequest<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: unknown
    ): Promise<T> {
        const response = await fetch(`/api/db/${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-DB-Provider': 'postgres',
                'X-DB-Connection': this.config.connectionString,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return response.json();
    }

    // Employee operations
    async getEmployees(): Promise<Employee[]> {
        return this.apiRequest<Employee[]>('employees');
    }

    async getEmployee(id: string): Promise<Employee | null> {
        try {
            return await this.apiRequest<Employee>(`employees/${id}`);
        } catch {
            return null;
        }
    }

    async createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee> {
        return this.apiRequest<Employee>('employees', 'POST', employee);
    }

    async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
        try {
            return await this.apiRequest<Employee>(`employees/${id}`, 'PUT', updates);
        } catch {
            return null;
        }
    }

    async updateHeartbeat(employeeId: string, heartbeat: HeartbeatData): Promise<void> {
        await this.apiRequest(`employees/${employeeId}/heartbeat`, 'PUT', heartbeat);
    }

    // Activity log operations
    async getActivityLogs(
        filter?: DateRangeFilter,
        employeeId?: string,
        pagination?: PaginationOptions
    ): Promise<ActivityLog[]> {
        const params = new URLSearchParams();
        if (filter) {
            params.set('startDate', filter.startDate);
            params.set('endDate', filter.endDate);
        }
        if (employeeId) params.set('employeeId', employeeId);
        if (pagination) {
            params.set('from', String(pagination.from));
            params.set('to', String(pagination.to));
        }

        return this.apiRequest<ActivityLog[]>(`activity-logs?${params}`);
    }

    async createActivityLog(log: Omit<ActivityLog, 'id'>): Promise<ActivityLog> {
        return this.apiRequest<ActivityLog>('activity-logs', 'POST', log);
    }

    // Daily summary operations
    async getDailySummaries(
        filter: DateRangeFilter,
        employeeId?: string,
        pagination?: PaginationOptions
    ): Promise<DailySummary[]> {
        const params = new URLSearchParams();
        params.set('startDate', filter.startDate);
        params.set('endDate', filter.endDate);
        if (employeeId) params.set('employeeId', employeeId);
        if (pagination) {
            params.set('from', String(pagination.from));
            params.set('to', String(pagination.to));
        }

        return this.apiRequest<DailySummary[]>(`daily-summaries?${params}`);
    }

    async upsertDailySummary(summary: Omit<DailySummary, 'id'>): Promise<DailySummary> {
        return this.apiRequest<DailySummary>('daily-summaries', 'POST', summary);
    }

    // Utility methods
    async testConnection(): Promise<boolean> {
        try {
            await this.apiRequest('health');
            this.isConnected = true;
            return true;
        } catch {
            this.isConnected = false;
            return false;
        }
    }

    async close(): Promise<void> {
        this.isConnected = false;
    }
}

// Factory function
export function createPostgresClient(connectionString: string, ssl: boolean = true): PostgresClient {
    return new PostgresClient({
        provider: 'postgres',
        connectionString,
        ssl,
    });
}
