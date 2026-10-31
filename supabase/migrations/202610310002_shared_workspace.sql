-- AICRATIVE shared cloud workspace.
-- Apply after the account/project migrations already run in Supabase.
-- Existing account-owned projects are copied into the shared workspace and
-- retained in public.projects as a backup; this migration does not delete them.

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

-- No browser role can read or write this table directly. The server-side
-- workspace API validates the signed shared-password cookie before using
-- the server-only service_role key.
revoke all privileges on table public.shared_projects from public, anon, authenticated;
grant all privileges on table public.shared_projects to service_role;

-- Preserve existing cloud projects by copying every account's rows into the
-- single shared workspace. Conflicting IDs are left untouched.
insert into public.shared_projects (id, title, project_data, created_at, updated_at)
select id, title, project_data, created_at, updated_at
from public.projects
on conflict (id) do nothing;
