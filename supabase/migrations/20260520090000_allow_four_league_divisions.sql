alter table public.league_divisions
drop constraint if exists league_divisions_division_number_check;

alter table public.league_divisions
add constraint league_divisions_division_number_check
check (division_number between 1 and 4);
