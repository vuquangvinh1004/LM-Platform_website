-- Phase 6 extension: shared notifications, question bank, course assessment result mirror,
-- and teacher personal library quota settings.

create table if not exists public.global_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'published',
  audience_roles text[] not null default array['admin', 'moderator', 'teacher']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint global_notifications_status_check check (status in ('published', 'archived')),
  constraint global_notifications_audience_roles_check check (
    audience_roles <@ array['admin', 'moderator', 'teacher']::text[]
  )
);

create index if not exists global_notifications_status_idx on public.global_notifications(status);
create index if not exists global_notifications_created_at_idx on public.global_notifications(created_at desc);

drop trigger if exists set_global_notifications_updated_at on public.global_notifications;
create trigger set_global_notifications_updated_at
before update on public.global_notifications
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.global_notifications enable row level security;

drop policy if exists "Admins and moderators can manage global notifications" on public.global_notifications;
create policy "Admins and moderators can manage global notifications"
on public.global_notifications
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'));

drop policy if exists "Staff can read published global notifications" on public.global_notifications;
create policy "Staff can read published global notifications"
on public.global_notifications
for select
using (
  status = 'published'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = any(audience_roles)
);

create table if not exists public.personal_library_settings (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  storage_quota_bytes bigint not null default 52428800,
  storage_used_bytes bigint not null default 0,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_library_settings_quota_positive_check check (storage_quota_bytes > 0),
  constraint personal_library_settings_usage_non_negative_check check (storage_used_bytes >= 0),
  constraint personal_library_settings_usage_within_quota_check check (storage_used_bytes <= storage_quota_bytes)
);

create index if not exists personal_library_settings_updated_at_idx on public.personal_library_settings(updated_at desc);

drop trigger if exists set_personal_library_settings_updated_at on public.personal_library_settings;
create trigger set_personal_library_settings_updated_at
before update on public.personal_library_settings
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.personal_library_settings enable row level security;

drop policy if exists "Teachers can read own personal library settings" on public.personal_library_settings;
create policy "Teachers can read own personal library settings"
on public.personal_library_settings
for select
using (teacher_id = auth.uid());

drop policy if exists "Admins can manage personal library settings" on public.personal_library_settings;
create policy "Admins can manage personal library settings"
on public.personal_library_settings
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.ensure_personal_library_settings(target_teacher_id uuid, actor_id uuid default null)
returns public.personal_library_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_row public.personal_library_settings;
begin
  insert into public.personal_library_settings (teacher_id, updated_by)
  values (target_teacher_id, actor_id)
  on conflict (teacher_id) do update
  set updated_by = coalesce(actor_id, public.personal_library_settings.updated_by)
  returning * into settings_row;

  return settings_row;
end;
$$;

grant execute on function public.ensure_personal_library_settings(uuid, uuid) to authenticated;

create or replace function public.can_author_assessment_for_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  )
  or public.can_manage_course(target_course_id)
  or exists (
    select 1
    from public.classes c
    where c.course_id = target_course_id
      and c.teacher_id = auth.uid()
      and c.status in ('draft', 'active')
  );
$$;

grant execute on function public.can_author_assessment_for_course(uuid) to authenticated;

create table if not exists public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  question_type text not null default 'multiple_choice',
  choices jsonb not null default '[]'::jsonb,
  answer_key jsonb,
  explanation text,
  difficulty text not null default 'medium',
  default_points numeric not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_bank_items_question_type_check check (question_type in ('multiple_choice', 'true_false', 'short_answer', 'essay')),
  constraint question_bank_items_difficulty_check check (difficulty in ('easy', 'medium', 'hard')),
  constraint question_bank_items_default_points_check check (default_points > 0),
  constraint question_bank_items_status_check check (status in ('active', 'archived'))
);

create index if not exists question_bank_items_course_id_idx on public.question_bank_items(course_id);
create index if not exists question_bank_items_status_idx on public.question_bank_items(status);

drop trigger if exists set_question_bank_items_updated_at on public.question_bank_items;
create trigger set_question_bank_items_updated_at
before update on public.question_bank_items
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.question_bank_items enable row level security;

drop policy if exists "Authors can manage question bank items" on public.question_bank_items;
create policy "Authors can manage question bank items"
on public.question_bank_items
for all
using (public.can_author_assessment_for_course(question_bank_items.course_id))
with check (public.can_author_assessment_for_course(question_bank_items.course_id));

create table if not exists public.assessment_question_links (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_bank_item_id uuid not null references public.question_bank_items(id) on delete restrict,
  sort_order int not null default 1,
  points_override numeric,
  snapshot_prompt text not null,
  snapshot_question_type text not null,
  snapshot_choices jsonb not null default '[]'::jsonb,
  snapshot_answer_key jsonb,
  snapshot_explanation text,
  primary key (assessment_id, question_bank_item_id),
  constraint assessment_question_links_sort_order_check check (sort_order >= 1),
  constraint assessment_question_links_points_override_check check (points_override is null or points_override > 0)
);

create index if not exists assessment_question_links_assessment_idx on public.assessment_question_links(assessment_id, sort_order);

alter table public.assessment_question_links enable row level security;

drop policy if exists "Managers can manage assessment question links" on public.assessment_question_links;
create policy "Managers can manage assessment question links"
on public.assessment_question_links
for all
using (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_question_links.assessment_id
      and public.can_manage_class(a.class_id)
  )
)
with check (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_question_links.assessment_id
      and public.can_manage_class(a.class_id)
  )
);

drop policy if exists "Students can read assessment question links in own class" on public.assessment_question_links;
create policy "Students can read assessment question links in own class"
on public.assessment_question_links
for select
using (
  exists (
    select 1
    from public.assessments a
    where a.id = assessment_question_links.assessment_id
      and public.has_active_membership_for_class(a.class_id)
  )
);

create table if not exists public.course_assessment_results (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_identifier text not null,
  attempt_number int not null default 1,
  raw_score numeric,
  max_score numeric,
  normalized_score numeric,
  status text not null,
  source text not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_assessment_results_attempt_number_check check (attempt_number >= 1),
  constraint course_assessment_results_status_check check (status in ('submitted', 'late', 'missing', 'ignored')),
  constraint course_assessment_results_source_check check (source in ('manual', 'csv_import', 'google_webhook', 'microsoft_webhook')),
  constraint course_assessment_results_raw_score_check check (raw_score is null or raw_score >= 0),
  constraint course_assessment_results_max_score_check check (max_score is null or max_score > 0),
  constraint course_assessment_results_normalized_score_check check (normalized_score is null or (normalized_score >= 0 and normalized_score <= 100)),
  constraint course_assessment_results_unique_attempt unique (course_id, assessment_id, student_id, attempt_number)
);

create index if not exists course_assessment_results_course_id_idx on public.course_assessment_results(course_id);
create index if not exists course_assessment_results_assessment_id_idx on public.course_assessment_results(assessment_id);
create index if not exists course_assessment_results_student_id_idx on public.course_assessment_results(student_id);

drop trigger if exists set_course_assessment_results_updated_at on public.course_assessment_results;
create trigger set_course_assessment_results_updated_at
before update on public.course_assessment_results
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.course_assessment_results enable row level security;

drop policy if exists "Managers can manage course assessment results" on public.course_assessment_results;
create policy "Managers can manage course assessment results"
on public.course_assessment_results
for all
using (public.can_author_assessment_for_course(course_assessment_results.course_id))
with check (public.can_author_assessment_for_course(course_assessment_results.course_id));

drop policy if exists "Students can read own mirrored assessment results" on public.course_assessment_results;
create policy "Students can read own mirrored assessment results"
on public.course_assessment_results
for select
using (student_id = auth.uid());
