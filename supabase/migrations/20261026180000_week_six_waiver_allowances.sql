begin;

-- Keep historical usage and scope exceptions to a specific league week.
select id from public.leagues where id = 'flash-family-season-1' for update;
alter table public.flash_family_weekly_waiver_usage
  add column pickup_count integer not null default 1 check (pickup_count > 0);

create table public.flash_family_weekly_waiver_allowances (
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null references public.league_teams(id) on delete cascade,
  week integer not null check (week between 0 and 52),
  pickup_limit integer not null check (pickup_limit between 1 and 10),
  primary key (league_id, team_id, week)
);
alter table public.flash_family_weekly_waiver_allowances enable row level security;
revoke all on public.flash_family_weekly_waiver_allowances from public, anon, authenticated;
grant select on public.flash_family_weekly_waiver_allowances to anon, authenticated;
create policy "Public can read weekly waiver allowances"
  on public.flash_family_weekly_waiver_allowances for select to anon, authenticated
  using (league_id = 'flash-family-season-1');

insert into public.flash_family_weekly_waiver_allowances (league_id, team_id, week, pickup_limit)
values
  ('flash-family-season-1', 'sunnyshore-city-shelter', 6, 4),
  ('flash-family-season-1', 'uconn-arcanines', 6, 4),
  ('flash-family-season-1', 'south-jersey-hounds', 6, 4);

-- The existing RPC holds the league lock and validates the access code, window,
-- mascot and roster budget. Only replace the weekly usage guard; failed moves
-- still roll back the counter, roster and transaction log together.
do $$
declare
  definition text;
  old_guard text := E'  if clean_add is not null then\n    insert into public.flash_family_weekly_waiver_usage (league_id, team_id, week)\n    select league_key, p_team_id, coalesce(current_matchup_number, 0)\n    from public.leagues where id = league_key\n    on conflict (league_id, team_id, week) do nothing;\n    if not found then\n      raise exception ''Your team has already used its one waiver pickup for this week'';\n    end if;\n  end if;';
  new_guard text := $guard$  if clean_add is not null then
    insert into public.flash_family_weekly_waiver_usage as usage (league_id, team_id, week)
    select league_key, p_team_id, coalesce(current_matchup_number, 0)
    from public.leagues where id = league_key
    on conflict (league_id, team_id, week) do update
      set pickup_count = usage.pickup_count + 1
      where usage.pickup_count < coalesce((
        select allowance.pickup_limit
        from public.flash_family_weekly_waiver_allowances allowance
        where allowance.league_id = excluded.league_id
          and allowance.team_id = excluded.team_id
          and allowance.week = excluded.week
      ), 1);
    if not found then
      raise exception 'Your team has already used all waiver pickups allowed for this week';
    end if;
  end if;$guard$;
begin
  select pg_get_functiondef('public.submit_flash_family_waiver(text,text,text,text,integer)'::regprocedure) into definition;
  if strpos(definition, old_guard) = 0 then
    raise exception 'Expected weekly waiver guard was not found';
  end if;
  execute replace(definition, old_guard, new_guard);
end;
$$;

commit;
