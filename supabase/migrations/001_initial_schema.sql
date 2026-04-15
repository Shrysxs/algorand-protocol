-- GhostGas Schema

-- Campaigns: off-chain metadata + USDC pricing for on-chain budget units
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  app_id bigint not null unique,
  advertiser_address text not null,
  name text not null default 'Untitled Campaign',
  ad_creative_url text,
  budget_total integer not null default 0,
  budget_remaining integer not null default 0,
  cost_per_impression_usdc numeric(10,6) not null default 0.01,
  status text not null default 'active' check (status in ('active','paused','exhausted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Impressions: every settled ad watch
create table impressions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  user_address text not null,
  publisher_address text not null,
  proof_id text not null unique,
  duration_seconds real not null,
  attestation_tx_id text,
  settlement_tx_id text,
  amount_micro_algo bigint not null default 0,
  publisher_earned_micro_algo bigint not null default 0,
  protocol_fee_micro_algo bigint not null default 0,
  settled_at timestamptz not null default now()
);

-- Sponsored transactions: every fee-pooled tx the sponsor covered
create table sponsored_txns (
  id uuid primary key default gen_random_uuid(),
  user_address text not null,
  sponsor_tx_id text,
  user_tx_id text,
  fee_paid_micro_algo bigint not null default 2000,
  impression_id uuid references impressions(id),
  created_at timestamptz not null default now()
);

-- Users: wallet session tracking + abuse prevention
create table users (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  total_impressions integer not null default 0,
  total_sponsored_txns integer not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- Indexes for fast queries
create index idx_impressions_user on impressions(user_address);
create index idx_impressions_campaign on impressions(campaign_id);
create index idx_impressions_settled on impressions(settled_at);
create index idx_sponsored_user on sponsored_txns(user_address);
create index idx_users_address on users(address);

-- Auto-update updated_at on campaigns
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function update_updated_at();

-- RLS policies (enable row level security)
alter table campaigns enable row level security;
alter table impressions enable row level security;
alter table sponsored_txns enable row level security;
alter table users enable row level security;

-- Allow anon read on all tables (public dashboard data)
create policy "Allow anon read campaigns" on campaigns for select using (true);
create policy "Allow anon read impressions" on impressions for select using (true);
create policy "Allow anon read sponsored_txns" on sponsored_txns for select using (true);
create policy "Allow anon read users" on users for select using (true);

-- Allow service role full access (agent + API routes use service key)
create policy "Allow service insert campaigns" on campaigns for insert with check (true);
create policy "Allow service update campaigns" on campaigns for update using (true);
create policy "Allow service insert impressions" on impressions for insert with check (true);
create policy "Allow service insert sponsored" on sponsored_txns for insert with check (true);
create policy "Allow service insert users" on users for insert with check (true);
create policy "Allow service update users" on users for update using (true);
