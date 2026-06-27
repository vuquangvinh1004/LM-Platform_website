-- Phase 4A: internal assessment runtime foundation.
-- Adds delivery mode metadata on assessments and creates the first
-- runtime tables for attempts, answers, and per-question scores.

alter table public.assessments
  add column if not exists delivery_mode text not null default 'external',
  add column if not exists attempt_limit integer not null default 1,
  add column if not exists shuffle_questions boolean not null default false,
  add column if not exists show_feedback_after_submit boolean not null default false,
  add column if not exists time_limit_minutes integer;

alter table public.assessments
  drop constraint if exists assessments_provider_check,
  add constraint assessments_provider_check
    check (provider in ('google_form', 'microsoft_form', 'manual', 'internal', 'other')),
  add constraint assessments_delivery_mode_check
    check (delivery_mode in ('external', 'internal')),
  add constraint assessments_attempt_limit_positive_check
    check (attempt_limit > 0),
  add constraint assessments_time_limit_minutes_positive_check
    check (time_limit_minutes is null or time_limit_minutes > 0);

alter table public.submissions
  drop constraint if exists submissions_source_check,
  add constraint submissions_source_check
    check (source in ('manual', 'internal', 'csv_import', 'google_webhook', 'microsoft_webhook'));

alter table public.course_assessment_results
  drop constraint if exists course_assessment_results_source_check,
  add constraint course_assessment_results_source_check
    check (source in ('manual', 'internal', 'csv_import', 'google_webhook', 'microsoft_webhook'));

create index if not exists assessments_delivery_mode_idx on public.assessments(delivery_mode);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  auto_graded_at timestamptz,
  graded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_attempts_status_check
    check (status in ('in_progress', 'submitted', 'auto_graded', 'graded', 'abandoned', 'expired')),
  constraint assessment_attempts_attempt_number_positive_check
    check (attempt_number > 0)
);

create unique index if not exists assessment_attempts_assessment_student_attempt_unique
on public.assessment_attempts(assessment_id, student_id, attempt_number);

create index if not exists assessment_attempts_assessment_id_idx
on public.assessment_attempts(assessment_id);

create index if not exists assessment_attempts_student_id_idx
on public.assessment_attempts(student_id);

create index if not exists assessment_attempts_status_idx
on public.assessment_attempts(status);

drop trigger if exists set_assessment_attempts_updated_at on public.assessment_attempts;
create trigger set_assessment_attempts_updated_at
before update on public.assessment_attempts
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_bank_item_id uuid not null references public.question_bank_items(id) on delete restrict,
  sort_order integer not null default 1,
  answer_payload jsonb not null default '{}'::jsonb,
  answered_at timestamptz,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_answers_sort_order_check check (sort_order >= 1),
  constraint assessment_answers_unique_attempt_question unique (attempt_id, question_bank_item_id),
  constraint assessment_answers_assessment_question_fk
    foreign key (assessment_id, question_bank_item_id)
    references public.assessment_question_links(assessment_id, question_bank_item_id)
    on delete restrict
);

create index if not exists assessment_answers_attempt_id_idx
on public.assessment_answers(attempt_id);

create index if not exists assessment_answers_assessment_id_idx
on public.assessment_answers(assessment_id);

create index if not exists assessment_answers_question_id_idx
on public.assessment_answers(question_bank_item_id);

drop trigger if exists set_assessment_answers_updated_at on public.assessment_answers;
create trigger set_assessment_answers_updated_at
before update on public.assessment_answers
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.assessment_answer_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_bank_item_id uuid not null references public.question_bank_items(id) on delete restrict,
  auto_score numeric,
  manual_score numeric,
  final_score numeric,
  grader_id uuid references public.profiles(id) on delete set null,
  feedback text,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_answer_scores_unique_attempt_question unique (attempt_id, question_bank_item_id),
  constraint assessment_answer_scores_auto_score_non_negative check (auto_score is null or auto_score >= 0),
  constraint assessment_answer_scores_manual_score_non_negative check (manual_score is null or manual_score >= 0),
  constraint assessment_answer_scores_final_score_non_negative check (final_score is null or final_score >= 0)
);

create index if not exists assessment_answer_scores_attempt_id_idx
on public.assessment_answer_scores(attempt_id);

create index if not exists assessment_answer_scores_question_id_idx
on public.assessment_answer_scores(question_bank_item_id);

drop trigger if exists set_assessment_answer_scores_updated_at on public.assessment_answer_scores;
create trigger set_assessment_answer_scores_updated_at
before update on public.assessment_answer_scores
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.assessment_answer_scores enable row level security;

drop policy if exists "Managers can manage assessment attempts in scope" on public.assessment_attempts;
create policy "Managers can manage assessment attempts in scope"
on public.assessment_attempts
for all
using (public.can_manage_assessment(assessment_attempts.assessment_id))
with check (public.can_manage_assessment(assessment_attempts.assessment_id));

drop policy if exists "Students can manage own assessment attempts" on public.assessment_attempts;
create policy "Students can manage own assessment attempts"
on public.assessment_attempts
for all
using (
  assessment_attempts.student_id = auth.uid()
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_attempts.assessment_id
      and public.has_active_membership_for_class(a.class_id)
  )
)
with check (
  assessment_attempts.student_id = auth.uid()
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_attempts.assessment_id
      and public.has_active_membership_for_class(a.class_id)
  )
);

drop policy if exists "Managers can manage assessment answers in scope" on public.assessment_answers;
create policy "Managers can manage assessment answers in scope"
on public.assessment_answers
for all
using (
  exists (
    select 1
    from public.assessment_attempts aa
    where aa.id = assessment_answers.attempt_id
      and public.can_manage_assessment(aa.assessment_id)
  )
)
with check (
  exists (
    select 1
    from public.assessment_attempts aa
    where aa.id = assessment_answers.attempt_id
      and public.can_manage_assessment(aa.assessment_id)
  )
);

drop policy if exists "Students can manage own assessment answers" on public.assessment_answers;
create policy "Students can manage own assessment answers"
on public.assessment_answers
for all
using (
  exists (
    select 1
    from public.assessment_attempts aa
    join public.assessments a on a.id = aa.assessment_id
    where aa.id = assessment_answers.attempt_id
      and aa.student_id = auth.uid()
      and public.has_active_membership_for_class(a.class_id)
  )
)
with check (
  exists (
    select 1
    from public.assessment_attempts aa
    join public.assessments a on a.id = aa.assessment_id
    where aa.id = assessment_answers.attempt_id
      and aa.student_id = auth.uid()
      and public.has_active_membership_for_class(a.class_id)
  )
);

drop policy if exists "Managers can manage assessment answer scores in scope" on public.assessment_answer_scores;
create policy "Managers can manage assessment answer scores in scope"
on public.assessment_answer_scores
for all
using (
  exists (
    select 1
    from public.assessment_attempts aa
    where aa.id = assessment_answer_scores.attempt_id
      and public.can_manage_assessment(aa.assessment_id)
  )
)
with check (
  exists (
    select 1
    from public.assessment_attempts aa
    where aa.id = assessment_answer_scores.attempt_id
      and public.can_manage_assessment(aa.assessment_id)
  )
);

drop policy if exists "Students can read own assessment answer scores" on public.assessment_answer_scores;
create policy "Students can read own assessment answer scores"
on public.assessment_answer_scores
for select
using (
  exists (
    select 1
    from public.assessment_attempts aa
    join public.assessments a on a.id = aa.assessment_id
    where aa.id = assessment_answer_scores.attempt_id
      and aa.student_id = auth.uid()
      and public.has_active_membership_for_class(a.class_id)
  )
);
