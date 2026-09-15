-- Store game-by-game species separately from mutable team rosters.
alter table public.flash_family_matchups add column game_lineups jsonb not null default '[]'::jsonb;

create function public.save_flash_family_week_reports(p_access_code text,p_week integer,p_results jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  r jsonb; g jsonb; side text; choices jsonb; slug text; saved record;
  orders integer[] := '{}'; homes integer[] := '{}'; aways integer[] := '{}';
  home_kos integer[] := '{}'; away_kos integer[] := '{}';
  game_count integer; lineup jsonb;
begin
  if upper(trim(coalesce(p_access_code,''))) not in ('PUFF1','NETO') then raise exception 'Admin access required'; end if;
  if jsonb_typeof(p_results) is distinct from 'array' then raise exception 'Invalid weekly reports'; end if;
  perform 1 from public.leagues where id='flash-family-season-1' for update;
  for r in select value from jsonb_array_elements(p_results) loop
    select * into saved from public.flash_family_matchups where league_id='flash-family-season-1'
      and week=p_week and display_order=(r->>'displayOrder')::integer for update;
    if not found or saved.home_team_id is distinct from r->>'home' or saved.away_team_id is distinct from r->>'away'
      then raise exception 'The matchup changed. Refresh before reporting scores'; end if;
    game_count := (r->>'homeScore')::integer + (r->>'awayScore')::integer;
    lineup := coalesce(r->'gameLineups',saved.game_lineups);
    if jsonb_typeof(lineup) is distinct from 'array' then raise exception 'Invalid game lineups'; end if;
    if (select count(distinct (value->>'game')::integer) from jsonb_array_elements(lineup)) <> jsonb_array_length(lineup)
      then raise exception 'Each game can only be reported once'; end if;
    for g in select value from jsonb_array_elements(lineup) loop
      if (g->>'game') is null or (g->>'game')::integer<1 or (g->>'game')::integer>game_count then raise exception 'Lineup game must fit the reported game count'; end if;
      foreach side in array array['home','away'] loop
        choices := g->side;
        if jsonb_typeof(choices) is distinct from 'array' then raise exception 'Choose zero to four Pokemon for each side'; end if;
        if jsonb_array_length(choices)>4 or (select count(distinct value) from jsonb_array_elements(choices))<>jsonb_array_length(choices)
          then raise exception 'Choose at most four different Pokemon for each side'; end if;
        if exists(select 1 from jsonb_array_elements(choices) where jsonb_typeof(value)<>'string') then raise exception 'Invalid Pokemon selection'; end if;
        for slug in select value from jsonb_array_elements_text(choices) loop
          if not exists(select 1 from public.team_rosters where league_id='flash-family-season-1'
              and team_id=case side when 'home' then saved.home_team_id else saved.away_team_id end and pokemon_slug=slug)
            and not exists(select 1 from jsonb_array_elements(saved.game_lineups) old_game where old_game->side ? slug)
            then raise exception 'Choose Pokemon from that team''s roster'; end if;
        end loop;
      end loop;
    end loop;
    orders := array_append(orders,(r->>'displayOrder')::integer);
    homes := array_append(homes,(r->>'homeScore')::integer); aways := array_append(aways,(r->>'awayScore')::integer);
    home_kos := array_append(home_kos,(r->>'homeKOs')::integer); away_kos := array_append(away_kos,(r->>'awayKOs')::integer);
  end loop;
  -- Existing validation and scoring remain authoritative; all changes are atomic.
  perform public.save_flash_family_week_results(p_access_code,p_week,orders,homes,aways,home_kos,away_kos);
  update public.flash_family_matchups set game_lineups='[]'::jsonb
    where league_id='flash-family-season-1' and week=p_week and not(display_order=any(orders));
  for r in select value from jsonb_array_elements(p_results) loop
    update public.flash_family_matchups set game_lineups=coalesce(r->'gameLineups',game_lineups)
      where league_id='flash-family-season-1' and week=p_week and display_order=(r->>'displayOrder')::integer;
  end loop;
end;
$$;
revoke all on function public.save_flash_family_week_reports(text,integer,jsonb) from public;
grant execute on function public.save_flash_family_week_reports(text,integer,jsonb) to anon,authenticated;

create function public.clear_flash_family_changed_lineups() returns trigger language plpgsql set search_path=public as $$
begin
  if new.home_team_id is distinct from old.home_team_id or new.away_team_id is distinct from old.away_team_id then new.game_lineups := '[]'::jsonb; end if;
  return new;
end;
$$;
revoke all on function public.clear_flash_family_changed_lineups() from public;
create trigger clear_flash_family_changed_lineups before update of home_team_id,away_team_id on public.flash_family_matchups
for each row execute function public.clear_flash_family_changed_lineups();

create function public.rewind_flash_family_game_lineups() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.id='flash-family-season-1' and new.current_matchup_number<old.current_matchup_number then
    update public.flash_family_matchups set game_lineups='[]'::jsonb where league_id=new.id and week>=greatest(new.current_matchup_number,1);
  end if;
  return new;
end;
$$;
revoke all on function public.rewind_flash_family_game_lineups() from public;
create trigger rewind_flash_family_game_lineups after update of current_matchup_number on public.leagues
for each row execute function public.rewind_flash_family_game_lineups();
