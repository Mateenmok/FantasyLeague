create or replace function public.submit_flash_family_pickem(
  p_access_code text,
  p_week integer,
  p_display_order integer,
  p_picked_team_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  picker_id text;
  picker_name text;
  active_week integer;
  pickems_lock_at timestamptz;
  matchup public.flash_family_matchups%rowtype;
begin
  select account_id, username
  into picker_id, picker_name
  from (values
    ('PUFF1', 'pufferz', 'Pufferz'),
    ('NETO', 'neto', 'Neto'),
    ('MOON4', 'kirbbles', 'Kirbbles'),
    ('FORMIDABLE', 'fear', 'Fear'),
    ('NC50', 'shdwemp', 'Shdwemp')
  ) as accounts(access_code, account_id, username)
  where access_code = clean_code;

  if picker_id is null then
    raise exception 'Sign in with a league access code to make a pick';
  end if;

  select greatest(current_matchup_number, 1), waiver_window_end_at
  into active_week, pickems_lock_at
  from public.leagues
  where id = league_key;

  if p_week is distinct from active_week then
    raise exception 'Picks are only open for the active week';
  end if;

  if pickems_lock_at is not null and now() >= pickems_lock_at then
    raise exception 'Pick''ems are locked because the waiver period has closed';
  end if;

  select *
  into matchup
  from public.flash_family_matchups
  where league_id = league_key
    and week = p_week
    and display_order = p_display_order;

  if not found then
    raise exception 'That matchup is unavailable';
  end if;

  if matchup.home_score is not null or matchup.away_score is not null then
    raise exception 'This matchup is already locked';
  end if;

  if p_picked_team_id not in (matchup.home_team_id, matchup.away_team_id) then
    raise exception 'Choose one of the teams in this matchup';
  end if;

  insert into public.flash_family_pickems (
    league_id, week, display_order, account_id, username, picked_team_id
  ) values (
    league_key, p_week, p_display_order, picker_id, picker_name, p_picked_team_id
  )
  on conflict (league_id, week, display_order, account_id)
  do update set
    username = excluded.username,
    picked_team_id = excluded.picked_team_id,
    updated_at = now();
end;
$$;

revoke all on function public.submit_flash_family_pickem(text, integer, integer, text) from public;
grant execute on function public.submit_flash_family_pickem(text, integer, integer, text) to anon, authenticated;
