begin;
-- PREP is a read-only tool route, never a guest, team, or admin identity.
do $$
declare definition text;
begin
  lock table public.flash_family_guest_accounts in share row exclusive mode;
  if exists(select 1 from public.flash_family_guest_accounts where access_code='PREP') then
    raise exception 'PREP already belongs to a guest; do not replace their sign-in';
  end if;
  select pg_get_functiondef('public.register_flash_family_guest(text,text)'::regprocedure) into definition;
  if position($marker$'GUEST1','GUEST','ADMIN'$marker$ in definition)=0 then
    raise exception 'Unexpected guest registration function; aborting';
  end if;
  execute replace(definition,$marker$'GUEST1','GUEST','ADMIN'$marker$,$marker$'GUEST1','GUEST','PREP','ADMIN'$marker$);
  -- Also prevent an already-running older registration call from claiming it.
  alter table public.flash_family_guest_accounts add constraint guest_prep_code_reserved check(access_code<>'PREP');
end $$;
commit;
