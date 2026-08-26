-- ============================================================
-- MicroBiz AI — Production database schema (PostgreSQL / Supabase)
-- Run in Supabase SQL editor or via `psql -f schema.sql`
-- ============================================================

-- Supabase provides auth.users automatically. We reference it below.
-- If using plain Postgres + Clerk/NextAuth, replace auth.users(id)
-- with your own users table.

-- ---------- 1. Business profiles ----------
create table if not exists businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  industry      text not null,
  location_city text,
  location_state text,               -- 2-letter code, e.g. 'TN'
  country       text not null default 'US',
  founded_year  int,
  employees     int check (employees >= 0),
  financing_need text,               -- 'working_capital' | 'equipment' | 'expansion' | ...
  marketing_challenge  text,
  operational_challenge text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on businesses (owner_id);

-- ---------- 2. Monthly financials (the core data asset) ----------
-- One row per business per month. Filled manually at first,
-- then automatically from QuickBooks/Plaid sync.
create table if not exists monthly_financials (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  period       date not null,        -- first day of month, e.g. 2026-08-01
  revenue      numeric(14,2) not null default 0,
  cogs         numeric(14,2) not null default 0,   -- cost of goods sold (variable)
  opex         numeric(14,2) not null default 0,   -- operating expenses (mostly fixed)
  payroll      numeric(14,2) not null default 0,
  cash_balance numeric(14,2),        -- end-of-month cash on hand
  debt_payments numeric(14,2) not null default 0,
  source       text not null default 'manual',     -- 'manual' | 'quickbooks' | 'plaid'
  created_at   timestamptz not null default now(),
  unique (business_id, period)
);
create index on monthly_financials (business_id, period desc);

-- ---------- 3. Computed snapshots (cache of derived metrics) ----------
-- Recomputed by the server whenever financials change; keeps the
-- dashboard fast and gives you a history of health scores.
create table if not exists metric_snapshots (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  as_of         date not null,
  health_score  int,
  net_margin    numeric(7,4),
  monthly_cash_flow numeric(14,2),
  break_even_revenue numeric(14,2),
  runway_months numeric(7,2),        -- null = self-sustaining
  credit_readiness int,              -- 0–5 checkpoints met
  details       jsonb,               -- full metric payload for the UI
  created_at    timestamptz not null default now(),
  unique (business_id, as_of)
);

-- ---------- 4. AI advisor conversations ----------
create table if not exists ai_conversations (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  title        text,
  created_at   timestamptz not null default now()
);

create table if not exists ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  tokens_in       int,
  tokens_out      int,
  created_at      timestamptz not null default now()
);
create index on ai_messages (conversation_id, created_at);

-- ---------- 5. Funding catalog + matches ----------
create table if not exists funding_programs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  program_type text not null,        -- 'loan' | 'grant' | 'incentive' | 'marketplace'
  min_amount  numeric(14,2),
  max_amount  numeric(14,2),
  country     text not null default 'US',
  state       text,                  -- null = nationwide
  best_for    text[],                -- {'working_capital','equipment',...}
  eligibility text,
  url         text,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists funding_matches (
  business_id uuid references businesses(id) on delete cascade,
  program_id  uuid references funding_programs(id) on delete cascade,
  match_score int,                   -- 0–100, computed by matching job
  status      text default 'suggested',  -- 'suggested' | 'saved' | 'applied' | 'dismissed'
  matched_at  timestamptz not null default now(),
  primary key (business_id, program_id)
);

-- ---------- 6. External account connections (QuickBooks / Plaid) ----------
-- NEVER store raw tokens in plaintext. Encrypt with pgsodium/Vault
-- (Supabase) or KMS before insert; columns below hold ciphertext.
create table if not exists integrations (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  provider      text not null check (provider in ('quickbooks','plaid')),
  external_id   text,                -- QBO realmId / Plaid item_id
  access_token_enc  text,            -- encrypted
  refresh_token_enc text,            -- encrypted (QuickBooks)
  status        text not null default 'active',  -- 'active' | 'error' | 'revoked'
  last_synced_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (business_id, provider)
);

-- ---------- 7. Usage metering (for billing + abuse protection) ----------
create table if not exists ai_usage (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  day        date not null default current_date,
  requests   int not null default 0,
  tokens_out int not null default 0,
  unique (owner_id, day)
);

-- ---------- 8. Row Level Security (Supabase) ----------
alter table businesses          enable row level security;
alter table monthly_financials  enable row level security;
alter table metric_snapshots    enable row level security;
alter table ai_conversations    enable row level security;
alter table ai_messages         enable row level security;
alter table funding_matches     enable row level security;
alter table integrations        enable row level security;
alter table ai_usage            enable row level security;

create policy "owners read/write own businesses" on businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owners access own financials" on monthly_financials
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "owners access own snapshots" on metric_snapshots
  for select using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "owners access own conversations" on ai_conversations
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "owners access own messages" on ai_messages
  for all using (conversation_id in (
    select c.id from ai_conversations c
    join businesses b on b.id = c.business_id
    where b.owner_id = auth.uid()));

create policy "owners access own matches" on funding_matches
  for all using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "owners see own integrations" on integrations
  for select using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "owners see own usage" on ai_usage
  for select using (owner_id = auth.uid());

-- funding_programs is public read:
alter table funding_programs enable row level security;
create policy "anyone can read active programs" on funding_programs
  for select using (active = true);
