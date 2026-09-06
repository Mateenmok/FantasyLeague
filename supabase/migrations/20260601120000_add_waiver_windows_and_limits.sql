alter table public.leagues
add column if not exists waiver_window_start_at timestamptz,
add column if not exists waiver_window_end_at timestamptz,
add column if not exists waiver_acquisition_limit int;
alter table public.leagues
drop constraint if exists leagues_waiver_window_order_check;
alter table public.leagues
add constraint leagues_waiver_window_order_check
check (
  waiver_window_start_at is null
  or waiver_window_end_at is null
  or waiver_window_end_at > waiver_window_start_at
);
alter table public.leagues
drop constraint if exists leagues_waiver_acquisition_limit_check;
alter table public.leagues
add constraint leagues_waiver_acquisition_limit_check
check (
  waiver_acquisition_limit is null
  or waiver_acquisition_limit in (1, 2, 3, 4)
);
create table if not exists public.league_waiver_acquisitions (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null references public.league_teams(id) on delete cascade,
  pokemon_slug text not null,
  waiver_window_start_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists league_waiver_acquisitions_window_idx
on public.league_waiver_acquisitions (league_id, team_id, waiver_window_start_at, created_at);
alter table public.league_waiver_acquisitions enable row level security;
grant select, insert, update, delete on public.league_waiver_acquisitions to authenticated;
drop policy if exists "Authenticated users can read waiver acquisitions" on public.league_waiver_acquisitions;
drop policy if exists "Authenticated users can create waiver acquisitions" on public.league_waiver_acquisitions;
drop policy if exists "Authenticated users can update waiver acquisitions" on public.league_waiver_acquisitions;
drop policy if exists "Authenticated users can delete waiver acquisitions" on public.league_waiver_acquisitions;
create policy "Authenticated users can read waiver acquisitions"
on public.league_waiver_acquisitions
for select
to authenticated
using (true);
create policy "Authenticated users can create waiver acquisitions"
on public.league_waiver_acquisitions
for insert
to authenticated
with check (true);
create policy "Authenticated users can update waiver acquisitions"
on public.league_waiver_acquisitions
for update
to authenticated
using (true)
with check (true);
create policy "Authenticated users can delete waiver acquisitions"
on public.league_waiver_acquisitions
for delete
to authenticated
using (true);
