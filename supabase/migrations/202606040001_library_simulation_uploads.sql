-- Phase 5.3: uploaded HTML simulations wait for review before being linked to courses.

create table if not exists public.simulation_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  original_file_name text not null,
  file_type text not null,
  file_size bigint not null check (file_size >= 0),
  storage_bucket text not null default 'simulation-packages',
  storage_path text not null,
  review_status text not null default 'pending_review',
  native_integration_status text not null default 'not_requested',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulation_uploads_review_status_check
    check (review_status in ('pending_review', 'approved', 'rejected')),
  constraint simulation_uploads_native_integration_status_check
    check (native_integration_status in ('not_requested', 'requested', 'accepted', 'rejected'))
);

create unique index if not exists simulation_uploads_storage_object_unique
on public.simulation_uploads(storage_bucket, storage_path);

create index if not exists simulation_uploads_uploaded_by_idx on public.simulation_uploads(uploaded_by);
create index if not exists simulation_uploads_review_status_idx on public.simulation_uploads(review_status);
create index if not exists simulation_uploads_created_at_idx on public.simulation_uploads(created_at desc);

drop trigger if exists set_simulation_uploads_updated_at on public.simulation_uploads;
create trigger set_simulation_uploads_updated_at
before update on public.simulation_uploads
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.simulation_uploads enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('simulation-packages', 'simulation-packages', false, 52428800, array['text/html']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Simulation uploaders can read own uploads" on public.simulation_uploads;
create policy "Simulation uploaders can read own uploads"
on public.simulation_uploads
for select
using (uploaded_by = auth.uid());

drop policy if exists "Teachers and staff can insert own simulation uploads" on public.simulation_uploads;
create policy "Teachers and staff can insert own simulation uploads"
on public.simulation_uploads
for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('teacher', 'moderator', 'admin')
  )
);

drop policy if exists "Uploaders can request native integration" on public.simulation_uploads;
create policy "Uploaders can request native integration"
on public.simulation_uploads
for update
using (uploaded_by = auth.uid())
with check (
  uploaded_by = auth.uid()
  and review_status in ('pending_review', 'approved', 'rejected')
);

drop policy if exists "Moderators and admins can review simulation uploads" on public.simulation_uploads;
create policy "Moderators and admins can review simulation uploads"
on public.simulation_uploads
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('moderator', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('moderator', 'admin')
  )
);

drop policy if exists "Owners can read own simulation package objects" on storage.objects;
create policy "Owners can read own simulation package objects"
on storage.objects
for select
using (bucket_id = 'simulation-packages' and owner = auth.uid());

drop policy if exists "Owners can insert simulation package objects" on storage.objects;
create policy "Owners can insert simulation package objects"
on storage.objects
for insert
with check (bucket_id = 'simulation-packages' and owner = auth.uid());

drop policy if exists "Moderators and admins can manage simulation package objects" on storage.objects;
create policy "Moderators and admins can manage simulation package objects"
on storage.objects
for all
using (
  bucket_id = 'simulation-packages'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('moderator', 'admin')
  )
)
with check (
  bucket_id = 'simulation-packages'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('moderator', 'admin')
  )
);
