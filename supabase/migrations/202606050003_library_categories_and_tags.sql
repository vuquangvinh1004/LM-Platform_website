-- Library categories and tags for materials, simulations, and uploaded HTML simulations.

create table if not exists public.library_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int not null default 0,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_categories_status_check check (status in ('active', 'archived')),
  constraint library_categories_name_check check (char_length(trim(name)) > 0),
  constraint library_categories_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists library_categories_status_sort_idx
on public.library_categories(status, sort_order, name);

alter table public.library_categories enable row level security;

drop policy if exists "Managers can read library categories" on public.library_categories;
create policy "Managers can read library categories"
on public.library_categories
for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('teacher', 'moderator', 'admin')
);

drop policy if exists "Mod admin can manage library categories" on public.library_categories;
create policy "Mod admin can manage library categories"
on public.library_categories
for all
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin')
);

insert into public.library_categories (name, slug, description, sort_order)
values
  ('Bài giảng', 'bai-giang', 'Tài liệu bài giảng, slide, ghi chú học tập.', 10),
  ('Bài tập', 'bai-tap', 'Bài tập, phiếu thực hành, đề luyện tập.', 20),
  ('Mô phỏng', 'mo-phong', 'Mô phỏng và tài nguyên tương tác.', 30),
  ('Tham khảo', 'tham-khao', 'Tài liệu đọc thêm và nguồn tham khảo.', 40)
on conflict (slug) do nothing;

alter table public.materials
add column if not exists category_id uuid references public.library_categories(id) on delete set null,
add column if not exists tags text[] not null default '{}';

alter table public.simulations
add column if not exists category_id uuid references public.library_categories(id) on delete set null,
add column if not exists tags text[] not null default '{}';

alter table public.simulation_uploads
add column if not exists category_id uuid references public.library_categories(id) on delete set null,
add column if not exists tags text[] not null default '{}';

create index if not exists materials_category_idx
on public.materials(category_id);

create index if not exists simulations_category_idx
on public.simulations(category_id);

create index if not exists simulation_uploads_category_idx
on public.simulation_uploads(category_id);

create index if not exists materials_tags_gin_idx
on public.materials using gin(tags);

create index if not exists simulations_tags_gin_idx
on public.simulations using gin(tags);

create index if not exists simulation_uploads_tags_gin_idx
on public.simulation_uploads using gin(tags);
