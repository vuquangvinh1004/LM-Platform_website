-- Learning-session content blocks for classroom lessons.

alter table public.class_sessions
add column if not exists overview_content text,
add column if not exists overview_objectives text,
add column if not exists lecture_items jsonb not null default '[]'::jsonb,
add column if not exists extra_materials jsonb not null default '[]'::jsonb,
add column if not exists assignments jsonb not null default '[]'::jsonb,
add column if not exists quick_review_questions jsonb not null default '[]'::jsonb;

