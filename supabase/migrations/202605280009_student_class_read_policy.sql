-- Phase 3.2: allow students to read classes they actively belong to.

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
  );
$$;

drop policy if exists "Students can read own classes via membership" on public.classes;
create policy "Students can read own classes via membership"
on public.classes
for select
using (public.has_active_membership_for_class(classes.id));