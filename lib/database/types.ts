/**
 * Database Abstraction Layer Types
 * Defines interfaces for pluggable database backends
 */

// Database provider types
export type DatabaseProvider = 'supabase' | 'postgres' | 'rds';

// Configuration for different database backends
export interface SupabaseConfig {
  provider: 'supabase';
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface PostgresConfig {
  provider: 'postgres' | 'rds';
  connectionString: string;
  ssl?: boolean;
  poolSize?: number;
}

export type DatabaseConfig = SupabaseConfig | PostgresConfig;

// Employee entity
export interface Employee {
  id: string;
  full_name: string;
  email?: string;
  department?: string;
  current_window?: string;
  current_app?: string;
  last_heartbeat?: string;
  created_at?: string;
}

// Activity log entity
export interface ActivityLog {
  id?: string | number;
  employee_id: string;
  window_title: string;
  app_name: string;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  created_at?: string;
}

// Daily summary entity
export interface DailySummary {
  id?: string;
  employee_id: string;
  date: string;
  total_seconds: number;
  session_count: number;
  first_activity?: string;
  last_activity?: string;
  top_app?: string;
  top_app_seconds?: number;
  created_at?: string;
  updated_at?: string;
}

// Heartbeat update data
export interface HeartbeatData {
  current_window: string;
  current_app: string;
  last_heartbeat: string;
}

// Query filter options
export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface PaginationOptions {
  from: number;
  to: number;
}

// Database client interface - all backends must implement this
export interface DatabaseClient {
  // Employee operations
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | null>;
  createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee>;
  updateEmployee(id: string, data: Partial<Employee>): Promise<Employee | null>;
  updateHeartbeat(employeeId: string, data: HeartbeatData): Promise<void>;
  
  // Activity log operations
  getActivityLogs(
    filter?: DateRangeFilter,
    employeeId?: string,
    pagination?: PaginationOptions
  ): Promise<ActivityLog[]>;
  createActivityLog(log: Omit<ActivityLog, 'id'>): Promise<ActivityLog>;
  
  // Daily summary operations
  getDailySummaries(
    filter: DateRangeFilter,
    employeeId?: string,
    pagination?: PaginationOptions
  ): Promise<DailySummary[]>;
  upsertDailySummary(summary: Omit<DailySummary, 'id'>): Promise<DailySummary>;
  
  // Utility
  testConnection(): Promise<boolean>;
  close(): Promise<void>;
}

// Configuration storage
export interface StoredDatabaseConfig {
  provider: DatabaseProvider;
  config: DatabaseConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Local storage key for database config
export const DB_CONFIG_STORAGE_KEY = 'screentime_db_config';
