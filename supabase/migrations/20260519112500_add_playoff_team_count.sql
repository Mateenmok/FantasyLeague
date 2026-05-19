alter table public.leagues
add column if not exists playoff_team_count int;

update public.leagues
set playoff_team_count = case
  when team_count >= 10 then 6
  when team_count >= 4 then 4
  else 2
end
where playoff_team_count is null;

alter table public.leagues
alter column playoff_team_count set default 6,
alter column playoff_team_count set not null;

alter table public.leagues
drop constraint if exists leagues_playoff_team_count_check;

alter table public.leagues
add constraint leagues_playoff_team_count_check
check (
  playoff_team_count between 2 and team_count
  and playoff_team_count % 2 = 0
);
