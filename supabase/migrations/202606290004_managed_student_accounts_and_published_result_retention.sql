create table if not exists public.managed_student_accounts (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  current_password text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists managed_student_accounts_created_at_idx
  on public.managed_student_accounts(created_at desc);

drop trigger if exists set_managed_student_accounts_updated_at on public.managed_student_accounts;
create trigger set_managed_student_accounts_updated_at
before update on public.managed_student_accounts
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.managed_student_accounts enable row level security;

drop policy if exists "Admins can manage managed student accounts" on public.managed_student_accounts;
create policy "Admins can manage managed student accounts"
on public.managed_student_accounts
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

alter table public.course_assessment_results
  alter column submission_id drop not null,
  alter column student_id drop not null;

alter table public.course_assessment_results
  drop constraint if exists course_assessment_results_submission_id_fkey,
  add constraint course_assessment_results_submission_id_fkey
    foreign key (submission_id)
    references public.submissions(id)
    on delete set null;

alter table public.course_assessment_results
  drop constraint if exists course_assessment_results_student_id_fkey,
  add constraint course_assessment_results_student_id_fkey
    foreign key (student_id)
    references public.profiles(id)
    on delete set null;
