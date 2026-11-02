begin;

-- Season1 opens the Season 2 workspace; it is never a live league identity.
do $$
declare definition text;
begin
  lock table public.flash_family_guest_accounts in share row exclusive mode;
  if exists(select 1 from public.flash_family_guest_accounts where access_code = 'SEASON1')
    or exists(select 1 from public.league_teams where upper(trim(team_access_code)) = 'SEASON1') then
    raise exception 'Season1 already belongs to an account; do not replace its sign-in';
  end if;
  select pg_get_functiondef('public.register_flash_family_guest(text,text)'::regprocedure) into definition;
  if position($marker$'GUEST1','GUEST','PREP','ADMIN'$marker$ in definition) = 0 then
    raise exception 'Unexpected guest registration function; aborting';
  end if;
  execute replace(definition,
    $marker$'GUEST1','GUEST','PREP','ADMIN'$marker$,
    $marker$'GUEST1','GUEST','PREP','SEASON1','ADMIN'$marker$);
  alter table public.flash_family_guest_accounts
    add constraint guest_season_two_workspace_code_reserved check (access_code <> 'SEASON1');
end $$;

commit;
