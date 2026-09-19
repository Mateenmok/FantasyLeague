-- Validate per-game survival markers on new reports only. Existing reports
-- are not rewritten. Losing-side Pokemon are always marked fainted.
create function public.validate_flash_family_game_survival()
returns trigger language plpgsql set search_path=public as $$
declare
  game_report jsonb; survival jsonb; side text; outcomes jsonb; previous_game jsonb;
  entry record; normalized jsonb := '[]'::jsonb;
begin
  for game_report in select value from jsonb_array_elements(new.game_lineups) loop
    if tg_op = 'UPDATE' then
      select value into previous_game from jsonb_array_elements(old.game_lineups)
        where value->>'game'=game_report->>'game' limit 1;
      if game_report is not distinct from previous_game then
        normalized := normalized || jsonb_build_array(game_report);
        continue;
      end if;
    end if;
    -- Cached editors without this field cannot silently erase recorded markers.
    -- New editors send an explicit empty object when clearing a status.
    if tg_op = 'UPDATE' and not (game_report ? 'survival') then
      select value into previous_game from jsonb_array_elements(old.game_lineups)
        where value->>'game'=game_report->>'game'
          and value->>'winnerTeamId' is not distinct from game_report->>'winnerTeamId' limit 1;
      if previous_game ? 'survival' then
        survival := '{}'::jsonb;
        foreach side in array array['home','away'] loop
          select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into outcomes
            from jsonb_each(coalesce(previous_game->'survival'->side,'{}'::jsonb))
            where game_report->side ? key;
          survival := jsonb_set(survival,array[side],outcomes,true);
        end loop;
        game_report := jsonb_set(game_report,'{survival}',survival,true);
      end if;
    end if;
    survival := coalesce(game_report->'survival','{}'::jsonb);
    if jsonb_typeof(survival) is distinct from 'object'
      or (survival - 'home' - 'away') <> '{}'::jsonb then
      raise exception 'Invalid Pokemon survival details';
    end if;
    foreach side in array array['home','away'] loop
      outcomes := coalesce(survival->side,'{}'::jsonb);
      if jsonb_typeof(outcomes) is distinct from 'object' then
        raise exception 'Invalid Pokemon survival details';
      end if;
      for entry in select key,value from jsonb_each(outcomes) loop
        if jsonb_typeof(entry.value) <> 'boolean'
          or not coalesce(game_report->side ? entry.key,false) then
          raise exception 'Survival markers must belong to reported Pokemon and be true or false';
        end if;
      end loop;
      if game_report->>'winnerTeamId' in (new.home_team_id,new.away_team_id)
        and game_report->>'winnerTeamId' <> (case side when 'home' then new.home_team_id else new.away_team_id end) then
        select coalesce(jsonb_object_agg(value,false),'{}'::jsonb) into outcomes
          from jsonb_array_elements_text(game_report->side);
      end if;
      survival := jsonb_set(survival,array[side],outcomes,true);
    end loop;
    -- Keep old optional reports byte-for-byte unless markers or a winner exist.
    if game_report ? 'survival' or game_report->>'winnerTeamId' is not null then
      game_report := jsonb_set(game_report,'{survival}',survival,true);
    end if;
    normalized := normalized || jsonb_build_array(game_report);
  end loop;
  new.game_lineups := normalized;
  return new;
end;
$$;
revoke all on function public.validate_flash_family_game_survival() from public;
create trigger validate_flash_family_game_survival
before insert or update of game_lineups on public.flash_family_matchups
for each row execute function public.validate_flash_family_game_survival();
