-- Extend shared notifications with audience targeting, expiry, and source metadata.

alter table public.global_notifications
  add column if not exists created_by_role text,
  add column if not exists target_profile_ids uuid[] not null default '{}'::uuid[],
  add column if not exists expires_at timestamptz,
  add column if not exists notification_kind text not null default 'announcement',
  add column if not exists related_entity_type text,
  add column if not exists related_entity_id uuid;

update public.global_notifications gn
set created_by_role = coalesce(
  gn.created_by_role,
  (
    select p.role::text
    from public.profiles p
    where p.id = gn.created_by
  ),
  'admin'
);

alter table public.global_notifications
  alter column created_by_role set default 'admin',
  alter column created_by_role set not null;

do $$
begin
  alter table public.global_notifications
    add constraint global_notifications_kind_check
    check (notification_kind in ('announcement', 'material_upload_request', 'material_upload_result'));
exception
  when duplicate_object then null;
end $$;

create index if not exists global_notifications_expires_at_idx on public.global_notifications(expires_at);
create index if not exists global_notifications_kind_idx on public.global_notifications(notification_kind);
create index if not exists global_notifications_related_entity_idx on public.global_notifications(related_entity_type, related_entity_id);
