create table if not exists public.league_divisions (
  id text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  division_number int not null check (division_number in (1, 2)),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (league_id, division_number)
);

alter table public.league_teams
add column if not exists division_id text references public.league_divisions(id) on delete set null;

alter table public.league_divisions enable row level security;

grant select, insert, update, delete on public.league_divisions to authenticated;

drop policy if exists "Authenticated users can read league divisions" on public.league_divisions;
drop policy if exists "Authenticated users can create league divisions" on public.league_divisions;
drop policy if exists "Authenticated users can update league divisions" on public.league_divisions;
drop policy if exists "Authenticated users can delete league divisions" on public.league_divisions;

create policy "Authenticated users can read league divisions"
on public.league_divisions
for select
to authenticated
using (true);

create policy "Authenticated users can create league divisions"
on public.league_divisions
for insert
to authenticated
with check (true);

create policy "Authenticated users can update league divisions"
on public.league_divisions
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete league divisions"
on public.league_divisions
for delete
to authenticated
using (true);
