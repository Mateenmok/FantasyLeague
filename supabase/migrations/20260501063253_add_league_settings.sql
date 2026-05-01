alter table public.leagues
add column if not exists roster_point_cap int not null default 50,
add column if not exists regular_season_matches int not null default 10;

alter table public.leagues
drop constraint if exists leagues_team_count_check;

alter table public.leagues
add constraint leagues_team_count_check
check (team_count in (8, 10, 12, 14, 16));

alter table public.leagues
drop constraint if exists leagues_roster_point_cap_check;

alter table public.leagues
add constraint leagues_roster_point_cap_check
check (roster_point_cap between 1 and 999);

alter table public.leagues
drop constraint if exists leagues_regular_season_matches_check;

alter table public.leagues
add constraint leagues_regular_season_matches_check
check (regular_season_matches between 6 and 12);
