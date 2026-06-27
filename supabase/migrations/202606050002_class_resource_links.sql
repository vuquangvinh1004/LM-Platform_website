-- Class-level resource links for Library materials and simulations.

create table if not exists public.class_resource_links (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  linked_by uuid references public.profiles(id) on delete set null,
  linked_at timestamptz not null default now(),
  constraint class_resource_links_target_type_check check (target_type in ('material', 'simulation')),
  constraint class_resource_links_unique unique (class_id, target_type, target_id)
);

create index if not exists class_resource_links_class_idx
on public.class_resource_links(class_id);

create index if not exists class_resource_links_target_idx
on public.class_resource_links(target_type, target_id);

alter table public.class_resource_links enable row level security;

drop policy if exists "Managers can read class resource links" on public.class_resource_links;
create policy "Managers can read class resource links"
on public.class_resource_links
for select
using (public.can_manage_class(class_resource_links.class_id));

drop policy if exists "Managers can manage class resource links" on public.class_resource_links;
create policy "Managers can manage class resource links"
on public.class_resource_links
for all
using (public.can_manage_class(class_resource_links.class_id))
with check (public.can_manage_class(class_resource_links.class_id));

drop policy if exists "Students can read own class resource links" on public.class_resource_links;
create policy "Students can read own class resource links"
on public.class_resource_links
for select
using (public.has_active_membership_for_class(class_resource_links.class_id));

drop policy if exists "Admins can manage all class resource links" on public.class_resource_links;
create policy "Admins can manage all class resource links"
on public.class_resource_links
for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.class_resource_links (class_id, target_type, target_id, linked_by)
select c.id, 'material', m.id, m.uploaded_by
from public.classes c
join public.materials m on m.course_id = c.course_id
where c.status = 'active'
  and m.status = 'published'
on conflict (class_id, target_type, target_id) do nothing;

insert into public.class_resource_links (class_id, target_type, target_id, linked_by)
select c.id, 'simulation', s.id, null
from public.classes c
join public.simulations s on s.course_id = c.course_id
where c.status = 'active'
  and s.status = 'published'
on conflict (class_id, target_type, target_id) do nothing;
