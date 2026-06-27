delete from public.class_resource_links
where target_type = 'material'
  and target_id in (
    select id
    from public.materials
    where review_status = 'rejected'
  );

delete from public.materials
where review_status = 'rejected';
