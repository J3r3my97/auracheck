-- AI Visibility Audit Tool - Supabase Schema
-- Run this in your Supabase SQL Editor to create the required tables

-- audits: one row per audit run
create table audits (
  id uuid primary key default gen_random_uuid(),
  website_url text not null,
  zip_code text not null,
  business_name text,           -- extracted from page
  status text not null,         -- 'running' | 'complete' | 'failed'
  score int,                    -- 0-100 final composite
  results jsonb,                -- full check results
  ip_address text,              -- for rate limiting + abuse
  user_agent text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- leads: email captured after seeing partial report
create table leads (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid references audits(id),
  email text not null,
  phone text,                   -- optional
  business_name text,
  unlocked_at timestamptz default now()
);

-- Indexes for performance
create index on audits (created_at desc);
create index on audits (status);
create index on audits (ip_address);
create index on leads (email);
create index on leads (audit_id);
