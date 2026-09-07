alter table public.leagues
drop constraint if exists leagues_regular_season_matches_check;

alter table public.leagues
add constraint leagues_regular_season_matches_check
check (regular_season_matches between 1 and 52);

create or replace function public.set_flash_family_waiver_window(
  p_access_code text,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if upper(trim(coalesce(p_access_code, ''))) not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  end if;

  if p_start_at is null or p_end_at is null then
    raise exception 'Choose both an opening and closing time';
  end if;

  if p_end_at <= p_start_at then
    raise exception 'Waivers must close after they open';
  end if;

  update public.leagues
  set
    waiver_window_start_at = p_start_at,
    waiver_window_end_at = p_end_at,
    waiver_open = now() between p_start_at and p_end_at
  where id = 'flash-family-season-1';

  if not found then
    raise exception 'Flash Family League was not found';
  end if;
end;
$$;

revoke all on function public.set_flash_family_waiver_window(text, timestamptz, timestamptz) from public;
grant execute on function public.set_flash_family_waiver_window(text, timestamptz, timestamptz) to anon;
grant execute on function public.set_flash_family_waiver_window(text, timestamptz, timestamptz) to authenticated;

create or replace function public.set_flash_family_season_rules(
  p_access_code text,
  p_total_weeks integer,
  p_point_cap integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if upper(trim(coalesce(p_access_code, ''))) not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  end if;

  if p_total_weeks < 1 or p_total_weeks > 52 then
    raise exception 'Season length must be between 1 and 52 weeks';
  end if;

  if p_point_cap < 1 or p_point_cap > 500 then
    raise exception 'Point cap must be between 1 and 500';
  end if;

  update public.leagues
  set
    regular_season_matches = p_total_weeks,
    roster_point_cap = p_point_cap
  where id = 'flash-family-season-1';
end;
$$;

revoke all on function public.set_flash_family_season_rules(text, integer, integer) from public;
grant execute on function public.set_flash_family_season_rules(text, integer, integer) to anon;
grant execute on function public.set_flash_family_season_rules(text, integer, integer) to authenticated;

create or replace function public.submit_flash_family_waiver(
  p_access_code text,
  p_team_id text,
  p_add_slug text,
  p_drop_slug text,
  p_resulting_points integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  allowed_team text;
  clean_add text := nullif(lower(trim(coalesce(p_add_slug, ''))), '');
  clean_drop text := nullif(lower(trim(coalesce(p_drop_slug, ''))), '');
  window_start timestamptz;
  window_end timestamptz;
  point_cap integer;
  pokemon_cap integer;
  roster_size integer;
  replacement_slot integer;
begin
  allowed_team := case clean_code
    when 'PUFF1' then 'boston-eeltics'
    when 'NETO' then 'miami-dragapults'
    else null
  end;

  if allowed_team is null or allowed_team <> p_team_id then
    raise exception 'This access code cannot change that roster';
  end if;

  select
    waiver_window_start_at,
    waiver_window_end_at,
    roster_point_cap,
    roster_pokemon_cap
  into window_start, window_end, point_cap, pokemon_cap
  from public.leagues
  where id = league_key
  for update;

  if not found then
    raise exception 'Flash Family League was not found';
  end if;

  if window_start is null or window_end is null or now() < window_start or now() > window_end then
    raise exception 'The waiver period is currently closed';
  end if;

  if clean_add is null and clean_drop is null then
    raise exception 'Choose a Pokemon to add or drop';
  end if;

  if clean_add is not null and clean_add !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid Pokemon identifier';
  end if;

  if clean_drop is not null and clean_drop !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid Pokemon identifier';
  end if;

  if p_resulting_points is null or p_resulting_points < 0 or p_resulting_points > point_cap then
    raise exception 'This transaction would exceed the team point cap';
  end if;

  select count(*)
  into roster_size
  from public.team_rosters
  where league_id = league_key and team_id = p_team_id;

  if clean_drop is not null then
    select slot_number
    into replacement_slot
    from public.team_rosters
    where league_id = league_key
      and team_id = p_team_id
      and pokemon_slug = clean_drop
    for update;

    if replacement_slot is null then
      raise exception 'The Pokemon selected to drop is not on this roster';
    end if;
  end if;

  if clean_add is not null then
    if clean_add = clean_drop then
      raise exception 'Choose a different Pokemon to add';
    end if;

    if exists (
      select 1
      from public.team_rosters
      where league_id = league_key and pokemon_slug = clean_add
    ) then
      raise exception 'That Pokemon is already on a league roster';
    end if;

    if clean_drop is null and roster_size >= pokemon_cap then
      raise exception 'This roster is full; choose a Pokemon to drop';
    end if;
  end if;

  if clean_drop is not null then
    delete from public.team_rosters
    where league_id = league_key
      and team_id = p_team_id
      and pokemon_slug = clean_drop;
  end if;

  if clean_add is not null then
    if replacement_slot is null then
      select coalesce(max(slot_number), 0) + 1
      into replacement_slot
      from public.team_rosters
      where league_id = league_key and team_id = p_team_id;
    end if;

    insert into public.team_rosters (league_id, team_id, pokemon_slug, slot_number)
    values (league_key, p_team_id, clean_add, replacement_slot);

    if exists (select 1 from public.league_teams where id = p_team_id) then
      insert into public.league_waiver_acquisitions (
        id,
        league_id,
        team_id,
        pokemon_slug,
        waiver_window_start_at
      ) values (
        md5(clock_timestamp()::text || random()::text || p_team_id || clean_add),
        league_key,
        p_team_id,
        clean_add,
        window_start
      );
    end if;
  end if;
end;
$$;

revoke all on function public.submit_flash_family_waiver(text, text, text, text, integer) from public;
grant execute on function public.submit_flash_family_waiver(text, text, text, text, integer) to anon;
grant execute on function public.submit_flash_family_waiver(text, text, text, text, integer) to authenticated;
