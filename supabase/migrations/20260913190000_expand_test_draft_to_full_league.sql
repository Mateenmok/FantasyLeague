create or replace function public.submit_flash_family_live_draft_pick(
  p_access_code text,
  p_room_key text,
  p_pokemon_slug text,
  p_for_team_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
  clean_slug text := lower(trim(coalesce(p_pokemon_slug, '')));
  viewer_team text;
  viewer_admin boolean := false;
  participants constant text[] := array[
    'daytona-torterras', 'kansas-krooks', 'south-jersey-hounds',
    'chicago-conkquerers', 'las-vegas-gatrs', 'north-carolina-ceruledge',
    'uconn-arcanines', 'boston-eeltics', 'sunnyshore-city-shelter',
    'massachusetts-midnight', 'miami-dragapults', 'san-francisco-soulfire',
    'stockholm-spin-cycles', 'dallas-disguises'
  ];
  test_human_teams constant text[] := array[
    'boston-eeltics', 'massachusetts-midnight',
    'miami-dragapults', 'north-carolina-ceruledge'
  ];
  participant_count integer;
  draft_room public.flash_family_draft_rooms%rowtype;
  next_pick integer;
  next_round integer;
  pick_position integer;
  expected_team text;
  expected_mascot text;
  pokemon_points integer;
  roster_count integer;
  roster_points integer;
  seconds_left integer;
  mascot_slugs constant text[] := array[
    'torterra', 'krookodile', 'houndoom', 'conkeldurr', 'feraligatr',
    'ceruledge', 'hisuian-arcanine', 'eelektross', 'hisuian-goodra',
    'umbreon', 'dragapult', 'chandelure', 'rotom-wash', 'mimikyu'
  ];
begin
  if clean_room = 'main' then
    viewer_team := case clean_code
      when 'PUFF1' then 'boston-eeltics'
      when 'NETO' then 'miami-dragapults'
      when 'MOON4' then 'massachusetts-midnight'
      when 'FORMIDABLE' then 'sunnyshore-city-shelter'
      when 'NC50' then 'north-carolina-ceruledge'
      when 'LAVOLON' then 'uconn-arcanines'
      when 'CLOUD' then 'las-vegas-gatrs'
      when 'PANCHAM' then 'kansas-krooks'
      when 'SWEDEN' then 'stockholm-spin-cycles'
      when 'CHITOWN' then 'chicago-conkquerers'
      when 'MVP' then 'daytona-torterras'
      when 'MIMIC' then 'dallas-disguises'
      when 'REGAL' then 'south-jersey-hounds'
      when 'GIANT' then 'san-francisco-soulfire'
      else null
    end;
    viewer_admin := clean_code in ('PUFF1', 'NETO');
  elsif clean_room = 'test' then
    viewer_team := case clean_code
      when 'DRAFTTEST1' then 'boston-eeltics'
      when 'DRAFTTEST2' then 'massachusetts-midnight'
      when 'DRAFTTEST3' then 'miami-dragapults'
      when 'DRAFTTEST4' then 'north-carolina-ceruledge'
      else null
    end;
    viewer_admin := clean_code = 'DRAFTTEST1';
  else
    raise exception 'Unknown draft room';
  end if;

  if viewer_team is null then
    raise exception 'This access code cannot enter this draft room';
  end if;

  select * into draft_room
  from public.flash_family_draft_rooms
  where room_key = clean_room
  for update;

  if not draft_room.is_started then
    raise exception 'The commissioner has not started this draft';
  end if;
  if draft_room.is_paused then
    raise exception 'The draft is paused';
  end if;
  if draft_room.scheduled_at is not null and now() < draft_room.scheduled_at then
    raise exception 'The scheduled draft time has not arrived';
  end if;

  participant_count := cardinality(participants);
  select count(*)::integer + 1 into next_pick
  from public.flash_family_live_draft_picks
  where room_key = clean_room;

  if next_pick > participant_count * 9 then
    raise exception 'The draft is complete';
  end if;

  next_round := ((next_pick - 1) / participant_count) + 1;
  pick_position := (next_pick - 1) % participant_count;
  if next_round % 2 = 1 then
    expected_team := participants[pick_position + 1];
  else
    expected_team := participants[participant_count - pick_position];
  end if;

  if viewer_admin then
    if p_for_team_id is not null and p_for_team_id <> expected_team then
      raise exception 'Admins can only submit the team currently on the clock';
    end if;
  elsif clean_room = 'test' and not (expected_team = any(test_human_teams)) then
    raise exception 'CPU team picks must be submitted by the test draft admin';
  elsif viewer_team <> expected_team then
    raise exception 'Your team is not on the clock';
  end if;

  seconds_left := greatest(
    0,
    draft_room.pick_seconds - floor(extract(epoch from (now() - draft_room.current_pick_started_at)))::integer
  );
  if seconds_left = 0 and not viewer_admin then
    raise exception 'Time expired. An admin must make this pick';
  end if;

  select point_value into pokemon_points
  from public.flash_family_draft_pool
  where pokemon_slug = clean_slug;

  if pokemon_points is null then
    raise exception 'This Pokemon is not in the league draft pool';
  end if;
  if clean_slug = any(mascot_slugs) then
    raise exception 'Team mascots are already rostered';
  end if;
  if exists (
    select 1 from public.flash_family_live_draft_picks
    where room_key = clean_room and pokemon_slug = clean_slug
  ) then
    raise exception 'That Pokemon has already been drafted';
  end if;

  if clean_room = 'main' then
    select count(*)::integer, coalesce(sum(pool.point_value), 0)::integer
    into roster_count, roster_points
    from public.team_rosters roster
    left join public.flash_family_draft_pool pool
      on pool.pokemon_slug = roster.pokemon_slug
    where roster.league_id = league_key
      and roster.team_id = expected_team;

    if roster_count >= 10 then
      raise exception 'That roster already has 10 Pokemon';
    end if;
    if roster_points + pokemon_points > 50 then
      raise exception 'That pick would exceed the 50-point roster cap';
    end if;
    if exists (
      select 1 from public.team_rosters
      where league_id = league_key and pokemon_slug = clean_slug
    ) then
      raise exception 'That Pokemon already belongs to another team';
    end if;
  else
    expected_mascot := case expected_team
      when 'daytona-torterras' then 'torterra'
      when 'kansas-krooks' then 'krookodile'
      when 'south-jersey-hounds' then 'houndoom'
      when 'chicago-conkquerers' then 'conkeldurr'
      when 'las-vegas-gatrs' then 'feraligatr'
      when 'north-carolina-ceruledge' then 'ceruledge'
      when 'uconn-arcanines' then 'hisuian-arcanine'
      when 'boston-eeltics' then 'eelektross'
      when 'sunnyshore-city-shelter' then 'hisuian-goodra'
      when 'massachusetts-midnight' then 'umbreon'
      when 'miami-dragapults' then 'dragapult'
      when 'san-francisco-soulfire' then 'chandelure'
      when 'stockholm-spin-cycles' then 'rotom-wash'
      when 'dallas-disguises' then 'mimikyu'
    end;

    select coalesce(sum(point_value), 0)::integer
    into roster_points
    from (
      select pool.point_value
      from public.flash_family_draft_pool pool
      where pool.pokemon_slug = expected_mascot
      union all
      select point_value
      from public.flash_family_live_draft_picks
      where room_key = clean_room and team_id = expected_team
    ) team_points;

    if roster_points + pokemon_points > 50 then
      raise exception 'That pick would exceed the 50-point roster cap';
    end if;
  end if;

  insert into public.flash_family_live_draft_picks (
    room_key, overall_pick, round_number, team_id,
    pokemon_slug, point_value, picked_by
  )
  values (
    clean_room, next_pick, next_round, expected_team,
    clean_slug, pokemon_points, clean_code
  );

  if clean_room = 'main' then
    insert into public.team_rosters (
      league_id, team_id, pokemon_slug, slot_number, is_mascot
    )
    values (
      league_key,
      expected_team,
      clean_slug,
      coalesce((
        select max(slot_number) + 1
        from public.team_rosters
        where league_id = league_key and team_id = expected_team
      ), 1),
      false
    );
  end if;

  update public.flash_family_draft_rooms
  set current_pick_started_at = now(),
      paused_seconds_remaining = null,
      revision = revision + 1,
      updated_at = now()
  where room_key = clean_room;

  return jsonb_build_object(
    'overallPick', next_pick,
    'roundNumber', next_round,
    'teamId', expected_team,
    'pokemonSlug', clean_slug,
    'pointValue', pokemon_points
  );
end;
$$;

revoke all on function public.submit_flash_family_live_draft_pick(text, text, text, text) from public;
grant execute on function public.submit_flash_family_live_draft_pick(text, text, text, text) to anon, authenticated;
