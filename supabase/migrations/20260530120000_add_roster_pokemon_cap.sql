alter table public.leagues
add column if not exists roster_pokemon_cap int not null default 10;

alter table public.leagues
drop constraint if exists leagues_roster_pokemon_cap_check;

alter table public.leagues
add constraint leagues_roster_pokemon_cap_check
check (roster_pokemon_cap between 8 and 12);
