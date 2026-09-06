(() => {
  const TEAM_COUNT = 14;
  const ROSTER_SIZE = 10;
  const DEFAULT_POINT_CAP = 50;
  const MIN_PICK_COST = 1;
  const PRACTICE_CPU_DELAY = 180;
  const FULL_MOCK_CPU_DELAY = 45;

  const TEAM_CONFIG = {
    1: { name: "Daytona Torterras", short: "Torterras", mascot: "Torterra", color: "#3fa129", logo: "images/teams/draft/daytona-torterras.png" },
    2: { name: "Kansas Krooks", short: "Krooks", mascot: "Krookodile", color: "#d8443e", logo: "images/teams/draft/kansas-krooks.png" },
    3: { name: "South Jersey Hounds", short: "Hounds", mascot: "Houndoom", color: "#ef554f", logo: "images/teams/draft/south-jersey-hounds.png" },
    4: { name: "Chicago Conkquerers", short: "Conkquerers", mascot: "Conkeldurr", color: "#ef6f45", logo: "images/teams/draft/chicago-conkquerers.png" },
    5: { name: "Las Vegas Gatrs", short: "Gatrs", mascot: "Feraligatr", color: "#d13f76", logo: "images/teams/draft/las-vegas-gatrs.png" },
    6: { name: "North Carolina Ceruledge", short: "Ceruledge", mascot: "Ceruledge", color: "#7b61e8", logo: "images/teams/draft/north-carolina-ceruledge.png" },
    7: { name: "UConn Arcanines", short: "UConn", mascot: "Hisuian Arcanine", color: "#4c78d5", logo: "images/teams/draft/uconn-arcanines.png" },
    8: { name: "Boston Eeltics", short: "Eeltics", mascot: "Eelektross", color: "#62a629", logo: "images/teams/draft/boston-eeltics.png" },
    9: { name: "Sunnyshore City Shelter", short: "Shelter", mascot: "Hisuian Goodra", color: "#6e9ddb", logo: "images/teams/draft/sunnyshore-city-shelter.png" },
    10: { name: "Massachusetts Midnight", short: "Midnight", mascot: "Umbreon", color: "#6154b7", logo: "images/teams/draft/massachusetts-midnight.png" },
    11: { name: "Miami Dragapults", short: "Dragapults", mascot: "Dragapult", color: "#20a493", logo: "images/teams/draft/miami-dragapults.png" },
    12: { name: "San Francisco Soulfire", short: "Soulfire", mascot: "Chandelure", color: "#874dc9", logo: "images/teams/draft/san-francisco-soulfire.png" },
    13: { name: "Stockholm Spin Cycles", short: "Spin Cycles", mascot: "Rotom-Wash", color: "#31a6cb", logo: "images/teams/draft/stockholm-spin-cycles.png" },
    14: { name: "Dallas Disguises", short: "Disguises", mascot: "Mimikyu", color: "#d7a93a", logo: "images/teams/draft/dallas-disguises.png" },
  };

  const TYPE_COLORS = {
    Bug: "#91a119", Dark: "#50413f", Dragon: "#5060e1", Electric: "#fac000",
    Fairy: "#ef70ef", Fighting: "#ff8000", Fire: "#e62829", Flying: "#81b9ef",
    Ghost: "#704170", Grass: "#3fa129", Ground: "#915121", Ice: "#3fd8ff",
    Normal: "#9fa19f", Poison: "#9141cb", Psychic: "#ef4179", Rock: "#afa981",
    Steel: "#60a1b8", Water: "#2980ef",
  };

  const TIER_SYMBOLS = { Diamond: "◆", Gold: "●", Silver: "●", Bronze: "●" };
  const STAT_ROLES = [
    "Heavy Hitter", "Physical Attacker", "Special Powerhouse", "Special Attacker",
    "Mixed Attacker", "Speedster", "Fast", "Physical Stronghold", "Physical Tank",
    "Special Fortress", "Special Wall", "Bulk City",
  ];
  const ROLE_ORDER = [
    ...STAT_ROLES,
    "Support", "Fake Out", "Prankster", "Intimidate", "Redirection",
    "Priority Tailwind", "Tailwind", "TR Setter", "TR Sweeper",
    "Rain Setter", "Rain Abuser", "Sun Setter", "Sun Abuser",
    "Sand Setter", "Sand Abuser", "Snow Setter", "Snow Abuser",
    "Terrain Setter", "Terrain Abuser", "Mega", "Dual Mega", "Curated Value Pick",
  ];
  const PHYSICAL_OFFENSE_ROLES = ["Heavy Hitter", "Physical Attacker"];
  const SPECIAL_OFFENSE_ROLES = ["Special Powerhouse", "Special Attacker"];
  const TAILWIND_ROLES = ["Tailwind", "Priority Tailwind"];
  const WEATHER_PLANS = [
    { name: "rain", setter: "Rain Setter", abuser: "Rain Abuser" },
    { name: "sun", setter: "Sun Setter", abuser: "Sun Abuser" },
    { name: "sand", setter: "Sand Setter", abuser: "Sand Abuser" },
    { name: "snow", setter: "Snow Setter", abuser: "Snow Abuser" },
  ];
  const WELL_ROUNDED_TEAM_IDS = new Set([2, 5, 8, 11, 14]);

  const names = (value) => value.split(",").map((name) => name.trim()).filter(Boolean);
  const ROLE_GROUPS = {
    Support: names("Farigiraf,Grimmsnarl,Incineroar,Pelipper,Raichu,Rillaboom,Sableye,Sinistcha,Whimsicott,Maushold,Politoed,Talonflame,Clefable,Corviknight,Hisuian Arcanine,Milotic,Scrafty,Vivillon,Arcanine,Klefki,Meowstic,Oranguru,Tinkaton,Tsareena,Hatterene,Liepard,Mimikyu,Altaria,Bellibolt,Galarian Slowking,Skarmory,Slowbro,Toxapex,Umbreon,Ninetales,Orthworm,Spiritomb,Alcremie,Cofagrigus,Ditto,Slowking,Wyrdeer,Audino,Aromatisse,Dedenne,Florges,Forretress,Gourgeist,Polteageist,Roserade,Slurpuff"),
    "Fake Out": names("Blastoise,Grimmsnarl,Incineroar,Kangaskhan,Lopunny,Meowstic,Morpeko,Mr. Rime,Pikachu,Raichu,Alolan Raichu,Rillaboom,Sableye,Salazzle,Scrafty,Simipour,Simisage,Simisear,Sneasler,Tinkaton,Toxicroak,Weavile,Infernape"),
    Prankster: names("Whimsicott,Grimmsnarl,Sableye,Klefki,Liepard,Meowstic,Banette"),
    Intimidate: names("Incineroar,Gyarados,Arcanine,Hisuian Arcanine,Scrafty,Overqwil,Qwilfish,Wyrdeer,Luxray,Staraptor,Salamence,Manectric"),
    "Priority Tailwind": names("Whimsicott,Talonflame"),
    Tailwind: names("Aerodactyl,Skarmory,Noivern,Altaria,Corviknight,Vivillon,Salamence,Dragonite"),
    "TR Setter": names("Farigiraf,Mimikyu,Oranguru,Hatterene,Meowstic,Sinistcha,Gallade"),
    "TR Sweeper": names("Torkoal,Crabominable,Camerupt,Golurk,Hatterene,Drampa,Mawile,Sylveon,Gardevoir"),
    Redirection: names("Maushold,Clefable,Ariados,Volcarona,Vivillon,Scovillain,Sinistcha"),
    "Rain Setter": names("Pelipper,Politoed"),
    "Rain Abuser": names("Archaludon,Swampert,Sharpedo,Heliolisk,Toxicroak,Palafin,Basculegion,Starmie,Kingambit"),
    "Sun Setter": names("Charizard,Torkoal,Ninetales"),
    "Sun Abuser": names("Venusaur,Vileplume,Scovillain,Victreebel,Charizard,Torkoal,Houndoom,Pyroar,Meganium"),
    "Sand Setter": names("Tyranitar,Hippowdon,Sandaconda"),
    "Sand Abuser": names("Excadrill,Houndstone,Lycanroc,Garchomp,Steelix,Heliolisk,Tyranitar"),
    "Snow Setter": names("Alolan Ninetales,Abomasnow,Froslass"),
    "Snow Abuser": names("Froslass,Beartic,Vanilluxe,Abomasnow,Alolan Ninetales,Glaceon,Aurorus"),
    "Terrain Setter": names("Raichu,Rillaboom"),
    "Terrain Abuser": names("Alakazam,Alolan Raichu,Ampharos,Armarouge,Chimecho,Dedenne,Eelektross,Emolga,Galarian Slowbro,Galarian Slowking,Galarian Stunfisk,Gardevoir,Hatterene,Heliolisk,Jolteon,Luxray,Manectric,Meowstic,Morpeko,Mr. Rime,Pikachu,Raichu,Reuniclus,Rotom,Rotom-Fan,Rotom-Frost,Rotom-Heat,Rotom-Mow,Rotom-Wash,Slowbro,Slowking,Starmie"),
    "Curated Value Pick": names("Alakazam,Alolan Raichu,Ditto,Espeon,Heracross,Pinsir,Reuniclus,Wyrdeer,Audino,Beedrill,Chimecho,Pidgeot"),
    "Dual Mega": names("Charizard,Raichu,Absol,Garchomp,Lucario"),
    Mega: names("Venusaur,Charizard,Blastoise,Beedrill,Pidgeot,Raichu,Clefable,Alakazam,Victreebel,Slowbro,Gengar,Kangaskhan,Starmie,Pinsir,Gyarados,Aerodactyl,Dragonite,Meganium,Feraligatr,Ampharos,Steelix,Scizor,Heracross,Skarmory,Houndoom,Tyranitar,Sceptile,Blaziken,Swampert,Gardevoir,Sableye,Mawile,Aggron,Medicham,Manectric,Sharpedo,Camerupt,Altaria,Banette,Chimecho,Absol,Glalie,Salamence,Metagross,Staraptor,Lopunny,Garchomp,Lucario,Abomasnow,Gallade,Froslass,Emboar,Excadrill,Audino,Scolipede,Scrafty,Eelektross,Chandelure,Golurk,Chesnaught,Delphox,Greninja,Pyroar,Eternal Floette,Meowstic,Malamar,Barbaracle,Dragalge,Hawlucha,Crabominable,Drampa,Falinks,Scovillain,Glimmora"),
  };

  const ROLE_MEMBERSHIP = Object.fromEntries(
    Object.entries(ROLE_GROUPS).map(([role, members]) => [role, new Set(members)])
  );

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const normalize = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const elements = {
    setup: $("[data-draft-setup]"), app: $("[data-draft-app]"), teamSelect: $("[data-team-select]"),
    modeSelect: $("[data-mode-select]"), start: $("[data-start-draft]"), reset: $("[data-new-draft]"),
    auto: $("[data-auto-pick]"), clockKicker: $("[data-clock-kicker]"), clockTeam: $("[data-clock-team]"),
    clockDetail: $("[data-clock-detail]"), overall: $("[data-overall-pick]"), round: $("[data-round]"),
    pointsUsed: $("[data-points-used]"), rosterCount: $("[data-roster-count]"), userTeamName: $("[data-user-team-name]"),
    budgetLeft: $("[data-budget-left]"), userRoster: $("[data-user-roster]"), log: $("[data-draft-log]"),
    recommendationName: $("[data-recommendation-name]"), recommendationReason: $("[data-recommendation-reason]"),
    recommendationPick: $("[data-recommendation-pick]"), grid: $("[data-pokemon-grid]"), resultCount: $("[data-result-count]"),
    empty: $("[data-empty-state]"), nameFilter: $("[data-name-filter]"), pointFilter: $("[data-point-filter]"),
    typeFilter: $("[data-type-filter]"), roleFilter: $("[data-role-filter]"), moveFilter: $("[data-move-filter]"),
    moveSuggestions: $("[data-move-suggestions]"), clearFilters: $("[data-clear-filters]"),
    teamBoard: $("[data-team-board]"), leagueRosters: $("[data-league-rosters]"), template: $("#draftCardTemplate"),
  };

  const state = {
    catalog: [], details: {}, detailIndex: {}, byName: new Map(), moveIndex: [], roleCache: new Map(),
    started: false, mode: "practice", userTeam: 8, pickIndex: 0, teams: {}, available: new Set(),
    log: [], cpuTimer: null, cpuPaused: false, pointCap: DEFAULT_POINT_CAP,
  };

  const teamForPick = (index) => {
    const round = Math.floor(index / TEAM_COUNT);
    const within = index % TEAM_COUNT;
    return round % 2 === 0 ? within + 1 : TEAM_COUNT - within;
  };

  const roundForPick = (index) => Math.floor(index / TEAM_COUNT) + 1;
  const pointValue = (pokemon) => Number(pokemon?.sortPoints ?? pokemon?.points ?? 0);
  const teamPoints = (team) => team.picks.reduce((sum, pick) => sum + pointValue(pick), 0);

  const statRolesFor = (detail) => {
    const roles = new Set();
    const formes = detail?.formes?.filter((forme) => forme.stats) || [];
    if (!formes.length) return roles;

    const max = (key) => Math.max(...formes.map((forme) => Number(forme.stats[key]) || 0));
    const attack = max("attack");
    const specialAttack = max("sp_atk");
    const speed = max("speed");
    const defense = max("defense");
    const specialDefense = max("sp_def");

    if (attack >= 120) roles.add("Heavy Hitter");
    else if (attack >= 100) roles.add("Physical Attacker");
    if (specialAttack >= 120) roles.add("Special Powerhouse");
    else if (specialAttack >= 100) roles.add("Special Attacker");
    if (speed >= 120) roles.add("Speedster");
    else if (speed >= 100) roles.add("Fast");
    if (defense >= 120) roles.add("Physical Stronghold");
    else if (defense >= 100) roles.add("Physical Tank");
    if (specialDefense >= 120) roles.add("Special Fortress");
    else if (specialDefense >= 100) roles.add("Special Wall");

    if (formes.some((forme) => Number(forme.stats.attack) >= 100 && Number(forme.stats.sp_atk) >= 100)) {
      roles.add("Mixed Attacker");
    }
    if (formes.some((forme) => Number(forme.stats.hp) >= 90 && Number(forme.stats.defense) >= 105 && Number(forme.stats.sp_def) >= 105)) {
      roles.add("Bulk City");
    }
    return roles;
  };

  const rolesFor = (pokemon) => {
    if (state.roleCache.has(pokemon.name)) return state.roleCache.get(pokemon.name);
    const roles = statRolesFor(state.details[normalize(pokemon.name)]);
    for (const [role, members] of Object.entries(ROLE_MEMBERSHIP)) {
      if (members.has(pokemon.name)) roles.add(role);
    }
    const ordered = ROLE_ORDER.filter((role) => roles.has(role));
    state.roleCache.set(pokemon.name, ordered);
    return ordered;
  };

  const roleMatches = (pokemon, selected) => {
    if (!selected) return true;
    const roles = rolesFor(pokemon);
    if (selected === "Mega") return roles.includes("Mega") || roles.includes("Dual Mega");
    if (selected === "Tailwind") return roles.includes("Tailwind") || roles.includes("Priority Tailwind");
    return roles.includes(selected);
  };

  const hasAnyRole = (roles, wanted) => wanted.some((role) => roles.includes(role));

  const strategicFitFor = (team, pokemon) => {
    const rosterRoleLists = team.picks.map(rolesFor);
    const rosterRoles = new Set(rosterRoleLists.flat());
    const candidateRoles = rolesFor(pokemon);
    const hasCandidateRole = (role) => candidateRoles.includes(role);
    const reasons = [];
    let score = 0;
    const wellRounded = team.draftStyle === "well-rounded";

    const physicalCount = rosterRoleLists.filter((roles) => hasAnyRole(roles, PHYSICAL_OFFENSE_ROLES) || roles.includes("Mixed Attacker")).length;
    const specialCount = rosterRoleLists.filter((roles) => hasAnyRole(roles, SPECIAL_OFFENSE_ROLES) || roles.includes("Mixed Attacker")).length;
    const candidatePhysical = hasAnyRole(candidateRoles, PHYSICAL_OFFENSE_ROLES) || hasCandidateRole("Mixed Attacker");
    const candidateSpecial = hasAnyRole(candidateRoles, SPECIAL_OFFENSE_ROLES) || hasCandidateRole("Mixed Attacker");

    if (physicalCount === 0 && specialCount === 0 && hasCandidateRole("Mixed Attacker")) {
      score += 30;
      reasons.push("starts a balanced offense");
    } else {
      if (physicalCount === 0 && candidatePhysical) {
        score += 26;
        reasons.push("adds physical offense");
      } else if (specialCount > physicalCount + 1 && candidatePhysical) {
        score += 15;
        reasons.push("balances physical offense");
      }
      if (specialCount === 0 && candidateSpecial) {
        score += 26;
        reasons.push("adds special offense");
      } else if (physicalCount > specialCount + 1 && candidateSpecial) {
        score += 15;
        reasons.push("balances special offense");
      }
    }

    for (const [role, bonus] of [["Prankster", 18], ["Intimidate", 18]]) {
      if (!rosterRoles.has(role) && hasCandidateRole(role)) {
        score += bonus;
        reasons.push(`adds ${role}`);
      }
    }

    const supportCount = rosterRoleLists.filter((roles) => roles.includes("Support")).length;
    const heavyCount = rosterRoleLists.filter((roles) => roles.includes("Heavy Hitter") || roles.includes("Special Powerhouse")).length;
    if (hasCandidateRole("Support")) {
      if (supportCount === 0) {
        score += wellRounded ? 28 : 18;
        reasons.push("adds the first support piece");
      } else if (wellRounded && supportCount < 2) {
        score += 10;
      }
    }
    if (hasCandidateRole("Heavy Hitter") || hasCandidateRole("Special Powerhouse")) {
      if (heavyCount === 0) {
        score += wellRounded ? 26 : 18;
        reasons.push("adds a heavy hitter");
      } else if (wellRounded && heavyCount < 2) {
        score += 10;
      }
    }

    const megaCount = rosterRoleLists.filter((roles) => roles.includes("Mega") || roles.includes("Dual Mega")).length;
    const candidateIsMega = hasCandidateRole("Mega") || hasCandidateRole("Dual Mega");
    if (candidateIsMega && megaCount >= 3) score -= 160;
    else if (candidateIsMega && megaCount === 2) score -= wellRounded ? 28 : 18;

    const rosterHasTailwind = TAILWIND_ROLES.some((role) => rosterRoles.has(role));
    const rosterHasTrSetter = rosterRoles.has("TR Setter");
    const rosterHasTrSweeper = rosterRoles.has("TR Sweeper");
    const rosterHasNonTrSweeper = rosterRoleLists.some((roles) =>
      (hasAnyRole(roles, PHYSICAL_OFFENSE_ROLES) || hasAnyRole(roles, SPECIAL_OFFENSE_ROLES) || roles.includes("Mixed Attacker"))
      && !roles.includes("TR Sweeper")
    );
    const candidateHasTailwind = hasAnyRole(candidateRoles, TAILWIND_ROLES);
    const candidateIsNonTrSweeper = (candidatePhysical || candidateSpecial) && !hasCandidateRole("TR Sweeper");
    const trPlan = rosterHasTrSetter || rosterHasTrSweeper;

    if (trPlan) {
      if (candidateHasTailwind) score -= 42;
      if (rosterHasTrSetter && hasCandidateRole("TR Sweeper")) {
        score += 50;
        reasons.push("pairs with Trick Room");
      }
      if (rosterHasTrSweeper && !rosterHasTrSetter && hasCandidateRole("TR Setter")) {
        score += 48;
        reasons.push("enables the Trick Room attackers");
      } else if (rosterHasTrSetter && hasCandidateRole("TR Setter")) {
        score -= 34;
      }
    } else if (rosterHasTailwind) {
      if (hasCandidateRole("TR Setter")) score -= 42;
      if (candidateHasTailwind) score -= 30;
      if (candidateIsNonTrSweeper) {
        score += 20;
        reasons.push("attacks under Tailwind");
      }
    } else {
      if (candidateHasTailwind) {
        score += rosterHasNonTrSweeper ? 36 : 14;
        reasons.push(rosterHasNonTrSweeper ? "supports the faster offense" : "adds Tailwind control");
      }
      if (hasCandidateRole("TR Setter")) {
        score += 14;
        reasons.push("adds Trick Room control");
      }
      if (hasCandidateRole("TR Sweeper")) score += 8;
    }

    const existingWeather = WEATHER_PLANS.find((plan) => rosterRoles.has(plan.setter));
    const candidateWeather = WEATHER_PLANS.find((plan) => hasCandidateRole(plan.setter));
    if (existingWeather) {
      if (candidateWeather) score -= candidateWeather === existingWeather ? 78 : 260;
      if (hasCandidateRole(existingWeather.abuser)) {
        const existingAbusers = rosterRoleLists.filter((roles) => roles.includes(existingWeather.abuser)).length;
        score += existingAbusers ? 32 : 72;
        reasons.push(`abuses ${existingWeather.name}`);
      }
    } else {
      const weatherNeeded = WEATHER_PLANS.find((plan) => rosterRoles.has(plan.abuser));
      if (weatherNeeded && hasCandidateRole(weatherNeeded.setter)) {
        score += 34;
        reasons.push(`enables ${weatherNeeded.name}`);
      }
    }

    return { score, reasons };
  };

  const canAfford = (team, pokemon) => {
    if (!team || team.picks.length >= ROSTER_SIZE) return false;
    const remainingAfterPick = ROSTER_SIZE - team.picks.length - 1;
    return teamPoints(team) + pointValue(pokemon) + remainingAfterPick * MIN_PICK_COST <= state.pointCap;
  };

  const currentTeamNumber = () => state.pickIndex < TEAM_COUNT * ROSTER_SIZE ? teamForPick(state.pickIndex) : null;

  const advancePastCompleteTeams = () => {
    while (state.pickIndex < TEAM_COUNT * ROSTER_SIZE) {
      const team = state.teams[currentTeamNumber()];
      if (team && team.picks.length < ROSTER_SIZE) break;
      state.pickIndex += 1;
    }
  };

  const scorePokemon = (team, pokemon, highestLegalPoints) => {
    const currentRoles = new Set(team.picks.flatMap(rolesFor));
    const currentTypes = new Set(team.picks.flatMap((pick) => pick.types));
    const roles = rolesFor(pokemon);
    const missingRoles = roles.filter((role) => !currentRoles.has(role)).length;
    const newTypes = pokemon.types.filter((type) => !currentTypes.has(type)).length;
    const wellRounded = team.draftStyle === "well-rounded";
    const supportBonus = !currentRoles.has("Support") && roles.includes("Support") ? (wellRounded ? 16 : 10) : 0;
    const speedBonus = !["Speedster", "Fast"].some((role) => currentRoles.has(role)) && roles.some((role) => ["Speedster", "Fast"].includes(role)) ? (wellRounded ? 18 : 15) : 0;
    const pointWeight = wellRounded ? 18 : 22;
    const missingRoleWeight = wellRounded ? 7 : 4;
    const newTypeWeight = wellRounded ? 7 : 5;
    const rawStrategy = strategicFitFor(team, pokemon).score;
    const strategy = rawStrategy > 0 && wellRounded ? rawStrategy * 1.25 : rawStrategy;
    const valueGap = Math.max(0, highestLegalPoints - pointValue(pokemon));
    const protectedStrategy = strategy > 0 ? strategy * Math.max(0.3, 1 - Math.max(0, valueGap - 1) * 0.2) : strategy;
    return pointValue(pokemon) * pointWeight + missingRoles * missingRoleWeight + newTypes * newTypeWeight + supportBonus + speedBonus + protectedStrategy + Math.random() * 5;
  };

  const legalPicksFor = (team) => [...state.available]
    .map((name) => state.byName.get(name))
    .filter((pokemon) => pokemon && canAfford(team, pokemon));

  const recommendationFor = (team) => {
    const legal = legalPicksFor(team);
    const highestLegalPoints = Math.max(0, ...legal.map(pointValue));
    return legal
      .map((pokemon) => ({ pokemon, score: scorePokemon(team, pokemon, highestLegalPoints) }))
      .sort((a, b) => b.score - a.score || pointValue(b.pokemon) - pointValue(a.pokemon))[0]?.pokemon;
  };

  const filterMatchesMove = (pokemon, query) => {
    if (!query) return true;
    const detail = state.details[normalize(pokemon.name)];
    return detail?.moves?.some((move) => move.name.toLowerCase().includes(query));
  };

  const filteredPokemon = () => {
    const team = state.teams[currentTeamNumber()] || state.teams[state.userTeam];
    const nameQuery = elements.nameFilter.value.trim().toLowerCase();
    const moveQuery = elements.moveFilter.value.trim().toLowerCase();
    const points = elements.pointFilter.value;
    const type = elements.typeFilter.value;
    const role = elements.roleFilter.value;

    return [...state.available]
      .map((name) => state.byName.get(name))
      .filter((pokemon) => pokemon
        && canAfford(team, pokemon)
        && (!nameQuery || [pokemon.name, ...(pokemon.aliases || [])].join(" ").toLowerCase().includes(nameQuery))
        && (!points || String(pointValue(pokemon)) === points)
        && (!type || pokemon.types.includes(type))
        && roleMatches(pokemon, role)
        && filterMatchesMove(pokemon, moveQuery))
      .sort((a, b) => pointValue(b) - pointValue(a) || a.name.localeCompare(b.name));
  };

  const typeBadge = (type) => {
    const span = document.createElement("span");
    span.className = "type-badge";
    const icon = document.createElement("img");
    icon.src = `images/types/${type.toLowerCase()}.png`;
    icon.alt = "";
    icon.width = 20;
    icon.height = 20;
    const label = document.createElement("span");
    label.textContent = type;
    span.append(icon, label);
    return span;
  };

  const cardFor = (pokemon) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    const roles = rolesFor(pokemon);
    const hasMega = roles.includes("Mega") || roles.includes("Dual Mega");
    const isHumanTurn = state.mode === "practice" && currentTeamNumber() === state.userTeam;

    card.dataset.tier = pokemon.tier;
    card.style.setProperty("--type-one", TYPE_COLORS[pokemon.types[0]]);
    card.style.setProperty("--type-two", TYPE_COLORS[pokemon.types[1] || pokemon.types[0]]);
    card.querySelector(".tier-symbol").textContent = TIER_SYMBOLS[pokemon.tier];
    card.querySelector(".tier-name").textContent = pokemon.tier;
    card.querySelector(".point-value").textContent = pointValue(pokemon);
    card.querySelector(".pokemon-name").textContent = pokemon.name;
    const sprite = card.querySelector(".pokemon-sprite");
    sprite.src = pokemon.sprite;
    sprite.alt = `${pokemon.name} menu sprite`;
    if (hasMega) card.querySelector(".mega-mark").hidden = false;

    const typeList = card.querySelector(".type-list");
    pokemon.types.forEach((type) => typeList.append(typeBadge(type)));

    const info = card.querySelector(".card-info");
    info.setAttribute("aria-label", `View ${pokemon.name} abilities, stats, and moves`);
    info.addEventListener("click", () => window.PokemonDetails?.open({ ...pokemon, draftRoles: roles }, info));

    const pick = card.querySelector(".draft-pick-button");
    pick.disabled = !isHumanTurn;
    pick.setAttribute("aria-label", `Draft ${pokemon.name} for ${pointValue(pokemon)} points`);
    pick.addEventListener("click", () => makePick(state.userTeam, pokemon.name, false));
    return card;
  };

  const renderBoard = () => {
    const matches = filteredPokemon();
    const fragment = document.createDocumentFragment();
    matches.forEach((pokemon) => fragment.append(cardFor(pokemon)));
    elements.grid.replaceChildren(fragment);
    elements.grid.setAttribute("aria-busy", "false");
    elements.resultCount.textContent = matches.length;
    elements.empty.hidden = matches.length > 0;
  };

  const renderRoster = () => {
    const team = state.teams[state.userTeam];
    elements.userTeamName.textContent = TEAM_CONFIG[state.userTeam].name;
    elements.budgetLeft.textContent = `${state.pointCap - teamPoints(team)} left`;
    const slots = [];
    for (let index = 0; index < ROSTER_SIZE; index += 1) {
      const pick = team.picks[index];
      if (!pick) {
        slots.push(`<div class="roster-slot roster-slot--empty"><span><strong>${index + 1}. Open slot</strong><br><small>Waiting for a pick</small></span></div>`);
        continue;
      }
      slots.push(`<div class="roster-slot"><img src="${escapeHtml(pick.sprite)}" alt=""><span><strong>${index + 1}. ${escapeHtml(pick.name)}</strong><br><small>${pick.mascot ? "Team mascot" : `Pick #${pick.overall}`}</small></span><span>${pointValue(pick)}</span></div>`);
    }
    elements.userRoster.innerHTML = slots.join("");
  };

  const renderLog = () => {
    if (!state.log.length) {
      elements.log.innerHTML = "<p>No picks yet.</p>";
      return;
    }
    elements.log.innerHTML = state.log.slice(-18).reverse().map((entry) => `
      <div class="log-row"><span>#${entry.overall}</span><strong>${escapeHtml(entry.pokemon.name)} · ${escapeHtml(TEAM_CONFIG[entry.team].name)}</strong><span>${pointValue(entry.pokemon)} pts</span></div>
    `).join("");
  };

  const renderTeamBoard = () => {
    const current = currentTeamNumber();
    const trackedRound = Math.min(roundForPick(state.pickIndex), ROSTER_SIZE);
    elements.teamBoard.innerHTML = Object.values(state.teams).map((team) => {
      const config = TEAM_CONFIG[team.id];
      const roundPick = team.picks.filter((pick) => !pick.mascot)[trackedRound - 1];
      const pickLabel = roundPick
        ? `<img src="${escapeHtml(roundPick.sprite)}" alt=""><strong title="${escapeHtml(roundPick.name)}">${escapeHtml(roundPick.name)}</strong>`
        : `<span class="team-round-empty">${team.id === current ? "On clock" : "Waiting"}</span>`;
      return `<article class="team-track-card${team.id === current ? " is-on-clock" : ""}${team.id === state.userTeam ? " is-user-team" : ""}" style="--team-color:${config.color}" aria-label="${escapeHtml(config.name)}, round ${trackedRound}: ${escapeHtml(roundPick?.name || (team.id === current ? "on the clock" : "waiting"))}">
        <span class="team-pick-number">${team.id}</span>
        <div class="team-track-identity">
          <img class="team-track-logo" src="${escapeHtml(config.logo)}" alt="">
          <strong title="${escapeHtml(config.name)}">${escapeHtml(config.short)}</strong>
        </div>
        <div class="team-round-pick${roundPick ? " is-filled" : ""}">
          <span class="team-round-label">R${trackedRound}</span>
          ${pickLabel}
        </div>
      </article>`;
    }).join("");

    const active = elements.teamBoard.querySelector(".is-on-clock");
    if (active && window.innerWidth < 980) active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  };

  const renderLeagueRosters = () => {
    elements.leagueRosters.innerHTML = Object.values(state.teams).map((team) => {
      const config = TEAM_CONFIG[team.id];
      return `<article class="league-roster-card comic-panel" style="box-shadow:6px 7px 0 ${config.color},11px 12px 0 #000">
        <h2>${escapeHtml(config.name)}</h2>
        <p>${teamPoints(team)} / ${state.pointCap} points · ${team.picks.length} / ${ROSTER_SIZE} Pokémon</p>
        <div class="league-roster-picks">${team.picks.map((pick) => `<span class="league-roster-pick" title="${escapeHtml(pick.name)} · ${pointValue(pick)} points"><img src="${escapeHtml(pick.sprite)}" alt=""><span>${escapeHtml(pick.name)}</span></span>`).join("")}</div>
      </article>`;
    }).join("");
  };

  const recommendationReason = (team, pokemon) => {
    const currentRoles = new Set(team.picks.flatMap(rolesFor));
    const strategicReasons = strategicFitFor(team, pokemon).reasons;
    const useful = strategicReasons.length
      ? strategicReasons.slice(0, 2)
      : rolesFor(pokemon).filter((role) => !currentRoles.has(role)).slice(0, 2).map((role) => `adds ${role}`);
    const pieces = [`adds a ${pointValue(pokemon)}-point ${pokemon.tier.toLowerCase()} pick`];
    if (useful.length) pieces.push(useful.join(" + "));
    pieces.push(`${state.pointCap - teamPoints(team) - pointValue(pokemon)} points remain`);
    return pieces.join(" · ");
  };

  const renderRecommendation = () => {
    const team = state.teams[state.userTeam];
    const humanTurn = state.mode === "practice" && currentTeamNumber() === state.userTeam;
    if (!humanTurn || team.picks.length >= ROSTER_SIZE) {
      elements.recommendationName.textContent = state.pickIndex >= TEAM_COUNT * ROSTER_SIZE ? "Mock draft complete!" : "Waiting for your turn…";
      elements.recommendationReason.textContent = state.pickIndex >= TEAM_COUNT * ROSTER_SIZE ? "Open League rosters to review every team." : "CPU teams are working through the board.";
      elements.recommendationPick.replaceChildren();
      return;
    }

    const pokemon = recommendationFor(team);
    if (!pokemon) {
      elements.recommendationName.textContent = "No legal pick available";
      elements.recommendationReason.textContent = "The current roster cannot be completed within the point cap.";
      elements.recommendationPick.replaceChildren();
      return;
    }

    elements.recommendationName.textContent = `${pokemon.name} · ${pointValue(pokemon)} PTS`;
    elements.recommendationReason.textContent = recommendationReason(team, pokemon);
    elements.recommendationPick.innerHTML = `<img src="${escapeHtml(pokemon.sprite)}" alt=""><button class="comic-button comic-button--primary" type="button">Draft pick</button>`;
    elements.recommendationPick.querySelector("button").addEventListener("click", () => makePick(state.userTeam, pokemon.name, false));
  };

  const renderStatus = () => {
    advancePastCompleteTeams();
    const current = currentTeamNumber();
    const finished = current === null;
    const user = state.teams[state.userTeam];
    const humanTurn = state.mode === "practice" && current === state.userTeam;

    elements.clockKicker.textContent = finished ? "Final buzzer" : humanTurn ? "You are on the clock!" : "Draft in progress";
    elements.clockTeam.textContent = finished ? "Mock draft complete" : TEAM_CONFIG[current].name;
    elements.clockDetail.textContent = finished ? "Every roster is locked." : `Round ${roundForPick(state.pickIndex)} · Pick ${state.pickIndex + 1}`;
    elements.overall.textContent = finished ? "140 / 140" : `${state.pickIndex + 1} / 140`;
    elements.round.textContent = finished ? "10" : roundForPick(state.pickIndex);
    elements.pointsUsed.textContent = `${teamPoints(user)} / ${state.pointCap}`;
    elements.rosterCount.textContent = `${user.picks.length} / ${ROSTER_SIZE}`;
    elements.auto.disabled = finished || humanTurn || state.mode === "cpu";
    elements.auto.textContent = state.cpuPaused ? "Continue simulation" : "Sim to my pick";

    renderRecommendation();
    renderTeamBoard();
    renderRoster();
    renderLog();
    renderLeagueRosters();
    renderBoard();
  };

  const makePick = (teamNumber, pokemonName, isCpu) => {
    if (!state.started || currentTeamNumber() !== teamNumber || !state.available.has(pokemonName)) return;
    const team = state.teams[teamNumber];
    const pokemon = state.byName.get(pokemonName);
    if (!pokemon || !canAfford(team, pokemon)) return;

    team.picks.push({ ...pokemon, mascot: false, overall: state.pickIndex + 1 });
    state.available.delete(pokemonName);
    state.log.push({ team: teamNumber, pokemon, overall: state.pickIndex + 1, cpu: isCpu });
    state.pickIndex += 1;
    advancePastCompleteTeams();
    const finished = currentTeamNumber() === null;
    const shouldRender = state.mode !== "cpu" || !isCpu || state.pickIndex % 5 === 0 || finished;
    if (shouldRender) renderStatus();
    else renderTeamBoard();
    scheduleCpu();
  };

  const scheduleCpu = () => {
    clearTimeout(state.cpuTimer);
    const current = currentTeamNumber();
    if (!state.started || current === null || state.cpuPaused) return;
    const shouldCpuPick = state.mode === "cpu" || current !== state.userTeam;
    if (!shouldCpuPick) return;
    state.cpuTimer = window.setTimeout(() => {
      const team = state.teams[current];
      const pick = recommendationFor(team);
      if (!pick) {
        state.pickIndex += 1;
        advancePastCompleteTeams();
        renderStatus();
        scheduleCpu();
        return;
      }
      makePick(current, pick.name, true);
    }, state.mode === "cpu" ? FULL_MOCK_CPU_DELAY : PRACTICE_CPU_DELAY);
  };

  const buildInitialTeams = () => {
    const teams = {};
    for (let teamNumber = 1; teamNumber <= TEAM_COUNT; teamNumber += 1) {
      const mascot = state.byName.get(TEAM_CONFIG[teamNumber].mascot);
      teams[teamNumber] = {
        id: teamNumber,
        draftStyle: WELL_ROUNDED_TEAM_IDS.has(teamNumber) ? "well-rounded" : "value",
        picks: mascot ? [{ ...mascot, mascot: true, overall: null }] : [],
      };
    }
    return teams;
  };

  const startDraft = () => {
    clearTimeout(state.cpuTimer);
    state.started = true;
    state.mode = elements.modeSelect.value;
    state.userTeam = Number(elements.teamSelect.value);
    state.pickIndex = 0;
    state.log = [];
    state.teams = buildInitialTeams();
    state.available = new Set(state.catalog.map((pokemon) => pokemon.name));
    Object.values(TEAM_CONFIG).forEach((team) => state.available.delete(team.mascot));
    state.cpuPaused = false;
    elements.setup.hidden = true;
    elements.app.hidden = false;
    clearFilters();
    renderStatus();
    scheduleCpu();
    window.scrollTo({ top: elements.app.offsetTop - 18, behavior: "smooth" });
  };

  const resetDraft = () => {
    clearTimeout(state.cpuTimer);
    state.started = false;
    state.cpuPaused = false;
    elements.app.hidden = true;
    elements.setup.hidden = false;
    window.scrollTo({ top: elements.setup.offsetTop - 18, behavior: "smooth" });
  };

  const clearFilters = () => {
    elements.nameFilter.value = "";
    elements.pointFilter.value = "";
    elements.typeFilter.value = "";
    elements.roleFilter.value = "";
    elements.moveFilter.value = "";
    hideMoveSuggestions();
    if (state.started) renderBoard();
  };

  const hideMoveSuggestions = () => {
    elements.moveSuggestions.hidden = true;
    elements.moveFilter.setAttribute("aria-expanded", "false");
  };

  const renderMoveSuggestions = () => {
    const query = elements.moveFilter.value.trim().toLowerCase();
    if (query.length < 2) {
      hideMoveSuggestions();
      return;
    }
    const suggestions = state.moveIndex.filter((move) => move.name.toLowerCase().includes(query)).slice(0, 8);
    if (!suggestions.length) {
      hideMoveSuggestions();
      return;
    }
    elements.moveSuggestions.innerHTML = suggestions.map((move) => `
      <button class="move-suggestion" type="button" data-move="${escapeHtml(move.name)}">
        <img src="images/types/${escapeHtml(move.type.toLowerCase())}.png" alt="">
        <strong>${escapeHtml(move.name)}</strong><span>${escapeHtml(move.type)}</span>
      </button>
    `).join("");
    elements.moveSuggestions.hidden = false;
    elements.moveFilter.setAttribute("aria-expanded", "true");
    $$(".move-suggestion").forEach((button) => button.addEventListener("click", () => {
      elements.moveFilter.value = button.dataset.move;
      hideMoveSuggestions();
      renderBoard();
    }));
  };

  const setView = (view) => {
    $$("[data-view]").forEach((section) => { section.hidden = section.dataset.view !== view; });
    $$("[data-view-button]").forEach((button) => {
      const active = button.dataset.viewButton === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    if (view === "rosters") renderLeagueRosters();
  };

  const populateSetup = () => {
    elements.teamSelect.innerHTML = Object.entries(TEAM_CONFIG).map(([number, team]) => `<option value="${number}"${Number(number) === 8 ? " selected" : ""}>Pick ${number} — ${escapeHtml(team.name)}</option>`).join("");
    elements.pointFilter.insertAdjacentHTML("beforeend", Array.from({ length: 10 }, (_, index) => 10 - index).map((point) => `<option value="${point}">${point} points</option>`).join(""));
    elements.typeFilter.insertAdjacentHTML("beforeend", Object.keys(TYPE_COLORS).sort().map((type) => `<option value="${type}">${type}</option>`).join(""));
    elements.roleFilter.insertAdjacentHTML("beforeend", ROLE_ORDER.map((role) => `<option value="${role}">${role}</option>`).join(""));
  };

  const buildMoveIndex = () => {
    const unique = new Map();
    Object.values(state.details).forEach((detail) => {
      (detail.moves || []).forEach((move) => {
        if (move.name && move.type && !unique.has(move.name)) unique.set(move.name, { name: move.name, type: move.type });
      });
    });
    state.moveIndex = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  };

  const bindEvents = () => {
    elements.start.addEventListener("click", startDraft);
    elements.reset.addEventListener("click", resetDraft);
    elements.auto.addEventListener("click", () => {
      state.cpuPaused = false;
      scheduleCpu();
    });
    [elements.nameFilter, elements.pointFilter, elements.typeFilter, elements.roleFilter].forEach((control) => control.addEventListener("input", renderBoard));
    elements.moveFilter.addEventListener("input", () => { renderMoveSuggestions(); renderBoard(); });
    elements.moveFilter.addEventListener("focus", renderMoveSuggestions);
    elements.clearFilters.addEventListener("click", clearFilters);
    $$("[data-view-button]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewButton)));
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".move-filter")) hideMoveSuggestions();
    });
  };

  const initialize = async () => {
    populateSetup();
    bindEvents();
    const leagueState = window.PokeLeagueState?.read();
    state.pointCap = Number(leagueState?.pointCap) || DEFAULT_POINT_CAP;
    const pointCapCopy = $("[data-draft-point-cap]");
    if (pointCapCopy) pointCapCopy.textContent = state.pointCap;
    try {
      const [catalogResponse, detailsResponse, indexResponse] = await Promise.all([
        fetch("data/pokemon-catalog.json?v=season-1-3"),
        fetch("data/pokemon-details.json?v=pokemon-details-1"),
        fetch("data/pokemon-detail-index.json?v=pokemon-details-1"),
      ]);
      if (!catalogResponse.ok || !detailsResponse.ok || !indexResponse.ok) throw new Error("Draft data unavailable");
      const [catalog, detailData, detailIndex] = await Promise.all([
        catalogResponse.json(), detailsResponse.json(), indexResponse.json(),
      ]);
      state.catalog = window.PokeLeagueState?.applyCatalog(catalog, leagueState) || catalog;
      state.details = detailData.pokemon || {};
      state.detailIndex = detailIndex;
      state.byName = new Map(state.catalog.map((pokemon) => [pokemon.name, pokemon]));
      buildMoveIndex();
      elements.start.disabled = false;
    } catch (error) {
      console.error(error);
      elements.start.disabled = true;
      elements.start.textContent = "Draft data unavailable";
    }
  };

  elements.start.disabled = true;
  initialize();
})();
