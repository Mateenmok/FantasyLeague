drop policy if exists "Authenticated users can read leagues" on public.leagues;
drop policy if exists "Authenticated users can create leagues" on public.leagues;
drop policy if exists "Authenticated users can update leagues" on public.leagues;

create policy "Authenticated users can read leagues"
on public.leagues
for select
to authenticated
using (true);

create policy "Authenticated users can create leagues"
on public.leagues
for insert
to authenticated
with check (true);

create policy "Authenticated users can update leagues"
on public.leagues
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read league teams" on public.league_teams;
drop policy if exists "Authenticated users can create league teams" on public.league_teams;
drop policy if exists "Authenticated users can update league teams" on public.league_teams;

create policy "Authenticated users can read league teams"
on public.league_teams
for select
to authenticated
using (true);

create policy "Authenticated users can create league teams"
on public.league_teams
for insert
to authenticated
with check (true);

create policy "Authenticated users can update league teams"
on public.league_teams
for update
to authenticated
using (true)
with check (true);
