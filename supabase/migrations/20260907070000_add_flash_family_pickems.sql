create table if not exists public.flash_family_matchups (
  league_id text not null references public.leagues(id) on delete cascade,
  week integer not null check (week between 1 and 52),
  display_order integer not null check (display_order between 1 and 20),
  home_team_id text not null,
  away_team_id text not null,
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  updated_at timestamptz not null default now(),
  primary key (league_id, week, display_order),
  check (home_team_id <> away_team_id)
);

create table if not exists public.flash_family_pickems (
  league_id text not null,
  week integer not null,
  display_order integer not null,
  account_id text not null,
  username text not null,
  picked_team_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, week, display_order, account_id),
  foreign key (league_id, week, display_order)
    references public.flash_family_matchups (league_id, week, display_order)
    on delete cascade
);

alter table public.flash_family_matchups enable row level security;
alter table public.flash_family_pickems enable row level security;

grant select on public.flash_family_matchups to anon, authenticated;
grant select on public.flash_family_pickems to anon, authenticated;

drop policy if exists "Anyone can read Flash Family matchups" on public.flash_family_matchups;
create policy "Anyone can read Flash Family matchups"
on public.flash_family_matchups
for select
to anon, authenticated
using (league_id = 'flash-family-season-1');

drop policy if exists "Anyone can read Flash Family pickems" on public.flash_family_pickems;
create policy "Anyone can read Flash Family pickems"
on public.flash_family_pickems
for select
to anon, authenticated
using (league_id = 'flash-family-season-1');

create or replace function public.submit_flash_family_pickem(
  p_access_code text,
  p_week integer,
  p_display_order integer,
  p_picked_team_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  picker_id text;
  picker_name text;
  active_week integer;
  matchup public.flash_family_matchups%rowtype;
begin
  select account_id, username
  into picker_id, picker_name
  from (values
    ('PUFF1', 'pufferz', 'Pufferz'),
    ('NETO', 'neto', 'Neto'),
    ('MOON4', 'kirbbles', 'Kirbbles'),
    ('FORMIDABLE', 'fear', 'Fear'),
    ('NC50', 'shdwemp', 'Shdwemp')
  ) as accounts(access_code, account_id, username)
  where access_code = clean_code;

  if picker_id is null then
    raise exception 'Sign in with a league access code to make a pick';
  end if;

  select greatest(current_matchup_number, 1)
  into active_week
  from public.leagues
  where id = league_key;

  if p_week is distinct from active_week then
    raise exception 'Picks are only open for the active week';
  end if;

  select *
  into matchup
  from public.flash_family_matchups
  where league_id = league_key
    and week = p_week
    and display_order = p_display_order;

  if not found then
    raise exception 'That matchup is unavailable';
  end if;

  if matchup.home_score is not null or matchup.away_score is not null then
    raise exception 'This matchup is already locked';
  end if;

  if p_picked_team_id not in (matchup.home_team_id, matchup.away_team_id) then
    raise exception 'Choose one of the teams in this matchup';
  end if;

  insert into public.flash_family_pickems (
    league_id, week, display_order, account_id, username, picked_team_id
  ) values (
    league_key, p_week, p_display_order, picker_id, picker_name, p_picked_team_id
  )
  on conflict (league_id, week, display_order, account_id)
  do update set
    username = excluded.username,
    picked_team_id = excluded.picked_team_id,
    updated_at = now();
end;
$$;

create or replace function public.save_flash_family_week_schedule(
  p_access_code text,
  p_week integer,
  p_home_team_ids text[],
  p_away_team_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  allowed_teams constant text[] := array[
    'daytona-torterras', 'kansas-krooks', 'south-jersey-hounds',
    'chicago-conkquerers', 'las-vegas-gatrs', 'north-carolina-ceruledge',
    'uconn-arcanines', 'boston-eeltics', 'sunnyshore-city-shelter',
    'massachusetts-midnight', 'miami-dragapults', 'san-francisco-soulfire',
    'stockholm-spin-cycles', 'dallas-disguises'
  ];
  participants text[];
begin
  if upper(trim(coalesce(p_access_code, ''))) not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  end if;

  if p_week < 1 or p_week > 52
    or cardinality(p_home_team_ids) <> 7
    or cardinality(p_away_team_ids) <> 7 then
    raise exception 'A valid week requires seven matchups';
  end if;

  participants := p_home_team_ids || p_away_team_ids;
  if (select count(distinct team_id) from unnest(participants) as teams(team_id)) <> 14
    or exists (select 1 from unnest(participants) as teams(team_id) where not (team_id = any(allowed_teams))) then
    raise exception 'Every league team must appear exactly once';
  end if;

  delete from public.flash_family_matchups
  where league_id = league_key and week = p_week;

  insert into public.flash_family_matchups (
    league_id, week, display_order, home_team_id, away_team_id
  )
  select league_key, p_week, position::integer, p_home_team_ids[position], p_away_team_ids[position]
  from generate_subscripts(p_home_team_ids, 1) as positions(position);
end;
$$;

create or replace function public.save_flash_family_week_scores(
  p_access_code text,
  p_week integer,
  p_display_orders integer[],
  p_home_scores integer[],
  p_away_scores integer[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  position integer;
begin
  if upper(trim(coalesce(p_access_code, ''))) not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  end if;

  if p_week < 1 or p_week > 52
    or cardinality(p_display_orders) <> cardinality(p_home_scores)
    or cardinality(p_display_orders) <> cardinality(p_away_scores) then
    raise exception 'Score data is incomplete';
  end if;

  update public.flash_family_matchups
  set home_score = null, away_score = null, updated_at = now()
  where league_id = league_key and week = p_week;

  for position in 1..coalesce(cardinality(p_display_orders), 0) loop
    if p_home_scores[position] < 0 or p_away_scores[position] < 0 then
      raise exception 'Scores cannot be negative';
    end if;
    update public.flash_family_matchups
    set
      home_score = p_home_scores[position],
      away_score = p_away_scores[position],
      updated_at = now()
    where league_id = league_key
      and week = p_week
      and display_order = p_display_orders[position];
  end loop;
end;
$$;

create or replace function public.set_flash_family_current_week(
  p_access_code text,
  p_week integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if upper(trim(coalesce(p_access_code, ''))) not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  end if;
  if p_week < 0 or p_week > 52 then
    raise exception 'Invalid league week';
  end if;
  update public.leagues
  set current_matchup_number = p_week
  where id = 'flash-family-season-1';
end;
$$;

revoke all on function public.submit_flash_family_pickem(text, integer, integer, text) from public;
revoke all on function public.save_flash_family_week_schedule(text, integer, text[], text[]) from public;
revoke all on function public.save_flash_family_week_scores(text, integer, integer[], integer[], integer[]) from public;
revoke all on function public.set_flash_family_current_week(text, integer) from public;

grant execute on function public.submit_flash_family_pickem(text, integer, integer, text) to anon, authenticated;
grant execute on function public.save_flash_family_week_schedule(text, integer, text[], text[]) to anon, authenticated;
grant execute on function public.save_flash_family_week_scores(text, integer, integer[], integer[], integer[]) to anon, authenticated;
grant execute on function public.set_flash_family_current_week(text, integer) to anon, authenticated;

update public.leagues
set current_matchup_number = 0
where id = 'flash-family-season-1'
  and schedule_generated = false;

insert into public.flash_family_matchups (
  league_id, week, display_order, home_team_id, away_team_id
) values
  ('flash-family-season-1', 1, 1, 'daytona-torterras', 'dallas-disguises'),
  ('flash-family-season-1', 1, 2, 'kansas-krooks', 'stockholm-spin-cycles'),
  ('flash-family-season-1', 1, 3, 'south-jersey-hounds', 'san-francisco-soulfire'),
  ('flash-family-season-1', 1, 4, 'chicago-conkquerers', 'miami-dragapults'),
  ('flash-family-season-1', 1, 5, 'las-vegas-gatrs', 'massachusetts-midnight'),
  ('flash-family-season-1', 1, 6, 'north-carolina-ceruledge', 'sunnyshore-city-shelter'),
  ('flash-family-season-1', 1, 7, 'uconn-arcanines', 'boston-eeltics')
on conflict (league_id, week, display_order) do nothing;
