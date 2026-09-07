-- AI Dungeon Master app schema.
-- Paste this whole file into the Supabase SQL editor (SQL Editor -> New query) and run it once.

create extension if not exists pgcrypto;

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  player_invite_code text not null unique,
  admin_invite_code text not null unique,
  dm_tone text not null default 'high fantasy',
  world_bible jsonb not null default '{"locations":[],"factions":[],"plotThreads":[]}'::jsonb,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, name)
);

create table characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid not null references users(id) on delete cascade,
  name text not null,
  race text not null,
  class text not null,
  background text not null,
  level integer not null default 1,
  ability_scores jsonb not null,
  ability_score_method text not null,
  proficient_skills text[] not null default '{}',
  proficient_saving_throws text[] not null default '{}',
  equipment jsonb not null default '[]'::jsonb,
  class_features text[] not null default '{}',
  spell_slots jsonb,
  base_armor_class integer not null default 10,
  derived jsonb not null,
  hp_current integer not null,
  hp_max integer not null,
  hp_temp integer not null default 0,
  conditions jsonb not null default '[]'::jsonb,
  death_save_successes integer not null default 0,
  death_save_failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index characters_campaign_id_idx on characters(campaign_id);
create index characters_player_id_idx on characters(player_id);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  pause_reason text check (pause_reason in ('admin', 'disconnect')),
  turn_queue jsonb not null default '[]'::jsonb,
  current_turn_index integer not null default -1,
  round integer not null default 1,
  pending_roll jsonb,
  pending_action_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_campaign_id_idx on sessions(campaign_id);

create table event_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  type text not null check (type in ('narration', 'player_action', 'roll_submitted', 'ruling', 'correction', 'system')),
  character_id uuid references characters(id) on delete set null,
  actor_label text,
  text text not null,
  roll_type text,
  roll_value numeric,
  ruling jsonb,
  correction jsonb,
  created_at timestamptz not null default now()
);
create index event_logs_session_id_idx on event_logs(session_id);

-- Row Level Security: the browser only ever reads through Realtime using the
-- anon key (never writes -- all mutations go through serverless functions
-- using the service-role key, which bypasses RLS and enforces its own JWT
-- based authorization). Invite codes live only on `campaigns`, which anon
-- can't select at all, so they never leak through a Realtime subscription.
alter table campaigns enable row level security;
alter table users enable row level security;
alter table characters enable row level security;
alter table sessions enable row level security;
alter table event_logs enable row level security;

create policy "anon can read characters" on characters for select to anon using (true);
create policy "anon can read sessions" on sessions for select to anon using (true);
create policy "anon can read event_logs" on event_logs for select to anon using (true);
-- No policies on campaigns or users for anon -- service role only (invite codes stay private).

-- Register the live-updated tables with Supabase Realtime.
alter publication supabase_realtime add table sessions, characters, event_logs;
