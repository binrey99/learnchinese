-- Run once in the Supabase SQL Editor.
-- Bảng lưu thông tin hồ sơ học viên, bao gồm ảnh đại diện (avatar_url).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kích hoạt Row Level Security
alter table public.profiles enable row level security;

-- Cho phép mọi người đọc hồ sơ công khai
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Cho phép người dùng tự tạo / chèn hồ sơ của chính mình
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Cho phép người dùng tự cập nhật hồ sơ (ảnh đại diện, tên, bio) của chính mình
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
