-- Phase 3.3 completion support: assessment table foundation + membership-aware RLS.
-- This enables lifecycle enforcement tests for pending/expired student access on assessments.

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  provider text not null default 'manual',
  form_url text,
  external_form_id text,
  embed_mode text not null default 'new_tab',
  max_score numeric,
  open_at timestamptz,
  due_at timestamptz,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_provider_check check (provider in ('google_form', 'microsoft_form', 'manual', 'other')),
  constraint assessments_embed_mode_check check (embed_mode in ('iframe', 'new_tab', 'disabled')),
  constraint assessments_status_check check (status in ('draft', 'open', 'closed', 'archived')),
  constraint assessments_max_score_check check (max_score is null or max_score > 0)
);

create index if not exists assessments_class_id_idx on public.assessments(class_id);
create index if not exists assessments_course_id_idx on public.assessments(course_id);
create index if not exists assessments_status_idx on public.assessments(status);

create trigger set_assessments_updated_at
before update on public.assessments
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.assessments enable row level security;

drop policy if exists "Managers can manage assessments in scope" on public.assessments;
create policy "Managers can manage assessments in scope"
on public.assessments
for all
using (public.can_manage_class(assessments.class_id))
with check (
  public.can_manage_class(assessments.class_id)
  and exists (
    select 1
    from public.classes c
    where c.id = assessments.class_id
      and c.course_id = assessments.course_id
  )
);

drop policy if exists "Students can read class assessments" on public.assessments;
create policy "Students can read class assessments"
on public.assessments
for select
using (
  status in ('open', 'closed')
  and public.has_active_membership_for_class(assessments.class_id)
);

drop policy if exists "Admins can read all assessments" on public.assessments;
create policy "Admins can read all assessments"
on public.assessments
for select
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
