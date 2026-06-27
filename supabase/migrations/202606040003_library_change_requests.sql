-- Phase 6: review workflow for archiving library resources without hard-deleting data.

create table if not exists public.library_change_requests (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  action text not null default 'archive',
  target_title_snapshot text not null,
  target_course_label_snapshot text,
  status text not null default 'pending_review',
  reason text,
  review_note text,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_change_requests_target_type_check check (target_type in ('material', 'simulation')),
  constraint library_change_requests_action_check check (action in ('archive')),
  constraint library_change_requests_status_check check (status in ('pending_review', 'approved', 'rejected'))
);

create index if not exists library_change_requests_target_idx
on public.library_change_requests(target_type, target_id);

create index if not exists library_change_requests_status_idx
on public.library_change_requests(status);

create index if not exists library_change_requests_requested_by_idx
on public.library_change_requests(requested_by);

create unique index if not exists library_change_requests_pending_unique
on public.library_change_requests(target_type, target_id, action)
where status = 'pending_review';

drop trigger if exists set_library_change_requests_updated_at on public.library_change_requests;
create trigger set_library_change_requests_updated_at
before update on public.library_change_requests
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.library_change_requests enable row level security;

drop policy if exists "Library requesters can read own change requests" on public.library_change_requests;
create policy "Library requesters can read own change requests"
on public.library_change_requests
for select
using (requested_by = auth.uid());

drop policy if exists "Teachers and staff can create library change requests" on public.library_change_requests;
create policy "Teachers and staff can create library change requests"
on public.library_change_requests
for insert
with check (
  requested_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('teacher', 'moderator', 'admin')
  )
);

drop policy if exists "Moderators and admins can review library change requests" on public.library_change_requests;
create policy "Moderators and admins can review library change requests"
on public.library_change_requests
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
