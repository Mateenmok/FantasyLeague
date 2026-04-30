create table if not exists public.team_logos (
  team_id text primary key,
  logo_url text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.team_logos (team_id, logo_url)
values
  ('team-1', ''),
  ('team-2', ''),
  ('team-3', ''),
  ('team-4', ''),
  ('team-5', ''),
  ('team-6', ''),
  ('team-7', ''),
  ('team-8', ''),
  ('team-9', ''),
  ('team-10', ''),
  ('team-11', ''),
  ('team-12', '')
on conflict (team_id) do nothing;

alter table public.team_logos enable row level security;

create policy "Anyone can read team logos"
on public.team_logos
for select
to anon
using (true);

create policy "Anyone can update team logos for demo"
on public.team_logos
for update
to anon
using (true)
with check (true);
