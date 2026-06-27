-- Phase 1.2 hardening: admin profile read policy based on app_metadata role claim.

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
  requested_role := coalesce(
    new.raw_app_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'role',
    'student'
  );

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

drop policy if exists "Admins can read all profiles" on public.profiles;

create policy "Admins can read all profiles"
on public.profiles
for select
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop function if exists public.is_current_user_admin();
