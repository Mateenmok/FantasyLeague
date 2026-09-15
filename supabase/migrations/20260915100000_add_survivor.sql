-- Survivor picks stay private until the week ends. All access goes through RPCs.
create table public.flash_family_survivor_picks (
  league_id text not null references public.leagues(id) on delete cascade,
  account_id text not null,
  username text not null,
  week integer not null check (week between 1 and 52),
  picked_team_id text not null,
  updated_at timestamptz not null default now(),
  primary key (league_id, account_id, week),
  unique (league_id, account_id, picked_team_id)
);
alter table public.flash_family_survivor_picks enable row level security;
revoke all on public.flash_family_survivor_picks from public, anon, authenticated;

create function public.flash_family_survivor_account(p_access_code text)
returns table(account_id text, username text) language sql stable set search_path = public as $$
  select a.account_id, a.username from (values
    ('PUFF1','pufferz','Pufferz'), ('NETO','neto','FLash'),
    ('MOON4','kirbbles','Kirbbles'), ('FORMIDABLE','fear','Fear'),
    ('NC50','shdwemp','Shdwemp'), ('LAVOLON','pin','Pin'),
    ('CLOUD','lio','Lio'), ('PANCHAM','narcotics','Narcotics'),
    ('SWEDEN','letsnot','LetsNot'), ('CHITOWN','chorizo','Chorizo'),
    ('MVP','flan','FLan'), ('MIMIC','kilan','Kilan'),
    ('REGAL','omen','Omen'), ('GIANT','norforil','Norforil')
  ) a(code,account_id,username) where a.code = upper(trim(coalesce(p_access_code,'')));
$$;
revoke all on function public.flash_family_survivor_account(text) from public, anon, authenticated;

create function public.flash_family_survivor_week_ended(p_week integer)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.flash_family_matchups where league_id='flash-family-season-1' and week=p_week)
    and (p_week < (select greatest(current_matchup_number,1) from public.leagues where id='flash-family-season-1')
      or not exists (select 1 from public.flash_family_matchups where league_id='flash-family-season-1' and week=p_week
        and (home_score is null or away_score is null)));
$$;
revoke all on function public.flash_family_survivor_week_ended(integer) from public, anon, authenticated;

create function public.submit_flash_family_survivor(p_access_code text, p_week integer, p_team_id text)
returns void language plpgsql security definer set search_path = public as $$
declare picker record; active_week integer; deadline timestamptz;
begin
  select * into picker from public.flash_family_survivor_account(p_access_code);
  if picker.account_id is null then raise exception 'Sign in with a league access code to play Survivor'; end if;
  select greatest(current_matchup_number,1), waiver_window_end_at into active_week,deadline
  from public.leagues where id='flash-family-season-1' for update;
  if p_week is distinct from active_week then raise exception 'Survivor picks are only open for the active week'; end if;
  if (deadline is not null and now() >= deadline) or exists (
    select 1 from public.flash_family_matchups where league_id='flash-family-season-1' and week=p_week
      and (home_score is not null or away_score is not null)
  ) then raise exception 'Survivor picks are locked for this week'; end if;
  if p_team_id is null or not exists (select 1 from public.flash_family_matchups
    where league_id='flash-family-season-1' and week=p_week and p_team_id in (home_team_id,away_team_id))
  then raise exception 'Choose a team playing in this week''s matchups'; end if;
  if exists (select 1 from public.flash_family_survivor_picks where league_id='flash-family-season-1'
    and account_id=picker.account_id and picked_team_id=p_team_id and week<>p_week)
  then raise exception 'You have already used this team in Survivor'; end if;
  insert into public.flash_family_survivor_picks(league_id,account_id,username,week,picked_team_id)
  values ('flash-family-season-1',picker.account_id,picker.username,p_week,p_team_id)
  on conflict (league_id,account_id,week) do update
    set picked_team_id=excluded.picked_team_id,username=excluded.username,updated_at=now();
end;
$$;
revoke all on function public.submit_flash_family_survivor(text,integer,text) from public;
grant execute on function public.submit_flash_family_survivor(text,integer,text) to anon, authenticated;

create function public.read_flash_family_survivor(p_access_code text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare picker record; active_week integer; deadline timestamptz; result jsonb;
begin
  select * into picker from public.flash_family_survivor_account(p_access_code);
  select greatest(current_matchup_number,1),waiver_window_end_at into active_week,deadline
  from public.leagues where id='flash-family-season-1';
  with weeks as (
    select distinct week from public.flash_family_matchups
    where league_id='flash-family-season-1' and week<=active_week and public.flash_family_survivor_week_ended(week)
  ), entries as (
    select account_id,max(username) as username from public.flash_family_survivor_picks
    where league_id='flash-family-season-1' and week<=active_week group by account_id
  ), history as (
    select e.account_id,e.username,w.week,p.picked_team_id,
      case when p.account_id is null then 'missed'
        when m.home_score is null or m.away_score is null or m.home_score=m.away_score then 'pending'
        when p.picked_team_id=case when m.home_score>m.away_score then m.home_team_id else m.away_team_id end then 'correct'
        else 'incorrect' end as outcome
    from entries e cross join weeks w
    left join public.flash_family_survivor_picks p on p.league_id='flash-family-season-1' and p.account_id=e.account_id and p.week=w.week
    left join public.flash_family_matchups m on m.league_id='flash-family-season-1' and m.week=w.week and p.picked_team_id in (m.home_team_id,m.away_team_id)
  ), contestants as (
    select e.account_id,e.username,min(h.week) filter(where h.outcome in ('missed','incorrect')) as eliminated_week
    from entries e left join history h on h.account_id=e.account_id group by e.account_id,e.username
  )
  select jsonb_build_object(
    'week',active_week,'deadline',deadline,'server_now',now(),
    'account_id',picker.account_id,'username',picker.username,
    'locked',(deadline is not null and now()>=deadline) or exists(select 1 from public.flash_family_matchups where league_id='flash-family-season-1' and week=active_week and (home_score is not null or away_score is not null)),
    'ended_weeks',coalesce((select jsonb_agg(week order by week desc) from weeks),'[]'::jsonb),
    'contestants',coalesce((select jsonb_agg(to_jsonb(c) order by c.username) from contestants c),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.week desc,h.username) from history h),'[]'::jsonb),
    'own_picks',coalesce((select jsonb_agg(jsonb_build_object('week',p.week,'picked_team_id',p.picked_team_id) order by p.week) from public.flash_family_survivor_picks p where p.league_id='flash-family-season-1' and p.account_id=picker.account_id and p.week<=active_week),'[]'::jsonb),
    'matchups',coalesce((select jsonb_agg(jsonb_build_object('home_team_id',m.home_team_id,'away_team_id',m.away_team_id) order by m.display_order) from public.flash_family_matchups m where m.league_id='flash-family-season-1' and m.week=active_week),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.read_flash_family_survivor(text) from public;
grant execute on function public.read_flash_family_survivor(text) to anon, authenticated;

-- A commissioner rewind reopens the prior week and discards future entries.
-- Survival is derived from scores, so score corrections/undo restore it naturally.
create function public.rewind_flash_family_survivor() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.id='flash-family-season-1' and new.current_matchup_number<old.current_matchup_number then
    delete from public.flash_family_survivor_picks where league_id=new.id and week>greatest(new.current_matchup_number,1);
  end if;
  return new;
end;
$$;
revoke all on function public.rewind_flash_family_survivor() from public,anon,authenticated;
create trigger rewind_flash_family_survivor after update of current_matchup_number on public.leagues
for each row execute function public.rewind_flash_family_survivor();
