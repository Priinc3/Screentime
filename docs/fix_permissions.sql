-- 1. Drop the Foreign Key constraint
-- This allows us to log activities for "dummy" employees that don't exist in the auth system yet.
alter table public.activity_logs 
drop constraint if exists activity_logs_employee_id_fkey;

-- 2. Update RLS Policy for Activity Logs
-- Allow the anonymous agent to insert logs without being signed in.
drop policy if exists "Employees can insert own logs" on public.activity_logs;

create policy "Allow anon inserts"
on public.activity_logs for insert
to anon
with check (true);

-- 3. Update RLS Policy for Employees (just in case)
drop policy if exists "Admins can view all employees" on public.employees;
create policy "Enable read access for all users"
on public.employees for select
using (true);
