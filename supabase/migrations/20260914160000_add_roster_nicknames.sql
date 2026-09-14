-- Team-owned display names, separate from roster slots so reorder/rebuilds do
-- not erase nicknames. Only currently rostered Pokémon are publicly visible.
create table public.flash_family_pokemon_nicknames (
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null,
  pokemon_slug text not null,
  nickname text not null check (char_length(nickname) between 1 and 24),
  updated_at timestamptz not null default now(),
  primary key (league_id, team_id, pokemon_slug)
);
alter table public.flash_family_pokemon_nicknames enable row level security;
revoke all on public.flash_family_pokemon_nicknames from public, anon, authenticated;
grant select on public.flash_family_pokemon_nicknames to anon, authenticated;
create policy "Read current roster nicknames"
on public.flash_family_pokemon_nicknames for select to anon, authenticated
using (league_id = 'flash-family-season-1' and exists (
  select 1 from public.team_rosters r
  where r.league_id = flash_family_pokemon_nicknames.league_id
    and r.team_id = flash_family_pokemon_nicknames.team_id
    and r.pokemon_slug = flash_family_pokemon_nicknames.pokemon_slug
));

create function public.set_flash_family_pokemon_nickname(
  p_access_code text, p_team_id text, p_pokemon_slug text, p_nickname text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_slug text := lower(trim(coalesce(p_pokemon_slug, '')));
  clean_name text := trim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
begin
  if clean_code = '' or not exists (
    select 1 from public.league_teams
    where league_id = league_key and id = p_team_id
      and upper(trim(team_access_code)) = clean_code
  ) then
    raise exception 'Only the team owner can nickname their Pokemon';
  end if;
  if char_length(clean_name) > 24 or clean_name ~ '[[:cntrl:]]' then
    raise exception 'Nicknames must be 24 characters or fewer, without control characters';
  end if;
  perform 1 from public.team_rosters
  where league_id = league_key and team_id = p_team_id and pokemon_slug = clean_slug
  for update;
  if not found then raise exception 'That Pokemon is no longer on your roster'; end if;

  if clean_name = '' then
    delete from public.flash_family_pokemon_nicknames
    where league_id = league_key and team_id = p_team_id and pokemon_slug = clean_slug;
  else
    insert into public.flash_family_pokemon_nicknames (league_id, team_id, pokemon_slug, nickname)
    values (league_key, p_team_id, clean_slug, clean_name)
    on conflict (league_id, team_id, pokemon_slug) do update
      set nickname = excluded.nickname, updated_at = now();
  end if;
  return clean_name;
end;
$$;
revoke all on function public.set_flash_family_pokemon_nickname(text, text, text, text) from public;
grant execute on function public.set_flash_family_pokemon_nickname(text, text, text, text) to anon, authenticated;
