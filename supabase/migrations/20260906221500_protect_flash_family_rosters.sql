drop policy if exists "Anyone can insert team rosters for demo" on public.team_rosters;
create policy "Anyone can insert team rosters for demo"
on public.team_rosters
for insert
to anon
with check (league_id is distinct from 'flash-family-season-1');

drop policy if exists "Anyone can update team rosters for demo" on public.team_rosters;
create policy "Anyone can update team rosters for demo"
on public.team_rosters
for update
to anon
using (league_id is distinct from 'flash-family-season-1')
with check (league_id is distinct from 'flash-family-season-1');

drop policy if exists "Anyone can delete team rosters for demo" on public.team_rosters;
create policy "Anyone can delete team rosters for demo"
on public.team_rosters
for delete
to anon
using (league_id is distinct from 'flash-family-season-1');
