-- ================================================
-- Daily Summary Table for Employee Screen Time
-- ================================================
-- This table stores pre-aggregated daily statistics for each employee.
-- Using this table makes weekly/monthly calculations simple and accurate.

-- Create the daily_summary table
CREATE TABLE IF NOT EXISTS daily_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_seconds INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    first_activity TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,
    top_app TEXT,
    top_app_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one record per employee per day
    UNIQUE(employee_id, date)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_daily_summary_employee ON daily_summary(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date_range ON daily_summary(employee_id, date);

-- Enable RLS
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Allow public read" ON daily_summary FOR SELECT USING (true);

-- Allow insert/update (for the cron job)
CREATE POLICY "Allow public insert" ON daily_summary FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON daily_summary FOR UPDATE USING (true);

-- ================================================
-- Function to aggregate daily data
-- ================================================
-- Call this function at end of day to aggregate activity_logs into daily_summary

CREATE OR REPLACE FUNCTION aggregate_daily_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
DECLARE
    emp RECORD;
    log_data RECORD;
    max_duration INTEGER := 7200; -- 2 hours cap per activity
BEGIN
    -- Loop through all employees
    FOR emp IN SELECT id FROM employees LOOP
        -- Aggregate activity_logs for this employee on target_date
        SELECT 
            COALESCE(SUM(LEAST(duration_seconds, max_duration)), 0) as total_secs,
            COUNT(*) as sessions,
            MIN(start_time) as first_act,
            MAX(COALESCE(end_time, start_time)) as last_act
        INTO log_data
        FROM activity_logs
        WHERE employee_id = emp.id
          AND DATE(start_time) = target_date;
        
        -- Get top app
        WITH app_totals AS (
            SELECT 
                app_name,
                SUM(LEAST(duration_seconds, max_duration)) as app_seconds
            FROM activity_logs
            WHERE employee_id = emp.id
              AND DATE(start_time) = target_date
            GROUP BY app_name
            ORDER BY app_seconds DESC
            LIMIT 1
        )
        INSERT INTO daily_summary (
            employee_id, 
            date, 
            total_seconds, 
            session_count, 
            first_activity, 
            last_activity,
            top_app,
            top_app_seconds,
            updated_at
        )
        SELECT 
            emp.id,
            target_date,
            log_data.total_secs,
            log_data.sessions,
            log_data.first_act,
            log_data.last_act,
            COALESCE(at.app_name, ''),
            COALESCE(at.app_seconds, 0),
            NOW()
        FROM (SELECT 1) dummy
        LEFT JOIN app_totals at ON true
        ON CONFLICT (employee_id, date) 
        DO UPDATE SET
            total_seconds = EXCLUDED.total_seconds,
            session_count = EXCLUDED.session_count,
            first_activity = EXCLUDED.first_activity,
            last_activity = EXCLUDED.last_activity,
            top_app = EXCLUDED.top_app,
            top_app_seconds = EXCLUDED.top_app_seconds,
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- Scheduled job to run at 11:59 PM daily
-- ================================================
-- Note: Supabase uses pg_cron for scheduling. Run this in SQL:

-- Enable pg_cron extension (if not already)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily aggregation at 23:59
-- SELECT cron.schedule(
--     'daily-summary-aggregation',
--     '59 23 * * *',
--     $$ SELECT aggregate_daily_summary(CURRENT_DATE); $$
-- );

-- ================================================
-- Insert sample data for testing (last 7 days)
-- ================================================
-- You'll need to replace the employee_id with actual IDs from your employees table

-- First, let's see existing employees
-- SELECT id, full_name FROM employees;

-- Then insert sample data (example - replace with actual employee IDs):
-- INSERT INTO daily_summary (employee_id, date, total_seconds, session_count, first_activity, last_activity, top_app, top_app_seconds)
-- VALUES 
--     ('YOUR-EMPLOYEE-UUID-1', CURRENT_DATE - INTERVAL '1 day', 28800, 45, NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day', 'Chrome', 14400),
--     ('YOUR-EMPLOYEE-UUID-1', CURRENT_DATE - INTERVAL '2 days', 25200, 38, NOW() - INTERVAL '2 days 9 hours', NOW() - INTERVAL '2 days 1 hour', 'VS Code', 12600);
