-- Phase 3.3.3/3.3.4: scoped permissions and enrollment request workflow.

create table if not exists public.permission_scopes (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  scope_type text not null,
  scope_id uuid,
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  granted_by uuid not null references public.profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint permission_scopes_scope_type_check check (scope_type in ('system', 'course', 'class')),
  constraint permission_scopes_status_check check (status in ('active', 'revoked')),
  constraint permission_scopes_scope_id_required_check check (
    (scope_type = 'system' and scope_id is null)
    or (scope_type in ('course', 'class') and scope_id is not null)
  )
);

create index if not exists permission_scopes_actor_id_idx on public.permission_scopes(actor_id);
create index if not exists permission_scopes_scope_type_scope_id_idx on public.permission_scopes(scope_type, scope_id);
create index if not exists permission_scopes_status_idx on public.permission_scopes(status);

alter table public.permission_scopes enable row level security;

create or replace function public.has_scope_permission(
  target_scope_type text,
  target_scope_id uuid,
  required_permission text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  )
  or exists (
    select 1
    from public.permission_scopes ps
    where ps.actor_id = auth.uid()
      and ps.status = 'active'
      and (ps.expires_at is null or ps.expires_at > now())
      and (
        (ps.scope_type = 'system' and target_scope_type in ('course', 'class'))
        or (ps.scope_type = target_scope_type and ps.scope_id = target_scope_id)
      )
      and (
        required_permission is null
        or coalesce((ps.permissions ->> required_permission)::boolean, false)
      )
  );
$$;

grant execute on function public.has_scope_permission(text, uuid, text) to authenticated;

create or replace function public.can_manage_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  )
  or exists (
    select 1
    from public.courses c
    where c.id = target_course_id
      and c.owner_id = auth.uid()
  )
  or public.has_scope_permission('course', target_course_id, 'manage_course');
$$;

grant execute on function public.can_manage_course(uuid) to authenticated;

create or replace function public.can_manage_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  )
  or exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and c.teacher_id = auth.uid()
  )
  or public.has_scope_permission('class', target_class_id, 'manage_class')
  or exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and public.has_scope_permission('course', c.course_id, 'manage_class')
  );
$$;

grant execute on function public.can_manage_class(uuid) to authenticated;

drop policy if exists "Admins can manage all permission scopes" on public.permission_scopes;
create policy "Admins can manage all permission scopes"
on public.permission_scopes
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Actors can read own permission scopes" on public.permission_scopes;
create policy "Actors can read own permission scopes"
on public.permission_scopes
for select
using (actor_id = auth.uid());

create table if not exists public.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  constraint enrollment_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create unique index if not exists enrollment_requests_pending_unique
on public.enrollment_requests(student_id, course_id, coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid))
where status = 'pending';

create index if not exists enrollment_requests_student_id_idx on public.enrollment_requests(student_id);
create index if not exists enrollment_requests_course_id_idx on public.enrollment_requests(course_id);
create index if not exists enrollment_requests_status_idx on public.enrollment_requests(status);

alter table public.enrollment_requests enable row level security;

drop policy if exists "Students can create own enrollment requests" on public.enrollment_requests;
create policy "Students can create own enrollment requests"
on public.enrollment_requests
for insert
with check (
  student_id = auth.uid()
  and status = 'pending'
);

drop policy if exists "Students can read own enrollment requests" on public.enrollment_requests;
create policy "Students can read own enrollment requests"
on public.enrollment_requests
for select
using (student_id = auth.uid());

drop policy if exists "Reviewers can read manageable enrollment requests" on public.enrollment_requests;
create policy "Reviewers can read manageable enrollment requests"
on public.enrollment_requests
for select
using (public.can_manage_course(course_id));

drop policy if exists "Reviewers can update manageable enrollment requests" on public.enrollment_requests;
create policy "Reviewers can update manageable enrollment requests"
on public.enrollment_requests
for update
using (public.can_manage_course(course_id))
with check (public.can_manage_course(course_id));

drop policy if exists "Admins can manage all enrollment requests" on public.enrollment_requests;
create policy "Admins can manage all enrollment requests"
on public.enrollment_requests
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Extend class policies for scoped moderators.
drop policy if exists "Moderators can manage scoped classes" on public.classes;
create policy "Moderators can manage scoped classes"
on public.classes
for all
using (public.can_manage_class(classes.id))
with check (public.can_manage_class(classes.id));

drop policy if exists "Moderators can manage scoped class members" on public.class_members;
create policy "Moderators can manage scoped class members"
on public.class_members
for all
using (public.can_manage_class(class_members.class_id))
with check (public.can_manage_class(class_members.class_id));
