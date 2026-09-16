-- Contact Us and Feedback messages.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
--
-- Anyone can send a message; nobody can read messages through the site.
-- You read them in Supabase: Table Editor → messages.

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('contact', 'feedback')),
  name        text check (char_length(name) <= 120),
  email       text check (char_length(email) <= 254),
  topic       text check (char_length(topic) <= 60),
  message     text not null check (char_length(message) between 1 and 5000),
  page        text check (char_length(page) <= 300),
  user_id     uuid references auth.users (id) on delete set null
);

alter table public.messages enable row level security;

-- Insert only. A signed-in visitor can attach their own id and nobody else's.
drop policy if exists "anyone can send a message" on public.messages;
create policy "anyone can send a message" on public.messages
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Row level security decides which rows; this grant allows the insert at all.
-- Deliberately no select, update or delete.
grant insert on public.messages to anon, authenticated;
