-- Phase 6 polish: allow reviewed delete requests and native integration decisions.

alter table public.library_change_requests
drop constraint if exists library_change_requests_action_check;

alter table public.library_change_requests
add constraint library_change_requests_action_check
check (action in ('archive', 'delete'));
