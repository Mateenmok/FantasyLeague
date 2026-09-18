-- Predictions must survive schedule saves and commissioner week changes.
-- Keep a private recovery history before any future update/delete.
create table public.flash_family_prediction_history (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null default now(),
  source_table text not null,
  operation text not null,
  row_data jsonb not null
);
alter table public.flash_family_prediction_history enable row level security;
revoke all on public.flash_family_prediction_history from public,anon,authenticated;
insert into public.flash_family_prediction_history(source_table,operation,row_data)
select 'flash_family_pickems','BASELINE',to_jsonb(p) from public.flash_family_pickems p
union all select 'flash_family_survivor_picks','BASELINE',to_jsonb(p) from public.flash_family_survivor_picks p;
create function public.archive_flash_family_prediction() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op<>'INSERT' then
    insert into public.flash_family_prediction_history(source_table,operation,row_data) values(tg_table_name,tg_op||'_BEFORE',to_jsonb(old));
  end if;
  if tg_op<>'DELETE' then
    insert into public.flash_family_prediction_history(source_table,operation,row_data) values(tg_table_name,tg_op,to_jsonb(new));
  end if;
  return null;
end;
$$;
revoke all on function public.archive_flash_family_prediction() from public,anon,authenticated;
create trigger archive_flash_family_pickem after insert or update or delete on public.flash_family_pickems for each row execute function public.archive_flash_family_prediction();
create trigger archive_flash_family_survivor after insert or update or delete on public.flash_family_survivor_picks for each row execute function public.archive_flash_family_prediction();

-- Rewinding results must not destroy submitted Survivor entries.
drop trigger if exists rewind_flash_family_survivor on public.leagues;
create or replace function public.rewind_flash_family_survivor() returns trigger
language plpgsql security definer set search_path=public as $$
begin return new; end;
$$;

-- Fail safely if any old code attempts to delete matchups with votes.
alter table public.flash_family_pickems drop constraint flash_family_pickems_league_id_week_display_order_fkey;
alter table public.flash_family_pickems add constraint flash_family_pickems_league_id_week_display_order_fkey
foreign key(league_id,week,display_order) references public.flash_family_matchups(league_id,week,display_order) on delete restrict;

create or replace function public.save_flash_family_week_schedule(
 p_access_code text,p_week integer,p_home_team_ids text[],p_away_team_ids text[]
) returns void language plpgsql security definer set search_path=public as $$
declare
 league_key constant text := 'flash-family-season-1';
 allowed_teams constant text[] := array['daytona-torterras','kansas-krooks','south-jersey-hounds','chicago-conkquerers','las-vegas-gatrs','north-carolina-ceruledge','uconn-arcanines','boston-eeltics','sunnyshore-city-shelter','massachusetts-midnight','miami-dragapults','san-francisco-soulfire','stockholm-spin-cycles','dallas-disguises'];
 participants text[];
begin
 if upper(trim(coalesce(p_access_code,''))) not in ('PUFF1','NETO') then raise exception 'Admin access required'; end if;
 if p_week is null or p_week<1 or p_week>52 or p_home_team_ids is null or p_away_team_ids is null
   or cardinality(p_home_team_ids)<>7 or cardinality(p_away_team_ids)<>7 then raise exception 'A valid week requires seven matchups'; end if;
 participants:=p_home_team_ids||p_away_team_ids;
 if (select count(distinct id) from unnest(participants) t(id))<>14 or exists(select 1 from unnest(participants) t(id) where id is null or not(id=any(allowed_teams)))
   then raise exception 'Every league team must appear exactly once'; end if;
 perform 1 from public.leagues where id=league_key for update;
 if (exists(select 1 from public.flash_family_pickems where league_id=league_key and week=p_week)
   or exists(select 1 from public.flash_family_survivor_picks where league_id=league_key and week=p_week))
   and exists(select 1 from generate_subscripts(p_home_team_ids,1) p
     left join public.flash_family_matchups m on m.league_id=league_key and m.week=p_week and m.display_order=p
     where m.home_team_id is distinct from p_home_team_ids[p] or m.away_team_id is distinct from p_away_team_ids[p])
   then raise exception 'This week already has predictions. Matchups cannot be replaced or reordered; existing picks have been preserved'; end if;
 insert into public.flash_family_matchups(league_id,week,display_order,home_team_id,away_team_id)
 select league_key,p_week,p,p_home_team_ids[p],p_away_team_ids[p] from generate_subscripts(p_home_team_ids,1) p
 on conflict(league_id,week,display_order) do update set home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,
   home_score=null,away_score=null,home_kos=null,away_kos=null,game_lineups='[]'::jsonb,updated_at=now()
 where flash_family_matchups.home_team_id is distinct from excluded.home_team_id or flash_family_matchups.away_team_id is distinct from excluded.away_team_id;
end;
$$;
