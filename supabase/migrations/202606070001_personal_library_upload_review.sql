-- Phase 6 polish: personal library uploads and shared-library review status.

alter table public.materials
alter column course_id drop not null;

alter table public.materials
add column if not exists review_status text not null default 'approved',
add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
add column if not exists reviewed_at timestamptz,
add column if not exists review_note text;

alter table public.materials
drop constraint if exists materials_review_status_check,
add constraint materials_review_status_check check (review_status in ('pending_review', 'approved', 'rejected'));

create index if not exists materials_review_status_idx on public.materials(review_status);

drop policy if exists "Uploaders can read own personal materials" on public.materials;
create policy "Uploaders can read own personal materials"
on public.materials
for select
using (course_id is null and uploaded_by = auth.uid());

drop policy if exists "Teachers and staff can insert personal materials" on public.materials;
create policy "Teachers and staff can insert personal materials"
on public.materials
for insert
with check (
  course_id is null
  and uploaded_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('teacher', 'moderator', 'admin')
  )
);

drop policy if exists "Moderators and admins can review materials" on public.materials;
create policy "Moderators and admins can review materials"
on public.materials
for update
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

alter table public.simulation_uploads
add column if not exists requested_course_id uuid references public.courses(id) on delete set null;

create index if not exists simulation_uploads_requested_course_idx on public.simulation_uploads(requested_course_id);
