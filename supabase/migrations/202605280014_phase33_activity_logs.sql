-- Phase 3.3: activity logs for approval/scope/enrollment governance actions.

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint activity_logs_entity_type_check check (
    entity_type in (
      'course',
      'class',
      'material',
      'assessment',
      'submission',
      'profile',
      'enrollment_request',
      'permission_scope'
    )
  )
);

create index if not exists activity_logs_actor_id_idx on public.activity_logs(actor_id);
create index if not exists activity_logs_action_idx on public.activity_logs(action);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "Actors can insert own activity logs" on public.activity_logs;
create policy "Actors can insert own activity logs"
on public.activity_logs
for insert
to authenticated
with check (actor_id = auth.uid());

drop policy if exists "Actors can read own activity logs" on public.activity_logs;
create policy "Actors can read own activity logs"
on public.activity_logs
for select
to authenticated
using (actor_id = auth.uid());

drop policy if exists "Admins can read all activity logs" on public.activity_logs;
create policy "Admins can read all activity logs"
on public.activity_logs
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
