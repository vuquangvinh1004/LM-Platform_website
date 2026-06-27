-- Phase 2.1: initial courses table with RLS and owner-based constraints.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  code text not null,
  title text not null,
  description text,
  visibility text not null default 'private',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_owner_code_unique unique (owner_id, code),
  constraint courses_visibility_check check (visibility in ('private', 'unlisted', 'public_preview')),
  constraint courses_status_check check (status in ('draft', 'active', 'archived'))
);

create trigger set_courses_updated_at
before update on public.courses
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.courses enable row level security;

drop policy if exists "Owners can read courses" on public.courses;
create policy "Owners can read courses"
on public.courses
for select
using (owner_id = auth.uid());

drop policy if exists "Owners can insert courses" on public.courses;
create policy "Owners can insert courses"
on public.courses
for insert
with check (owner_id = auth.uid());

drop policy if exists "Owners can update courses" on public.courses;
create policy "Owners can update courses"
on public.courses
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Admins can read all courses" on public.courses;
create policy "Admins can read all courses"
on public.courses
for select
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage all courses" on public.courses;
create policy "Admins can manage all courses"
on public.courses
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
