/**
 * Supabase Database Client Implementation
 * Primary backend using Supabase for database operations
 */

import { createBrowserClient } from '@supabase/ssr';
import type {
    DatabaseClient,
    Employee,
    ActivityLog,
    DailySummary,
    HeartbeatData,
    DateRangeFilter,
    PaginationOptions,
    SupabaseConfig,
} from './types';

export class SupabaseClient implements DatabaseClient {
    private client: ReturnType<typeof createBrowserClient>;
    private config: SupabaseConfig;

    constructor(config: SupabaseConfig) {
        this.config = config;
        this.client = createBrowserClient(config.url, config.anonKey);
    }

    // Employee operations
    async getEmployees(): Promise<Employee[]> {
        const { data, error } = await this.client
            .from('employees')
            .select('*')
            .order('full_name');

        if (error) throw new Error(`Failed to fetch employees: ${error.message}`);
        return data || [];
    }

    async getEmployee(id: string): Promise<Employee | null> {
        const { data, error } = await this.client
            .from('employees')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    }

    async createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee> {
        const { data, error } = await this.client
            .from('employees')
            .insert(employee)
            .select()
            .single();

        if (error) throw new Error(`Failed to create employee: ${error.message}`);
        return data;
    }

    async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
        const { data, error } = await this.client
            .from('employees')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return null;
        return data;
    }

    async updateHeartbeat(employeeId: string, heartbeat: HeartbeatData): Promise<void> {
        const { error } = await this.client
            .from('employees')
            .update(heartbeat)
            .eq('id', employeeId);

        if (error) {
            console.error(`Failed to update heartbeat: ${error.message}`);
        }
    }

    // Activity log operations
    async getActivityLogs(
        filter?: DateRangeFilter,
        employeeId?: string,
        pagination?: PaginationOptions
    ): Promise<ActivityLog[]> {
        let query = this.client
            .from('activity_logs')
            .select('*');

        if (filter) {
            // Use IST timezone for filtering
            const startOfDay = `${filter.startDate}T00:00:00+05:30`;
            const endOfDay = `${filter.endDate}T23:59:59+05:30`;
            query = query.gte('start_time', startOfDay).lte('start_time', endOfDay);
        }

        if (employeeId) {
            query = query.eq('employee_id', employeeId);
        }

        if (pagination) {
            query = query.range(pagination.from, pagination.to);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch activity logs: ${error.message}`);
        return data || [];
    }

    async createActivityLog(log: Omit<ActivityLog, 'id'>): Promise<ActivityLog> {
        const { data, error } = await this.client
            .from('activity_logs')
            .insert(log)
            .select()
            .single();

        if (error) throw new Error(`Failed to create activity log: ${error.message}`);
        return data;
    }

    // Daily summary operations
    async getDailySummaries(
        filter: DateRangeFilter,
        employeeId?: string,
        pagination?: PaginationOptions
    ): Promise<DailySummary[]> {
        let query = this.client
            .from('daily_summary')
            .select('*')
            .gte('date', filter.startDate)
            .lte('date', filter.endDate);

        if (employeeId) {
            query = query.eq('employee_id', employeeId);
        }

        if (pagination) {
            query = query.range(pagination.from, pagination.to);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch daily summaries: ${error.message}`);
        return data || [];
    }

    async upsertDailySummary(summary: Omit<DailySummary, 'id'>): Promise<DailySummary> {
        const { data, error } = await this.client
            .from('daily_summary')
            .upsert(summary, { onConflict: 'employee_id,date' })
            .select()
            .single();

        if (error) throw new Error(`Failed to upsert daily summary: ${error.message}`);
        return data;
    }

    // Utility methods
    async testConnection(): Promise<boolean> {
        try {
            const { error } = await this.client
                .from('employees')
                .select('id')
                .limit(1);
            return !error;
        } catch {
            return false;
        }
    }

    async close(): Promise<void> {
        // Supabase client doesn't need explicit cleanup
    }

    // Expose raw client for advanced queries
    getRawClient() {
        return this.client;
    }
}

// Factory function for creating Supabase client from env
export function createSupabaseClientFromEnv(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        throw new Error('Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    return new SupabaseClient({
        provider: 'supabase',
        url,
        anonKey,
    });
}
