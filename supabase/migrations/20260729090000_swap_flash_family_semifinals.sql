-- Flash Family's two unscored semifinal pairings were entered in the wrong order.
-- Scope this correction to that league and only to the expected saved bracket state.
do $$
declare
  flash_league_id text;
  midnight_id text;
  fear_id text;
  dragapults_id text;
  smear_id text;
  updated_rows integer;
begin
  select id into strict flash_league_id
  from public.leagues
  where lower(name) = lower('Flash Family');

  select id into strict midnight_id
  from public.league_teams
  where league_id = flash_league_id and team_name = 'Massachusetts Midnight';

  select id into strict fear_id
  from public.league_teams
  where league_id = flash_league_id and team_name = 'Fukushima Fear';

  select id into strict dragapults_id
  from public.league_teams
  where league_id = flash_league_id and team_name = 'Miami Dragapults';

  select id into strict smear_id
  from public.league_teams
  where league_id = flash_league_id and team_name = 'Smear Squad';

  update public.league_matchups
  set
    team1_id = case display_order
      when 1 then fear_id
      when 2 then dragapults_id
    end,
    team2_id = case display_order
      when 1 then midnight_id
      when 2 then smear_id
    end,
    team1_score = null,
    team2_score = null,
    winner_team_id = null,
    completed = false
  where league_id = flash_league_id
    and phase = 'playoff'
    and matchup_number = 2
    and display_order in (1, 2)
    and team1_score is null
    and team2_score is null
    and winner_team_id is null
    and completed = false
    and (
      (display_order = 1 and team1_id = midnight_id and team2_id = dragapults_id)
      or
      (display_order = 2 and team1_id = smear_id and team2_id = fear_id)
    );

  get diagnostics updated_rows = row_count;

  if updated_rows <> 2 then
    raise exception 'Flash Family semifinal correction expected 2 unscored rows, updated %', updated_rows;
  end if;
end $$;
