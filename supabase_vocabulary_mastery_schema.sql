-- Run once in the Supabase SQL Editor.
-- Stores the words each signed-in learner has marked as mastered.

create table if not exists public.vocabulary_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id bigint not null references public.vocabulary(id) on delete cascade,
  mastered_at timestamptz not null default now(),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  achieved_at timestamptz,
  primary key (user_id, vocabulary_id)
);

-- Safe to run on an existing vocabulary_mastery table.
alter table public.vocabulary_mastery add column if not exists correct_answers integer not null default 0 check (correct_answers >= 0);
alter table public.vocabulary_mastery add column if not exists achieved_at timestamptz;

create index if not exists vocabulary_mastery_user_idx
  on public.vocabulary_mastery (user_id, mastered_at desc);

alter table public.vocabulary_mastery enable row level security;

drop policy if exists "Users can read their mastered vocabulary" on public.vocabulary_mastery;
drop policy if exists "Users can add mastered vocabulary" on public.vocabulary_mastery;
drop policy if exists "Users can remove mastered vocabulary" on public.vocabulary_mastery;
drop policy if exists "Users can update mastered vocabulary" on public.vocabulary_mastery;

create policy "Users can read their mastered vocabulary"
on public.vocabulary_mastery for select to authenticated
using (auth.uid() = user_id);

create policy "Users can add mastered vocabulary"
on public.vocabulary_mastery for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can remove mastered vocabulary"
on public.vocabulary_mastery for delete to authenticated
using (auth.uid() = user_id);

create policy "Users can update mastered vocabulary"
on public.vocabulary_mastery for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
