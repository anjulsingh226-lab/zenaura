create extension if not exists pgcrypto;
create table registrations(
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text not null, team int, age int, budget text,
  shot_path text, status text not null default 'pending',
  created_at timestamptz default now());
alter table registrations enable row level security;
