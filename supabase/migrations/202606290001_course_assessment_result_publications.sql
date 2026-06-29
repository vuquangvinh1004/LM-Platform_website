-- Add publication snapshot fields so teacher-submitted assessment results can be
-- explicitly pushed to the moderator-facing course evaluation board.

alter table public.course_assessment_results
  add column if not exists assessment_component_type text,
  add column if not exists assessment_clo_codes text[] not null default '{}'::text[],
  add column if not exists clo_scores jsonb not null default '{}'::jsonb,
  add column if not exists class_code_snapshot text,
  add column if not exists class_title_snapshot text,
  add column if not exists academic_year_snapshot text,
  add column if not exists student_code_snapshot text,
  add column if not exists student_full_name_snapshot text,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles(id) on delete set null;

alter table public.course_assessment_results
  drop constraint if exists course_assessment_results_component_type_check;

alter table public.course_assessment_results
  add constraint course_assessment_results_component_type_check
  check (
    assessment_component_type is null
    or assessment_component_type in ('diagnostic', 'frequent', 'periodic', 'final')
  );

create index if not exists course_assessment_results_published_at_idx
  on public.course_assessment_results(published_at desc);

create index if not exists course_assessment_results_course_published_idx
  on public.course_assessment_results(course_id, published_at desc);

update public.course_assessment_results car
set
  assessment_component_type = a.assessment_component_type,
  assessment_clo_codes = case
    when jsonb_typeof(a.assessment_clo_codes) = 'array'
      then array(
        select jsonb_array_elements_text(a.assessment_clo_codes)
      )
    else '{}'::text[]
  end,
  clo_scores = case
    when jsonb_typeof(
      coalesce(
        (
          select s.metadata
          from public.submissions s
          where s.id = car.submission_id
        ),
        '{}'::jsonb
      ) -> 'cloScores'
    ) = 'object'
      then coalesce(
        (
          select s.metadata
          from public.submissions s
          where s.id = car.submission_id
        ),
        '{}'::jsonb
      ) -> 'cloScores'
    else '{}'::jsonb
  end,
  class_code_snapshot = c.class_code,
  class_title_snapshot = c.title,
  academic_year_snapshot = c.academic_year,
  student_code_snapshot = p.student_code,
  student_full_name_snapshot = p.full_name
from public.assessments a,
     public.classes c,
     public.profiles p
where a.id = car.assessment_id
  and c.id = car.class_id
  and p.id = car.student_id;
