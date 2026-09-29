begin;

-- Separate from trades, and keyed by league week rather than editable window dates.
create table public.flash_family_weekly_waiver_usage (
  league_id text not null references public.leagues(id) on delete cascade,
  team_id text not null,
  week integer not null check (week between 0 and 52),
  created_at timestamptz not null default now(),
  primary key (league_id, team_id, week)
);
alter table public.flash_family_weekly_waiver_usage enable row level security;
revoke all on public.flash_family_weekly_waiver_usage from public, anon, authenticated;
grant select on public.flash_family_weekly_waiver_usage to anon, authenticated;
create policy "Public can read weekly waiver usage"
on public.flash_family_weekly_waiver_usage for select to anon, authenticated
using (league_id = 'flash-family-season-1');

-- Serialize installation with roster moves, and honor pickups already made in
-- the currently scheduled window. Do not undo any completed roster changes.
select id from public.leagues where id = 'flash-family-season-1' for update;
insert into public.flash_family_weekly_waiver_usage (league_id, team_id, week, created_at)
select t.league_id, t.team_id, coalesce(l.current_matchup_number, 0), min(t.created_at)
from public.flash_family_transaction_log t
join public.leagues l on l.id = t.league_id
where t.league_id = 'flash-family-season-1' and t.source = 'waiver' and t.action = 'added'
  and t.created_at >= l.waiver_window_start_at
group by t.league_id, t.team_id, l.current_matchup_number;

update public.leagues set waiver_acquisition_limit = 1 where id = 'flash-family-season-1';

-- Preserve existing access, mascot, budget, roster and transaction-log checks.
-- The RPC already holds the league row lock. A unique weekly usage row also
-- prevents double submissions; all writes roll back if the pickup fails.
do $$
declare
  definition text;
  anchor text := E'  if clean_drop is not null then\n    delete from public.team_rosters';
  guard text := E'  if clean_add is not null then\n    insert into public.flash_family_weekly_waiver_usage (league_id, team_id, week)\n    select league_key, p_team_id, coalesce(current_matchup_number, 0)\n    from public.leagues where id = league_key\n    on conflict (league_id, team_id, week) do nothing;\n    if not found then\n      raise exception ''Your team has already used its one waiver pickup for this week'';\n    end if;\n  end if;\n\n';
begin
  select pg_get_functiondef('public.submit_flash_family_waiver(text,text,text,text,integer)'::regprocedure) into definition;
  if strpos(definition, anchor) = 0 or strpos(definition, 'flash_family_weekly_waiver_usage') > 0 then
    raise exception 'Expected waiver mutation block was not found or already patched';
  end if;
  execute replace(definition, anchor, guard || anchor);
end;
$$;

commit;
