-- Phase 3 prerequisite for material-access enforcement: classes table with ownership and student read policies.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  teacher_id uuid not null references public.profiles(id),
  class_code text not null,
  title text not null,
  semester text,
  academic_year text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_teacher_code_term_unique unique (teacher_id, class_code, academic_year, semester),
  constraint classes_status_check check (status in ('draft', 'active', 'archived'))
);

create index if not exists classes_course_id_idx on public.classes(course_id);
create index if not exists classes_teacher_id_idx on public.classes(teacher_id);
create index if not exists classes_status_idx on public.classes(status);

create trigger set_classes_updated_at
before update on public.classes
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.classes enable row level security;

drop policy if exists "Teachers can read own classes" on public.classes;
create policy "Teachers can read own classes"
on public.classes
for select
using (teacher_id = auth.uid());

drop policy if exists "Teachers can insert own classes" on public.classes;
create policy "Teachers can insert own classes"
on public.classes
for insert
with check (teacher_id = auth.uid());

drop policy if exists "Teachers can update own classes" on public.classes;
create policy "Teachers can update own classes"
on public.classes
for update
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());


drop policy if exists "Admins can manage all classes" on public.classes;
create policy "Admins can manage all classes"
on public.classes
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
