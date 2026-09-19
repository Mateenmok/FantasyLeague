-- Optional winners live alongside each game's existing, historical lineup.
-- This changes validation only; it does not rewrite any saved reports.
do $$
declare definition text;
  marker constant text := 'for g in select value from jsonb_array_elements(lineup) loop';
begin
  select pg_get_functiondef('public.save_flash_family_week_reports(text,integer,jsonb)'::regprocedure)
    into definition;
  if position(marker in definition)=0 then
    raise exception 'Unexpected weekly report function; migration aborted';
  end if;
  definition := replace(definition, marker, $validation$
    if exists(select 1 from jsonb_array_elements(lineup) entry
      where entry->'winnerTeamId' is not null and entry->'winnerTeamId' <> 'null'::jsonb
        and (jsonb_typeof(entry->'winnerTeamId') <> 'string'
          or entry->>'winnerTeamId' not in (saved.home_team_id,saved.away_team_id))) then
      raise exception 'Choose a game winner from the two matchup teams';
    end if;
    if (select count(*) from jsonb_array_elements(lineup) entry where entry->>'winnerTeamId'=saved.home_team_id) > (r->>'homeScore')::integer
      or (select count(*) from jsonb_array_elements(lineup) entry where entry->>'winnerTeamId'=saved.away_team_id) > (r->>'awayScore')::integer then
      raise exception 'Game winners must match the reported score';
    end if;
    for g in select value from jsonb_array_elements(lineup) loop
  $validation$);
  execute definition;
end;
$$;
