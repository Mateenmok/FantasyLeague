create function public.auto_pick_flash_family_test_draft(
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  participants constant text[] := array[
    'daytona-torterras', 'kansas-krooks', 'south-jersey-hounds',
    'chicago-conkquerers', 'las-vegas-gatrs', 'north-carolina-ceruledge',
    'uconn-arcanines', 'boston-eeltics', 'sunnyshore-city-shelter',
    'massachusetts-midnight', 'miami-dragapults', 'san-francisco-soulfire',
    'stockholm-spin-cycles', 'dallas-disguises'
  ];
  human_teams constant text[] := array[
    'boston-eeltics', 'massachusetts-midnight',
    'miami-dragapults', 'north-carolina-ceruledge'
  ];
  mascot_slugs constant text[] := array[
    'torterra', 'krookodile', 'houndoom', 'conkeldurr', 'feraligatr',
    'ceruledge', 'hisuian-arcanine', 'eelektross', 'hisuian-goodra',
    'umbreon', 'dragapult', 'chandelure', 'rotom-wash', 'mimikyu'
  ];
  draft_room public.flash_family_draft_rooms%rowtype;
  next_pick integer;
  next_round integer;
  pick_position integer;
  expected_team text;
  expected_mascot text;
  existing_live_picks integer;
  roster_points integer;
  selected_slug text;
begin
  if clean_code not in ('DRAFTTEST1', 'DRAFTTEST2', 'DRAFTTEST3', 'DRAFTTEST4') then
    raise exception 'This access code cannot enter the test draft room';
  end if;

  select * into draft_room
  from public.flash_family_draft_rooms
  where room_key = 'test'
  for update;

  if not found then
    raise exception 'Test draft room unavailable';
  end if;
  if not draft_room.is_started or draft_room.is_paused then
    return jsonb_build_object('status', 'waiting');
  end if;
  if draft_room.current_pick_started_at is null
     or now() - draft_room.current_pick_started_at < interval '1 second' then
    return jsonb_build_object('status', 'waiting');
  end if;

  select count(*)::integer + 1 into next_pick
  from public.flash_family_live_draft_picks
  where room_key = 'test';

  if next_pick > cardinality(participants) * 9 then
    return jsonb_build_object('status', 'complete');
  end if;

  next_round := ((next_pick - 1) / cardinality(participants)) + 1;
  pick_position := (next_pick - 1) % cardinality(participants);
  if next_round % 2 = 1 then
    expected_team := participants[pick_position + 1];
  else
    expected_team := participants[cardinality(participants) - pick_position];
  end if;

  if expected_team = any(human_teams) then
    return jsonb_build_object('status', 'human_turn', 'teamId', expected_team);
  end if;

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

  select count(*)::integer, coalesce(sum(point_value), 0)::integer
  into existing_live_picks, roster_points
  from public.flash_family_live_draft_picks
  where room_key = 'test' and team_id = expected_team;

  roster_points := roster_points + coalesce((
    select point_value
    from public.flash_family_draft_pool
    where pokemon_slug = expected_mascot
  ), 0);

  select pokemon_slug into selected_slug
  from (
    select pool.pokemon_slug, pool.point_value
    from public.flash_family_draft_pool pool
    where not (pool.pokemon_slug = any(mascot_slugs))
      and not exists (
        select 1
        from public.flash_family_live_draft_picks pick
        where pick.room_key = 'test'
          and pick.pokemon_slug = pool.pokemon_slug
      )
      and roster_points + pool.point_value + (8 - existing_live_picks) <= 50
    order by pool.point_value desc, pool.pokemon_slug
    limit 8
  ) strongest_legal
  order by random()
  limit 1;

  if selected_slug is null then
    raise exception 'No legal automatic pick is available for this CPU team';
  end if;

  return public.submit_flash_family_live_draft_pick_internal(
    'DRAFTTEST1', 'test', selected_slug, expected_team
  );
end;
$$;

revoke all on function public.auto_pick_flash_family_test_draft(text) from public;
grant execute on function public.auto_pick_flash_family_test_draft(text) to anon, authenticated;
