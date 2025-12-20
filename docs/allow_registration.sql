-- ALLOW EMPLOYEE REGISTRATION

-- 1. Enable RLS (just to be sure)
alter table public.employees enable row level security;

-- 2. Drop existing restrictive policies
drop policy if exists "Admins can view all employees" on public.employees;
drop policy if exists "Employees can view own profile" on public.employees;
drop policy if exists "Enable insert for everyone" on public.employees;

-- 3. Allow ANYONE to register (Insert)
create policy "Enable insert for everyone"
on public.employees for insert
with check (true);

-- 4. Allow ANYONE to view employees (Select) - needed for the dashboard and to verify registration
create policy "Enable select for everyone"
on public.employees for select
using (true);

-- 5. Grant permissions to anon role
grant all on public.employees to anon;
grant all on public.employees to authenticated;
grant all on public.employees to service_role;
