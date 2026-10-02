-- ============================================================
-- 1. PHÂN QUYỀN ROLE QUẢN LÝ (ADMIN) TRONG BẢNG PROFILES
-- ============================================================

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

-- Cấp quyền Quản lý (Admin) cho tài khoản chủ trang web:
update public.profiles
set role = 'admin'
where lower(email) in (
  'binhnguyen28hn@gmail.com',
  'binhnguyen2810zzz@gmail.com',
  'binhnguyen2810zzzzzz@gmail.com',
  'nvbghostrider99@gmail.com'
);

-- ============================================================
-- 2. BẢNG DỮ LIỆU CHAT HỖ TRỢ TRỰC TUYẾN (SUPPORT CHAT MESSAGES)
-- ============================================================

create table if not exists public.support_messages (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  sender_role text not null default 'user' check (sender_role in ('user', 'admin', 'bot')),
  user_name text not null default 'Học viên',
  user_email text default '',
  user_avatar text default '',
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists idx_support_messages_session_id on public.support_messages(session_id);
create index if not exists idx_support_messages_created_at on public.support_messages(created_at desc);

alter table public.support_messages enable row level security;

drop policy if exists "Allow public read support_messages" on public.support_messages;
drop policy if exists "Allow public insert support_messages" on public.support_messages;
drop policy if exists "Allow public update support_messages" on public.support_messages;

create policy "Allow public read support_messages"
  on public.support_messages for select
  using (true);

create policy "Allow public insert support_messages"
  on public.support_messages for insert
  with check (true);

create policy "Allow public update support_messages"
  on public.support_messages for update
  using (true)
  with check (true);
