-- Phase 6 polish: course metadata and moderator-created course requests.

alter table public.courses
add column if not exists credits integer,
add column if not exists knowledge_block text,
add column if not exists course_type text,
add column if not exists clo_items jsonb not null default '[]'::jsonb,
add column if not exists assessment_components jsonb not null default '[]'::jsonb;

alter table public.courses
drop constraint if exists courses_credits_check,
add constraint courses_credits_check check (credits is null or credits between 1 and 20);

alter table public.courses
drop constraint if exists courses_knowledge_block_check,
add constraint courses_knowledge_block_check check (
  knowledge_block is null or knowledge_block in ('general', 'foundation', 'major')
);

alter table public.courses
drop constraint if exists courses_course_type_check,
add constraint courses_course_type_check check (
  course_type is null or course_type in ('required', 'elective')
);

alter table public.course_change_requests
alter column target_course_id drop not null;

alter table public.course_change_requests
add column if not exists requested_title text,
add column if not exists requested_code text,
add column if not exists requested_description text,
add column if not exists requested_visibility text,
add column if not exists requested_credits integer,
add column if not exists requested_knowledge_block text,
add column if not exists requested_course_type text,
add column if not exists requested_clo_items jsonb not null default '[]'::jsonb,
add column if not exists requested_assessment_components jsonb not null default '[]'::jsonb,
add column if not exists assigned_moderator_id uuid references public.profiles(id) on delete set null;

alter table public.course_change_requests
drop constraint if exists course_change_requests_action_check,
add constraint course_change_requests_action_check check (action in ('create', 'archive', 'delete'));

alter table public.course_change_requests
drop constraint if exists course_change_requests_payload_check,
add constraint course_change_requests_payload_check check (
  (
    action = 'create'
    and target_course_id is null
    and requested_code is not null
    and requested_title is not null
  )
  or (
    action in ('archive', 'delete')
    and target_course_id is not null
  )
);

alter table public.course_change_requests
drop constraint if exists course_change_requests_requested_visibility_check,
add constraint course_change_requests_requested_visibility_check check (
  requested_visibility is null or requested_visibility in ('private', 'unlisted', 'public_preview')
);

alter table public.course_change_requests
drop constraint if exists course_change_requests_requested_credits_check,
add constraint course_change_requests_requested_credits_check check (
  requested_credits is null or requested_credits between 1 and 20
);

alter table public.course_change_requests
drop constraint if exists course_change_requests_requested_knowledge_block_check,
add constraint course_change_requests_requested_knowledge_block_check check (
  requested_knowledge_block is null or requested_knowledge_block in ('general', 'foundation', 'major')
);

alter table public.course_change_requests
drop constraint if exists course_change_requests_requested_course_type_check,
add constraint course_change_requests_requested_course_type_check check (
  requested_course_type is null or requested_course_type in ('required', 'elective')
);

create unique index if not exists course_change_requests_pending_create_unique
on public.course_change_requests(requested_by, requested_code)
where status = 'pending_review' and action = 'create';
