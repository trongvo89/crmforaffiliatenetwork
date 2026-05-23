-- Cityads CRM - Database Schema
-- Run in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Companies
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  profit_target numeric default 300,
  bonus_pool_pct numeric default 10,
  pm_pct numeric default 40,
  bd_pct numeric default 30,
  am_pct numeric default 20,
  admin_pct numeric default 10,
  min_kpi_threshold numeric default 70,
  bonus_forfeit_policy text default 'redistribute' check (bonus_forfeit_policy in ('redistribute', 'retain')),
  fraud_platinum_threshold numeric default 0.5,
  fraud_gold_threshold numeric default 1.0,
  fraud_silver_threshold numeric default 2.0,
  fraud_bronze_threshold numeric default 3.0,
  traffic_revenue_drop_pct numeric default 80,
  traffic_revenue_crash_pct numeric default 60,
  traffic_clicks_drop_pct numeric default 70,
  traffic_cr_spike_pct numeric default 140,
  traffic_cr_crash_pct numeric default 60,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Employees
create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  email text,
  role text not null check (role in ('pm', 'bd', 'am', 'admin', 'custom')),
  custom_role_name text,
  base_salary numeric,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Publishers
create table if not exists publishers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  email text,
  tier text default 'Bronze' check (tier in ('Platinum', 'Gold', 'Silver', 'Bronze')),
  traffic_sources text[] default '{}',
  payment_method text,
  bank_info text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Publisher contact log
create table if not exists publisher_contact_log (
  id uuid primary key default uuid_generate_v4(),
  publisher_id uuid references publishers(id) on delete cascade,
  event_type text not null check (event_type in ('system', 'manual')),
  note text not null,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Advertisers
create table if not exists advertisers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  contact_name text,
  contact_email text,
  payment_terms integer default 30,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Offers
create table if not exists offers (
  id uuid primary key default uuid_generate_v4(),
  advertiser_id uuid references advertisers(id) on delete cascade,
  name text not null,
  model text not null check (model in ('CPA', 'CPL', 'CPS', 'CPI', 'RevShare')),
  payout numeric not null,
  geo text[] default '{}',
  status text default 'active' check (status in ('active', 'paused', 'ended')),
  budget_total numeric,
  budget_spent numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Monthly P&L
create table if not exists pl_monthly (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  period_month date not null,
  revenue numeric default 0,
  publisher_cost numeric default 0,
  salary_cost numeric default 0,
  bonus_cost numeric default 0,
  other_cost numeric default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, period_month)
);

-- Campaigns
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  advertiser_id uuid references advertisers(id),
  offer_id uuid references offers(id),
  name text not null,
  status text default 'active' check (status in ('active', 'paused', 'ended')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaign P&L
create table if not exists campaign_pl (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  period_month date not null,
  revenue numeric default 0,
  publisher_cost numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(campaign_id, period_month)
);

-- KPI records
create table if not exists kpi_records (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references employees(id) on delete cascade,
  period_month date not null,
  kpi_1_label text,
  kpi_1_target numeric,
  kpi_1_actual numeric,
  kpi_2_label text,
  kpi_2_target numeric,
  kpi_2_actual numeric,
  kpi_3_label text,
  kpi_3_target numeric,
  kpi_3_actual numeric,
  activity_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(employee_id, period_month)
);

-- Reconciliation sessions
create table if not exists recon_sessions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  advertiser_id uuid references advertisers(id),
  period_month date not null,
  status text default 'pending' check (status in ('pending', 'matching', 'review', 'approved', 'paid')),
  our_file_url text,
  adv_file_url text,
  match_rate numeric,
  dispute_note text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reconciliation records
create table if not exists recon_records (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references recon_sessions(id) on delete cascade,
  match_status text not null check (match_status in ('matched', 'our_only', 'adv_only', 'amount_mismatch')),
  click_id text,
  conversion_id text,
  our_amount numeric,
  adv_amount numeric,
  transaction_date date,
  publisher_id uuid references publishers(id),
  dispute_note text,
  raw_data jsonb,
  created_at timestamptz default now()
);

-- Contracts
create table if not exists contracts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  party_name text not null,
  party_type text not null check (party_type in ('publisher', 'advertiser', 'other')),
  file_url text,
  signed_date date,
  expiry_date date,
  ai_analysis jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Daily metrics
create table if not exists daily_metrics (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  publisher_id uuid references publishers(id),
  metric_date date not null,
  clicks integer default 0,
  conversions integer default 0,
  revenue numeric default 0,
  epc numeric generated always as (case when clicks > 0 then revenue / clicks else 0 end) stored,
  cr numeric generated always as (case when clicks > 0 then conversions::numeric / clicks * 100 else 0 end) stored,
  created_at timestamptz default now(),
  unique(campaign_id, publisher_id, metric_date)
);

-- Fraud flags
create table if not exists fraud_flags (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  publisher_id uuid references publishers(id),
  campaign_id uuid references campaigns(id),
  flag_type text not null check (flag_type in ('cr_spike', 'fraud_rate', 'revenue_anomaly')),
  severity text not null check (severity in ('high', 'medium', 'low')),
  status text default 'open' check (status in ('open', 'investigating', 'resolved', 'false_positive')),
  details jsonb,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security
alter table companies enable row level security;
alter table employees enable row level security;
alter table publishers enable row level security;
alter table publisher_contact_log enable row level security;
alter table advertisers enable row level security;
alter table offers enable row level security;
alter table pl_monthly enable row level security;
alter table campaigns enable row level security;
alter table campaign_pl enable row level security;
alter table kpi_records enable row level security;
alter table recon_sessions enable row level security;
alter table recon_records enable row level security;
alter table contracts enable row level security;
alter table daily_metrics enable row level security;
alter table fraud_flags enable row level security;

-- Storage buckets
insert into storage.buckets (id, name, public) values ('contracts', 'contracts', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('reconciliation-files', 'reconciliation-files', false) on conflict do nothing;
