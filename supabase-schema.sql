-- ============================================================
-- 行前夹 TripClip v0.5 · Supabase 数据库结构
-- 使用方法：Supabase 项目 → SQL Editor → New query → 粘贴全部 → Run
-- ============================================================

-- 1. 收藏条目表（与前端条目字段一一对应，snake_case 命名）
create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '',
  type       text not null default '',
  tags       jsonb not null default '[]',
  address    text not null default '',
  hours      text not null default '',
  price      text not null default '',
  cancel     text not null default '',
  date_time  text not null default '',
  from_to    text not null default '',
  code       text not null default '',
  extra      text not null default '',
  note       text not null default '',
  link       text not null default '',
  source     text not null default '',
  pending    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. 行级安全策略：每个用户只能读写自己的数据（最关键的一步）
alter table public.entries enable row level security;

create policy "users can view own entries"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "users can insert own entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "users can update own entries"
  on public.entries for update
  using (auth.uid() = user_id);

create policy "users can delete own entries"
  on public.entries for delete
  using (auth.uid() = user_id);

-- 3. updated_at 自动更新触发器
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- 4. 按用户查询的索引（数据量大了以后保持流畅）
create index if not exists idx_entries_user_created
  on public.entries (user_id, created_at desc);

-- 5. 匿名 key 只有客户端能力，数据安全靠 RLS（第 2 步）
--    不要关闭 RLS，也不要给 anon/authenticated 角色任何直接表权限
revoke all on public.entries from anon;
revoke all on public.entries from authenticated;
