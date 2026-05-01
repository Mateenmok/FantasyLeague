alter table public.leagues
add column if not exists draft_pick_seconds integer not null default 120;

alter table public.leagues
drop constraint if exists leagues_draft_pick_seconds_check;

alter table public.leagues
add constraint leagues_draft_pick_seconds_check
check (draft_pick_seconds between 15 and 600);
