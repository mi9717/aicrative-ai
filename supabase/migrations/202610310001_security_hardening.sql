-- AICRATIVE security hardening: tighten grants for app-owned tables.
-- Safe to re-run. Apply after 202610300001_aicrative_accounts_projects.sql.

-- Anonymous visitors must never receive table privileges, even though RLS is
-- also enabled. Keep authenticated grants limited to the operations the app uses.
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.projects from anon;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;

-- The profile bootstrap function is only invoked by the auth.users trigger.
-- It runs as its owner with an empty search_path and schema-qualified objects.
revoke all privileges on function public.handle_new_aicrative_user() from public;
revoke all privileges on function public.handle_new_aicrative_user() from anon;
revoke all privileges on function public.handle_new_aicrative_user() from authenticated;

-- Reassert row-level security in case a dashboard/manual change disabled it.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- NOTE: Do not FORCE ROW LEVEL SECURITY here. The SECURITY DEFINER profile
-- bootstrap trigger must be able to insert the profile row as its owner.
