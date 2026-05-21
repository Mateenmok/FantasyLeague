alter table public.team_rosters
add column if not exists is_mascot boolean not null default false;

create unique index if not exists unique_team_mascot
on public.team_rosters (league_id, team_id)
where is_mascot = true and league_id is not null;

create or replace function public.save_league_mascots(
  p_league_id text,
  p_mascots jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_count int;
  v_mascot_count int;
  v_admin_count int;
begin
  select count(*)
  into v_admin_count
  from public.league_memberships
  where league_id = p_league_id
    and user_id = auth.uid()
    and role = 'admin';

  if v_admin_count = 0 then
    raise exception 'Only league admins can save mascots.';
  end if;

  if exists (
    select 1
    from public.league_draft_state
    where league_id = p_league_id
      and is_started = true
  ) or exists (
    select 1
    from public.league_draft_picks
    where league_id = p_league_id
  ) then
    raise exception 'Mascots can only be saved before the draft begins.';
  end if;

  if exists (
    select 1
    from public.team_rosters
    where league_id = p_league_id
      and is_mascot = false
  ) then
    raise exception 'Mascots cannot be changed after non-mascot roster entries exist.';
  end if;

  select count(*)
  into v_team_count
  from public.league_teams
  where league_id = p_league_id;

  select count(*)
  into v_mascot_count
  from jsonb_to_recordset(p_mascots) as mascot_rows(team_id text, pokemon_slug text);

  if v_mascot_count <> v_team_count then
    raise exception 'A mascot must be assigned for every team.';
  end if;

  if exists (
    select 1
    from (
      select team_id
      from jsonb_to_recordset(p_mascots) as mascot_rows(team_id text, pokemon_slug text)
      group by team_id
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Each team can only have one mascot.';
  end if;

  if exists (
    select 1
    from (
      select lower(trim(pokemon_slug)) as pokemon_slug
      from jsonb_to_recordset(p_mascots) as mascot_rows(team_id text, pokemon_slug text)
      group by lower(trim(pokemon_slug))
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Each mascot must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_mascots) as mascot_rows(team_id text, pokemon_slug text)
    left join public.league_teams
      on league_teams.id = mascot_rows.team_id
      and league_teams.league_id = p_league_id
    where league_teams.id is null
      or nullif(trim(mascot_rows.pokemon_slug), '') is null
  ) then
    raise exception 'Mascot assignments must include valid teams and Pokémon.';
  end if;

  delete from public.team_rosters
  where league_id = p_league_id
    and is_mascot = true;

  insert into public.team_rosters (
    league_id,
    team_id,
    pokemon_slug,
    slot_number,
    is_mascot
  )
  select
    p_league_id,
    mascot_rows.team_id,
    lower(trim(mascot_rows.pokemon_slug)),
    1,
    true
  from jsonb_to_recordset(p_mascots) as mascot_rows(team_id text, pokemon_slug text);
end;
$$;

grant execute on function public.save_league_mascots(text, jsonb) to authenticated;
