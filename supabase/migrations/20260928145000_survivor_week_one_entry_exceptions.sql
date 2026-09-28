-- Commissioner-approved missed-Week-1 exceptions, without inventing picks.
create table public.flash_family_survivor_missed_week_exemptions (
  league_id text not null references public.leagues(id) on delete cascade,
  account_id text not null,
  username text not null,
  week integer not null check (week between 1 and 52),
  primary key (league_id,account_id,week)
);
alter table public.flash_family_survivor_missed_week_exemptions enable row level security;
revoke all on public.flash_family_survivor_missed_week_exemptions from public,anon,authenticated;

insert into public.flash_family_survivor_missed_week_exemptions(league_id,account_id,username,week)
values ('flash-family-season-1','narcotics','Narcotics',1),
       ('flash-family-season-1','shdwemp','Shdwemp',1);

do $$
declare
  definition text;
  entries_marker constant text := $marker$select account_id,max(username) as username from public.flash_family_survivor_picks
    where league_id='flash-family-season-1' and week<=active_week group by account_id$marker$;
  history_marker constant text := $marker$left join public.flash_family_matchups m on m.league_id='flash-family-season-1' and m.week=w.week and p.picked_team_id in (m.home_team_id,m.away_team_id)$marker$;
begin
  select pg_get_functiondef('public.read_flash_family_survivor(text)'::regprocedure) into definition;
  if position(entries_marker in definition)=0 or position(history_marker in definition)=0 then
    raise exception 'Unexpected Survivor read implementation; migration aborted';
  end if;
  definition := replace(definition,entries_marker,$replacement$
    select account_id,max(username) as username from (
      select account_id,username from public.flash_family_survivor_picks
        where league_id='flash-family-season-1' and week<=active_week
      union all
      select account_id,username from public.flash_family_survivor_missed_week_exemptions
        where league_id='flash-family-season-1' and week<active_week
    ) eligible_entries group by account_id
  $replacement$);
  definition := replace(definition,history_marker,history_marker || $replacement$
    where not (p.account_id is null and exists (
      select 1 from public.flash_family_survivor_missed_week_exemptions exemption
      where exemption.league_id='flash-family-season-1'
        and exemption.account_id=e.account_id and exemption.week=w.week
    ))
  $replacement$);
  execute definition;
end;
$$;
