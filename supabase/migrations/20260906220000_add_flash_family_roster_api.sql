insert into public.leagues (
  id,
  league_code,
  name,
  team_count,
  roster_point_cap,
  regular_season_matches,
  playoff_team_count,
  roster_pokemon_cap
)
values (
  'flash-family-season-1',
  'FFS1LIVE',
  'Flash Family League',
  14,
  50,
  10,
  8,
  10
)
on conflict (id) do update
set
  name = excluded.name,
  team_count = excluded.team_count,
  roster_point_cap = excluded.roster_point_cap,
  regular_season_matches = excluded.regular_season_matches,
  playoff_team_count = excluded.playoff_team_count,
  roster_pokemon_cap = excluded.roster_pokemon_cap;

create or replace function public.replace_flash_family_roster(
  p_access_code text,
  p_team_id text,
  p_pokemon_slugs text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  allowed_teams constant text[] := array[
    'daytona-torterras',
    'kansas-krooks',
    'south-jersey-hounds',
    'chicago-conkquerers',
    'las-vegas-gatrs',
    'north-carolina-ceruledge',
    'uconn-arcanines',
    'boston-eeltics',
    'sunnyshore-city-shelter',
    'massachusetts-midnight',
    'miami-dragapults',
    'san-francisco-soulfire',
    'stockholm-spin-cycles',
    'dallas-disguises'
  ];
  clean_slugs text[] := coalesce(p_pokemon_slugs, array[]::text[]);
begin
  if upper(trim(coalesce(p_access_code, ''))) not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  end if;

  if not (p_team_id = any(allowed_teams)) then
    raise exception 'Unknown Flash Family League team';
  end if;

  if cardinality(clean_slugs) > 10 then
    raise exception 'A roster cannot contain more than 10 Pokemon';
  end if;

  if exists (
    select 1
    from unnest(clean_slugs) as picks(slug)
    where slug is null or trim(slug) = '' or slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ) then
    raise exception 'Invalid Pokemon identifier';
  end if;

  if (select count(*) from unnest(clean_slugs)) <> (select count(distinct slug) from unnest(clean_slugs) as picks(slug)) then
    raise exception 'A Pokemon cannot appear twice on one roster';
  end if;

  if exists (
    select 1
    from public.team_rosters as roster
    where roster.league_id = league_key
      and roster.team_id <> p_team_id
      and roster.pokemon_slug = any(clean_slugs)
  ) then
    raise exception 'One or more Pokemon already belong to another team';
  end if;

  delete from public.team_rosters
  where league_id = league_key
    and team_id = p_team_id;

  insert into public.team_rosters (league_id, team_id, pokemon_slug, slot_number)
  select league_key, p_team_id, slug, position::integer
  from unnest(clean_slugs) with ordinality as picks(slug, position);
end;
$$;

revoke all on function public.replace_flash_family_roster(text, text, text[]) from public;
grant execute on function public.replace_flash_family_roster(text, text, text[]) to anon;
grant execute on function public.replace_flash_family_roster(text, text, text[]) to authenticated;
