-- Protect the first roster slot in both standalone drops and add/drop swaps.
-- Patch only the waiver RPC, preserving its access, window, budget, and log logic.
do $$
declare
  definition text;
  anchor text := E'    if replacement_slot is null then\n      raise exception ''The Pokemon selected to drop is not on this roster'';\n    end if;';
begin
  select pg_get_functiondef('public.submit_flash_family_waiver(text,text,text,text,integer)'::regprocedure)
  into definition;
  if strpos(definition, anchor) = 0 then
    raise exception 'Waiver mascot guard could not be installed: expected roster check missing';
  end if;
  execute replace(definition, anchor, anchor || E'\n\n    if replacement_slot = (select min(slot_number) from public.team_rosters where league_id = league_key and team_id = p_team_id) then\n      raise exception ''Your team mascot cannot be dropped'';\n    end if;');
end;
$$;
