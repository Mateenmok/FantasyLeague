create or replace function public.validate_flash_family_live_draft_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  mascot_slug text;
  roster_count integer := 0;
  roster_points integer := 0;
  remaining_slots_after_pick integer := 0;
begin
  if new.room_key = 'main' then
    select count(*)::integer, coalesce(sum(pool.point_value), 0)::integer
    into roster_count, roster_points
    from public.team_rosters roster
    left join public.flash_family_draft_pool pool
      on pool.pokemon_slug = roster.pokemon_slug
    where roster.league_id = league_key
      and roster.team_id = new.team_id;
  else
    mascot_slug := case new.team_id
      when 'daytona-torterras' then 'torterra'
      when 'kansas-krooks' then 'krookodile'
      when 'south-jersey-hounds' then 'houndoom'
      when 'chicago-conkquerers' then 'conkeldurr'
      when 'las-vegas-gatrs' then 'feraligatr'
      when 'north-carolina-ceruledge' then 'ceruledge'
      when 'uconn-arcanines' then 'hisuian-arcanine'
      when 'boston-eeltics' then 'eelektross'
      when 'sunnyshore-city-shelter' then 'hisuian-goodra'
      when 'massachusetts-midnight' then 'umbreon'
      when 'miami-dragapults' then 'dragapult'
      when 'san-francisco-soulfire' then 'chandelure'
      when 'stockholm-spin-cycles' then 'rotom-wash'
      when 'dallas-disguises' then 'mimikyu'
    end;

    select 1 + count(*)::integer,
           coalesce((select point_value from public.flash_family_draft_pool where pokemon_slug = mascot_slug), 0)
             + coalesce(sum(point_value), 0)::integer
    into roster_count, roster_points
    from public.flash_family_live_draft_picks
    where room_key = new.room_key
      and team_id = new.team_id;
  end if;

  remaining_slots_after_pick := greatest(0, 10 - roster_count - 1);
  if roster_points + new.point_value + remaining_slots_after_pick > 50 then
    raise exception 'That pick would leave too few points to fill every remaining roster slot';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_flash_family_live_draft_budget
  on public.flash_family_live_draft_picks;

create trigger validate_flash_family_live_draft_budget
before insert on public.flash_family_live_draft_picks
for each row execute function public.validate_flash_family_live_draft_budget();

revoke all on function public.validate_flash_family_live_draft_budget() from public;
