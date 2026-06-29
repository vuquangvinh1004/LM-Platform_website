-- Let each class decide whether student enrollment requests should be
-- auto-approved immediately after submission.

alter table public.classes
  add column if not exists auto_approve_enrollment boolean not null default false;
