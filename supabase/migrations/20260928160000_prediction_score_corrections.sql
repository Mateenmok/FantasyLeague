-- Commissioner-provided Week 1 totals; predictions remain the source of votes,
-- while only results after through_week add to these restored totals.
begin;

create table public.flash_family_pickem_score_baselines (
  league_id text not null references public.leagues(id) on delete cascade,
  account_id text not null,
  username text not null,
  through_week integer not null check (through_week between 0 and 52),
  correct integer not null check (correct >= 0),
  primary key (league_id, account_id)
);
alter table public.flash_family_pickem_score_baselines enable row level security;
revoke all on public.flash_family_pickem_score_baselines from public, anon, authenticated;

insert into public.flash_family_pickem_score_baselines
  (league_id, account_id, username, through_week, correct)
select 'flash-family-season-1', account_id, username, 1, correct
from (values
  ('pufferz', 'Pufferz', 1),
  ('neto', 'FLash', 2),
  ('shdwemp', 'Shdwemp', 2),
  ('kilan', 'Kilan', 3),
  ('kirbbles', 'Kirbbles', 3),
  ('letsnot', 'LetsNot', 2),
  ('lio', 'Lio', 0),
  ('norforil', 'Norforil', 2),
  ('fear', 'Fear', 1),
  ('chorizo', 'Chorizo', 2),
  ('flan', 'FLan', 1),
  ('pin', 'Pin', 1),
  ('narcotics', 'Narcotics', 0),
  ('omen', 'Omen', 0)
) as scores(account_id, username, correct);

create or replace function public.read_flash_family_pickem_leaderboard()
returns table(account_id text, username text, correct bigint, scored bigint, picks bigint)
language sql stable security definer set search_path = public
as $$
  with baseline as (
    select * from public.flash_family_pickem_score_baselines
    where league_id = 'flash-family-season-1'
  ), cutoff as (
    select coalesce(max(through_week), 0) as week from baseline
  ), predictions as (
    select p.*, case
      when m.home_score > m.away_score then m.home_team_id
      when m.away_score > m.home_score then m.away_team_id
    end as winner
    from public.flash_family_pickems p
    left join public.flash_family_matchups m
      on (m.league_id, m.week, m.display_order) = (p.league_id, p.week, p.display_order)
    where p.league_id = 'flash-family-season-1'
  ), entrants as (
    select b.account_id, b.username from baseline b
    union all
    select distinct on (p.account_id) p.account_id, p.username
    from predictions p
    where not exists (select 1 from baseline b where b.account_id = p.account_id)
    order by account_id, username
  )
  select e.account_id, e.username,
    coalesce(b.correct, 0)::bigint + count(*) filter (
      where p.week > coalesce(b.through_week, c.week) and p.winner = p.picked_team_id
    ) as correct,
    count(*) filter (where p.week > coalesce(b.through_week, c.week) and p.winner is not null) as scored,
    count(p.account_id) as picks
  from entrants e
  cross join cutoff c
  left join baseline b on b.account_id = e.account_id
  left join predictions p on p.account_id = e.account_id
  group by e.account_id, e.username, b.correct
  order by correct desc, scored desc, e.username;
$$;
revoke all on function public.read_flash_family_pickem_leaderboard() from public;
grant execute on function public.read_flash_family_pickem_leaderboard() to anon, authenticated;

-- Fill only the two explicitly supplied historical choices. Never overwrite a
-- submitted choice or remove a current-week pick to satisfy the no-reuse rule.
do $$
declare
  choice record;
begin
  if (select current_matchup_number from public.leagues where id = 'flash-family-season-1') is distinct from 2 then
    raise exception 'This correction must be reviewed if the league is no longer in Week 2';
  end if;
  for choice in select * from (values
    ('narcotics', 'Narcotics', 'chicago-conkquerers'),
    ('shdwemp', 'Shdwemp', 'stockholm-spin-cycles')
  ) as choices(account_id, username, team_id)
  loop
    if exists (
      select 1 from public.flash_family_survivor_picks p
      where p.league_id = 'flash-family-season-1' and p.account_id = choice.account_id
        and ((p.week = 1 and p.picked_team_id <> choice.team_id)
          or (p.week <> 1 and p.picked_team_id = choice.team_id))
    ) then
      raise exception 'A saved Survivor pick conflicts with the historical choice for %', choice.username;
    end if;
    if not exists (
      select 1 from public.flash_family_matchups m
      where m.league_id = 'flash-family-season-1' and m.week = 1
        and ((m.home_team_id = choice.team_id and m.home_score > m.away_score)
          or (m.away_team_id = choice.team_id and m.away_score > m.home_score))
    ) then
      raise exception 'Verify the Week 1 winning team for % before backfilling', choice.username;
    end if;
    insert into public.flash_family_survivor_picks (league_id, account_id, username, week, picked_team_id)
    values ('flash-family-season-1', choice.account_id, choice.username, 1, choice.team_id)
    on conflict (league_id, account_id, week) do nothing;
  end loop;
end;
$$;

commit;
