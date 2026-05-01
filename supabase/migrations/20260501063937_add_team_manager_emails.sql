alter table public.league_teams
add column if not exists manager_email text;

create unique index if not exists unique_league_manager_email
on public.league_teams (league_id, lower(manager_email))
where manager_email is not null and manager_email <> '';
