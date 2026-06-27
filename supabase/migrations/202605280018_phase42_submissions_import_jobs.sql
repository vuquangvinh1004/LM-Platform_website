-- Phase 4.2: submission import foundation (import jobs + idempotent submissions upsert).

create or replace function public.can_manage_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessments a
    where a.id = target_assessment_id
      and public.can_manage_class(a.class_id)
  );
$$;

grant execute on function public.can_manage_assessment(uuid) to authenticated;

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  source text not null default 'csv',
  status text not null default 'pending',
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  error_rows integer not null default 0,
  error_report jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_jobs_source_check check (source in ('csv', 'google_webhook', 'microsoft_webhook', 'manual')),
  constraint import_jobs_status_check check (status in ('pending', 'completed', 'partial', 'failed')),
  constraint import_jobs_total_rows_non_negative check (total_rows >= 0),
  constraint import_jobs_success_rows_non_negative check (success_rows >= 0),
  constraint import_jobs_error_rows_non_negative check (error_rows >= 0)
);

create index if not exists import_jobs_assessment_id_idx on public.import_jobs(assessment_id);
create index if not exists import_jobs_created_by_idx on public.import_jobs(created_by);
create index if not exists import_jobs_status_idx on public.import_jobs(status);

create trigger set_import_jobs_updated_at
before update on public.import_jobs
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_identifier text not null,
  external_response_id text,
  attempt_number integer not null default 1,
  raw_score numeric,
  max_score numeric,
  normalized_score numeric,
  submitted_at timestamptz,
  status text not null default 'submitted',
  source text not null default 'csv_import',
  import_job_id uuid references public.import_jobs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submissions_status_check check (status in ('submitted', 'late', 'missing', 'ignored')),
  constraint submissions_source_check check (source in ('manual', 'csv_import', 'google_webhook', 'microsoft_webhook')),
  constraint submissions_attempt_number_positive check (attempt_number > 0),
  constraint submissions_raw_score_non_negative check (raw_score is null or raw_score >= 0),
  constraint submissions_max_score_positive check (max_score is null or max_score > 0),
  constraint submissions_normalized_score_range check (normalized_score is null or (normalized_score >= 0 and normalized_score <= 100))
);

create unique index if not exists submissions_assessment_identifier_attempt_unique
on public.submissions(assessment_id, student_identifier, attempt_number);

create unique index if not exists submissions_assessment_external_response_unique
on public.submissions(assessment_id, external_response_id)
where external_response_id is not null;

create index if not exists submissions_assessment_id_idx on public.submissions(assessment_id);
create index if not exists submissions_student_id_idx on public.submissions(student_id);
create index if not exists submissions_status_idx on public.submissions(status);

create trigger set_submissions_updated_at
before update on public.submissions
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.import_jobs enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Managers can manage import jobs in scope" on public.import_jobs;
create policy "Managers can manage import jobs in scope"
on public.import_jobs
for all
using (public.can_manage_assessment(import_jobs.assessment_id))
with check (public.can_manage_assessment(import_jobs.assessment_id));

drop policy if exists "Admins can read all import jobs" on public.import_jobs;
create policy "Admins can read all import jobs"
on public.import_jobs
for select
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Managers can manage submissions in scope" on public.submissions;
create policy "Managers can manage submissions in scope"
on public.submissions
for all
using (public.can_manage_assessment(submissions.assessment_id))
with check (public.can_manage_assessment(submissions.assessment_id));

drop policy if exists "Students can read own submissions" on public.submissions;
create policy "Students can read own submissions"
on public.submissions
for select
using (
  submissions.student_id = auth.uid()
  and exists (
    select 1
    from public.assessments a
    where a.id = submissions.assessment_id
      and public.has_active_membership_for_class(a.class_id)
  )
);

drop policy if exists "Admins can read all submissions" on public.submissions;
create policy "Admins can read all submissions"
on public.submissions
for select
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
