create or replace function public.read_flash_family_live_draft(
  p_access_code text,
  p_room_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
  viewer_team text;
  viewer_admin boolean := false;
  draft_room public.flash_family_draft_rooms%rowtype;
  draft_picks jsonb;
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
  where room_key = clean_room;

  if not found then
    raise exception 'Draft room unavailable';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'overallPick', overall_pick,
        'roundNumber', round_number,
        'teamId', team_id,
        'pokemonSlug', pokemon_slug,
        'pointValue', point_value,
        'createdAt', created_at
      )
      order by overall_pick
    ),
    '[]'::jsonb
  )
  into draft_picks
  from public.flash_family_live_draft_picks
  where room_key = clean_room;

  return jsonb_build_object(
    'serverNow', now(),
    'viewer', jsonb_build_object(
      'teamId', viewer_team,
      'isAdmin', viewer_admin
    ),
    'room', jsonb_build_object(
      'key', draft_room.room_key,
      'label', draft_room.room_label,
      'scheduledAt', draft_room.scheduled_at,
      'pickSeconds', draft_room.pick_seconds,
      'isStarted', draft_room.is_started,
      'isPaused', draft_room.is_paused,
      'currentPickStartedAt', draft_room.current_pick_started_at,
      'pausedSecondsRemaining', draft_room.paused_seconds_remaining,
      'revision', draft_room.revision,
      'updatedAt', draft_room.updated_at
    ),
    'picks', draft_picks
  );
end;
$$;

revoke all on function public.read_flash_family_live_draft(text, text) from public;
grant execute on function public.read_flash_family_live_draft(text, text) to anon, authenticated;

