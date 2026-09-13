create or replace function public.set_flash_family_draft_point(
  p_access_code text,
  p_pokemon_name text,
  p_point_value integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_name text := trim(coalesce(p_pokemon_name, ''));
  saved_row public.flash_family_draft_pool%rowtype;
begin
  if clean_code not in ('PUFF1', 'NETO') then
    raise exception 'Admin access is required to change draft point values';
  end if;

  if p_point_value is not null and (p_point_value < 1 or p_point_value > 10) then
    raise exception 'Point values must be between 1 and 10';
  end if;

  update public.flash_family_draft_pool
  set point_value = coalesce(p_point_value, default_point_value)
  where lower(pokemon_name) = lower(clean_name)
  returning * into saved_row;

  if not found then
    raise exception 'Pokémon is not in the official draft pool';
  end if;

  update public.flash_family_live_draft_picks
  set point_value = saved_row.point_value
  where pokemon_slug = saved_row.pokemon_slug;

  update public.flash_family_draft_rooms
  set revision = revision + 1,
      updated_at = now()
  where room_key in ('main', 'test');

  return jsonb_build_object(
    'pokemonName', saved_row.pokemon_name,
    'pointValue', saved_row.point_value,
    'defaultPointValue', saved_row.default_point_value
  );
end;
$$;

revoke all on function public.set_flash_family_draft_point(text, text, integer) from public;
grant execute on function public.set_flash_family_draft_point(text, text, integer) to anon, authenticated;
