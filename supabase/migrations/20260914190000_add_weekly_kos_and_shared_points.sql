-- Preserve account IDs/access codes so existing picks stay attached to the GM.
update public.league_teams set owner_name = 'FLash'
where league_id = 'flash-family-season-1' and id = 'miami-dragapults';
update public.flash_family_pickems set username = 'FLash'
where league_id = 'flash-family-season-1' and account_id = 'neto';
do $$
declare definition text;
begin
  select pg_get_functiondef('public.submit_flash_family_pickem(text,integer,integer,text)'::regprocedure) into definition;
  execute replace(definition, '''neto'', ''Neto''', '''neto'', ''FLash''');
end;
$$;

-- Point values are public catalog data; do not expose draft/account records.
create function public.read_flash_family_point_values()
returns jsonb language sql security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(pokemon_name, point_value order by pokemon_name), '{}'::jsonb)
  from public.flash_family_draft_pool;
$$;
revoke all on function public.read_flash_family_point_values() from public;
grant execute on function public.read_flash_family_point_values() to anon, authenticated;

alter table public.flash_family_matchups
  add column home_kos integer,
  add column away_kos integer,
  add constraint flash_family_matchups_ko_pair_check check (
    (home_kos is null and away_kos is null)
    or (home_kos is not null and away_kos is not null and home_kos >= 0 and away_kos >= 0
      and home_score is not null and away_score is not null)
  );

-- Rewinding/clearing scores also clears their KO contribution. No schedules
-- or existing scores are changed by installing this trigger.
create function public.clear_flash_family_unscored_kos()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.home_score is null or new.away_score is null then
    new.home_kos := null;
    new.away_kos := null;
  end if;
  return new;
end;
$$;
revoke all on function public.clear_flash_family_unscored_kos() from public;
create trigger clear_flash_family_unscored_kos
before update of home_score, away_score on public.flash_family_matchups
for each row execute function public.clear_flash_family_unscored_kos();

create function public.save_flash_family_week_results(
  p_access_code text, p_week integer, p_display_orders integer[],
  p_home_scores integer[], p_away_scores integer[], p_home_kos integer[], p_away_kos integer[]
)
returns void language plpgsql security definer set search_path = public as $$
declare
  league_key constant text := 'flash-family-season-1';
  position integer;
begin
  if upper(trim(coalesce(p_access_code, ''))) not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  end if;
  if p_week is null or p_week < 1 or p_week > 52
    or p_display_orders is null or p_home_scores is null or p_away_scores is null
    or p_home_kos is null or p_away_kos is null
    or cardinality(p_display_orders) <> cardinality(p_home_scores)
    or cardinality(p_display_orders) <> cardinality(p_away_scores)
    or cardinality(p_display_orders) <> cardinality(p_home_kos)
    or cardinality(p_display_orders) <> cardinality(p_away_kos)
    or (select count(distinct pick) from unnest(p_display_orders) as picks(pick)) <> cardinality(p_display_orders) then
    raise exception 'Score data is incomplete or contains duplicate matchups';
  end if;
  perform 1 from public.leagues where id = league_key for update;

  update public.flash_family_matchups
  set home_score = null, away_score = null, home_kos = null, away_kos = null, updated_at = now()
  where league_id = league_key and week = p_week;
  for position in 1..cardinality(p_display_orders) loop
    if p_home_scores[position] is null or p_away_scores[position] is null
      or p_home_scores[position] < 0 or p_away_scores[position] < 0 then
      raise exception 'Enter non-negative game counts for both teams';
    end if;
    if (p_home_kos[position] is null) <> (p_away_kos[position] is null)
      or p_home_kos[position] < 0 or p_away_kos[position] < 0 then
      raise exception 'Enter non-negative KOs for both teams, or leave both blank';
    end if;
    update public.flash_family_matchups
    set home_score = p_home_scores[position], away_score = p_away_scores[position],
        home_kos = p_home_kos[position], away_kos = p_away_kos[position], updated_at = now()
    where league_id = league_key and week = p_week and display_order = p_display_orders[position];
    if not found then raise exception 'Save the matchup schedule before reporting scores'; end if;
  end loop;
end;
$$;
revoke all on function public.save_flash_family_week_results(text,integer,integer[],integer[],integer[],integer[],integer[]) from public;
grant execute on function public.save_flash_family_week_results(text,integer,integer[],integer[],integer[],integer[],integer[]) to anon, authenticated;

-- Old cached admin pages may still call this API. Preserve KO totals when
-- their game score hasn't changed, instead of silently discarding those KOs.
create or replace function public.save_flash_family_week_scores(
  p_access_code text, p_week integer, p_display_orders integer[],
  p_home_scores integer[], p_away_scores integer[]
)
returns void language plpgsql security definer set search_path = public as $$
declare home_kos integer[]; away_kos integer[];
begin
  select coalesce(array_agg(case when m.home_score = p_home_scores[p.position] and m.away_score = p_away_scores[p.position] then m.home_kos end order by p.position), array[]::integer[]),
         coalesce(array_agg(case when m.home_score = p_home_scores[p.position] and m.away_score = p_away_scores[p.position] then m.away_kos end order by p.position), array[]::integer[])
  into home_kos, away_kos
  from unnest(p_display_orders) with ordinality as p(display_order, position)
  left join public.flash_family_matchups m
    on m.league_id = 'flash-family-season-1' and m.week = p_week and m.display_order = p.display_order;
  perform public.save_flash_family_week_results(p_access_code, p_week, p_display_orders,
    p_home_scores, p_away_scores, home_kos, away_kos);
end;
$$;
