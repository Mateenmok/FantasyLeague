do $migration$
declare
  function_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.submit_flash_family_waiver(text,text,text,text,integer)'::regprocedure
  ) into function_definition;

  if position('NC50' in function_definition) = 0 then
    updated_definition := replace(
      function_definition,
      'when ''FORMIDABLE'' then ''sunnyshore-city-shelter''',
      'when ''FORMIDABLE'' then ''sunnyshore-city-shelter''
    when ''NC50'' then ''north-carolina-ceruledge'''
    );

    if updated_definition = function_definition then
      raise exception 'Could not extend the Flash Family waiver access map';
    end if;

    execute updated_definition;
  end if;
end;
$migration$;
