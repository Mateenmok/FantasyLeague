alter table public.leagues
  add column if not exists is_public boolean not null default false,
  add column if not exists public_description text not null default '',
  add column if not exists discord_url text not null default '';

alter table public.leagues
  drop constraint if exists leagues_public_description_length_check;

alter table public.leagues
  add constraint leagues_public_description_length_check
  check (char_length(public_description) <= 500);

alter table public.leagues
  drop constraint if exists leagues_discord_url_length_check;

alter table public.leagues
  add constraint leagues_discord_url_length_check
  check (char_length(discord_url) <= 300);

create index if not exists leagues_public_directory_idx
  on public.leagues (is_public, created_at desc)
  where is_public = true;
