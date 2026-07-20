create extension if not exists pgcrypto;

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
