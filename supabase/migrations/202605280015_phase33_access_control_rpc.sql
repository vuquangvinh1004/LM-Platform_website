-- Phase 3.3: security-definer RPC for student access approval/renewal without service-role dependency.

create or replace function public.approve_student_access(
  target_student_id uuid,
  target_expires_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  updated_count int;
begin
  select p.role
  into actor_role
  from public.profiles p
  where p.id = auth.uid();

  if actor_role not in ('admin', 'moderator', 'teacher') then
    raise exception 'FORBIDDEN_APPROVE_STUDENT_ACCESS';
  end if;

  update public.profiles
  set access_status = 'active',
      access_expires_at = target_expires_at,
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = target_student_id
    and role = 'student';

  get diagnostics updated_count = row_count;

  return updated_count > 0;
end;
$$;

grant execute on function public.approve_student_access(uuid, timestamptz) to authenticated;

create or replace function public.renew_student_access(
  target_student_id uuid,
  target_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  updated_count int;
begin
  select p.role
  into actor_role
  from public.profiles p
  where p.id = auth.uid();

  if actor_role not in ('admin', 'moderator', 'teacher') then
    raise exception 'FORBIDDEN_RENEW_STUDENT_ACCESS';
  end if;

  update public.profiles
  set access_status = 'active',
      access_expires_at = target_expires_at,
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = target_student_id
    and role = 'student';

  get diagnostics updated_count = row_count;

  return updated_count > 0;
end;
$$;

grant execute on function public.renew_student_access(uuid, timestamptz) to authenticated;
