create or replace function public.control_flash_family_live_draft(
  p_access_code text,
  p_room_key text,
  p_action text,
  p_value integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
  clean_action text := lower(trim(coalesce(p_action, '')));
  draft_room public.flash_family_draft_rooms%rowtype;
  last_pick public.flash_family_live_draft_picks%rowtype;
  remaining integer;
begin
  if clean_room = 'main' and clean_code not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  elsif clean_room = 'test' and clean_code not in ('DRAFTTEST1', 'DRAFTTEST3') then
    raise exception 'Test draft controls belong to DraftTest1 and DraftTest3';
  elsif clean_room not in ('main', 'test') then
    raise exception 'Unknown draft room';
  end if;

  select * into draft_room
  from public.flash_family_draft_rooms
  where room_key = clean_room
  for update;

  if not found then
    raise exception 'Draft room unavailable';
  end if;

  if clean_action = 'start' then
    if not draft_room.is_started then
      update public.flash_family_draft_rooms
      set is_started = true,
          is_paused = false,
          current_pick_started_at = now(),
          paused_seconds_remaining = null,
          revision = revision + 1,
          updated_at = now()
      where room_key = clean_room;
    elsif draft_room.is_paused then
      remaining := coalesce(draft_room.paused_seconds_remaining, draft_room.pick_seconds);
      update public.flash_family_draft_rooms
      set is_paused = false,
          current_pick_started_at = now() - make_interval(secs => greatest(0, draft_room.pick_seconds - remaining)),
          paused_seconds_remaining = null,
          revision = revision + 1,
          updated_at = now()
      where room_key = clean_room;
    end if;
  elsif clean_action = 'pause' then
    if draft_room.is_started and not draft_room.is_paused then
      remaining := greatest(
        0,
        draft_room.pick_seconds - floor(extract(epoch from (now() - draft_room.current_pick_started_at)))::integer
      );
      update public.flash_family_draft_rooms
      set is_paused = true,
          paused_seconds_remaining = remaining,
          revision = revision + 1,
          updated_at = now()
      where room_key = clean_room;
    end if;
  elsif clean_action = 'resume' then
    if not draft_room.is_started then
      raise exception 'Start the draft first';
    end if;
    if draft_room.is_paused then
      remaining := coalesce(draft_room.paused_seconds_remaining, draft_room.pick_seconds);
      update public.flash_family_draft_rooms
      set is_paused = false,
          current_pick_started_at = now() - make_interval(secs => greatest(0, draft_room.pick_seconds - remaining)),
          paused_seconds_remaining = null,
          revision = revision + 1,
          updated_at = now()
      where room_key = clean_room;
    end if;
  elsif clean_action = 'set_timer' then
    if p_value is null or p_value < 15 or p_value > 600 then
      raise exception 'Timer must be between 15 and 600 seconds';
    end if;
    update public.flash_family_draft_rooms
    set pick_seconds = p_value,
        current_pick_started_at = case when is_started and not is_paused then now() else current_pick_started_at end,
        paused_seconds_remaining = case when is_paused then p_value else null end,
        revision = revision + 1,
        updated_at = now()
    where room_key = clean_room;
  elsif clean_action = 'undo' then
    select * into last_pick
    from public.flash_family_live_draft_picks
    where room_key = clean_room
    order by overall_pick desc
    limit 1
    for update;

    if not found then
      raise exception 'There are no picks to undo';
    end if;

    delete from public.flash_family_live_draft_picks
    where id = last_pick.id;

    if clean_room = 'main' then
      delete from public.team_rosters
      where league_id = league_key
        and team_id = last_pick.team_id
        and pokemon_slug = last_pick.pokemon_slug;
    end if;

    update public.flash_family_draft_rooms
    set current_pick_started_at = case when is_started and not is_paused then now() else current_pick_started_at end,
        paused_seconds_remaining = case when is_paused then pick_seconds else null end,
        revision = revision + 1,
        updated_at = now()
    where room_key = clean_room;
  elsif clean_action = 'reset' then
    if clean_room = 'main' then
      delete from public.team_rosters roster
      using public.flash_family_live_draft_picks pick
      where pick.room_key = clean_room
        and roster.league_id = league_key
        and roster.team_id = pick.team_id
        and roster.pokemon_slug = pick.pokemon_slug;
    end if;

    delete from public.flash_family_live_draft_picks
    where room_key = clean_room;

    update public.flash_family_draft_rooms
    set is_started = false,
        is_paused = false,
        current_pick_started_at = null,
        paused_seconds_remaining = null,
        revision = revision + 1,
        updated_at = now()
    where room_key = clean_room;
  else
    raise exception 'Unknown draft control';
  end if;
end;
$$;

revoke all on function public.control_flash_family_live_draft(text, text, text, integer) from public;
grant execute on function public.control_flash_family_live_draft(text, text, text, integer) to anon, authenticated;
