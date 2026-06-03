drop policy if exists "League members can read matchup picks" on public.league_matchup_picks;

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
  and (
    league_matchup_picks.user_id = auth.uid()
    or exists (
      select 1
      from public.league_matchups as matchup
      where matchup.id = league_matchup_picks.matchup_id
        and matchup.league_id = league_matchup_picks.league_id
        and (
          matchup.completed = true
          or (
            matchup.pick_lock_at is not null
            and now() >= matchup.pick_lock_at
          )
        )
    )
  )
);
