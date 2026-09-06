-- Run once in Supabase SQL Editor to save sentence-order progress.
create unique index if not exists sentence_order_progress_user_question_idx on public.sentence_order_progress (user_id, level, lesson, question_index);
alter table public.sentence_order_progress enable row level security;
drop policy if exists "Users can read sentence order progress" on public.sentence_order_progress;
drop policy if exists "Users can insert sentence order progress" on public.sentence_order_progress;
drop policy if exists "Users can update sentence order progress" on public.sentence_order_progress;
create policy "Users can read sentence order progress" on public.sentence_order_progress for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert sentence order progress" on public.sentence_order_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update sentence order progress" on public.sentence_order_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
