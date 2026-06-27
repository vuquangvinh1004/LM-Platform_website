-- Phase 6 polish: Admin course edits assigned to a moderator require moderator consent.

alter table public.course_change_requests
drop constraint if exists course_change_requests_action_check,
add constraint course_change_requests_action_check check (action in ('create', 'update', 'archive', 'delete'));

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
    action = 'update'
    and target_course_id is not null
    and assigned_moderator_id is not null
    and requested_title is not null
  )
  or (
    action in ('archive', 'delete')
    and target_course_id is not null
  )
);
