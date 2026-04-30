create table if not exists public.team_profiles (
  team_id text primary key,
  team_name text not null default '',
  owner_name text not null default '',
  record text not null default '0-0',
  logo_url text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.team_profiles (team_id, team_name, owner_name, record, logo_url)
values
  ('team-1', 'Team 1', 'Owner Name', '0-0', ''),
  ('team-2', 'Team 2', 'Owner Name', '0-0', ''),
  ('team-3', 'Team 3', 'Owner Name', '0-0', ''),
  ('team-4', 'Team 4', 'Owner Name', '0-0', ''),
  ('team-5', 'Team 5', 'Owner Name', '0-0', ''),
  ('team-6', 'Team 6', 'Owner Name', '0-0', ''),
  ('team-7', 'Team 7', 'Owner Name', '0-0', ''),
  ('team-8', 'Team 8', 'Owner Name', '0-0', ''),
  ('team-9', 'Team 9', 'Owner Name', '0-0', ''),
  ('team-10', 'Team 10', 'Owner Name', '0-0', ''),
  ('team-11', 'Team 11', 'Owner Name', '0-0', ''),
  ('team-12', 'Team 12', 'Owner Name', '0-0', '')
on conflict (team_id) do nothing;

update public.team_profiles
set logo_url = public.team_logos.logo_url
from public.team_logos
where public.team_profiles.team_id = public.team_logos.team_id;

alter table public.team_profiles enable row level security;

create policy "Anyone can read team profiles"
on public.team_profiles
for select
to anon
using (true);

create policy "Anyone can update team profiles for demo"
on public.team_profiles
for update
to anon
using (true)
with check (true);
