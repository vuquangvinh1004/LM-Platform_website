-- Phase 4.C follow-up: allow lifecycle-generated reporting rows.

alter table public.submissions
  drop constraint if exists submissions_source_check;

alter table public.submissions
  add constraint submissions_source_check
  check (source in ('manual', 'internal', 'csv_import', 'google_webhook', 'microsoft_webhook', 'lifecycle'));

alter table public.course_assessment_results
  drop constraint if exists course_assessment_results_source_check;

alter table public.course_assessment_results
  add constraint course_assessment_results_source_check
  check (source in ('manual', 'internal', 'csv_import', 'google_webhook', 'microsoft_webhook', 'lifecycle'));
