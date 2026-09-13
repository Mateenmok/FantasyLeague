create table if not exists public.flash_family_draft_pool (
  pokemon_slug text primary key,
  pokemon_name text not null,
  point_value integer not null check (point_value between 1 and 10)
);

insert into public.flash_family_draft_pool (pokemon_slug, pokemon_name, point_value)
values
  ('basculegion', 'Basculegion', 10),
  ('charizard', 'Charizard', 10),
  ('eternal-floette', 'Eternal Floette', 10),
  ('garchomp', 'Garchomp', 10),
  ('metagross', 'Metagross', 10),
  ('salamence', 'Salamence', 10),
  ('sneasler', 'Sneasler', 10),
  ('staraptor', 'Staraptor', 10),
  ('aerodactyl', 'Aerodactyl', 9),
  ('archaludon', 'Archaludon', 9),
  ('farigiraf', 'Farigiraf', 9),
  ('gengar', 'Gengar', 9),
  ('gholdengo', 'Gholdengo', 9),
  ('grimmsnarl', 'Grimmsnarl', 9),
  ('incineroar', 'Incineroar', 9),
  ('indeedee', 'Indeedee', 9),
  ('kangaskhan', 'Kangaskhan', 9),
  ('kingambit', 'Kingambit', 9),
  ('pelipper', 'Pelipper', 9),
  ('raichu', 'Raichu', 9),
  ('rillaboom', 'Rillaboom', 9),
  ('sableye', 'Sableye', 9),
  ('sinistcha', 'Sinistcha', 9),
  ('swampert', 'Swampert', 9),
  ('tyranitar', 'Tyranitar', 9),
  ('whimsicott', 'Whimsicott', 9),
  ('annihilape', 'Annihilape', 8),
  ('baxcalibur', 'Baxcalibur', 8),
  ('blastoise', 'Blastoise', 8),
  ('blaziken', 'Blaziken', 8),
  ('delphox', 'Delphox', 8),
  ('dragonite', 'Dragonite', 8),
  ('froslass', 'Froslass', 8),
  ('gardevoir', 'Gardevoir', 8),
  ('glimmora', 'Glimmora', 8),
  ('golisopod', 'Golisopod', 8),
  ('lucario', 'Lucario', 8),
  ('maushold', 'Maushold', 8),
  ('mawile', 'Mawile', 8),
  ('politoed', 'Politoed', 8),
  ('sylveon', 'Sylveon', 8),
  ('talonflame', 'Talonflame', 8),
  ('torkoal', 'Torkoal', 8),
  ('venusaur', 'Venusaur', 8),
  ('absol', 'Absol', 7),
  ('aegislash', 'Aegislash', 7),
  ('alolan-ninetales', 'Alolan Ninetales', 7),
  ('armarouge', 'Armarouge', 7),
  ('clefable', 'Clefable', 7),
  ('corviknight', 'Corviknight', 7),
  ('dragapult', 'Dragapult', 7),
  ('excadrill', 'Excadrill', 7),
  ('gyarados', 'Gyarados', 7),
  ('hatterene', 'Hatterene', 7),
  ('hisuian-arcanine', 'Hisuian Arcanine', 7),
  ('hydreigon', 'Hydreigon', 7),
  ('kommo-o', 'Kommo-o', 7),
  ('lopunny', 'Lopunny', 7),
  ('meowscarada', 'Meowscarada', 7),
  ('milotic', 'Milotic', 7),
  ('primarina', 'Primarina', 7),
  ('rotom-wash', 'Rotom-Wash', 7),
  ('scizor', 'Scizor', 7),
  ('scovillain', 'Scovillain', 7),
  ('vivillon', 'Vivillon', 7),
  ('aggron', 'Aggron', 6),
  ('alakazam', 'Alakazam', 6),
  ('arcanine', 'Arcanine', 6),
  ('ceruledge', 'Ceruledge', 6),
  ('feraligatr', 'Feraligatr', 6),
  ('greninja', 'Greninja', 6),
  ('hisuian-typhlosion', 'Hisuian Typhlosion', 6),
  ('hisuian-zoroark', 'Hisuian Zoroark', 6),
  ('houndstone', 'Houndstone', 6),
  ('klefki', 'Klefki', 6),
  ('meowstic', 'Meowstic', 6),
  ('oranguru', 'Oranguru', 6),
  ('pawmot', 'Pawmot', 6),
  ('pyroar', 'Pyroar', 6),
  ('rotom-heat', 'Rotom-Heat', 6),
  ('sceptile', 'Sceptile', 6),
  ('scrafty', 'Scrafty', 6),
  ('starmie', 'Starmie', 6),
  ('tauros-aqua', 'Tauros-Aqua', 6),
  ('tinkaton', 'Tinkaton', 6),
  ('tsareena', 'Tsareena', 6),
  ('volcarona', 'Volcarona', 6),
  ('weavile', 'Weavile', 6),
  ('chandelure', 'Chandelure', 5),
  ('cinderace', 'Cinderace', 5),
  ('crabominable', 'Crabominable', 5),
  ('empoleon', 'Empoleon', 5),
  ('espathra', 'Espathra', 5),
  ('gallade', 'Gallade', 5),
  ('golurk', 'Golurk', 5),
  ('hawlucha', 'Hawlucha', 5),
  ('hisuian-goodra', 'Hisuian Goodra', 5),
  ('infernape', 'Infernape', 5),
  ('krookodile', 'Krookodile', 5),
  ('liepard', 'Liepard', 5),
  ('mamoswine', 'Mamoswine', 5),
  ('meganium', 'Meganium', 5),
  ('mimikyu', 'Mimikyu', 5),
  ('palafin', 'Palafin', 5),
  ('rotom-frost', 'Rotom-Frost', 5),
  ('sharpedo', 'Sharpedo', 5),
  ('tauros-blaze', 'Tauros-Blaze', 5),
  ('vileplume', 'Vileplume', 5),
  ('altaria', 'Altaria', 4),
  ('ampharos', 'Ampharos', 4),
  ('araquanid', 'Araquanid', 4),
  ('azumarill', 'Azumarill', 4),
  ('bellibolt', 'Bellibolt', 4),
  ('camerupt', 'Camerupt', 4),
  ('chesnaught', 'Chesnaught', 4),
  ('dragalge', 'Dragalge', 4),
  ('drampa', 'Drampa', 4),
  ('eelektross', 'Eelektross', 4),
  ('falinks', 'Falinks', 4),
  ('galarian-slowking', 'Galarian Slowking', 4),
  ('gliscor', 'Gliscor', 4),
  ('heliolisk', 'Heliolisk', 4),
  ('hisuian-decidueye', 'Hisuian Decidueye', 4),
  ('hisuian-samurott', 'Hisuian Samurott', 4),
  ('inteleon', 'Inteleon', 4),
  ('kleavor', 'Kleavor', 4),
  ('lycanroc', 'Lycanroc', 4),
  ('manectric', 'Manectric', 4),
  ('noivern', 'Noivern', 4),
  ('rotom-mow', 'Rotom-Mow', 4),
  ('skarmory', 'Skarmory', 4),
  ('slowbro', 'Slowbro', 4),
  ('snorlax', 'Snorlax', 4),
  ('steelix', 'Steelix', 4),
  ('toxapex', 'Toxapex', 4),
  ('toxtricity', 'Toxtricity', 4),
  ('umbreon', 'Umbreon', 4),
  ('alolan-raichu', 'Alolan Raichu', 3),
  ('arboliva', 'Arboliva', 3),
  ('banette', 'Banette', 3),
  ('conkeldurr', 'Conkeldurr', 3),
  ('galarian-slowbro', 'Galarian Slowbro', 3),
  ('goodra', 'Goodra', 3),
  ('hippowdon', 'Hippowdon', 3),
  ('jolteon', 'Jolteon', 3),
  ('malamar', 'Malamar', 3),
  ('medicham', 'Medicham', 3),
  ('mudsdale', 'Mudsdale', 3),
  ('ninetales', 'Ninetales', 3),
  ('orthworm', 'Orthworm', 3),
  ('overqwil', 'Overqwil', 3),
  ('persian-alola', 'Persian-Alola', 3),
  ('rampardos', 'Rampardos', 3),
  ('rotom-fan', 'Rotom-Fan', 3),
  ('runerigus', 'Runerigus', 3),
  ('scolipede', 'Scolipede', 3),
  ('spiritomb', 'Spiritomb', 3),
  ('tauros-combat', 'Tauros-Combat', 3),
  ('toxicroak', 'Toxicroak', 3),
  ('vanilluxe', 'Vanilluxe', 3),
  ('zoroark', 'Zoroark', 3),
  ('abomasnow', 'Abomasnow', 2),
  ('alcremie', 'Alcremie', 2),
  ('ariados', 'Ariados', 2),
  ('aurorus', 'Aurorus', 2),
  ('barbaracle', 'Barbaracle', 2),
  ('beartic', 'Beartic', 2),
  ('beedrill', 'Beedrill', 2),
  ('cofagrigus', 'Cofagrigus', 2),
  ('ditto', 'Ditto', 2),
  ('espeon', 'Espeon', 2),
  ('florges', 'Florges', 2),
  ('garganacl', 'Garganacl', 2),
  ('gogoat', 'Gogoat', 2),
  ('heracross', 'Heracross', 2),
  ('houndoom', 'Houndoom', 2),
  ('mr-mime', 'Mr. Mime', 2),
  ('mr-rime', 'Mr. Rime', 2),
  ('musharna', 'Musharna', 2),
  ('perrserker', 'Perrserker', 2),
  ('pincurchin', 'Pincurchin', 2),
  ('pinsir', 'Pinsir', 2),
  ('polteageist', 'Polteageist', 2),
  ('quaquaval', 'Quaquaval', 2),
  ('qwilfish', 'Qwilfish', 2),
  ('reuniclus', 'Reuniclus', 2),
  ('rhyperior', 'Rhyperior', 2),
  ('sirfetch-d', 'Sirfetch''d', 2),
  ('slowking', 'Slowking', 2),
  ('squawkabilly', 'Squawkabilly', 2),
  ('toucannon', 'Toucannon', 2),
  ('trevenant', 'Trevenant', 2),
  ('victreebel', 'Victreebel', 2),
  ('watchog', 'Watchog', 2),
  ('wigglytuff', 'Wigglytuff', 2),
  ('wyrdeer', 'Wyrdeer', 2),
  ('appletun', 'Appletun', 1),
  ('arbok', 'Arbok', 1),
  ('aromatisse', 'Aromatisse', 1),
  ('audino', 'Audino', 1),
  ('avalugg', 'Avalugg', 1),
  ('bastiodon', 'Bastiodon', 1),
  ('castform', 'Castform', 1),
  ('chimecho', 'Chimecho', 1),
  ('clawitzer', 'Clawitzer', 1),
  ('decidueye', 'Decidueye', 1),
  ('dedenne', 'Dedenne', 1),
  ('diggersby', 'Diggersby', 1),
  ('emboar', 'Emboar', 1),
  ('emolga', 'Emolga', 1),
  ('farfetch-d', 'Farfetch''d', 1),
  ('flapple', 'Flapple', 1),
  ('flareon', 'Flareon', 1),
  ('forretress', 'Forretress', 1),
  ('furfrou', 'Furfrou', 1),
  ('galarian-stunfisk', 'Galarian Stunfisk', 1),
  ('garbodor', 'Garbodor', 1),
  ('glaceon', 'Glaceon', 1),
  ('glalie', 'Glalie', 1),
  ('gourgeist', 'Gourgeist', 1),
  ('grapploct', 'Grapploct', 1),
  ('hisuian-avalugg', 'Hisuian Avalugg', 1),
  ('hydrapple', 'Hydrapple', 1),
  ('leafeon', 'Leafeon', 1),
  ('luxray', 'Luxray', 1),
  ('mabosstiff', 'Mabosstiff', 1),
  ('machamp', 'Machamp', 1),
  ('morpeko', 'Morpeko', 1),
  ('pangoro', 'Pangoro', 1),
  ('passimian', 'Passimian', 1),
  ('persian', 'Persian', 1),
  ('pidgeot', 'Pidgeot', 1),
  ('pikachu', 'Pikachu', 1),
  ('roserade', 'Roserade', 1),
  ('rotom', 'Rotom', 1),
  ('salazzle', 'Salazzle', 1),
  ('samurott', 'Samurott', 1),
  ('sandaconda', 'Sandaconda', 1),
  ('serperior', 'Serperior', 1),
  ('simipour', 'Simipour', 1),
  ('simisage', 'Simisage', 1),
  ('simisear', 'Simisear', 1),
  ('skeledirge', 'Skeledirge', 1),
  ('slurpuff', 'Slurpuff', 1),
  ('stunfisk', 'Stunfisk', 1),
  ('swalot', 'Swalot', 1),
  ('tauros', 'Tauros', 1),
  ('thievul', 'Thievul', 1),
  ('torterra', 'Torterra', 1),
  ('typhlosion', 'Typhlosion', 1),
  ('tyrantrum', 'Tyrantrum', 1),
  ('vaporeon', 'Vaporeon', 1)
on conflict (pokemon_slug) do update
set pokemon_name = excluded.pokemon_name,
    point_value = excluded.point_value;

create table if not exists public.flash_family_draft_rooms (
  room_key text primary key check (room_key in ('main', 'test')),
  room_label text not null,
  scheduled_at timestamptz,
  pick_seconds integer not null default 90 check (pick_seconds between 15 and 600),
  is_started boolean not null default false,
  is_paused boolean not null default true,
  current_pick_started_at timestamptz,
  paused_seconds_remaining integer,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.flash_family_live_draft_picks (
  id bigint generated by default as identity primary key,
  room_key text not null references public.flash_family_draft_rooms(room_key) on delete cascade,
  overall_pick integer not null check (overall_pick > 0),
  round_number integer not null check (round_number between 1 and 9),
  team_id text not null references public.league_teams(id) on delete cascade,
  pokemon_slug text not null references public.flash_family_draft_pool(pokemon_slug),
  point_value integer not null check (point_value between 1 and 10),
  picked_by text not null,
  created_at timestamptz not null default now(),
  unique (room_key, overall_pick),
  unique (room_key, pokemon_slug)
);

alter table public.flash_family_draft_pool enable row level security;
alter table public.flash_family_draft_rooms enable row level security;
alter table public.flash_family_live_draft_picks enable row level security;

revoke all on public.flash_family_draft_pool from anon, authenticated;
revoke all on public.flash_family_draft_rooms from anon, authenticated;
revoke all on public.flash_family_live_draft_picks from anon, authenticated;

insert into public.flash_family_draft_rooms (
  room_key, room_label, scheduled_at, pick_seconds, is_started, is_paused
)
values
  ('main', 'MAIN DRAFT', '2026-09-13 23:00:00+00', 90, false, true),
  ('test', 'TEST DRAFT', null, 90, false, true)
on conflict (room_key) do update
set room_label = excluded.room_label,
    scheduled_at = excluded.scheduled_at;

create or replace function public.read_flash_family_live_draft(
  p_access_code text,
  p_room_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
  viewer_team text;
  viewer_admin boolean := false;
  draft_room public.flash_family_draft_rooms%rowtype;
  draft_picks jsonb;
begin
  if clean_room = 'main' then
    viewer_team := case clean_code
      when 'PUFF1' then 'boston-eeltics'
      when 'NETO' then 'miami-dragapults'
      when 'MOON4' then 'massachusetts-midnight'
      when 'FORMIDABLE' then 'sunnyshore-city-shelter'
      when 'NC50' then 'north-carolina-ceruledge'
      when 'LAVOLON' then 'uconn-arcanines'
      when 'CLOUD' then 'las-vegas-gatrs'
      when 'PANCHAM' then 'kansas-krooks'
      when 'SWEDEN' then 'stockholm-spin-cycles'
      when 'CHITOWN' then 'chicago-conkquerers'
      when 'MVP' then 'daytona-torterras'
      when 'MIMIC' then 'dallas-disguises'
      when 'REGAL' then 'south-jersey-hounds'
      when 'GIANT' then 'san-francisco-soulfire'
      else null
    end;
    viewer_admin := clean_code in ('PUFF1', 'NETO');
  elsif clean_room = 'test' then
    viewer_team := case clean_code
      when 'DRAFTTEST1' then 'boston-eeltics'
      when 'DRAFTTEST2' then 'massachusetts-midnight'
      when 'DRAFTTEST3' then 'miami-dragapults'
      when 'DRAFTTEST4' then 'north-carolina-ceruledge'
      else null
    end;
    viewer_admin := clean_code = 'DRAFTTEST1';
  else
    raise exception 'Unknown draft room';
  end if;

  if viewer_team is null then
    raise exception 'This access code cannot enter this draft room';
  end if;

  select * into draft_room
  from public.flash_family_draft_rooms
  where room_key = clean_room;

  if not found then
    raise exception 'Draft room unavailable';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'overallPick', overall_pick,
        'roundNumber', round_number,
        'teamId', team_id,
        'pokemonSlug', pokemon_slug,
        'pointValue', point_value,
        'pickedBy', picked_by,
        'createdAt', created_at
      )
      order by overall_pick
    ),
    '[]'::jsonb
  )
  into draft_picks
  from public.flash_family_live_draft_picks
  where room_key = clean_room;

  return jsonb_build_object(
    'serverNow', now(),
    'viewer', jsonb_build_object(
      'teamId', viewer_team,
      'isAdmin', viewer_admin
    ),
    'room', jsonb_build_object(
      'key', draft_room.room_key,
      'label', draft_room.room_label,
      'scheduledAt', draft_room.scheduled_at,
      'pickSeconds', draft_room.pick_seconds,
      'isStarted', draft_room.is_started,
      'isPaused', draft_room.is_paused,
      'currentPickStartedAt', draft_room.current_pick_started_at,
      'pausedSecondsRemaining', draft_room.paused_seconds_remaining,
      'revision', draft_room.revision,
      'updatedAt', draft_room.updated_at
    ),
    'picks', draft_picks
  );
end;
$$;

create or replace function public.submit_flash_family_live_draft_pick(
  p_access_code text,
  p_room_key text,
  p_pokemon_slug text,
  p_for_team_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
  clean_slug text := lower(trim(coalesce(p_pokemon_slug, '')));
  viewer_team text;
  viewer_admin boolean := false;
  participants text[];
  participant_count integer;
  draft_room public.flash_family_draft_rooms%rowtype;
  next_pick integer;
  next_round integer;
  pick_position integer;
  expected_team text;
  pokemon_points integer;
  roster_count integer;
  roster_points integer;
  seconds_left integer;
  mascot_slugs constant text[] := array[
    'torterra', 'krookodile', 'houndoom', 'conkeldurr', 'feraligatr',
    'ceruledge', 'hisuian-arcanine', 'eelektross', 'hisuian-goodra',
    'umbreon', 'dragapult', 'chandelure', 'rotom-wash', 'mimikyu'
  ];
begin
  if clean_room = 'main' then
    participants := array[
      'daytona-torterras', 'kansas-krooks', 'south-jersey-hounds',
      'chicago-conkquerers', 'las-vegas-gatrs', 'north-carolina-ceruledge',
      'uconn-arcanines', 'boston-eeltics', 'sunnyshore-city-shelter',
      'massachusetts-midnight', 'miami-dragapults', 'san-francisco-soulfire',
      'stockholm-spin-cycles', 'dallas-disguises'
    ];
    viewer_team := case clean_code
      when 'PUFF1' then 'boston-eeltics'
      when 'NETO' then 'miami-dragapults'
      when 'MOON4' then 'massachusetts-midnight'
      when 'FORMIDABLE' then 'sunnyshore-city-shelter'
      when 'NC50' then 'north-carolina-ceruledge'
      when 'LAVOLON' then 'uconn-arcanines'
      when 'CLOUD' then 'las-vegas-gatrs'
      when 'PANCHAM' then 'kansas-krooks'
      when 'SWEDEN' then 'stockholm-spin-cycles'
      when 'CHITOWN' then 'chicago-conkquerers'
      when 'MVP' then 'daytona-torterras'
      when 'MIMIC' then 'dallas-disguises'
      when 'REGAL' then 'south-jersey-hounds'
      when 'GIANT' then 'san-francisco-soulfire'
      else null
    end;
    viewer_admin := clean_code in ('PUFF1', 'NETO');
  elsif clean_room = 'test' then
    participants := array[
      'boston-eeltics', 'massachusetts-midnight',
      'miami-dragapults', 'north-carolina-ceruledge'
    ];
    viewer_team := case clean_code
      when 'DRAFTTEST1' then 'boston-eeltics'
      when 'DRAFTTEST2' then 'massachusetts-midnight'
      when 'DRAFTTEST3' then 'miami-dragapults'
      when 'DRAFTTEST4' then 'north-carolina-ceruledge'
      else null
    end;
    viewer_admin := clean_code = 'DRAFTTEST1';
  else
    raise exception 'Unknown draft room';
  end if;

  if viewer_team is null then
    raise exception 'This access code cannot enter this draft room';
  end if;

  select * into draft_room
  from public.flash_family_draft_rooms
  where room_key = clean_room
  for update;

  if not draft_room.is_started then
    raise exception 'The commissioner has not started this draft';
  end if;
  if draft_room.is_paused then
    raise exception 'The draft is paused';
  end if;
  if draft_room.scheduled_at is not null and now() < draft_room.scheduled_at then
    raise exception 'The scheduled draft time has not arrived';
  end if;

  participant_count := cardinality(participants);
  select count(*)::integer + 1 into next_pick
  from public.flash_family_live_draft_picks
  where room_key = clean_room;

  if next_pick > participant_count * 9 then
    raise exception 'The draft is complete';
  end if;

  next_round := ((next_pick - 1) / participant_count) + 1;
  pick_position := (next_pick - 1) % participant_count;
  if next_round % 2 = 1 then
    expected_team := participants[pick_position + 1];
  else
    expected_team := participants[participant_count - pick_position];
  end if;

  if viewer_admin then
    if p_for_team_id is not null and p_for_team_id <> expected_team then
      raise exception 'Admins can only submit the team currently on the clock';
    end if;
  elsif viewer_team <> expected_team then
    raise exception 'Your team is not on the clock';
  end if;

  seconds_left := greatest(
    0,
    draft_room.pick_seconds - floor(extract(epoch from (now() - draft_room.current_pick_started_at)))::integer
  );
  if seconds_left = 0 and not viewer_admin then
    raise exception 'Time expired. An admin must make this pick';
  end if;

  select point_value into pokemon_points
  from public.flash_family_draft_pool
  where pokemon_slug = clean_slug;

  if pokemon_points is null then
    raise exception 'This Pokemon is not in the league draft pool';
  end if;
  if clean_slug = any(mascot_slugs) then
    raise exception 'Team mascots are already rostered';
  end if;
  if exists (
    select 1 from public.flash_family_live_draft_picks
    where room_key = clean_room and pokemon_slug = clean_slug
  ) then
    raise exception 'That Pokemon has already been drafted';
  end if;

  if clean_room = 'main' then
    select count(*)::integer, coalesce(sum(pool.point_value), 0)::integer
    into roster_count, roster_points
    from public.team_rosters roster
    left join public.flash_family_draft_pool pool
      on pool.pokemon_slug = roster.pokemon_slug
    where roster.league_id = league_key
      and roster.team_id = expected_team;

    if roster_count >= 10 then
      raise exception 'That roster already has 10 Pokemon';
    end if;
    if roster_points + pokemon_points > 50 then
      raise exception 'That pick would exceed the 50-point roster cap';
    end if;
    if exists (
      select 1 from public.team_rosters
      where league_id = league_key and pokemon_slug = clean_slug
    ) then
      raise exception 'That Pokemon already belongs to another team';
    end if;
  else
    select coalesce(sum(point_value), 0)::integer
    into roster_points
    from (
      select pool.point_value
      from unnest(mascot_slugs) as mascot(pokemon_slug)
      join public.flash_family_draft_pool pool using (pokemon_slug)
      where mascot.pokemon_slug = (
        case expected_team
          when 'boston-eeltics' then 'eelektross'
          when 'massachusetts-midnight' then 'umbreon'
          when 'miami-dragapults' then 'dragapult'
          when 'north-carolina-ceruledge' then 'ceruledge'
        end
      )
      union all
      select point_value
      from public.flash_family_live_draft_picks
      where room_key = clean_room and team_id = expected_team
    ) team_points;

    if roster_points + pokemon_points > 50 then
      raise exception 'That pick would exceed the 50-point roster cap';
    end if;
  end if;

  insert into public.flash_family_live_draft_picks (
    room_key, overall_pick, round_number, team_id,
    pokemon_slug, point_value, picked_by
  )
  values (
    clean_room, next_pick, next_round, expected_team,
    clean_slug, pokemon_points, clean_code
  );

  if clean_room = 'main' then
    insert into public.team_rosters (
      league_id, team_id, pokemon_slug, slot_number, is_mascot
    )
    values (
      league_key,
      expected_team,
      clean_slug,
      coalesce((
        select max(slot_number) + 1
        from public.team_rosters
        where league_id = league_key and team_id = expected_team
      ), 1),
      false
    );
  end if;

  update public.flash_family_draft_rooms
  set current_pick_started_at = now(),
      paused_seconds_remaining = null,
      revision = revision + 1,
      updated_at = now()
  where room_key = clean_room;

  return jsonb_build_object(
    'overallPick', next_pick,
    'roundNumber', next_round,
    'teamId', expected_team,
    'pokemonSlug', clean_slug,
    'pointValue', pokemon_points
  );
end;
$$;

create or replace function public.control_flash_family_live_draft(
  p_access_code text,
  p_room_key text,
  p_action text,
  p_value integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league_key constant text := 'flash-family-season-1';
  clean_code text := upper(trim(coalesce(p_access_code, '')));
  clean_room text := lower(trim(coalesce(p_room_key, '')));
  clean_action text := lower(trim(coalesce(p_action, '')));
  draft_room public.flash_family_draft_rooms%rowtype;
  last_pick public.flash_family_live_draft_picks%rowtype;
  remaining integer;
begin
  if clean_room = 'main' and clean_code not in ('PUFF1', 'NETO') then
    raise exception 'Admin access required';
  elsif clean_room = 'test' and clean_code <> 'DRAFTTEST1' then
    raise exception 'Test draft controls belong to DraftTest1';
  elsif clean_room not in ('main', 'test') then
    raise exception 'Unknown draft room';
  end if;

  select * into draft_room
  from public.flash_family_draft_rooms
  where room_key = clean_room
  for update;

  if not found then
    raise exception 'Draft room unavailable';
  end if;

  if clean_action = 'start' then
    if draft_room.scheduled_at is not null and now() < draft_room.scheduled_at then
      raise exception 'The draft cannot start before Sunday, September 13 at 7:00 PM ET';
    end if;
    if not draft_room.is_started then
      update public.flash_family_draft_rooms
      set is_started = true,
          is_paused = false,
          current_pick_started_at = now(),
          paused_seconds_remaining = null,
          revision = revision + 1,
          updated_at = now()
      where room_key = clean_room;
    elsif draft_room.is_paused then
      remaining := coalesce(draft_room.paused_seconds_remaining, draft_room.pick_seconds);
      update public.flash_family_draft_rooms
      set is_paused = false,
          current_pick_started_at = now() - make_interval(secs => greatest(0, draft_room.pick_seconds - remaining)),
          paused_seconds_remaining = null,
          revision = revision + 1,
          updated_at = now()
      where room_key = clean_room;
    end if;
  elsif clean_action = 'pause' then
    if draft_room.is_started and not draft_room.is_paused then
      remaining := greatest(
        0,
        draft_room.pick_seconds - floor(extract(epoch from (now() - draft_room.current_pick_started_at)))::integer
      );
      update public.flash_family_draft_rooms
      set is_paused = true,
          paused_seconds_remaining = remaining,
          revision = revision + 1,
          updated_at = now()
      where room_key = clean_room;
    end if;
  elsif clean_action = 'resume' then
    if not draft_room.is_started then
      raise exception 'Start the draft first';
    end if;
    if draft_room.is_paused then
      remaining := coalesce(draft_room.paused_seconds_remaining, draft_room.pick_seconds);
      update public.flash_family_draft_rooms
      set is_paused = false,
          current_pick_started_at = now() - make_interval(secs => greatest(0, draft_room.pick_seconds - remaining)),
          paused_seconds_remaining = null,
          revision = revision + 1,
          updated_at = now()
      where room_key = clean_room;
    end if;
  elsif clean_action = 'set_timer' then
    if p_value is null or p_value < 15 or p_value > 600 then
      raise exception 'Timer must be between 15 and 600 seconds';
    end if;
    update public.flash_family_draft_rooms
    set pick_seconds = p_value,
        current_pick_started_at = case when is_started and not is_paused then now() else current_pick_started_at end,
        paused_seconds_remaining = case when is_paused then p_value else null end,
        revision = revision + 1,
        updated_at = now()
    where room_key = clean_room;
  elsif clean_action = 'undo' then
    select * into last_pick
    from public.flash_family_live_draft_picks
    where room_key = clean_room
    order by overall_pick desc
    limit 1
    for update;

    if not found then
      raise exception 'There are no picks to undo';
    end if;

    delete from public.flash_family_live_draft_picks
    where id = last_pick.id;

    if clean_room = 'main' then
      delete from public.team_rosters
      where league_id = league_key
        and team_id = last_pick.team_id
        and pokemon_slug = last_pick.pokemon_slug;
    end if;

    update public.flash_family_draft_rooms
    set current_pick_started_at = case when is_started and not is_paused then now() else current_pick_started_at end,
        paused_seconds_remaining = case when is_paused then pick_seconds else null end,
        revision = revision + 1,
        updated_at = now()
    where room_key = clean_room;
  else
    raise exception 'Unknown draft control';
  end if;
end;
$$;

revoke all on function public.read_flash_family_live_draft(text, text) from public;
revoke all on function public.submit_flash_family_live_draft_pick(text, text, text, text) from public;
revoke all on function public.control_flash_family_live_draft(text, text, text, integer) from public;

grant execute on function public.read_flash_family_live_draft(text, text) to anon, authenticated;
grant execute on function public.submit_flash_family_live_draft_pick(text, text, text, text) to anon, authenticated;
grant execute on function public.control_flash_family_live_draft(text, text, text, integer) to anon, authenticated;

