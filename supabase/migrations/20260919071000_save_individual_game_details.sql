-- Save exactly one game's details without rewriting scores or other reports.
create function public.save_flash_family_game_details(
  p_access_code text,p_week integer,p_display_order integer,
  p_home_team_id text,p_away_team_id text,p_game jsonb,p_expected_game jsonb,
  p_home_score integer,p_away_score integer
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  saved public.flash_family_matchups%rowtype;
  game_number integer; previous_game jsonb; games jsonb; side text; choices jsonb; slug text;
begin
  if upper(trim(coalesce(p_access_code,''))) not in ('PUFF1','NETO') then raise exception 'Admin access required'; end if;
  perform 1 from public.leagues where id='flash-family-season-1' for update;
  select * into saved from public.flash_family_matchups where league_id='flash-family-season-1'
    and week=p_week and display_order=p_display_order for update;
  if not found or saved.home_team_id is distinct from p_home_team_id or saved.away_team_id is distinct from p_away_team_id then
    raise exception 'The matchup changed. Refresh before saving';
  end if;
  if saved.home_score is null or saved.away_score is null then
    raise exception 'Save Scores to publish the match score first';
  end if;
  if saved.home_score is distinct from p_home_score or saved.away_score is distinct from p_away_score then
    raise exception 'The match score changed. Refresh before saving';
  end if;
  if jsonb_typeof(p_game) is distinct from 'object' or coalesce(p_game->>'game','') !~ '^[0-9]+$' then
    raise exception 'Invalid game details';
  end if;
  game_number := (p_game->>'game')::integer;
  if game_number<1 or game_number>saved.home_score+saved.away_score then raise exception 'Game must fit the reported match score'; end if;
  select value into previous_game from jsonb_array_elements(saved.game_lineups) where (value->>'game')::integer=game_number;
  if previous_game is distinct from nullif(p_expected_game,'null'::jsonb) then
    raise exception 'This game was updated by another admin. Refresh before saving';
  end if;
  foreach side in array array['home','away'] loop
    choices := p_game->side;
    if jsonb_typeof(choices) is distinct from 'array' then raise exception 'Choose zero to four Pokemon per side'; end if;
    if jsonb_array_length(choices)>4 or (select count(distinct value) from jsonb_array_elements(choices))<>jsonb_array_length(choices)
      then raise exception 'Choose at most four different Pokemon per side'; end if;
    if exists(select 1 from jsonb_array_elements(choices) where jsonb_typeof(value)<>'string') then raise exception 'Invalid Pokemon selection'; end if;
    for slug in select value from jsonb_array_elements_text(choices) loop
      if not exists(select 1 from public.team_rosters where league_id='flash-family-season-1'
        and team_id=(case side when 'home' then saved.home_team_id else saved.away_team_id end) and pokemon_slug=slug)
        and not exists(select 1 from jsonb_array_elements(saved.game_lineups) old_game where old_game->side ? slug) then
        raise exception 'Choose Pokemon from that team''s roster';
      end if;
    end loop;
  end loop;
  if p_game->'winnerTeamId' is not null and p_game->'winnerTeamId'<>'null'::jsonb
    and (jsonb_typeof(p_game->'winnerTeamId')<>'string' or p_game->>'winnerTeamId' not in (saved.home_team_id,saved.away_team_id)) then
    raise exception 'Choose a game winner from the two matchup teams';
  end if;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into games from jsonb_array_elements(saved.game_lineups)
    where (value->>'game')::integer<>game_number;
  games := games || jsonb_build_array(p_game);
  if (select count(*) from jsonb_array_elements(games) g where g->>'winnerTeamId'=saved.home_team_id)>saved.home_score
    or (select count(*) from jsonb_array_elements(games) g where g->>'winnerTeamId'=saved.away_team_id)>saved.away_score then
    raise exception 'Game winners must match the reported score';
  end if;
  select jsonb_agg(value order by (value->>'game')::integer) into games from jsonb_array_elements(games);
  update public.flash_family_matchups set game_lineups=games,updated_at=now()
    where league_id=saved.league_id and week=saved.week and display_order=saved.display_order
    returning game_lineups into games;
  return (select value from jsonb_array_elements(games) where (value->>'game')::integer=game_number);
end;
$$;
revoke all on function public.save_flash_family_game_details(text,integer,integer,text,text,jsonb,jsonb,integer,integer) from public;
grant execute on function public.save_flash_family_game_details(text,integer,integer,text,text,jsonb,jsonb,integer,integer) to anon,authenticated;
