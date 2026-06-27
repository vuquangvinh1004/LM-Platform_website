-- Preserve requested course status when Admin edits a moderator-managed course.

alter table public.course_change_requests
add column if not exists requested_status text;

alter table public.course_change_requests
drop constraint if exists course_change_requests_requested_status_check,
add constraint course_change_requests_requested_status_check check (
  requested_status is null or requested_status in ('draft', 'active', 'archived')
);
