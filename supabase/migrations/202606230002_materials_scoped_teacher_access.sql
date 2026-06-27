-- Allow scoped course managers, including assigned teachers, to work with course materials.

drop policy if exists "Scoped managers can read materials" on public.materials;
create policy "Scoped managers can read materials"
on public.materials
for select
using (public.can_manage_course(materials.course_id));

drop policy if exists "Scoped managers can insert materials" on public.materials;
create policy "Scoped managers can insert materials"
on public.materials
for insert
with check (
  uploaded_by = auth.uid()
  and public.can_manage_course(materials.course_id)
);

drop policy if exists "Scoped managers can update materials" on public.materials;
create policy "Scoped managers can update materials"
on public.materials
for update
using (public.can_manage_course(materials.course_id))
with check (public.can_manage_course(materials.course_id));
