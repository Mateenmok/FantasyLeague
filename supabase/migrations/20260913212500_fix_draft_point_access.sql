create or replace function public.read_flash_family_draft_points(p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  is_league_member boolean := false;
begin
  select exists (
    select 1
    from public.league_teams
    where league_id = 'flash-family-season-1'
      and upper(team_access_code) = clean_code
  ) into is_league_member;

  if not is_league_member
    and clean_code not in ('DRAFTTEST1', 'DRAFTTEST2', 'DRAFTTEST3', 'DRAFTTEST4') then
    raise exception 'This access code cannot read draft point values';
  end if;

  return coalesce(
    (
      select jsonb_object_agg(pokemon_name, point_value order by pokemon_name)
      from public.flash_family_draft_pool
    ),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.read_flash_family_draft_points(text) from public;
grant execute on function public.read_flash_family_draft_points(text) to anon, authenticated;
