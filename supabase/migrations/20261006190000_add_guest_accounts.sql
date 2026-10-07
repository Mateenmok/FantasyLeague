begin;

-- Guest identities are separate from league teams and every manager/admin
-- authorization helper. A nickname is intentionally a guest-only passcode.
create table public.flash_family_guest_accounts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 3 and 24),
  access_code text generated always as (upper(nickname)) stored unique,
  created_at timestamptz not null default now()
);
alter table public.flash_family_guest_accounts enable row level security;
revoke all on public.flash_family_guest_accounts from public, anon, authenticated;

create function public.read_flash_family_guest_account(p_access_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', 'guest:' || g.id::text, 'accountName', g.nickname,
    'isGuest', true, 'isAdmin', false, 'teamId', null)
  from public.flash_family_guest_accounts g
  where g.access_code = upper(regexp_replace(trim(coalesce(p_access_code, '')), '\s+', ' ', 'g'));
$$;

create function public.register_flash_family_guest(p_access_code text, p_nickname text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  clean_name text := regexp_replace(trim(coalesce(p_nickname, '')), '\s+', ' ', 'g');
  clean_code text := upper(clean_name);
begin
  if upper(trim(coalesce(p_access_code, ''))) <> 'GUEST1' then
    raise exception 'Enter GUEST1 to create a guest account';
  end if;
  if clean_name !~ '^[A-Za-z0-9][A-Za-z0-9 _-]{2,23}$' then
    raise exception 'Use 3–24 letters, numbers, spaces, underscores or hyphens, starting with a letter or number';
  end if;
  if clean_code = any(array[
    'GUEST1','GUEST','ADMIN','ADMINISTRATOR','COMMISSIONER','SYSTEM',
    'PUFF1','NETO','MOON4','FORMIDABLE','NC50','LAVOLON','CLOUD','PANCHAM',
    'SWEDEN','CHITOWN','MVP','MIMIC','REGAL','GIANT',
    'DRAFTTEST1','DRAFTTEST2','DRAFTTEST3','DRAFTTEST4',
    'PUFFERZ','FLASH','KIRBBLES','FEAR','SHDWEMP','PIN','LIO','NARCOTICS',
    'LETSNOT','CHORIZO','FLAN','KILAN','KILAIN','OMEN','NORFORIL','NORFIRIL','SCRUB'
  ]) or exists (
    select 1 from public.league_teams
    where league_id = 'flash-family-season-1'
      and (upper(trim(team_access_code)) = clean_code or upper(trim(owner_name)) = clean_code)
  ) then
    raise exception 'That nickname is reserved. Please choose another';
  end if;
  begin
    insert into public.flash_family_guest_accounts(nickname) values (clean_name);
  exception when unique_violation then
    raise exception 'That nickname is already taken. Choose another, or use it on the sign-in screen if it is yours';
  end;
  return public.read_flash_family_guest_account(clean_name);
end;
$$;

-- Deliberately separate from the existing manager pick RPC, so no team
-- membership or owner permissions are ever inferred from a guest identity.
create function public.submit_flash_family_guest_pickem(
  p_access_code text, p_week integer, p_display_order integer, p_picked_team_id text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  guest jsonb := public.read_flash_family_guest_account(p_access_code);
  active_week integer;
  deadline timestamptz;
  matchup public.flash_family_matchups%rowtype;
begin
  if guest is null then raise exception 'Sign in with your guest nickname to make a pick'; end if;
  select greatest(current_matchup_number, 1), waiver_window_end_at into active_week, deadline
  from public.leagues where id = 'flash-family-season-1' for share;
  if p_week is distinct from active_week then raise exception 'Picks are only open for the active week'; end if;
  if deadline is not null and now() >= deadline then raise exception 'Pick''ems are locked because the waiver period has closed'; end if;
  select * into matchup from public.flash_family_matchups
  where league_id = 'flash-family-season-1' and week = p_week and display_order = p_display_order for update;
  if not found then raise exception 'That matchup is unavailable'; end if;
  if matchup.home_score is not null or matchup.away_score is not null then raise exception 'This matchup is already locked'; end if;
  if p_picked_team_id is null or p_picked_team_id not in (matchup.home_team_id, matchup.away_team_id) then
    raise exception 'Choose one of the teams in this matchup';
  end if;
  insert into public.flash_family_pickems(league_id,week,display_order,account_id,username,picked_team_id)
  values ('flash-family-season-1',p_week,p_display_order,guest->>'id',guest->>'accountName',p_picked_team_id)
  on conflict (league_id,week,display_order,account_id) do update
    set picked_team_id = excluded.picked_team_id, updated_at = now();
end;
$$;

-- A dedicated spectator read avoids widening the draft reader that is used
-- internally by privileged draft actions. The private test room stays private.
create function public.read_flash_family_guest_draft(p_access_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare guest jsonb := public.read_flash_family_guest_account(p_access_code); room public.flash_family_draft_rooms%rowtype;
begin
  if guest is null then raise exception 'Sign in with your guest nickname to watch the draft'; end if;
  select * into room from public.flash_family_draft_rooms where room_key = 'main';
  if not found then raise exception 'Draft room unavailable'; end if;
  return jsonb_build_object('serverNow',now(),
    'viewer',jsonb_build_object('teamId',null,'isAdmin',false,'isGuest',true,'accountName',guest->>'accountName'),
    'room',jsonb_build_object('key',room.room_key,'label',room.room_label,'scheduledAt',room.scheduled_at,
      'pickSeconds',room.pick_seconds,'isStarted',room.is_started,'isPaused',room.is_paused,
      'currentPickStartedAt',room.current_pick_started_at,'pausedSecondsRemaining',room.paused_seconds_remaining,
      'revision',room.revision,'updatedAt',room.updated_at),
    'picks',coalesce((select jsonb_agg(jsonb_build_object('overallPick',overall_pick,'roundNumber',round_number,
      'teamId',team_id,'pokemonSlug',pokemon_slug,'pointValue',point_value,'createdAt',created_at) order by overall_pick)
      from public.flash_family_live_draft_picks where room_key='main'),'[]'::jsonb));
end;
$$;

revoke all on function public.read_flash_family_guest_account(text) from public;
revoke all on function public.register_flash_family_guest(text,text) from public;
revoke all on function public.submit_flash_family_guest_pickem(text,integer,integer,text) from public;
revoke all on function public.read_flash_family_guest_draft(text) from public;
grant execute on function public.read_flash_family_guest_account(text) to anon,authenticated;
grant execute on function public.register_flash_family_guest(text,text) to anon,authenticated;
grant execute on function public.submit_flash_family_guest_pickem(text,integer,integer,text) to anon,authenticated;
grant execute on function public.read_flash_family_guest_draft(text) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
