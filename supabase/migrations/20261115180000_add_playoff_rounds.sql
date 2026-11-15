-- Season 1 has eight regular weeks followed by Round 1, Round 2 and Championship.
-- Installing this migration does not advance the league or rewrite matchups/picks.
begin;

alter table public.flash_family_matchups alter column home_team_id drop not null;
alter table public.flash_family_matchups alter column away_team_id drop not null;
alter table public.flash_family_matchups add constraint flash_family_pending_playoff_sides
  check (week between 9 and 11 or (home_team_id is not null and away_team_id is not null));
alter table public.flash_family_matchups add constraint flash_family_pending_matchup_no_results
  check ((home_team_id is not null and away_team_id is not null)
    or (home_score is null and away_score is null and home_kos is null and away_kos is null and game_lineups='[]'::jsonb));

update public.leagues set regular_season_matches=8,playoff_team_count=8 where id='flash-family-season-1';

create or replace function public.save_flash_family_week_schedule(
  p_access_code text,p_week integer,p_home_team_ids text[],p_away_team_ids text[]
) returns void language plpgsql security definer set search_path=public as $$
declare
  league_key constant text := 'flash-family-season-1';
  allowed_teams constant text[] := array['daytona-torterras','kansas-krooks','south-jersey-hounds','chicago-conkquerers','las-vegas-gatrs','north-carolina-ceruledge','uconn-arcanines','boston-eeltics','sunnyshore-city-shelter','massachusetts-midnight','miami-dragapults','san-francisco-soulfire','stockholm-spin-cycles','dallas-disguises'];
  slots integer; homes text[]; aways text[]; participants text[]; position integer;
  saved public.flash_family_matchups%rowtype;
begin
  if upper(trim(coalesce(p_access_code,''))) not in ('PUFF1','NETO') then raise exception 'Admin access required'; end if;
  if p_week is null or p_week<1 or p_week>11 then raise exception 'Choose a regular week or playoff round'; end if;
  slots := case p_week when 9 then 4 when 10 then 2 when 11 then 1 else 7 end;
  if p_home_team_ids is null or p_away_team_ids is null or cardinality(p_home_team_ids)<>slots or cardinality(p_away_team_ids)<>slots
    or array_ndims(p_home_team_ids)<>1 or array_ndims(p_away_team_ids)<>1 then
    raise exception 'This period requires % matchup slots',slots;
  end if;
  select array_agg(nullif(btrim(id),'') order by ord) into homes from unnest(p_home_team_ids) with ordinality t(id,ord);
  select array_agg(nullif(btrim(id),'') order by ord) into aways from unnest(p_away_team_ids) with ordinality t(id,ord);
  participants := homes||aways;
  if exists(select 1 from unnest(participants) t(id) where id is not null and not(id=any(allowed_teams))) then
    raise exception 'Choose teams from this league';
  end if;
  if (select count(id) from unnest(participants) t(id))<>(select count(distinct id) from unnest(participants) t(id)) then
    raise exception 'Each team may appear only once in this period';
  end if;
  if p_week<=8 and (select count(id) from unnest(participants) t(id))<>14 then
    raise exception 'Every league team must appear exactly once during the regular season';
  end if;
  perform 1 from public.leagues where id=league_key for update;
  if not found then raise exception 'Flash Family League was not found'; end if;
  if exists(select 1 from public.flash_family_matchups where league_id=league_key and week=p_week and display_order>slots) then
    raise exception 'This period has existing matches outside the playoff bracket. They must be reviewed before saving';
  end if;
  for position in 1..slots loop
    select * into saved from public.flash_family_matchups where league_id=league_key and week=p_week and display_order=position for update;
    if found and (saved.home_team_id is distinct from homes[position] or saved.away_team_id is distinct from aways[position]) then
      if saved.home_score is not null or saved.away_score is not null or saved.home_kos is not null or saved.away_kos is not null or saved.game_lineups<>'[]'::jsonb then
        raise exception 'Matchup % already has results. Its teams cannot be replaced',position;
      end if;
      if exists(select 1 from public.flash_family_pickems where league_id=league_key and week=p_week and display_order=position)
        or exists(select 1 from public.flash_family_survivor_picks where league_id=league_key and week=p_week and picked_team_id in (saved.home_team_id,saved.away_team_id)) then
        raise exception 'Matchup % already has predictions. Its teams cannot be replaced or reordered',position;
      end if;
    end if;
  end loop;
  insert into public.flash_family_matchups(league_id,week,display_order,home_team_id,away_team_id)
    select league_key,p_week,p,homes[p],aways[p] from generate_series(1,slots) p
    on conflict(league_id,week,display_order) do update set home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,updated_at=now()
      where flash_family_matchups.home_team_id is distinct from excluded.home_team_id or flash_family_matchups.away_team_id is distinct from excluded.away_team_id;
end;
$$;

create or replace function public.set_flash_family_current_week(p_access_code text,p_week integer)
returns void language plpgsql security definer set search_path=public as $$
declare active_week integer; slots integer;
begin
  if upper(trim(coalesce(p_access_code,''))) not in ('PUFF1','NETO') then raise exception 'Admin access required'; end if;
  if p_week is null or p_week<0 or p_week>11 then raise exception 'Choose Week 0 through Championship'; end if;
  select current_matchup_number into active_week from public.leagues where id='flash-family-season-1' for update;
  if not found then raise exception 'Flash Family League was not found'; end if;
  if p_week>8 and p_week>active_week then
    slots := case p_week when 9 then 4 when 10 then 2 else 1 end;
    if (select count(*) from public.flash_family_matchups where league_id='flash-family-season-1' and week=p_week and display_order between 1 and slots)<>slots then
      raise exception 'Choose the playoff bracket before advancing. Opponents may be left blank';
    end if;
  end if;
  update public.leagues set current_matchup_number=p_week where id='flash-family-season-1';
end;
$$;

create function public.advance_flash_family_playoff_round(
  p_access_code text,p_expected_week integer,p_home_team_ids text[],p_away_team_ids text[],
  p_waiver_window_end_at timestamptz default null
) returns integer language plpgsql security definer set search_path=public as $$
declare active_week integer; next_week integer;
begin
  if upper(trim(coalesce(p_access_code,''))) not in ('PUFF1','NETO') then raise exception 'Admin access required'; end if;
  select current_matchup_number into active_week from public.leagues where id='flash-family-season-1' for update;
  if not found then raise exception 'Flash Family League was not found'; end if;
  if active_week is distinct from p_expected_week then raise exception 'The league period changed. Refresh before advancing'; end if;
  if active_week not between 8 and 10 then raise exception 'Playoff advancement is available after Week 8 through Round 2'; end if;
  if p_waiver_window_end_at is not null and p_waiver_window_end_at<=now() then raise exception 'Choose a future waiver closing time'; end if;
  next_week := active_week+1;
  perform public.save_flash_family_week_schedule(p_access_code,next_week,p_home_team_ids,p_away_team_ids);
  update public.leagues set current_matchup_number=next_week,
    waiver_window_start_at=case when p_waiver_window_end_at is not null then now() else waiver_window_start_at end,
    waiver_window_end_at=coalesce(p_waiver_window_end_at,waiver_window_end_at),
    waiver_open=case when p_waiver_window_end_at is not null then true else waiver_open end
    where id='flash-family-season-1';
  return next_week;
end;
$$;
revoke all on function public.advance_flash_family_playoff_round(text,integer,text[],text[],timestamptz) from public;
grant execute on function public.advance_flash_family_playoff_round(text,integer,text[],text[],timestamptz) to anon,authenticated;

create or replace function public.set_flash_family_season_rules(p_access_code text,p_total_weeks integer,p_point_cap integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  if upper(trim(coalesce(p_access_code,''))) not in ('PUFF1','NETO') then raise exception 'Admin access required'; end if;
  if p_total_weeks is distinct from 8 then raise exception 'Season 1 has eight regular weeks followed by three playoff rounds'; end if;
  if p_point_cap is null or p_point_cap<1 or p_point_cap>500 then raise exception 'Point cap must be between 1 and 500'; end if;
  update public.leagues set regular_season_matches=8,playoff_team_count=8,roster_point_cap=p_point_cap where id='flash-family-season-1';
end;
$$;

-- Guard all pick writers, including cached manager/guest RPCs, without replacing
-- their account mapping or deadline overrides. SQL's NULL membership is not a
-- valid substitute for an explicit complete-opponent check.
create function public.validate_flash_family_complete_prediction() returns trigger
language plpgsql security definer set search_path=public as $$
declare matchup public.flash_family_matchups%rowtype;
begin
  if new.league_id<>'flash-family-season-1' then return new; end if;
  if tg_table_name='flash_family_pickems' then
    select * into matchup from public.flash_family_matchups where league_id=new.league_id and week=new.week and display_order=new.display_order for share;
  else
    if new.week>8 or (select current_matchup_number from public.leagues where id=new.league_id)>8 then
      raise exception 'Survivor has ended for Season 1';
    end if;
    select * into matchup from public.flash_family_matchups where league_id=new.league_id and week=new.week and new.picked_team_id in(home_team_id,away_team_id) for share;
  end if;
  if matchup.home_team_id is null or matchup.away_team_id is null then raise exception 'Picks open once both matchup teams are confirmed'; end if;
  if new.picked_team_id is null or new.picked_team_id not in(matchup.home_team_id,matchup.away_team_id) then raise exception 'Choose a team in this matchup'; end if;
  return new;
end;
$$;
revoke all on function public.validate_flash_family_complete_prediction() from public,anon,authenticated;
create trigger validate_flash_family_pickem_opponents before insert or update on public.flash_family_pickems
  for each row execute function public.validate_flash_family_complete_prediction();
create trigger validate_flash_family_survivor_period before insert or update on public.flash_family_survivor_picks
  for each row execute function public.validate_flash_family_complete_prediction();

create or replace function public.submit_flash_family_survivor(p_access_code text,p_week integer,p_team_id text)
returns void language plpgsql security definer set search_path=public as $$
declare picker record; active_week integer; deadline timestamptz;
begin
  select * into picker from public.flash_family_survivor_account(p_access_code);
  if picker.account_id is null then raise exception 'Sign in with a league access code to play Survivor'; end if;
  select greatest(current_matchup_number,1),waiver_window_end_at into active_week,deadline from public.leagues where id='flash-family-season-1' for update;
  if active_week>8 then raise exception 'Survivor has ended for Season 1'; end if;
  if p_week is distinct from active_week then raise exception 'Survivor picks are only open for the active week'; end if;
  if (deadline is not null and now()>=deadline) or exists(select 1 from public.flash_family_matchups where league_id='flash-family-season-1' and week=p_week and(home_score is not null or away_score is not null)) then
    raise exception 'Survivor picks are locked for this week';
  end if;
  if p_team_id is null or not exists(select 1 from public.flash_family_matchups where league_id='flash-family-season-1' and week=p_week and home_team_id is not null and away_team_id is not null and p_team_id in(home_team_id,away_team_id)) then
    raise exception 'Choose a team in a confirmed matchup';
  end if;
  if exists(select 1 from public.flash_family_survivor_picks where league_id='flash-family-season-1' and account_id=picker.account_id and picked_team_id=p_team_id and week<>p_week) then raise exception 'You have already used this team in Survivor'; end if;
  insert into public.flash_family_survivor_picks(league_id,account_id,username,week,picked_team_id)
    values('flash-family-season-1',picker.account_id,picker.username,p_week,p_team_id)
    on conflict(league_id,account_id,week) do update set picked_team_id=excluded.picked_team_id,username=excluded.username,updated_at=now();
end;
$$;

create or replace function public.read_flash_family_survivor(p_access_code text default '')
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare picker record; league_week integer; active_week integer; deadline timestamptz; finished boolean; complete_results boolean; result jsonb;
begin
  select * into picker from public.flash_family_survivor_account(p_access_code);
  select greatest(current_matchup_number,1),waiver_window_end_at into league_week,deadline from public.leagues where id='flash-family-season-1';
  active_week := least(league_week,8);
  select not exists(select 1 from generate_series(1,8) w where
    (select count(*) from public.flash_family_matchups m where m.league_id='flash-family-season-1' and m.week=w
      and m.home_score is not null and m.away_score is not null and m.home_score<>m.away_score)<>7) into complete_results;
  finished := league_week>8 or (league_week=8 and complete_results);
  with weeks as (
    select distinct week from public.flash_family_matchups where league_id='flash-family-season-1' and week<=active_week and public.flash_family_survivor_week_ended(week)
  ), entries as (
    select account_id,max(username) as username from (
      select account_id,username from public.flash_family_survivor_picks where league_id='flash-family-season-1' and week<=active_week
      union all select account_id,username from public.flash_family_survivor_missed_week_exemptions where league_id='flash-family-season-1' and week<league_week and week<=8
    ) eligible_entries group by account_id
  ), history as (
    select e.account_id,e.username,w.week,p.picked_team_id,
      case when p.account_id is null then 'missed'
        when m.home_score is null or m.away_score is null or m.home_score=m.away_score then 'pending'
        when p.picked_team_id=case when m.home_score>m.away_score then m.home_team_id else m.away_team_id end then 'correct'
        else 'incorrect' end as outcome
    from entries e cross join weeks w
    left join public.flash_family_survivor_picks p on p.league_id='flash-family-season-1' and p.account_id=e.account_id and p.week=w.week
    left join public.flash_family_matchups m on m.league_id='flash-family-season-1' and m.week=w.week and p.picked_team_id in(m.home_team_id,m.away_team_id)
    where not(p.account_id is null and exists(select 1 from public.flash_family_survivor_missed_week_exemptions exemption where exemption.league_id='flash-family-season-1' and exemption.account_id=e.account_id and exemption.week=w.week))
  ), contestants as (
    select e.account_id,e.username,min(h.week) filter(where h.outcome in('missed','incorrect')) as eliminated_week
    from entries e left join history h on h.account_id=e.account_id group by e.account_id,e.username
  )
  select jsonb_build_object(
    'week',active_week,'current_week',league_week,'season_complete',finished,'results_complete',complete_results,
    'deadline',case when finished then null else deadline end,'server_now',now(),'account_id',picker.account_id,'username',picker.username,
    'locked',finished or(deadline is not null and now()>=deadline) or exists(select 1 from public.flash_family_matchups where league_id='flash-family-season-1' and week=active_week and(home_score is not null or away_score is not null)),
    'winners',case when finished and complete_results then coalesce((select jsonb_agg(jsonb_build_object('account_id',c.account_id,'username',c.username) order by c.username) from contestants c where c.eliminated_week is null),'[]'::jsonb) else '[]'::jsonb end,
    'ended_weeks',coalesce((select jsonb_agg(week order by week desc) from weeks),'[]'::jsonb),
    'contestants',coalesce((select jsonb_agg(to_jsonb(c) order by c.username) from contestants c),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.week desc,h.username) from history h),'[]'::jsonb),
    'own_picks',coalesce((select jsonb_agg(jsonb_build_object('week',p.week,'picked_team_id',p.picked_team_id) order by p.week) from public.flash_family_survivor_picks p where p.league_id='flash-family-season-1' and p.account_id=picker.account_id and p.week<=active_week),'[]'::jsonb),
    'matchups',case when finished then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('home_team_id',m.home_team_id,'away_team_id',m.away_team_id) order by m.display_order) from public.flash_family_matchups m where m.league_id='flash-family-season-1' and m.week=active_week),'[]'::jsonb) end
  ) into result;
  return result;
end;
$$;

-- FNPL includes the playoff periods although regular_season_matches remains 8.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.save_flash_family_fnpl(text,integer,date,jsonb,integer)'::regprocedure) into definition;
  if position('select regular_season_matches into season_weeks' in definition)=0 then raise exception 'Unexpected FNPL save implementation'; end if;
  execute replace(definition,'select regular_season_matches into season_weeks','select 11 into season_weeks');
  select pg_get_functiondef('public.read_flash_family_fnpl()'::regprocedure) into definition;
  if position('''totalWeeks'',l.regular_season_matches' in definition)=0 then raise exception 'Unexpected FNPL read implementation'; end if;
  execute replace(definition,'''totalWeeks'',l.regular_season_matches','''totalWeeks'',11,''regularSeasonWeeks'',8');
end;
$$;

commit;
