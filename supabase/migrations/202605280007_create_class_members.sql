-- Phase 3 prerequisite for material-access enforcement: class membership table.

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  student_code_snapshot text,
  full_name_snapshot text,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint class_members_class_student_unique unique (class_id, student_id),
  constraint class_members_status_check check (status in ('active', 'inactive', 'removed'))
);

create index if not exists class_members_class_id_idx on public.class_members(class_id);
create index if not exists class_members_student_id_idx on public.class_members(student_id);
create index if not exists class_members_status_idx on public.class_members(status);

alter table public.class_members enable row level security;

create or replace function public.has_active_class_membership_for_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.class_members cm on cm.class_id = c.id
    where c.course_id = target_course_id
      and c.status = 'active'
      and cm.student_id = auth.uid()
      and cm.status = 'active'
  );
$$;

drop policy if exists "Teachers can read class members for own classes" on public.class_members;
create policy "Teachers can read class members for own classes"
on public.class_members
for select
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_members.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can insert class members for own classes" on public.class_members;
create policy "Teachers can insert class members for own classes"
on public.class_members
for insert
with check (
  exists (
    select 1
    from public.classes c
    where c.id = class_members.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can update class members for own classes" on public.class_members;
create policy "Teachers can update class members for own classes"
on public.class_members
for update
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_members.class_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = class_members.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "Students can read own memberships" on public.class_members;
create policy "Students can read own memberships"
on public.class_members
for select
using (student_id = auth.uid());

drop policy if exists "Admins can manage all class members" on public.class_members;
create policy "Admins can manage all class members"
on public.class_members
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Students can read published materials via membership" on public.materials;
create policy "Students can read published materials via membership"
on public.materials
for select
using (
  status = 'published'
  and public.has_active_class_membership_for_course(materials.course_id)
);

drop policy if exists "Students can read material objects via membership" on storage.objects;
create policy "Students can read material objects via membership"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'course-materials'
  and exists (
    select 1
    from public.materials m
    where m.storage_bucket = storage.objects.bucket_id
      and m.storage_path = storage.objects.name
      and m.status = 'published'
      and public.has_active_class_membership_for_course(m.course_id)
  )
);
