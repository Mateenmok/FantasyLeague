create or replace function public.delete_league_as_admin(p_league_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.league_memberships
    where league_id = p_league_id
      and user_id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Only league admins can delete this league';
  end if;

  delete from public.team_rosters
  where league_id = p_league_id;

  delete from public.league_draft_picks
  where league_id = p_league_id;

  delete from public.league_draft_order
  where league_id = p_league_id;

  delete from public.league_draft_state
  where league_id = p_league_id;

  delete from public.league_memberships
  where league_id = p_league_id;

  delete from public.league_teams
  where league_id = p_league_id;

  delete from public.leagues
  where id = p_league_id;

  if not found then
    raise exception 'League not found or already deleted';
  end if;
end;
$$;

grant execute on function public.delete_league_as_admin(text) to authenticated;
