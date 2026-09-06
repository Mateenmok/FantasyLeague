alter table public.league_matchups
add column if not exists pick_lock_at timestamptz;
create table if not exists public.league_matchup_picks (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  matchup_id text not null references public.league_matchups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  picked_team_id text not null references public.league_teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (matchup_id, user_id)
);
create index if not exists league_matchup_picks_league_idx
on public.league_matchup_picks (league_id);
create index if not exists league_matchup_picks_matchup_idx
on public.league_matchup_picks (matchup_id);
alter table public.league_matchup_picks enable row level security;
grant select, insert, update, delete on public.league_matchup_picks to authenticated;
drop policy if exists "League members can read matchup picks" on public.league_matchup_picks;
drop policy if exists "League members can create own matchup picks before lock" on public.league_matchup_picks;
drop policy if exists "League members can update own matchup picks before lock" on public.league_matchup_picks;
drop policy if exists "League members can delete own matchup picks before lock" on public.league_matchup_picks;
drop policy if exists "League admins can delete matchup picks" on public.league_matchup_picks;
create policy "League members can read matchup picks"
on public.league_matchup_picks
for select
to authenticated
using (
  exists (
    select 1
    from public.league_memberships as membership
    where membership.league_id = league_matchup_picks.league_id
      and membership.user_id = auth.uid()
  )
);
create policy "League members can create own matchup picks before lock"
on public.league_matchup_picks
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.league_memberships as membership
    where membership.league_id = league_matchup_picks.league_id
      and membership.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.league_matchups as matchup
    where matchup.id = league_matchup_picks.matchup_id
      and matchup.league_id = league_matchup_picks.league_id
      and league_matchup_picks.picked_team_id in (matchup.team1_id, matchup.team2_id)
      and matchup.completed = false
      and matchup.pick_lock_at is not null
      and now() < matchup.pick_lock_at
  )
);
create policy "League members can update own matchup picks before lock"
on public.league_matchup_picks
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.league_matchups as matchup
    where matchup.id = league_matchup_picks.matchup_id
      and matchup.league_id = league_matchup_picks.league_id
      and matchup.completed = false
      and matchup.pick_lock_at is not null
      and now() < matchup.pick_lock_at
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.league_memberships as membership
    where membership.league_id = league_matchup_picks.league_id
      and membership.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.league_matchups as matchup
    where matchup.id = league_matchup_picks.matchup_id
      and matchup.league_id = league_matchup_picks.league_id
      and league_matchup_picks.picked_team_id in (matchup.team1_id, matchup.team2_id)
      and matchup.completed = false
      and matchup.pick_lock_at is not null
      and now() < matchup.pick_lock_at
  )
);
create policy "League members can delete own matchup picks before lock"
on public.league_matchup_picks
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.league_matchups as matchup
    where matchup.id = league_matchup_picks.matchup_id
      and matchup.league_id = league_matchup_picks.league_id
      and matchup.completed = false
      and matchup.pick_lock_at is not null
      and now() < matchup.pick_lock_at
  )
);
create policy "League admins can delete matchup picks"
on public.league_matchup_picks
for delete
to authenticated
using (
  exists (
    select 1
    from public.league_memberships as membership
    where membership.league_id = league_matchup_picks.league_id
      and membership.user_id = auth.uid()
      and membership.role = 'admin'
  )
);
