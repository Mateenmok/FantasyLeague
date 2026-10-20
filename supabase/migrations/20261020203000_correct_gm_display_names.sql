-- Display-name corrections only. Keep legacy account IDs, codes, picks and scores.
begin;

do $$
declare
  signature text;
  definition text;
  table_name text;
  before_rows jsonb;
  after_rows jsonb;
begin
  foreach signature in array array[
    'public.submit_flash_family_pickem(text,integer,integer,text)',
    'public.flash_family_survivor_account(text)'
  ] loop
    select pg_get_functiondef(signature::regprocedure) into definition;
    definition := replace(replace(definition, quote_literal('Kilan'), quote_literal('kilain')),
      quote_literal('Norforil'), quote_literal('norfiril'));
    if position(quote_literal('kilain') in definition)=0
      or position(quote_literal('norfiril') in definition)=0 then
      raise exception 'Unexpected GM name mapping in %; no changes applied', signature;
    end if;
    execute definition;
  end loop;

  update public.league_teams set owner_name = case id
    when 'dallas-disguises' then 'kilain'
    when 'san-francisco-soulfire' then 'norfiril'
  end
  where league_id='flash-family-season-1'
    and id in ('dallas-disguises','san-francisco-soulfire');

  foreach table_name in array array[
    'flash_family_pickems', 'flash_family_pickem_score_baselines',
    'flash_family_survivor_picks', 'flash_family_survivor_missed_week_exemptions'
  ] loop
    execute format('select jsonb_agg(to_jsonb(r)-''username'' order by (to_jsonb(r)-''username'')::text)
      from public.%I r where league_id=$1 and account_id in (''kilan'',''norforil'')', table_name)
      into before_rows using 'flash-family-season-1';
    execute format('update public.%I set username=case account_id
      when ''kilan'' then ''kilain'' when ''norforil'' then ''norfiril'' end
      where league_id=$1 and account_id in (''kilan'',''norforil'')', table_name)
      using 'flash-family-season-1';
    execute format('select jsonb_agg(to_jsonb(r)-''username'' order by (to_jsonb(r)-''username'')::text)
      from public.%I r where league_id=$1 and account_id in (''kilan'',''norforil'')', table_name)
      into after_rows using 'flash-family-season-1';
    if before_rows is distinct from after_rows then
      raise exception 'Non-name data changed in %; rolling back', table_name;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
