alter function public.read_flash_family_live_draft(text, text)
  rename to read_flash_family_live_draft_internal;

alter function public.submit_flash_family_live_draft_pick(text, text, text, text)
  rename to submit_flash_family_live_draft_pick_internal;

alter function public.control_flash_family_live_draft(text, text, text, integer)
  rename to control_flash_family_live_draft_internal;

revoke all on function public.read_flash_family_live_draft_internal(text, text) from public, anon, authenticated;
revoke all on function public.submit_flash_family_live_draft_pick_internal(text, text, text, text) from public, anon, authenticated;
revoke all on function public.control_flash_family_live_draft_internal(text, text, text, integer) from public, anon, authenticated;

create function public.read_flash_family_live_draft(
  p_access_code text,
  p_room_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
begin
  result := public.read_flash_family_live_draft_internal(p_access_code, p_room_key);

  if clean_room = 'test' and clean_code = 'DRAFTTEST3' then
    result := jsonb_set(result, '{viewer,isAdmin}', 'true'::jsonb, false);
  end if;

  return result;
end;
$$;

create function public.submit_flash_family_live_draft_pick(
  p_access_code text,
  p_room_key text,
  p_pokemon_slug text,
  p_for_team_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
begin
  if clean_room = 'test' and clean_code = 'DRAFTTEST3' then
    return public.submit_flash_family_live_draft_pick_internal(
      'DRAFTTEST1', p_room_key, p_pokemon_slug, p_for_team_id
    );
  end if;

  return public.submit_flash_family_live_draft_pick_internal(
    p_access_code, p_room_key, p_pokemon_slug, p_for_team_id
  );
end;
$$;

create function public.control_flash_family_live_draft(
  p_access_code text,
  p_room_key text,
  p_action text,
  p_value integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
begin
  if clean_room = 'test' and clean_code = 'DRAFTTEST3' then
    perform public.control_flash_family_live_draft_internal(
      'DRAFTTEST1', p_room_key, p_action, p_value
    );
    return;
  end if;

  perform public.control_flash_family_live_draft_internal(
    p_access_code, p_room_key, p_action, p_value
  );
end;
$$;

revoke all on function public.read_flash_family_live_draft(text, text) from public;
revoke all on function public.submit_flash_family_live_draft_pick(text, text, text, text) from public;
revoke all on function public.control_flash_family_live_draft(text, text, text, integer) from public;

grant execute on function public.read_flash_family_live_draft(text, text) to anon, authenticated;
grant execute on function public.submit_flash_family_live_draft_pick(text, text, text, text) to anon, authenticated;
grant execute on function public.control_flash_family_live_draft(text, text, text, integer) to anon, authenticated;
