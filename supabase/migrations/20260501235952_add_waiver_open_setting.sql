alter table public.leagues
add column if not exists waiver_open boolean not null default false;
