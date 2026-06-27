-- Phase 6 polish: approval workflows for class/course lifecycle changes.

create table if not exists public.class_change_requests (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_class_id uuid references public.classes(id) on delete set null,
  course_id uuid not null references public.courses(id) on delete cascade,
  class_code text,
  title text,
  semester text,
  academic_year text,
  requested_status text,
  status text not null default 'pending_review',
  reason text,
  review_note text,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_change_requests_action_check check (action in ('create', 'archive', 'delete')),
  constraint class_change_requests_status_check check (status in ('pending_review', 'approved', 'rejected')),
  constraint class_change_requests_requested_status_check check (requested_status is null or requested_status in ('draft', 'active', 'archived')),
  constraint class_change_requests_payload_check check (
    (action = 'create' and target_class_id is null and class_code is not null and title is not null)
    or (action in ('archive', 'delete') and target_class_id is not null)
  )
);

create index if not exists class_change_requests_status_idx on public.class_change_requests(status);
create index if not exists class_change_requests_requested_by_idx on public.class_change_requests(requested_by);
create index if not exists class_change_requests_course_id_idx on public.class_change_requests(course_id);

create unique index if not exists class_change_requests_pending_unique
on public.class_change_requests(action, coalesce(target_class_id, '00000000-0000-0000-0000-000000000000'::uuid), course_id, coalesce(class_code, ''))
where status = 'pending_review';

drop trigger if exists set_class_change_requests_updated_at on public.class_change_requests;
create trigger set_class_change_requests_updated_at
before update on public.class_change_requests
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.class_change_requests enable row level security;

drop policy if exists "Class requesters can read own requests" on public.class_change_requests;
create policy "Class requesters can read own requests"
on public.class_change_requests
for select
using (requested_by = auth.uid());

drop policy if exists "Teachers and staff can create class change requests" on public.class_change_requests;
create policy "Teachers and staff can create class change requests"
on public.class_change_requests
for insert
with check (
  requested_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('teacher', 'moderator', 'admin')
  )
);

drop policy if exists "Moderators and admins can review class change requests" on public.class_change_requests;
create policy "Moderators and admins can review class change requests"
on public.class_change_requests
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('moderator', 'admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('moderator', 'admin')
  )
);

create table if not exists public.course_change_requests (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_course_id uuid not null references public.courses(id) on delete cascade,
  target_title_snapshot text not null,
  target_code_snapshot text not null,
  status text not null default 'pending_review',
  reason text,
  review_note text,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_change_requests_action_check check (action in ('archive', 'delete')),
  constraint course_change_requests_status_check check (status in ('pending_review', 'approved', 'rejected'))
);

create index if not exists course_change_requests_status_idx on public.course_change_requests(status);
create index if not exists course_change_requests_requested_by_idx on public.course_change_requests(requested_by);

create unique index if not exists course_change_requests_pending_unique
on public.course_change_requests(action, target_course_id)
where status = 'pending_review';

drop trigger if exists set_course_change_requests_updated_at on public.course_change_requests;
create trigger set_course_change_requests_updated_at
before update on public.course_change_requests
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.course_change_requests enable row level security;

drop policy if exists "Course requesters can read own requests" on public.course_change_requests;
create policy "Course requesters can read own requests"
on public.course_change_requests
for select
using (requested_by = auth.uid());

drop policy if exists "Teachers and staff can create course change requests" on public.course_change_requests;
create policy "Teachers and staff can create course change requests"
on public.course_change_requests
for insert
with check (
  requested_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('teacher', 'moderator', 'admin')
  )
);

drop policy if exists "Moderators and admins can review course change requests" on public.course_change_requests;
create policy "Moderators and admins can review course change requests"
on public.course_change_requests
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('moderator', 'admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('moderator', 'admin')
  )
);
