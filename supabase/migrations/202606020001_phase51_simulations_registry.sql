-- Phase 5.1: simulations registry linked to courses.

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  config jsonb,
  sort_order integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulations_course_slug_unique unique (course_id, slug),
  constraint simulations_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists simulations_course_id_idx on public.simulations(course_id);
create index if not exists simulations_status_idx on public.simulations(status);

create trigger set_simulations_updated_at
before update on public.simulations
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.simulations enable row level security;

drop policy if exists "Course owners can read simulations" on public.simulations;
create policy "Course owners can read simulations"
on public.simulations
for select
using (
  exists (
    select 1
    from public.courses c
    where c.id = simulations.course_id and c.owner_id = auth.uid()
  )
);

drop policy if exists "Course owners can manage simulations" on public.simulations;
create policy "Course owners can manage simulations"
on public.simulations
for all
using (
  exists (
    select 1
    from public.courses c
    where c.id = simulations.course_id and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses c
    where c.id = simulations.course_id and c.owner_id = auth.uid()
  )
);

drop policy if exists "Moderators can manage scoped simulations" on public.simulations;
create policy "Moderators can manage scoped simulations"
on public.simulations
for all
using (public.can_manage_course(simulations.course_id))
with check (public.can_manage_course(simulations.course_id));

drop policy if exists "Students can read published simulations via membership" on public.simulations;
create policy "Students can read published simulations via membership"
on public.simulations
for select
using (
  status = 'published'
  and public.has_active_class_membership_for_course(simulations.course_id)
);

drop policy if exists "Admins can manage all simulations" on public.simulations;
create policy "Admins can manage all simulations"
on public.simulations
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
