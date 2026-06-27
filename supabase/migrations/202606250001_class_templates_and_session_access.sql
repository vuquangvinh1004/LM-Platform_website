alter table public.class_sessions
add column if not exists student_access text not null default 'open',
add column if not exists available_from timestamptz null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'class_sessions_status_check'
      and conrelid = 'public.class_sessions'::regclass
  ) then
    alter table public.class_sessions
    drop constraint class_sessions_status_check;
  end if;
end $$;

alter table public.class_sessions
add constraint class_sessions_status_check check (status in ('planned', 'completed', 'cancelled'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_sessions_student_access_check'
      and conrelid = 'public.class_sessions'::regclass
  ) then
    alter table public.class_sessions
    add constraint class_sessions_student_access_check check (student_access in ('open', 'locked', 'scheduled'));
  end if;
end $$;

create index if not exists class_sessions_student_access_idx on public.class_sessions(student_access);
create index if not exists class_sessions_available_from_idx on public.class_sessions(available_from);

create table if not exists public.class_templates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  source_class_id uuid references public.classes(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  description text,
  teacher_desk_note text,
  linked_material_ids uuid[] not null default '{}'::uuid[],
  linked_simulation_ids uuid[] not null default '{}'::uuid[],
  session_blueprint jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_templates_course_id_idx on public.class_templates(course_id);
create index if not exists class_templates_created_by_idx on public.class_templates(created_by);
create index if not exists class_templates_created_at_idx on public.class_templates(created_at desc);

drop trigger if exists set_class_templates_updated_at on public.class_templates;
create trigger set_class_templates_updated_at
before update on public.class_templates
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.class_templates enable row level security;

drop policy if exists "Managers can read class templates" on public.class_templates;
create policy "Managers can read class templates"
on public.class_templates
for select
using (
  (created_by = auth.uid())
  or exists (
    select 1
    from public.classes c
    where c.course_id = class_templates.course_id
      and public.can_manage_class(c.id)
  )
);

drop policy if exists "Managers can insert class templates" on public.class_templates;
create policy "Managers can insert class templates"
on public.class_templates
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.classes c
    where c.course_id = class_templates.course_id
      and public.can_manage_class(c.id)
  )
);

drop policy if exists "Managers can update own class templates" on public.class_templates;
create policy "Managers can update own class templates"
on public.class_templates
for update
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "Managers can delete own class templates" on public.class_templates;
create policy "Managers can delete own class templates"
on public.class_templates
for delete
using (created_by = auth.uid());
