-- AICRATIVE shared password workspace.
-- Run this migration in the Supabase SQL Editor.
-- Browser clients cannot access this table directly. The Vercel API uses
-- SUPABASE_SERVICE_ROLE_KEY after validating the HttpOnly shared-access cookie.

create table if not exists public.shared_projects (
  id text primary key,
  title text not null default 'Untitled project',
  project_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_projects_updated_idx
  on public.shared_projects(updated_at desc);

alter table public.shared_projects enable row level security;

revoke all on table public.shared_projects from anon, authenticated;
grant select, insert, update, delete on table public.shared_projects to service_role;
