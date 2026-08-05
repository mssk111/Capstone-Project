create extension if not exists pgcrypto;

-- Marketplace moderation and taxonomy. These tables are deliberately separate
-- from Supabase Auth so a profile can be moderated without changing an auth user.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'warned', 'banned')),
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id bigint primary key,
  seller_id uuid references public.users(id) on delete set null,
  title text not null,
  category text,
  price numeric(10, 2),
  status text not null default 'active' check (status in ('active', 'flagged', 'removed')),
  is_sold boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Safe upgrades for installations where these tables already exist.
alter table public.users add column if not exists status text not null default 'active';
alter table public.listings add column if not exists status text not null default 'active';
alter table public.listings add column if not exists is_sold boolean not null default false;
alter table public.listings add column if not exists completed_at timestamptz;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text not null default 'tag',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.categories (name, slug, icon, display_order) values
  ('Textbooks', 'textbooks', 'book-open', 10),
  ('Furniture', 'furniture', 'armchair', 20),
  ('Sublets', 'sublets', 'house', 30),
  ('Electronics', 'electronics', 'laptop', 40),
  ('Bikes', 'bikes', 'bike', 50),
  ('Dorm', 'dorm', 'lamp-desk', 60),
  ('Clothing', 'clothing', 'shirt', 70)
on conflict (slug) do nothing;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid references public.users(id) on delete set null,
  -- Marketplace IDs are local Date.now() values during the prototype phase.
  -- Keep the reference as text so it also supports migrated numeric/legacy IDs.
  listing_id text,
  reason text not null check (reason in ('spam', 'scam', 'harassment')),
  details text not null default '',
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Existing installations may have created reports.listing_id as uuid. Remove
-- its foreign key before converting every existing reference to its text form.
do $$
declare
  listing_fk record;
begin
  for listing_fk in
    select conname
    from pg_constraint
    where conrelid = 'public.reports'::regclass
      and contype = 'f'
      and conkey = array[
        (select attnum from pg_attribute
         where attrelid = 'public.reports'::regclass and attname = 'listing_id')
      ]
  loop
    execute format('alter table public.reports drop constraint %I', listing_fk.conname);
  end loop;
end
$$;

alter table public.reports
  alter column listing_id type text using listing_id::text;

create index if not exists reports_pending_priority_idx
  on public.reports (status, reason, created_at desc);

create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  query text not null,
  created_at timestamptz not null default now()
);

create index if not exists search_logs_query_created_idx
  on public.search_logs (query, created_at desc);

-- Analytics query surface; `active users` reflects users who searched, listed,
-- reported, or completed a transaction today.
create or replace view public.platform_analytics as
select
  (select count(distinct user_id) from (
    select user_id from public.search_logs where created_at >= date_trunc('day', now())
    union all select seller_id from public.listings where created_at >= date_trunc('day', now())
    union all select reporter_id from public.reports where created_at >= date_trunc('day', now())
  ) activity where user_id is not null) as dau,
  (select count(*) from public.listings where status = 'active' and not is_sold) as active_listings,
  (select count(*) from public.listings where is_sold) as sold_listings,
  (select count(*) from public.listings where is_sold) as completed_transactions,
  (select coalesce(sum(price), 0) from public.listings where is_sold) as transaction_volume;

create or replace view public.top_search_terms as
select query, count(*)::integer as count
from public.search_logs
where created_at >= now() - interval '30 days' and length(trim(query)) > 0
group by query
order by count(*) desc, query asc
limit 5;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  -- Local listing IDs are generated with Date.now(), so bigint is required.
  item_id bigint not null,
  buyer_username text not null,
  seller_username text not null,
  constraint chats_buyer_seller_item_key
    unique (item_id, buyer_username, seller_username)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_username text not null,
  message_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_created_at_idx
  on public.chat_messages (chat_id, created_at);

-- Publish inserts so connected recipients receive new rooms and messages immediately.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;

-- These prototype policies support the app's current LocalStorage-based login.
-- Replace them with user-scoped policies after moving login fully to Supabase Auth.
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

grant select, insert on public.chats to anon, authenticated;
grant select, insert on public.chat_messages to anon, authenticated;

drop policy if exists "prototype users can read chats" on public.chats;
create policy "prototype users can read chats"
  on public.chats for select
  to anon, authenticated
  using (true);

drop policy if exists "prototype users can create chats" on public.chats;
create policy "prototype users can create chats"
  on public.chats for insert
  to anon, authenticated
  with check (true);

drop policy if exists "prototype users can read chat messages" on public.chat_messages;
create policy "prototype users can read chat messages"
  on public.chat_messages for select
  to anon, authenticated
  using (true);

drop policy if exists "prototype users can create chat messages" on public.chat_messages;
create policy "prototype users can create chat messages"
  on public.chat_messages for insert
  to anon, authenticated
  with check (true);
