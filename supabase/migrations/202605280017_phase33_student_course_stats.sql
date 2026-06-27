-- Phase 3.3.5: lightweight per-course aggregation for student profile breakdown.

create table if not exists public.student_course_stats (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  completed_assessments int not null default 0,
  average_score numeric,
  updated_at timestamptz not null default now(),
  constraint student_course_stats_pk primary key (student_id, course_id),
  constraint student_course_stats_completed_non_negative check (completed_assessments >= 0)
);

create index if not exists student_course_stats_student_id_idx on public.student_course_stats(student_id);
create index if not exists student_course_stats_course_id_idx on public.student_course_stats(course_id);

create trigger set_student_course_stats_updated_at
before update on public.student_course_stats
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.student_course_stats enable row level security;

drop policy if exists "Students can read own course stats" on public.student_course_stats;
create policy "Students can read own course stats"
on public.student_course_stats
for select
using (student_id = auth.uid());

drop policy if exists "Managers can read course stats" on public.student_course_stats;
create policy "Managers can read course stats"
on public.student_course_stats
for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'teacher', 'moderator')
);

drop policy if exists "Service role can manage course stats" on public.student_course_stats;
create policy "Service role can manage course stats"
on public.student_course_stats
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
