create table if not exists public.leagues (
  id text primary key,
  league_code text not null unique,
  name text not null,
  team_count int not null check (team_count between 8 and 16),
  created_at timestamptz not null default now()
);

create table if not exists public.league_teams (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  team_number int not null,
  team_name text not null,
  owner_name text not null default 'Unassigned',
  record text not null default '0-0',
  logo_url text not null default '',
  team_passcode text not null check (team_passcode ~ '^[A-Z]{4}$'),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (league_id, team_number),
  unique (league_id, team_passcode)
);

alter table public.leagues enable row level security;
alter table public.league_teams enable row level security;

create policy "Anyone can read leagues for demo"
on public.leagues
for select
to anon
using (true);

create policy "Anyone can create leagues for demo"
on public.leagues
for insert
to anon
with check (true);

create policy "Anyone can update leagues for demo"
on public.leagues
for update
to anon
using (true)
with check (true);

create policy "Anyone can read league teams for demo"
on public.league_teams
for select
to anon
using (true);

create policy "Anyone can create league teams for demo"
on public.league_teams
for insert
to anon
with check (true);

create policy "Anyone can update league teams for demo"
on public.league_teams
for update
to anon
using (true)
with check (true);
