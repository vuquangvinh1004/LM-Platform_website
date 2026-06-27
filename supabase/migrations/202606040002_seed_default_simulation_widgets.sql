-- Phase 5.3: seed built-in native simulation widgets for existing non-archived courses.

insert into public.simulations (course_id, slug, title, description, config, sort_order, status)
select
  c.id,
  widget.slug,
  widget.title,
  widget.description,
  widget.config,
  widget.sort_order,
  'published'
from public.courses c
cross join (
  values
    (
      'moving-average-basic',
      'Mô phỏng bình quân di động',
      'Widget mô phỏng tính bình quân di động với kích thước cửa sổ có thể điều chỉnh.',
      '{"source":"native_widget"}'::jsonb,
      10
    ),
    (
      'simple-exponential-smoothing',
      'Mô phỏng san bằng mũ đơn giản',
      'Widget mô phỏng hệ số alpha và dự báo theo chuỗi thời gian cơ bản.',
      '{"source":"native_widget"}'::jsonb,
      20
    ),
    (
      'normal-distribution-linear-regression',
      'Mô phỏng phân phối chuẩn và hồi quy',
      'Widget minh họa xác suất cơ bản và đường hồi quy từ tập điểm mẫu.',
      '{"source":"native_widget"}'::jsonb,
      30
    )
) as widget(slug, title, description, config, sort_order)
where c.status <> 'archived'
on conflict (course_id, slug) do update
set
  title = excluded.title,
  description = excluded.description,
  config = excluded.config,
  sort_order = excluded.sort_order,
  status = excluded.status;
