-- Run once in Supabase SQL Editor.
-- The app saves one answer per user, level, lesson, and question.

create unique index if not exists translation_progress_user_question_idx
  on public.translation_progress (user_id, level, lesson, question_index);

alter table public.translation_progress enable row level security;

drop policy if exists "Users can read their translation progress" on public.translation_progress;
drop policy if exists "Users can insert their translation progress" on public.translation_progress;
drop policy if exists "Users can update their translation progress" on public.translation_progress;

create policy "Users can read their translation progress"
on public.translation_progress for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their translation progress"
on public.translation_progress for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their translation progress"
on public.translation_progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
