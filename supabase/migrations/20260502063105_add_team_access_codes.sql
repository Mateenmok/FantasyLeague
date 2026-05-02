alter table public.league_teams
add column if not exists team_access_code text;

update public.league_teams
set team_access_code = upper(substr(md5(id || now()::text || random()::text), 1, 6))
where team_access_code is null;

create unique index if not exists league_teams_league_access_code_unique
on public.league_teams(league_id, team_access_code)
where team_access_code is not null;
