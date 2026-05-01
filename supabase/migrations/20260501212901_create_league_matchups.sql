alter table public.leagues
add column if not exists current_matchup_number integer not null default 1;

alter table public.leagues
add column if not exists season_phase text not null default 'regular'
check (season_phase in ('regular', 'playoff', 'complete'));

alter table public.leagues
add column if not exists schedule_generated boolean not null default false;

alter table public.league_teams
add column if not exists wins integer not null default 0;

alter table public.league_teams
add column if not exists losses integer not null default 0;

alter table public.league_teams
add column if not exists ties integer not null default 0;

alter table public.league_teams
add column if not exists games_won integer not null default 0;

alter table public.league_teams
add column if not exists games_lost integer not null default 0;

create table if not exists public.league_matchups (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  phase text not null check (phase in ('regular', 'playoff')),
  matchup_number integer not null,
  display_order integer not null,
  team1_id text not null references public.league_teams(id) on delete cascade,
  team2_id text not null references public.league_teams(id) on delete cascade,
  team1_score integer,
  team2_score integer,
  winner_team_id text references public.league_teams(id) on delete set null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),

  unique (league_id, phase, matchup_number, display_order)
);

alter table public.league_matchups enable row level security;

grant select, insert, update, delete on public.league_matchups to authenticated;

drop policy if exists "Authenticated users can read matchups" on public.league_matchups;
drop policy if exists "Authenticated users can create matchups" on public.league_matchups;
drop policy if exists "Authenticated users can update matchups" on public.league_matchups;
drop policy if exists "Authenticated users can delete matchups" on public.league_matchups;

create policy "Authenticated users can read matchups"
on public.league_matchups
for select
to authenticated
using (true);

create policy "Authenticated users can create matchups"
on public.league_matchups
for insert
to authenticated
with check (true);

create policy "Authenticated users can update matchups"
on public.league_matchups
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete matchups"
on public.league_matchups
for delete
to authenticated
using (true);
