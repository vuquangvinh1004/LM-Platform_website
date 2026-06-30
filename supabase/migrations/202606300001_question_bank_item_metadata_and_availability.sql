alter table public.question_bank_items
  add column if not exists clo_code text,
  add column if not exists chapter_label text,
  add column if not exists is_available boolean not null default false;

create index if not exists question_bank_items_is_available_idx
  on public.question_bank_items(course_id, is_available)
  where status = 'active';
