alter table public.question_bank_items
  drop constraint if exists question_bank_items_difficulty_check;

update public.question_bank_items
set difficulty = case difficulty
  when 'easy' then 'remembering'
  when 'medium' then 'understanding'
  when 'hard' then 'analyzing'
  else difficulty
end
where difficulty in ('easy', 'medium', 'hard');

alter table public.question_bank_items
  alter column difficulty set default 'remembering';

alter table public.question_bank_items
  add constraint question_bank_items_difficulty_check
  check (
    difficulty in (
      'remembering',
      'understanding',
      'applying',
      'analyzing',
      'evaluating',
      'creating'
    )
  );
