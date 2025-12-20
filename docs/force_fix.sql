-- FORCE FIX PERMISSIONS

-- 1. Disable RLS temporarily to reset (optional, but good for cleanup)
alter table public.activity_logs disable row level security;

-- 2. Drop the Foreign Key constraint (Critical for dummy ID)
alter table public.activity_logs 
drop constraint if exists activity_logs_employee_id_fkey;

-- 3. Re-enable RLS
alter table public.activity_logs enable row level security;

-- 4. Drop ALL existing policies on activity_logs to avoid conflicts
drop policy if exists "Employees can insert own logs" on public.activity_logs;
drop policy if exists "Admins can view all logs" on public.activity_logs;
drop policy if exists "Allow anon inserts" on public.activity_logs;
drop policy if exists "Enable insert for everyone" on public.activity_logs;

-- 5. Create a WIDE OPEN insert policy
create policy "Enable insert for everyone"
on public.activity_logs for insert
with check (true);

-- 6. Create a WIDE OPEN select policy (so you can see data in dashboard)
create policy "Enable select for everyone"
on public.activity_logs for select
using (true);

-- 7. Grant permissions to anon and authenticated roles
grant all on public.activity_logs to anon;
grant all on public.activity_logs to authenticated;
grant all on public.activity_logs to service_role;
