alter table public.leagues
add column if not exists logo_url text not null default '';
