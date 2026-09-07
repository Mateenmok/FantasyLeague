create or replace function public.rewind_flash_family_current_week(
  p_access_code text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  active_week integer;
  reopened_week integer;
begin
  if upper(trim(coalesce(p_access_code, ''))) not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  end if;

  select coalesce(current_matchup_number, 0)
  into active_week
  from public.leagues
  where id = league_key
  for update;

  if not found then
    raise exception 'Flash Family League was not found';
  end if;

  if active_week <= 0 then
    raise exception 'The league is already in Week 0';
  end if;

  reopened_week := active_week - 1;

  if reopened_week > 0 then
    update public.flash_family_matchups
    set home_score = null,
        away_score = null,
        updated_at = now()
    where league_id = league_key
      and week = reopened_week;
  end if;

  update public.leagues
  set current_matchup_number = reopened_week
  where id = league_key;

  return reopened_week;
end;
$$;

revoke all on function public.rewind_flash_family_current_week(text) from public;
grant execute on function public.rewind_flash_family_current_week(text) to anon, authenticated;
