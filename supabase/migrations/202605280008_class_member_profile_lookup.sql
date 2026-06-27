-- Phase 3.2: allow teacher/admin to resolve student profiles for membership creation without broad profiles read access.

create or replace function public.find_student_profiles_for_class_membership(
  target_class_id uuid,
  target_emails text[],
  target_student_codes text[]
)
returns table (
  id uuid,
  email text,
  full_name text,
  student_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  actor_role := auth.jwt() -> 'app_metadata' ->> 'role';

  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if actor_role <> 'admin' and not exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'Forbidden class membership lookup' using errcode = '42501';
  end if;

  return query
  select p.id, p.email, p.full_name, p.student_code
  from public.profiles p
  where p.role = 'student'
    and (
      (coalesce(array_length(target_emails, 1), 0) > 0 and lower(p.email) = any(target_emails))
      or (coalesce(array_length(target_student_codes, 1), 0) > 0 and p.student_code = any(target_student_codes))
    );
end;
$$;

grant execute on function public.find_student_profiles_for_class_membership(uuid, text[], text[]) to authenticated;