-- Only classes explicitly opened by teaching staff should appear on the public
-- login page enrollment list. Keep the public list opt-in instead of exposing
-- every active class by default.

alter table public.classes
  add column if not exists is_open_for_enrollment boolean not null default false;

alter table public.class_change_requests
  add column if not exists requested_open_for_enrollment boolean;

