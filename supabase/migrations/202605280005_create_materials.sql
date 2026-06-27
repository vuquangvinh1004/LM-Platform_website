-- Phase 2.2: materials metadata table and private storage bucket for course files.

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  uploaded_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  section_label text,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  storage_bucket text not null default 'course-materials',
  storage_path text not null,
  allow_download boolean not null default true,
  sort_order integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materials_file_size_non_negative check (file_size >= 0),
  constraint materials_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists materials_course_id_idx on public.materials(course_id);
create index if not exists materials_uploaded_by_idx on public.materials(uploaded_by);
create index if not exists materials_status_idx on public.materials(status);

create trigger set_materials_updated_at
before update on public.materials
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.materials enable row level security;

drop policy if exists "Course owners can read materials" on public.materials;
create policy "Course owners can read materials"
on public.materials
for select
using (
  exists (
    select 1
    from public.courses c
    where c.id = materials.course_id and c.owner_id = auth.uid()
  )
);

drop policy if exists "Course owners can insert materials" on public.materials;
create policy "Course owners can insert materials"
on public.materials
for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.courses c
    where c.id = materials.course_id and c.owner_id = auth.uid()
  )
);

drop policy if exists "Course owners can update materials" on public.materials;
create policy "Course owners can update materials"
on public.materials
for update
using (
  exists (
    select 1
    from public.courses c
    where c.id = materials.course_id and c.owner_id = auth.uid()
  )
)
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.courses c
    where c.id = materials.course_id and c.owner_id = auth.uid()
  )
);

drop policy if exists "Admins can read all materials" on public.materials;
create policy "Admins can read all materials"
on public.materials
for select
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


drop policy if exists "Admins can manage all materials" on public.materials;
create policy "Admins can manage all materials"
on public.materials
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Owners can read own course material objects" on storage.objects;
create policy "Owners can read own course material objects"
on storage.objects
for select
using (bucket_id = 'course-materials' and owner = auth.uid());

drop policy if exists "Owners can insert course material objects" on storage.objects;
create policy "Owners can insert course material objects"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'course-materials' and owner = auth.uid());

drop policy if exists "Owners can update own course material objects" on storage.objects;
create policy "Owners can update own course material objects"
on storage.objects
for update
to authenticated
using (bucket_id = 'course-materials' and owner = auth.uid())
with check (bucket_id = 'course-materials' and owner = auth.uid());

drop policy if exists "Admins can manage all course material objects" on storage.objects;
create policy "Admins can manage all course material objects"
on storage.objects
for all
to authenticated
using (bucket_id = 'course-materials' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check (bucket_id = 'course-materials' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

