do $migration$
declare
  function_signature text;
  function_definition text;
  updated_definition text;
begin
  foreach function_signature in array array[
    'public.submit_flash_family_waiver(text,text,text,text,integer)',
    'public.read_flash_family_trades(text)',
    'public.propose_flash_family_trade(text,text,text[],text[],integer,integer)',
    'public.respond_flash_family_trade(text,bigint,text)'
  ] loop
    select pg_get_functiondef(to_regprocedure(function_signature)) into function_definition;

    if position('LAVOLON' in function_definition) = 0 then
      updated_definition := replace(
        function_definition,
        'when ''NC50'' then ''north-carolina-ceruledge''',
        'when ''NC50'' then ''north-carolina-ceruledge''
    when ''LAVOLON'' then ''uconn-arcanines''
    when ''CLOUD'' then ''las-vegas-gatrs''
    when ''PANCHAM'' then ''kansas-krooks''
    when ''SWEDEN'' then ''stockholm-spin-cycles''
    when ''CHITOWN'' then ''chicago-conkquerers''
    when ''MVP'' then ''daytona-torterras''
    when ''MIMIC'' then ''dallas-disguises''
    when ''REGAL'' then ''south-jersey-hounds''
    when ''GIANT'' then ''san-francisco-soulfire'''
      );

      if updated_definition = function_definition then
        raise exception 'Could not extend access map for %', function_signature;
      end if;

      execute updated_definition;
    end if;
  end loop;

  select pg_get_functiondef(
    'public.submit_flash_family_pickem(text,integer,integer,text)'::regprocedure
  ) into function_definition;

  if position('LAVOLON' in function_definition) = 0 then
    updated_definition := replace(
      function_definition,
      '(''NC50'', ''shdwemp'', ''Shdwemp'')',
      '(''NC50'', ''shdwemp'', ''Shdwemp''),
    (''LAVOLON'', ''pin'', ''Pin''),
    (''CLOUD'', ''lio'', ''Lio''),
    (''PANCHAM'', ''narcotics'', ''Narcotics''),
    (''SWEDEN'', ''letsnot'', ''LetsNot''),
    (''CHITOWN'', ''chorizo'', ''Chorizo''),
    (''MVP'', ''flan'', ''FLan''),
    (''MIMIC'', ''kilan'', ''Kilan''),
    (''REGAL'', ''omen'', ''Omen''),
    (''GIANT'', ''norforil'', ''Norforil'')'
    );

    if updated_definition = function_definition then
      raise exception 'Could not extend the Flash Family Pick''ems access map';
    end if;

    execute updated_definition;
  end if;
end;
$migration$;

update public.league_teams
set owner_name = case id
    when 'uconn-arcanines' then 'Pin'
    when 'las-vegas-gatrs' then 'Lio'
    when 'kansas-krooks' then 'Narcotics'
    when 'stockholm-spin-cycles' then 'LetsNot'
    when 'chicago-conkquerers' then 'Chorizo'
    when 'daytona-torterras' then 'FLan'
    when 'dallas-disguises' then 'Kilan'
    when 'south-jersey-hounds' then 'Omen'
    when 'san-francisco-soulfire' then 'Norforil'
    else owner_name
  end,
  team_access_code = case id
    when 'uconn-arcanines' then 'LAVOLON'
    when 'las-vegas-gatrs' then 'CLOUD'
    when 'kansas-krooks' then 'PANCHAM'
    when 'stockholm-spin-cycles' then 'SWEDEN'
    when 'chicago-conkquerers' then 'CHITOWN'
    when 'daytona-torterras' then 'MVP'
    when 'dallas-disguises' then 'MIMIC'
    when 'south-jersey-hounds' then 'REGAL'
    when 'san-francisco-soulfire' then 'GIANT'
    else team_access_code
  end
where league_id = 'flash-family-season-1'
  and id in (
    'uconn-arcanines', 'las-vegas-gatrs', 'kansas-krooks',
    'stockholm-spin-cycles', 'chicago-conkquerers', 'daytona-torterras',
    'dallas-disguises', 'south-jersey-hounds', 'san-francisco-soulfire'
  );
