update public.question_bank_items
set is_available = true
where status = 'active'
  and coalesce(is_available, false) = false;
