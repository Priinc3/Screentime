-- ADD HEARTBEAT COLUMNS TO EMPLOYEES TABLE

-- 1. Add columns for real-time status
alter table public.employees 
add column if not exists current_window text,
add column if not exists current_app text,
add column if not exists last_heartbeat timestamptz;

-- 2. Allow agents to update their own heartbeat (Update policy)
create policy "Enable update for everyone"
on public.employees for update
using (true)
with check (true);

-- 3. Grant update permission
grant update on public.employees to anon;
grant update on public.employees to authenticated;
grant update on public.employees to service_role;
