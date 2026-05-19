alter table public.team_rosters
drop constraint if exists unique_pokemon_owner;

drop index if exists public.unique_pokemon_owner;

create unique index if not exists unique_league_pokemon_owner
on public.team_rosters (league_id, pokemon_slug)
where league_id is not null;
