-- Phase 1.1: automatically create profile rows when a new auth user signs up.

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
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

  if requested_role in ('admin', 'teacher', 'student', 'assistant') then
    resolved_role := requested_role;
  else
    resolved_role := 'student';
  end if;

  resolved_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  if resolved_full_name is null then
    resolved_full_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, resolved_full_name, resolved_role, 'active')
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      status = 'active',
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

grant execute on function public.handle_new_auth_user() to supabase_auth_admin;

-- Backfill profiles for existing auth users that do not have a profile row yet.
insert into public.profiles (id, email, full_name, role, status)
select
  au.id,
  au.email,
  coalesce(nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''), split_part(au.email, '@', 1)) as full_name,
  case
    when coalesce(au.raw_user_meta_data ->> 'role', 'student') in ('admin', 'teacher', 'student', 'assistant')
      then coalesce(au.raw_user_meta_data ->> 'role', 'student')
    else 'student'
  end as role,
  'active' as status
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;
