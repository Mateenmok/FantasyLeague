grant delete on public.leagues to authenticated;

drop policy if exists "League admins can delete leagues" on public.leagues;

create policy "League admins can delete leagues"
on public.leagues
for delete
to authenticated
using (
  exists (
    select 1
    from public.league_memberships
    where league_memberships.league_id = leagues.id
      and league_memberships.user_id = auth.uid()
      and league_memberships.role = 'admin'
  )
);
