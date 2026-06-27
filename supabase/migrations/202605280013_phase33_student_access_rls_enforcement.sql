-- Phase 3.3.1/3.3.2: enforce student access lifecycle in class/material read policies.

create or replace function public.has_active_class_membership_for_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.class_members cm on cm.class_id = c.id
    where c.course_id = target_course_id
      and c.status = 'active'
      and cm.student_id = auth.uid()
      and cm.status = 'active'
      and public.is_student_access_active(auth.uid())
  );
$$;

create or replace function public.has_active_membership_for_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_members cm
    where cm.class_id = target_class_id
      and cm.student_id = auth.uid()
      and cm.status = 'active'
      and public.is_student_access_active(auth.uid())
  );
$$;
