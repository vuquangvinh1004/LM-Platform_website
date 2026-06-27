-- Phase 1.2: allow active admins to read all profiles via RLS.

create or replace function public.is_current_user_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_role text;
  current_status text;
begin
  select role, status
    into current_role, current_status
  from public.profiles
  where id = auth.uid();

  return current_role = 'admin' and current_status = 'active';
end;
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.is_current_user_admin() to service_role;

drop policy if exists "Admins can read all profiles" on public.profiles;

create policy "Admins can read all profiles"
on public.profiles
for select
using (public.is_current_user_admin());
