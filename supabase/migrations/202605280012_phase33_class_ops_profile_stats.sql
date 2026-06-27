-- Phase 3.3.5 and class operations expansion: sessions, announcements, messages, lightweight stats.

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  session_index int not null,
  title text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_session_index_check check (session_index >= 1),
  constraint class_sessions_time_range_check check (end_at > start_at),
  constraint class_sessions_status_check check (status in ('planned', 'completed', 'cancelled')),
  constraint class_sessions_unique_session unique (class_id, session_index)
);

create index if not exists class_sessions_class_id_idx on public.class_sessions(class_id);
create index if not exists class_sessions_status_idx on public.class_sessions(status);

create trigger set_class_sessions_updated_at
before update on public.class_sessions
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.class_sessions enable row level security;

drop policy if exists "Managers can manage class sessions" on public.class_sessions;
create policy "Managers can manage class sessions"
on public.class_sessions
for all
using (public.can_manage_class(class_sessions.class_id))
with check (public.can_manage_class(class_sessions.class_id));

drop policy if exists "Members can read class sessions" on public.class_sessions;
create policy "Members can read class sessions"
on public.class_sessions
for select
using (
  public.can_manage_class(class_sessions.class_id)
  or public.has_active_membership_for_class(class_sessions.class_id)
);

create table if not exists public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  content text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  constraint class_announcements_status_check check (status in ('published', 'archived'))
);

create index if not exists class_announcements_class_id_idx on public.class_announcements(class_id);
create index if not exists class_announcements_created_at_idx on public.class_announcements(created_at desc);

alter table public.class_announcements enable row level security;

drop policy if exists "Managers can manage class announcements" on public.class_announcements;
create policy "Managers can manage class announcements"
on public.class_announcements
for all
using (public.can_manage_class(class_announcements.class_id))
with check (public.can_manage_class(class_announcements.class_id));

drop policy if exists "Members can read published announcements" on public.class_announcements;
create policy "Members can read published announcements"
on public.class_announcements
for select
using (
  status = 'published'
  and (
    public.can_manage_class(class_announcements.class_id)
    or public.has_active_membership_for_class(class_announcements.class_id)
  )
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint direct_messages_sender_recipient_check check (sender_id <> recipient_id)
);

create index if not exists direct_messages_class_id_idx on public.direct_messages(class_id);
create index if not exists direct_messages_sender_id_idx on public.direct_messages(sender_id);
create index if not exists direct_messages_recipient_id_idx on public.direct_messages(recipient_id);

alter table public.direct_messages enable row level security;

drop policy if exists "Participants can read direct messages" on public.direct_messages;
create policy "Participants can read direct messages"
on public.direct_messages
for select
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
);

drop policy if exists "Managers and participants can create direct messages" on public.direct_messages;
create policy "Managers and participants can create direct messages"
on public.direct_messages
for insert
with check (
  (
    sender_id = auth.uid()
    and (
      public.can_manage_class(direct_messages.class_id)
      or public.has_active_membership_for_class(direct_messages.class_id)
    )
  )
  or public.can_manage_class(direct_messages.class_id)
);

drop policy if exists "Participants can update own received messages" on public.direct_messages;
create policy "Participants can update own received messages"
on public.direct_messages
for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create table if not exists public.student_profile_stats (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  total_assessments int not null default 0,
  completed_assessments int not null default 0,
  average_score numeric,
  weekly_active_count int,
  monthly_active_count int,
  total_access_minutes int,
  updated_at timestamptz not null default now(),
  constraint student_profile_stats_non_negative_totals_check check (
    total_assessments >= 0 and completed_assessments >= 0
  )
);

create trigger set_student_profile_stats_updated_at
before update on public.student_profile_stats
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.student_profile_stats enable row level security;

drop policy if exists "Students can read own profile stats" on public.student_profile_stats;
create policy "Students can read own profile stats"
on public.student_profile_stats
for select
using (student_id = auth.uid());

drop policy if exists "Managers can read profile stats" on public.student_profile_stats;
create policy "Managers can read profile stats"
on public.student_profile_stats
for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'teacher', 'moderator')
);

drop policy if exists "Service role can manage student profile stats" on public.student_profile_stats;
create policy "Service role can manage student profile stats"
on public.student_profile_stats
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
