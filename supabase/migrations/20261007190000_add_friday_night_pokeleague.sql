-- Broadcast scheduling is independent of match results, picks, and week changes.
begin;
create table public.flash_family_fnpl (
  league_id text not null references public.leagues(id) on delete cascade,
  week integer not null check (week between 1 and 52),
  event_date date not null,
  slots jsonb not null default '[]' check (jsonb_typeof(slots) = 'array'),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (league_id, week)
);
alter table public.flash_family_fnpl enable row level security;
revoke all on public.flash_family_fnpl from public, anon, authenticated;

create function public.save_flash_family_fnpl(p_access_code text, p_week integer, p_event_date date, p_slots jsonb, p_expected_revision integer)
returns integer language plpgsql security definer set search_path=public as $$
declare
  league_key constant text := 'flash-family-season-1';
  current_revision integer; season_weeks integer; slot jsonb; match record;
  previous_time text := ''; slot_time text; used_orders integer[] := '{}';
  normalized jsonb := '[]'; match_order integer;
begin
  if upper(trim(coalesce(p_access_code,''))) not in ('PUFF1','NETO') then raise exception 'Admin access required'; end if;
  select regular_season_matches into season_weeks from public.leagues where id=league_key for update;
  if p_week is null or p_week not between 1 and least(coalesce(season_weeks,52),52) then raise exception 'Choose a week in this season'; end if;
  if p_event_date is null or p_event_date not between date '2020-01-01' and date '2100-12-31' then raise exception 'Choose a valid event date'; end if;
  if jsonb_typeof(p_slots) is distinct from 'array' or jsonb_array_length(p_slots)>20 then raise exception 'Choose at most 20 time slots'; end if;
  select revision into current_revision from public.flash_family_fnpl where league_id=league_key and week=p_week for update;
  if p_expected_revision is distinct from coalesce(current_revision,0) then raise exception 'Another admin updated FNPL. Reload the saved schedule before editing'; end if;
  for slot in select value from jsonb_array_elements(p_slots) loop
    slot_time := slot->>'time';
    if jsonb_typeof(slot) is distinct from 'object' or slot_time is null or slot_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Every slot needs a valid time'; end if;
    if slot_time <= previous_time then raise exception 'Time slots must be unique and in chronological order'; end if;
    previous_time := slot_time;
    match_order := null;
    if slot->>'displayOrder' is not null then
      if (slot->>'displayOrder') !~ '^[0-9]{1,2}$' then raise exception 'Invalid matchup'; end if;
      match_order := (slot->>'displayOrder')::integer;
      select * into match from public.flash_family_matchups where league_id=league_key and week=p_week and display_order=match_order for share;
      if not found or match.home_team_id is distinct from slot->>'homeTeamId' or match.away_team_id is distinct from slot->>'awayTeamId' then raise exception 'The weekly matchup changed. Reload before assigning it'; end if;
      if match_order=any(used_orders) then raise exception 'Each matchup can appear only once on FNPL'; end if;
      used_orders := array_append(used_orders,match_order);
    end if;
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'time',slot_time,'startsAt',(p_event_date + slot_time::time) at time zone 'America/New_York',
      'displayOrder',match_order,'homeTeamId',case when match_order is not null then match.home_team_id end,
      'awayTeamId',case when match_order is not null then match.away_team_id end));
  end loop;
  insert into public.flash_family_fnpl(league_id,week,event_date,slots,revision)
  values(league_key,p_week,p_event_date,normalized,coalesce(current_revision,0)+1)
  on conflict(league_id,week) do update set event_date=excluded.event_date,slots=excluded.slots,revision=excluded.revision,updated_at=now();
  return coalesce(current_revision,0)+1;
end;
$$;
revoke all on function public.save_flash_family_fnpl(text,integer,date,jsonb,integer) from public;
grant execute on function public.save_flash_family_fnpl(text,integer,date,jsonb,integer) to anon,authenticated;

create function public.read_flash_family_fnpl()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('currentWeek',l.current_matchup_number,'totalWeeks',l.regular_season_matches,'serverNow',now(),
    'matchups',coalesce((select jsonb_agg(jsonb_build_object('week',m.week,'display_order',m.display_order,'home_team_id',m.home_team_id,'away_team_id',m.away_team_id) order by m.week,m.display_order)
      from public.flash_family_matchups m where m.league_id=l.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('week',e.week,'eventDate',e.event_date,'revision',e.revision,
      'slots',coalesce((select jsonb_agg(s.value || jsonb_build_object('valid',exists(select 1 from public.flash_family_matchups m
          where m.league_id=e.league_id and m.week=e.week and m.display_order=(s.value->>'displayOrder')::integer
          and m.home_team_id=s.value->>'homeTeamId' and m.away_team_id=s.value->>'awayTeamId')) order by s.ordinality)
        from jsonb_array_elements(e.slots) with ordinality s(value,ordinality)),'[]'::jsonb)) order by e.week)
      from public.flash_family_fnpl e where e.league_id=l.id),'[]'::jsonb))
  from public.leagues l where l.id='flash-family-season-1';
$$;
revoke all on function public.read_flash_family_fnpl() from public;
grant execute on function public.read_flash_family_fnpl() to anon,authenticated;
commit;
