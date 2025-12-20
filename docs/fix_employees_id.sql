-- FIX EMPLOYEES TABLE ID

-- 1. Drop the foreign key to auth.users (so we can have "agent" employees without login accounts)
alter table public.employees drop constraint if exists employees_id_fkey;

-- 2. Make the ID auto-generate a UUID if not provided
alter table public.employees alter column id set default gen_random_uuid();

-- 3. Ensure the ID is not null (it's already PK, but good to be safe)
alter table public.employees alter column id set not null;
