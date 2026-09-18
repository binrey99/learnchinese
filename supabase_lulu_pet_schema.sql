-- ============================================================
-- BẢNG DỮ LIỆU NUÔI THÚ CƯNG LULU (PET LULU)
-- ============================================================

create table if not exists public.lulu_pet (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  pet_name text default 'LuLu',
  level integer default 1,
  exp integer default 20,
  max_exp integer default 100,
  fullness integer default 85,
  happiness integer default 90,
  energy integer default 80,
  inventory jsonb default '{"baozi": 2, "orange": 3, "apple": 4, "watermelon": 1}'::jsonb,
  last_claim_date text default '',
  total_fed integer default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Bật Row Level Security (RLS)
alter table public.lulu_pet enable row level security;

-- Xóa chính sách cũ nếu có để tránh trùng lặp
drop policy if exists "Users can view own pet" on public.lulu_pet;
drop policy if exists "Users can insert own pet" on public.lulu_pet;
drop policy if exists "Users can update own pet" on public.lulu_pet;
drop policy if exists "Allow public pet access" on public.lulu_pet;

-- Chính sách cho phép người dùng xem, tạo và cập nhật thú cưng của mình
create policy "Users can view own pet"
  on public.lulu_pet for select
  using (auth.uid() = user_id or auth.uid() is null);

create policy "Users can insert own pet"
  on public.lulu_pet for insert
  with check (auth.uid() = user_id or auth.uid() is null);

create policy "Users can update own pet"
  on public.lulu_pet for update
  using (auth.uid() = user_id or auth.uid() is null);

-- Cho phép người dùng khách hoặc demo truy cập
create policy "Allow public pet access"
  on public.lulu_pet for all
  using (true)
  with check (true);

-- Tự động cập nhật thời gian updated_at
create or replace function public.handle_lulu_pet_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_lulu_pet_updated_at on public.lulu_pet;
create trigger set_lulu_pet_updated_at
  before update on public.lulu_pet
  for each row
  execute function public.handle_lulu_pet_updated_at();

