create table if not exists public.league_trade_offers (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  sender_team_id text not null references public.league_teams(id) on delete cascade,
  receiver_team_id text not null references public.league_teams(id) on delete cascade,
  offered_pokemon_slug text not null,
  requested_pokemon_slug text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,

  check (sender_team_id <> receiver_team_id),
  check (offered_pokemon_slug <> requested_pokemon_slug)
);

alter table public.league_trade_offers enable row level security;

grant select, insert, update, delete on public.league_trade_offers to authenticated;

drop policy if exists "Authenticated users can read trade offers" on public.league_trade_offers;
drop policy if exists "Authenticated users can create trade offers" on public.league_trade_offers;
drop policy if exists "Authenticated users can update trade offers" on public.league_trade_offers;
drop policy if exists "Authenticated users can delete trade offers" on public.league_trade_offers;

create policy "Authenticated users can read trade offers"
on public.league_trade_offers
for select
to authenticated
using (true);

create policy "Authenticated users can create trade offers"
on public.league_trade_offers
for insert
to authenticated
with check (true);

create policy "Authenticated users can update trade offers"
on public.league_trade_offers
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete trade offers"
on public.league_trade_offers
for delete
to authenticated
using (true);

create or replace function public.accept_trade_offer_as_manager(p_trade_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer record;
  v_offered_roster record;
  v_requested_roster record;
begin
  select *
  into v_offer
  from public.league_trade_offers
  where id = p_trade_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Trade offer not found or no longer pending';
  end if;

  if not exists (
    select 1
    from public.league_memberships
    where league_id = v_offer.league_id
      and user_id = auth.uid()
      and (
        league_team_id = v_offer.receiver_team_id
        or role = 'admin'
      )
  ) then
    raise exception 'Only the receiving manager or an admin can accept this trade';
  end if;

  select id, slot_number
  into v_offered_roster
  from public.team_rosters
  where league_id = v_offer.league_id
    and team_id = v_offer.sender_team_id
    and pokemon_slug = v_offer.offered_pokemon_slug
  for update;

  if not found then
    raise exception 'Offered Pokémon is no longer on the sender roster';
  end if;

  select id, slot_number
  into v_requested_roster
  from public.team_rosters
  where league_id = v_offer.league_id
    and team_id = v_offer.receiver_team_id
    and pokemon_slug = v_offer.requested_pokemon_slug
  for update;

  if not found then
    raise exception 'Requested Pokémon is no longer on the receiver roster';
  end if;

  update public.team_rosters
  set
    team_id = v_offer.receiver_team_id,
    slot_number = v_requested_roster.slot_number
  where id = v_offered_roster.id;

  update public.team_rosters
  set
    team_id = v_offer.sender_team_id,
    slot_number = v_offered_roster.slot_number
  where id = v_requested_roster.id;

  update public.league_trade_offers
  set
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  where id = v_offer.id;

  update public.league_trade_offers
  set
    status = 'cancelled',
    updated_at = now()
  where league_id = v_offer.league_id
    and status = 'pending'
    and id <> v_offer.id
    and (
      offered_pokemon_slug in (v_offer.offered_pokemon_slug, v_offer.requested_pokemon_slug)
      or requested_pokemon_slug in (v_offer.offered_pokemon_slug, v_offer.requested_pokemon_slug)
    );
end;
$$;

grant execute on function public.accept_trade_offer_as_manager(text) to authenticated;
