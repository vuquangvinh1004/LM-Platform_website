-- Phase 3.3.1/3.3.2: add moderator role and student access lifecycle fields.

update public.profiles
set role = 'moderator'
where role = 'assistant';

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('admin', 'moderator', 'teacher', 'student'));

alter table public.profiles
add column if not exists access_status text;

update public.profiles
set access_status = case
  when role = 'student' then 'pending_approval'
  else 'active'
end
where access_status is null;

alter table public.profiles
alter column access_status set default 'pending_approval';

alter table public.profiles
alter column access_status set not null;

alter table public.profiles
drop constraint if exists profiles_access_status_check;

alter table public.profiles
add constraint profiles_access_status_check
check (access_status in ('pending_approval', 'active', 'suspended', 'expired'));

alter table public.profiles
add column if not exists access_expires_at timestamptz;

alter table public.profiles
add column if not exists approved_by uuid references public.profiles(id);

alter table public.profiles
add column if not exists approved_at timestamptz;

create index if not exists profiles_access_status_idx on public.profiles(access_status);
create index if not exists profiles_access_expires_at_idx on public.profiles(access_expires_at);

create or replace function public.is_student_access_active(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_student_id
      and p.role = 'student'
      and p.status = 'active'
      and p.access_status = 'active'
      and (p.access_expires_at is null or p.access_expires_at > now())
  );
$$;

grant execute on function public.is_student_access_active(uuid) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  resolved_role text;
  resolved_full_name text;
  resolved_access_status text;
begin
  requested_role := coalesce(
    new.raw_app_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'role',
    'student'
  );

  if requested_role in ('admin', 'moderator', 'teacher', 'student') then
    resolved_role := requested_role;
  else
    resolved_role := 'student';
  end if;

  resolved_access_status := case
    when resolved_role = 'student' then 'pending_approval'
    else 'active'
  end;

  resolved_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  if resolved_full_name is null then
    resolved_full_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    status,
    access_status,
    approved_by,
    approved_at
  )
  values (
    new.id,
    new.email,
    resolved_full_name,
    resolved_role,
    'active',
    resolved_access_status,
    null,
    case when resolved_access_status = 'active' then now() else null end
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      status = 'active',
      access_status = excluded.access_status,
      updated_at = now();

  return new;
end;
$$;
