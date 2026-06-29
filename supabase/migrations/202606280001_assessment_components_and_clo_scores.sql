-- Assessment component metadata for teacher-facing result import/export by CLO.

alter table public.assessments
  add column if not exists assessment_component_type text,
  add column if not exists assessment_clo_codes jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assessments_assessment_component_type_check'
  ) then
    alter table public.assessments
      add constraint assessments_assessment_component_type_check
      check (
        assessment_component_type is null
        or assessment_component_type in ('diagnostic', 'frequent', 'periodic', 'final')
      );
  end if;
end
$$;

create index if not exists assessments_assessment_component_type_idx
on public.assessments(assessment_component_type);
