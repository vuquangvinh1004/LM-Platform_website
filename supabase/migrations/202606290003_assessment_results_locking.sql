alter table public.assessments
  add column if not exists results_locked_at timestamptz,
  add column if not exists results_locked_by uuid references public.profiles(id),
  add column if not exists results_published_at timestamptz,
  add column if not exists results_published_by uuid references public.profiles(id);

create index if not exists assessments_results_locked_at_idx
  on public.assessments(results_locked_at desc);

create index if not exists assessments_results_published_at_idx
  on public.assessments(results_published_at desc);

with latest_publication as (
  select distinct on (car.assessment_id)
    car.assessment_id,
    car.published_at,
    car.published_by
  from public.course_assessment_results car
  where car.published_at is not null
  order by car.assessment_id, car.published_at desc
)
update public.assessments a
set
  results_locked_at = coalesce(a.results_locked_at, latest_publication.published_at),
  results_published_at = coalesce(a.results_published_at, latest_publication.published_at),
  results_published_by = coalesce(a.results_published_by, latest_publication.published_by)
from latest_publication
where a.id = latest_publication.assessment_id;
