-- ============================================================
-- BẢNG DỮ LIỆU LƯU TIẾN ĐỘ TẬP VIẾT CHỮ HÁN CHO MỖI TÀI KHOẢN
-- (Chạy mã SQL này trong Supabase SQL Editor của dự án)
-- ============================================================

create table if not exists public.user_writing_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id bigint references public.vocabulary(id) on delete set null,
  word text not null,
  character text not null,
  level text default 'HSK 1',
  stroke_count integer default 0,
  mode text default 'quiz',
  times_written integer not null default 1,
  last_written_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_writing_unique_word_char unique (user_id, word, character)
);

-- Chỉ mục tối ưu hóa tốc độ truy vấn
create index if not exists user_writing_progress_user_idx
  on public.user_writing_progress (user_id, last_written_at desc);

create index if not exists user_writing_progress_level_idx
  on public.user_writing_progress (user_id, level);

-- Kích hoạt Row Level Security (RLS) bảo vệ dữ liệu người dùng
alter table public.user_writing_progress enable row level security;

-- Xóa các policy cũ nếu có
drop policy if exists "Users can read their writing progress" on public.user_writing_progress;
drop policy if exists "Users can insert their writing progress" on public.user_writing_progress;
drop policy if exists "Users can update their writing progress" on public.user_writing_progress;
drop policy if exists "Users can delete their writing progress" on public.user_writing_progress;

-- Chính sách: Người dùng chỉ đọc dữ liệu tập viết của chính mình
create policy "Users can read their writing progress"
on public.user_writing_progress for select to authenticated
using (auth.uid() = user_id);

-- Chính sách: Người dùng chỉ thêm tiến độ tập viết của chính mình
create policy "Users can insert their writing progress"
on public.user_writing_progress for insert to authenticated
with check (auth.uid() = user_id);

-- Chính sách: Người dùng chỉ cập nhật tiến độ tập viết của chính mình
create policy "Users can update their writing progress"
on public.user_writing_progress for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Chính sách: Người dùng chỉ xóa dữ liệu tập viết của chính mình
create policy "Users can delete their writing progress"
on public.user_writing_progress for delete to authenticated
using (auth.uid() = user_id);
