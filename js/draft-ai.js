((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PokeLeagueDraftAI = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const OPENING_ELITE = ["Charizard", "Basculegion", "Garchomp", "Salamence"];
  const HARD_DEADLINES = { Basculegion: 5, Garchomp: 5 };
  const PICK_ONE_WEIGHTS = { Charizard: 55, Garchomp: 17, Basculegion: 15, Salamence: 13 };
  const PREMIUM = {
    Charizard: { early: 44, urgency: 3, deadline: 7 },
    Basculegion: { early: 24, urgency: 3, deadline: 5 },
    Garchomp: { early: 27, urgency: 3, deadline: 5 },
    Salamence: { early: 21, urgency: 5, softDeadline: 11 },
  };
  const ROUND_ONE_PROMINENCE = {
    Incineroar: 12, Whimsicott: 11, Gengar: 10, Gholdengo: 7, Rillaboom: 7,
    Kingambit: 7, Grimmsnarl: 5, Pelipper: 5, Kangaskhan: 5, Sableye: -18, Sinistcha: -18,
  };
  const PREMIUM_TAILWIND = new Set(["Whimsicott", "Talonflame"]);
  const RELIABLE_TAILWIND = new Set(["Aerodactyl", "Skarmory", "Noivern", "Altaria", "Corviknight", "Vivillon"]);
  const RELIABLE_TR = new Set(["Meowstic", "Farigiraf", "Mimikyu", "Oranguru", "Hatterene", "Sinistcha", "Gallade"]);
  const DEDICATED_TR = ["Farigiraf", "Oranguru", "Gallade"];
  const TR_PAYOFF = new Set(["Torkoal", "Crabominable", "Camerupt", "Golurk", "Mawile", "Hatterene", "Sylveon", "Kingambit", "Snorlax", "Mudsdale", "Hisuian Goodra"]);
  const ATTACK_ROLES = new Set(["Heavy Hitter", "Physical Attacker", "Special Powerhouse", "Special Attacker", "Mixed Attacker"]);
  const BULK_ROLES = new Set(["Bulk City", "Physical Stronghold", "Physical Tank", "Special Fortress", "Special Wall"]);
  const WEATHER = {
    rain: { setters: ["Pelipper", "Politoed"], roles: ["Rain Setter"], abuserRole: "Rain Abuser" },
    sun: { setters: ["Charizard", "Torkoal", "Ninetales"], roles: ["Sun Setter"], abuserRole: "Sun Abuser" },
    sand: { setters: ["Tyranitar", "Hippowdon", "Sandaconda"], roles: ["Sand Setter"], abuserRole: "Sand Abuser" },
    snow: { setters: ["Alolan Ninetales", "Abomasnow", "Froslass"], roles: ["Snow Setter"], abuserRole: "Snow Abuser" },
  };
  const SPECIFIC_CORES = {
    rain: {
      setters: ["Pelipper", "Politoed", "Sableye"],
      anchors: ["Archaludon", "Swampert", "Basculegion"],
      support: ["Primarina", "Palafin", "Rotom-Wash"],
    },
    sun: {
      setters: ["Charizard", "Torkoal", "Ninetales"],
      anchors: ["Venusaur", "Vileplume", "Scovillain"],
      support: ["Hisuian Typhlosion", "Volcarona", "Armarouge"],
    },
    trickRoom: {
      setters: ["Farigiraf", "Oranguru", "Gallade"],
      anchors: [...TR_PAYOFF],
      support: ["Kingambit", "Snorlax", "Mudsdale", "Hisuian Goodra"],
    },
  };
  const FORM_FAMILIES = [
    ["Zoroark", "Hisuian Zoroark"], ["Goodra", "Hisuian Goodra"],
    ["Rotom", "Rotom-Fan", "Rotom-Frost", "Rotom-Heat", "Rotom-Mow", "Rotom-Wash"],
    ["Tauros", "Tauros-Aqua", "Tauros-Blaze", "Tauros-Combat"],
    ["Arcanine", "Hisuian Arcanine"], ["Avalugg", "Hisuian Avalugg"],
    ["Decidueye", "Hisuian Decidueye"], ["Samurott", "Hisuian Samurott"],
    ["Typhlosion", "Hisuian Typhlosion"], ["Raichu", "Alolan Raichu"],
    ["Ninetales", "Alolan Ninetales"], ["Slowbro", "Galarian Slowbro"],
    ["Slowking", "Galarian Slowking"], ["Stunfisk", "Galarian Stunfisk"],
  ].map((family) => new Set(family));
  const PAIR_SYNERGY = new Map();
  const addPair = (candidate, owned, score) => PAIR_SYNERGY.set(`${candidate}|${owned}`, score);
  [
    ["Excadrill", "Tyranitar", 34], ["Houndstone", "Tyranitar", 24],
    ["Pelipper", "Swampert", 29], ["Swampert", "Pelipper", 14], ["Politoed", "Swampert", 16], ["Swampert", "Politoed", 9],
    ["Pelipper", "Archaludon", 25], ["Archaludon", "Pelipper", 12], ["Politoed", "Archaludon", 24], ["Archaludon", "Politoed", 11],
    ["Sableye", "Archaludon", 28], ["Archaludon", "Sableye", 14], ["Sinistcha", "Archaludon", 22], ["Archaludon", "Sinistcha", 16],
    ["Basculegion", "Pelipper", 8], ["Pelipper", "Basculegion", 7],
    ["Venusaur", "Charizard", 46], ["Charizard", "Venusaur", 34], ["Vileplume", "Torkoal", 30], ["Torkoal", "Vileplume", 24],
    ["Vileplume", "Charizard", 22], ["Venusaur", "Torkoal", 24], ["Torkoal", "Venusaur", 15], ["Venusaur", "Ninetales", 20], ["Ninetales", "Venusaur", 13],
    ["Oranguru", "Torkoal", 24], ["Torkoal", "Oranguru", 20], ["Torkoal", "Farigiraf", 18], ["Hatterene", "Farigiraf", 17],
    ["Crabominable", "Farigiraf", 16], ["Camerupt", "Farigiraf", 16], ["Farigiraf", "Torkoal", 14], ["Farigiraf", "Hatterene", 13],
    ["Farigiraf", "Crabominable", 12], ["Farigiraf", "Camerupt", 12],
    ["Maushold", "Annihilape", 24], ["Annihilape", "Maushold", 24], ["Maushold", "Gardevoir", 18], ["Gardevoir", "Maushold", 18],
    ["Lycanroc", "Hippowdon", 21], ["Hippowdon", "Lycanroc", 17], ["Houndstone", "Hippowdon", 21], ["Hippowdon", "Houndstone", 17],
    ["Lycanroc", "Tyranitar", 16], ["Tyranitar", "Lycanroc", 13],
    ["Gengar", "Incineroar", 17], ["Incineroar", "Gengar", 15], ["Rillaboom", "Incineroar", 8], ["Incineroar", "Rillaboom", 8],
    ["Rotom-Heat", "Garchomp", 24], ["Rotom-Wash", "Garchomp", 22], ["Garchomp", "Rotom-Heat", 12], ["Garchomp", "Rotom-Wash", 11],
    ["Sneasler", "Rillaboom", 22], ["Rillaboom", "Sneasler", 17], ["Hawlucha", "Rillaboom", 20], ["Rillaboom", "Hawlucha", 15],
    ["Sceptile", "Rillaboom", 12], ["Rillaboom", "Sceptile", 9],
    ["Whimsicott", "Talonflame", -24], ["Talonflame", "Whimsicott", -24],
  ].forEach((pair) => addPair(...pair));

  const TYPE_WEAKNESSES = {
    Normal: ["Fighting"], Fire: ["Water", "Ground", "Rock"], Water: ["Electric", "Grass"],
    Electric: ["Ground"], Grass: ["Fire", "Ice", "Poison", "Flying", "Bug"], Ice: ["Fire", "Fighting", "Rock", "Steel"],
    Fighting: ["Flying", "Psychic", "Fairy"], Poison: ["Ground", "Psychic"], Ground: ["Water", "Grass", "Ice"],
    Flying: ["Electric", "Ice", "Rock"], Psychic: ["Bug", "Ghost", "Dark"], Bug: ["Fire", "Flying", "Rock"],
    Rock: ["Water", "Grass", "Fighting", "Ground", "Steel"], Ghost: ["Ghost", "Dark"], Dragon: ["Ice", "Dragon", "Fairy"],
    Dark: ["Fighting", "Bug", "Fairy"], Steel: ["Fire", "Fighting", "Ground"], Fairy: ["Poison", "Steel"],
  };

  const shuffle = (items, rng) => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  };
  const weightedPick = (items, weightFor, rng) => {
    const weighted = items.map((item) => [item, Math.max(0, weightFor(item))]);
    const total = weighted.reduce((sum, entry) => sum + entry[1], 0);
    if (!total) return items[0];
    let roll = rng() * total;
    for (const [item, weight] of weighted) {
      roll -= weight;
      if (roll <= 0) return item;
    }
    return items.at(-1);
  };

  const create = ({ catalog, rolesFor, pointCap = 50, teamCount = 14, rosterSize = 10, rng = Math.random }) => {
    const byName = new Map(catalog.map((pokemon) => [pokemon.name, pokemon]));
    const roleSets = new Map(catalog.map((pokemon) => [pokemon.name, new Set(rolesFor(pokemon))]));
    const points = (pokemon) => Number(pokemon?.sortPoints ?? pokemon?.points ?? 0);
    const roles = (pokemon) => roleSets.get(pokemon?.name) || new Set();
    const pickNames = (team) => team.picks.map((pick) => pick.name);
    const teamPoints = (team) => team.picks.reduce((sum, pick) => sum + points(pick), 0);
    const roundForPick = (index) => Math.floor(index / teamCount) + 1;
    const teamForPick = (index) => {
      const round = Math.floor(index / teamCount);
      const within = index % teamCount;
      return round % 2 === 0 ? within + 1 : teamCount - within;
    };
    const nextPickDistance = (teamId, index) => {
      for (let distance = 1; distance <= teamCount * rosterSize; distance += 1) {
        if (teamForPick(index + distance) === teamId) return distance;
      }
      return 99;
    };
    const hasRole = (pokemon, role) => roles(pokemon).has(role);
    const rosterHasRole = (team, role) => team.picks.some((pick) => hasRole(pick, role));
    const rosterHasAnyRole = (team, wanted) => team.picks.some((pick) => [...roles(pick)].some((role) => wanted.has(role)));
    const attackerCache = new Map(catalog.map((pokemon) => [pokemon.name, [...roles(pokemon)].some((role) => ATTACK_ROLES.has(role))]));
    const bulkyCache = new Map(catalog.map((pokemon) => [pokemon.name, [...roles(pokemon)].some((role) => BULK_ROLES.has(role))]));
    const megaCache = new Map(catalog.map((pokemon) => [pokemon.name, hasRole(pokemon, "Mega") || hasRole(pokemon, "Dual Mega")]));
    const weatherCache = new Map(catalog.map((pokemon) => [pokemon.name, Object.entries(WEATHER).filter(([, plan]) => plan.setters.includes(pokemon.name) || plan.roles.some((role) => hasRole(pokemon, role))).map(([name]) => name)]));
    const isAttacker = (pokemon) => attackerCache.get(pokemon?.name) || false;
    const isSupportHeavy = (pokemon) => hasRole(pokemon, "Support") && !isAttacker(pokemon);
    const isBulky = (pokemon) => bulkyCache.get(pokemon?.name) || false;
    const isMega = (pokemon) => megaCache.get(pokemon?.name) || false;
    const weatherTypesFor = (pokemon) => weatherCache.get(pokemon?.name) || [];
    const teamWeather = (team) => new Set(team.picks.flatMap(weatherTypesFor));
    const reliableRainOwned = (team, context) => {
      const owned = new Set(pickNames(team));
      if (owned.has("Pelipper") || owned.has("Politoed")) return true;
      const primarySettersGone = !context.available.has("Pelipper") && !context.available.has("Politoed");
      return primarySettersGone && owned.has("Sableye");
    };
    const budgetLegal = (team, pokemon) => {
      if (!team || team.picks.length >= rosterSize) return false;
      const slotsAfter = rosterSize - team.picks.length - 1;
      return teamPoints(team) + points(pokemon) + slotsAfter <= pointCap;
    };
    const basicLegal = (team, pokemon, context) => Boolean(pokemon && context.available.has(pokemon.name) && budgetLegal(team, pokemon));
    const affordableAfter = (team, first, partner) => {
      if (!partner) return false;
      const slotsAfterPair = rosterSize - team.picks.length - 2;
      return slotsAfterPair >= 0 && teamPoints(team) + points(first) + points(partner) + slotsAfterPair <= pointCap;
    };

    const violatesFamily = (team, pokemon) => FORM_FAMILIES.some((family) => family.has(pokemon.name) && team.picks.some((pick) => pick.name !== pokemon.name && family.has(pick.name)));
    const violatesCombination = (team, pokemon) => {
      const owned = new Set(pickNames(team));
      if ((pokemon.name === "Excadrill" && owned.has("Houndstone")) || (pokemon.name === "Houndstone" && owned.has("Excadrill"))) return true;
      const trio = ["Charizard", "Talonflame", "Dragonite"];
      return trio.includes(pokemon.name) && trio.filter((name) => owned.has(name)).length >= 2;
    };

    const isLegal = (team, pokemon, context, isCpu = false) => {
      if (!basicLegal(team, pokemon, context) || violatesFamily(team, pokemon) || violatesCombination(team, pokemon)) return false;
      const owned = new Set(pickNames(team));
      const distance = nextPickDistance(team.id, context.pickIndex);

      if (pokemon.name === "Swampert" && !reliableRainOwned(team, context)) {
        const liveSetters = ["Pelipper", "Politoed"].map((name) => byName.get(name)).filter((partner) => basicLegal(team, partner, context) && affordableAfter(team, pokemon, partner));
        const fallback = byName.get("Sableye");
        const rainPath = liveSetters.length || (!context.available.has("Pelipper") && !context.available.has("Politoed") && basicLegal(team, fallback, context) && affordableAfter(team, pokemon, fallback));
        if (!rainPath || (isCpu && (distance !== 1 || team.picks.length >= rosterSize - 1))) return false;
      }
      if (pokemon.name === "Archaludon" && !["Pelipper", "Politoed", "Sableye"].some((name) => owned.has(name))) {
        const rainPath = ["Pelipper", "Politoed", "Sableye"].some((name) => affordableAfter(team, pokemon, byName.get(name)) && context.available.has(name));
        if (!rainPath || (isCpu && distance > 2)) return false;
      }

      if (["Torkoal", "Snorlax"].includes(pokemon.name) && !DEDICATED_TR.some((name) => owned.has(name))) {
        const setterPath = DEDICATED_TR.some((name) => affordableAfter(team, pokemon, byName.get(name)) && context.available.has(name));
        if (distance > 2 || !setterPath) return false;
      }
      if (pokemon.name === "Mawile" && !DEDICATED_TR.some((name) => owned.has(name))) {
        const paths = DEDICATED_TR.filter((name) => affordableAfter(team, pokemon, byName.get(name)) && context.available.has(name)).length;
        const required = distance >= 20 ? 3 : distance >= 6 ? 2 : 1;
        if (distance > 10 || paths < required) return false;
      }
      if (pokemon.name === "Hatterene" && !DEDICATED_TR.some((name) => owned.has(name))) {
        const committed = team.draftStrategy === "specific-core" && team.specificCore === "trickRoom";
        const paths = DEDICATED_TR.filter((name) => affordableAfter(team, pokemon, byName.get(name)) && context.available.has(name)).length;
        const required = distance >= 20 ? 3 : distance >= 6 ? 2 : 1;
        if (!committed || paths < required) return false;
      }
      if (pokemon.name === "Oranguru" && !team.picks.some((pick) => TR_PAYOFF.has(pick.name))) {
        const committed = team.draftStrategy === "specific-core" && team.specificCore === "trickRoom" && team.picks.length <= 4;
        const payoffLive = [...TR_PAYOFF].some((name) => basicLegal(team, byName.get(name), context));
        if (!committed || !payoffLive) return false;
      }
      if (pokemon.name === "Ninetales" && !team.picks.some((pick) => SPECIFIC_CORES.sun.anchors.includes(pick.name))) {
        const committed = team.draftStrategy === "specific-core" && team.specificCore === "sun" && team.picks.length <= 3;
        const payoffLive = SPECIFIC_CORES.sun.anchors.some((name) => basicLegal(team, byName.get(name), context));
        if (!committed || !payoffLive) return false;
      }
      if (["Houndstone", "Lycanroc"].includes(pokemon.name) && owned.has("Tyranitar") && basicLegal(team, byName.get("Excadrill"), context)) return false;
      return true;
    };

    const legalCandidates = (team, context, isCpu = false) => [...context.available]
      .map((name) => byName.get(name))
      .filter((pokemon) => isLegal(team, pokemon, context, isCpu));
    const namedLegal = (legal, wanted) => wanted.map((name) => legal.find((pokemon) => pokemon.name === name)).filter(Boolean);

    const hardDeadlinePool = (legal, overall) => {
      const due = Object.entries(HARD_DEADLINES)
        .map(([name, deadline]) => ({ pokemon: legal.find((candidate) => candidate.name === name), deadline }))
        .filter((entry) => entry.pokemon);
      for (const deadline of [...new Set(due.map((entry) => entry.deadline))].sort((a, b) => a - b)) {
        const deadlinePicks = due.filter((entry) => entry.deadline <= deadline).map((entry) => entry.pokemon);
        const selectionsRemaining = Math.max(0, deadline - overall + 1);
        if (deadlinePicks.length && deadlinePicks.length >= selectionsRemaining) return deadlinePicks;
      }
      if (overall >= 7) {
        const charizard = legal.find((pokemon) => pokemon.name === "Charizard");
        if (charizard) return [charizard];
      }
      return null;
    };

    const forcedDependency = (team, legal, context) => {
      const owned = new Set(pickNames(team));
      const pickFirst = (wanted, rule) => {
        const pool = namedLegal(legal, wanted);
        return pool.length ? { pool: [pool[0]], rule } : null;
      };
      if (owned.has("Swampert") && !reliableRainOwned(team, context)) return pickFirst(["Pelipper", "Politoed", "Sableye"], "Swampert rain partner");
      if (owned.has("Archaludon") && !["Pelipper", "Politoed", "Sableye"].some((name) => owned.has(name))) return pickFirst(["Pelipper", "Politoed", "Sableye"], "Archaludon rain partner");
      if (owned.has("Charizard") && !owned.has("Venusaur")) return pickFirst(["Venusaur"], "Charizard + Venusaur core");
      if (owned.has("Tyranitar") && !["Excadrill", "Houndstone", "Lycanroc"].some((name) => owned.has(name))) return pickFirst(["Excadrill", "Houndstone", "Lycanroc"], "Tyranitar sand partner");

      const last = [...team.picks].reverse().find((pick) => !pick.mascot);
      if (last && ["Torkoal", "Snorlax", "Mawile", "Hatterene"].includes(last.name) && !DEDICATED_TR.some((name) => owned.has(name))) {
        return pickFirst(DEDICATED_TR, `${last.name} Trick Room setter`);
      }
      if (last?.name === "Oranguru" && !team.picks.some((pick) => TR_PAYOFF.has(pick.name))) return pickFirst([...TR_PAYOFF], "Oranguru Trick Room payoff");
      if (last?.name === "Ninetales" && !SPECIFIC_CORES.sun.anchors.some((name) => owned.has(name))) return pickFirst(SPECIFIC_CORES.sun.anchors, "Ninetales sun payoff");
      return null;
    };

    const stageMultiplier = (team) => team.picks.length <= 3 ? 0.58 : team.picks.length <= 6 ? 0.9 : team.picks.length <= 8 ? 1.08 : 1.24;
    const countRole = (team, role) => team.picks.filter((pick) => hasRole(pick, role)).length;
    const needScore = (team, pokemon) => {
      const candidateRoles = roles(pokemon);
      const stage = stageMultiplier(team);
      const addIfMissing = (role, value) => (!rosterHasRole(team, role) && candidateRoles.has(role) ? value * stage : 0);
      let score = 0;
      score += addIfMissing("Heavy Hitter", 18);
      score += addIfMissing("Special Powerhouse", 18);
      score += addIfMissing("Speedster", 18);
      score += addIfMissing("Support", 14);
      const positionalMissing = !rosterHasRole(team, "Prankster") && !rosterHasRole(team, "Redirection");
      if (positionalMissing && (candidateRoles.has("Prankster") || candidateRoles.has("Redirection"))) score += 15 * stage;
      const tempoMissing = !rosterHasRole(team, "Fake Out") && !rosterHasRole(team, "Intimidate");
      if (tempoMissing && (candidateRoles.has("Fake Out") || candidateRoles.has("Intimidate"))) score += 16 * stage;
      const speedMissing = !team.picks.some((pick) => PREMIUM_TAILWIND.has(pick.name) || RELIABLE_TAILWIND.has(pick.name) || RELIABLE_TR.has(pick.name));
      if (speedMissing && (PREMIUM_TAILWIND.has(pokemon.name) || RELIABLE_TR.has(pokemon.name))) score += 20;
      else if (speedMissing && RELIABLE_TAILWIND.has(pokemon.name)) score += 14;
      const bulkyCount = team.picks.filter(isBulky).length;
      if (isBulky(pokemon)) score += bulkyCount === 0 ? 9 * stage : bulkyCount === 1 ? 4 * stage : -7;
      const megaCount = team.picks.filter(isMega).length;
      if (isMega(pokemon)) score += megaCount === 0 ? 6 * stage : megaCount === 1 ? 5 * stage : megaCount === 2 ? 1.5 * stage : -12;
      if (candidateRoles.has("Dual Mega")) score += 1.5;
      return score;
    };

    const repeatPenalty = (team, pokemon) => {
      const last = [...team.picks].reverse().find((pick) => !pick.mascot);
      if (!last) return 0;
      const candidate = roles(pokemon);
      const previous = roles(last);
      const penalties = { Speedster: -14, "Heavy Hitter": -6, "Special Powerhouse": -6, Support: -5, Prankster: -6, Redirection: -5, "Fake Out": -5, Intimidate: -5, Mega: -3 };
      let score = 0;
      Object.entries(penalties).forEach(([role, penalty]) => {
        const candidateMatch = role === "Mega" ? isMega(pokemon) : candidate.has(role);
        const previousMatch = role === "Mega" ? isMega(last) : previous.has(role);
        if (candidateMatch && previousMatch) score += penalty;
      });
      if (isBulky(pokemon) && isBulky(last)) score -= 4;
      if (weatherTypesFor(pokemon).some((weather) => weatherTypesFor(last).includes(weather))) score -= 7;
      return score;
    };

    const typeDiversity = (team, pokemon) => {
      const counts = {};
      team.picks.flatMap((pick) => pick.types || []).forEach((type) => { counts[type] = (counts[type] || 0) + 1; });
      let score = (pokemon.types || []).reduce((sum, type) => sum + (counts[type] >= 3 ? -8 : counts[type] === 2 ? -5.5 : counts[type] === 1 ? -2.5 : 0), 0);
      const exact = team.picks.filter((pick) => [...(pick.types || [])].sort().join("|") === [...(pokemon.types || [])].sort().join("|")).length;
      if (exact) score += exact >= 2 ? -13 : -8;
      const last = [...team.picks].reverse().find((pick) => !pick.mascot);
      if (last) {
        const shared = (pokemon.types || []).filter((type) => (last.types || []).includes(type)).length;
        score += shared >= 2 ? -6 : shared === 1 ? -2 : 0;
      }
      return score;
    };

    const buildWeaknessProfile = (pokemon) => {
      const multipliers = {};
      (pokemon.types || []).forEach((type) => (TYPE_WEAKNESSES[type] || []).forEach((weakness) => { multipliers[weakness] = (multipliers[weakness] || 1) * 2; }));
      return multipliers;
    };
    const weaknessCache = new Map(catalog.map((pokemon) => [pokemon.name, buildWeaknessProfile(pokemon)]));
    const weaknessProfile = (pokemon) => weaknessCache.get(pokemon?.name) || {};
    const weaknessPenalty = (team, pokemon) => {
      const existing = team.picks.map(weaknessProfile);
      let score = 0;
      Object.entries(weaknessProfile(pokemon)).forEach(([type, multiplier]) => {
        const weak = existing.filter((profile) => (profile[type] || 1) > 1).length;
        const four = existing.filter((profile) => (profile[type] || 1) >= 4).length;
        score += weak >= 3 ? -8.5 : weak === 2 ? -5.5 : weak === 1 ? -1.5 : 0;
        if (multiplier >= 4 && weak) score -= 2.5;
        if (multiplier >= 4 && four) score -= 3.5;
      });
      return score;
    };

    const budgetScore = (team, pokemon) => {
      const slotsBefore = rosterSize - team.picks.length;
      const budgetBefore = pointCap - teamPoints(team);
      const slotsAfter = slotsBefore - 1;
      const budgetAfter = budgetBefore - points(pokemon);
      const currentAvg = budgetBefore / Math.max(1, slotsBefore);
      const futureAvg = slotsAfter ? budgetAfter / slotsAfter : 0;
      const futureExtra = budgetAfter - slotsAfter;
      let score = 0;
      if (slotsAfter >= 2) {
        if (futureExtra === 0) score -= 32;
        else if (futureExtra === 1 && slotsAfter >= 3) score -= 22;
        else if (futureAvg < 1.5) score -= 18;
        else if (futureAvg < 2) score -= 10;
        else if (futureAvg < 2.35 && slotsAfter >= 3) score -= 5;
      }
      const over = points(pokemon) - currentAvg;
      const under = currentAvg - points(pokemon);
      if (over > 2) score -= 4 * (over - 1);
      else if (over > 1) score -= 2.25 * over;
      if (under > 2.5) score -= Math.min(8, (under - 2.5) * 2);
      if (Math.abs(points(pokemon) - currentAvg) <= 0.75) score += 4;
      else if (Math.abs(points(pokemon) - currentAvg) <= 1.5) score += 2;
      if (currentAvg >= 3.25 && points(pokemon) === 1) score -= 4;
      else if (currentAvg >= 4.25 && points(pokemon) <= 2) score -= 2.5;
      return score;
    };

    const baseMarket = (pokemon, round) => {
      let score = points(pokemon) * 7.4;
      if (round === 1) score += points(pokemon) === 10 ? 27 : points(pokemon) === 9 ? 15 : points(pokemon) <= 7 ? -12 : 0;
      else if (round === 2) score += points(pokemon) === 10 ? 20 : points(pokemon) === 9 ? 18 : points(pokemon) <= 6 ? -7 : 0;
      else if (round <= 5) score += points(pokemon) >= 7 ? 5 : points(pokemon) <= 5 ? 3 : 0;
      if (round >= 7) score += (6 - points(pokemon)) * 1.2;
      return score;
    };

    const premiumBonus = (pokemon, overall) => {
      const config = PREMIUM[pokemon.name];
      if (!config) return 0;
      let score = config.early;
      if (overall >= config.urgency) score += (overall - config.urgency + 1) * 4.5;
      if (config.softDeadline && overall >= config.softDeadline - 2) score += 14;
      if (pokemon.name === "Basculegion" && [2, 3].includes(overall)) score += 18;
      return score;
    };

    const timingScore = (pokemon, overall) => {
      if (pokemon.name === "Farigiraf") return overall <= 5 ? -30 : overall <= 9 ? -18 : overall <= 13 ? -7 : overall <= 18 ? 5 : overall <= 23 ? 8 : overall <= 28 ? 5 : 0;
      if (pokemon.name === "Hatterene") return overall <= 20 ? -16 : overall <= 28 ? -8 : overall <= 42 ? -2 : 0;
      return 0;
    };

    const marketBonus = (pokemon, round) => {
      if (round === 1 && points(pokemon) === 10) return 18;
      if (round === 1 && points(pokemon) === 9) return 7;
      if (round >= 2 && points(pokemon) === 10) return 80;
      if (round === 2 && points(pokemon) === 9) return 13;
      if (round >= 3 && points(pokemon) === 9) return 40;
      return 0;
    };

    const dependencyScore = (team, pokemon, context) => {
      const owned = new Set(pickNames(team));
      let score = 0;
      if (hasRole(pokemon, "Rain Abuser") && !reliableRainOwned(team, context)) score -= pokemon.name === "Swampert" ? 16 : pokemon.name === "Archaludon" ? 30 : 10;
      if (hasRole(pokemon, "Sun Abuser") && !team.picks.some((pick) => weatherTypesFor(pick).includes("sun"))) score -= pokemon.name === "Vileplume" ? 28 : 8;
      if (TR_PAYOFF.has(pokemon.name) && !DEDICATED_TR.some((name) => owned.has(name)) && !team.picks.some((pick) => RELIABLE_TR.has(pick.name))) score -= 18;
      if (pokemon.name === "Torkoal" && !DEDICATED_TR.some((name) => owned.has(name))) score -= 14;
      if (pokemon.name === "Houndstone" && !owned.has("Tyranitar") && !owned.has("Hippowdon")) score -= 14;
      return score;
    };

    const redundancyScore = (team, pokemon) => {
      let score = 0;
      const duplicate = (role, penalty) => { if (hasRole(pokemon, role) && rosterHasRole(team, role)) score += penalty; };
      duplicate("Prankster", -4); duplicate("Tailwind", -5); duplicate("Priority Tailwind", -5);
      duplicate("Speedster", -7); duplicate("Heavy Hitter", -3); duplicate("Special Powerhouse", -3);
      if (hasRole(pokemon, "Support") && countRole(team, "Support") >= 2) score -= 4;
      if (isBulky(pokemon) && team.picks.filter(isBulky).length >= 2) score -= 5;
      if (isMega(pokemon) && team.picks.filter(isMega).length >= 3) score -= 5;
      if ((pokemon.name === "Whimsicott" && pickNames(team).includes("Talonflame")) || (pokemon.name === "Talonflame" && pickNames(team).includes("Whimsicott"))) score -= 12;
      return score;
    };

    const rawSynergy = (team, pokemon) => {
      const owned = new Set(pickNames(team));
      let score = 0;
      owned.forEach((name) => { score += PAIR_SYNERGY.get(`${pokemon.name}|${name}`) || 0; });
      if (TR_PAYOFF.has(pokemon.name) && team.picks.some((pick) => RELIABLE_TR.has(pick.name))) score += 22;
      if (pokemon.name === "Clefable") {
        const hitters = team.picks.filter((pick) => hasRole(pick, "Heavy Hitter") || hasRole(pick, "Special Powerhouse")).length;
        score += hitters >= 2 ? 13 : hitters === 1 ? 9 : 0;
      }
      if (owned.has("Clefable") && (hasRole(pokemon, "Heavy Hitter") || hasRole(pokemon, "Special Powerhouse"))) score += 9;
      if (hasRole(pokemon, "Redirection") && team.picks.some((pick) => PREMIUM_TAILWIND.has(pick.name) || RELIABLE_TAILWIND.has(pick.name))) score += 6;
      if (hasRole(pokemon, "Fake Out") && team.picks.some((pick) => PREMIUM_TAILWIND.has(pick.name) || RELIABLE_TAILWIND.has(pick.name) || RELIABLE_TR.has(pick.name))) score += 7;
      if (owned.has("Pelipper") && owned.has("Archaludon") && pokemon.name === "Swampert") score += 34;
      if (owned.has("Pelipper") && owned.has("Swampert") && pokemon.name === "Archaludon") score += 34;
      if (owned.has("Archaludon") && owned.has("Swampert") && pokemon.name === "Pelipper") score += 40;
      return score;
    };

    const effectiveSynergy = (team, pokemon, round) => {
      const raw = rawSynergy(team, pokemon);
      if (raw <= 0) return raw;
      let cap = round <= 2 ? 5 : round <= 4 ? 9 : round <= 6 ? 13 : 18;
      const foundation = (!rosterHasRole(team, "Heavy Hitter") && hasRole(pokemon, "Heavy Hitter"))
        || (!rosterHasRole(team, "Special Powerhouse") && hasRole(pokemon, "Special Powerhouse"))
        || (!rosterHasRole(team, "Speedster") && hasRole(pokemon, "Speedster"))
        || (!rosterHasRole(team, "Support") && hasRole(pokemon, "Support"))
        || (team.picks.filter(isBulky).length < 2 && isBulky(pokemon));
      if (foundation) cap += 2;
      if (team.picks.length <= 3 && !foundation) cap = Math.min(cap, 3);
      return Math.min(raw, cap);
    };

    const weatherScore = (team, pokemon) => {
      const existing = teamWeather(team);
      const candidate = weatherTypesFor(pokemon);
      let score = 0;
      candidate.forEach((weather) => {
        if (existing.has(weather)) score -= 16;
        else if (existing.size) score -= 12 + 5 * existing.size;
      });
      for (const weather of existing) {
        if (hasRole(pokemon, WEATHER[weather].abuserRole)) score += 14;
      }
      return Math.max(-33, score);
    };

    const swampertRisk = (team, pokemon, context) => {
      if (pokemon.name !== "Swampert" || reliableRainOwned(team, context)) return 0;
      const distance = nextPickDistance(team.id, context.pickIndex);
      const live = ["Pelipper", "Politoed"].filter((name) => context.available.has(name) && affordableAfter(team, pokemon, byName.get(name))).length;
      let penalty = distance >= 20 ? (live >= 2 ? -32 : -40) : distance >= 14 ? (live >= 2 ? -22 : -30) : distance >= 9 ? (live >= 2 ? -13 : -19) : distance >= 5 ? (live >= 2 ? -6 : -10) : 0;
      if (pickNames(team).includes("Sableye") && penalty < 0) penalty = Math.min(0, penalty + 8);
      return penalty;
    };

    const turnDistanceScore = (team, pokemon, context) => {
      if (context.pickIndex + 1 > 28) return 0;
      const enabler = weatherTypesFor(pokemon).length || PREMIUM_TAILWIND.has(pokemon.name) || RELIABLE_TR.has(pokemon.name);
      if (!enabler) return 0;
      const distance = nextPickDistance(team.id, context.pickIndex);
      if (team.id <= 4 && distance > 18) return -10;
      if (team.id >= 11 && distance <= 7) return 6;
      return 0;
    };

    const profileScore = (team, pokemon, isCpu) => {
      const profile = team.primaryProfile || "balanced";
      let score = 0;
      if (profile === "offense" && isAttacker(pokemon)) score += 7 + (hasRole(pokemon, "Heavy Hitter") || hasRole(pokemon, "Special Powerhouse") ? 2.5 : 0);
      if (profile === "support" && (hasRole(pokemon, "Support") || hasRole(pokemon, "Fake Out") || hasRole(pokemon, "Prankster"))) score += 8;
      if (profile === "value" && points(pokemon) <= 5) score += 8;
      if (profile === "mega" && isMega(pokemon)) score += 7;
      if (profile === "speed" && (PREMIUM_TAILWIND.has(pokemon.name) || RELIABLE_TAILWIND.has(pokemon.name) || RELIABLE_TR.has(pokemon.name))) score += 9 + (hasRole(pokemon, "Speedster") ? 2 : 0);
      if (profile === "bulk" && isBulky(pokemon)) score += 8;
      if (profile === "weather" && (weatherTypesFor(pokemon).length || Object.values(WEATHER).some((plan) => hasRole(pokemon, plan.abuserRole)))) score += 7;
      return score * (isCpu ? 1 : 0.75);
    };

    const strategyScore = (team, pokemon, round, isCpu) => {
      if (!isCpu) return 0;
      if (team.draftStrategy === "balanced") {
        if (round <= 3) return points(pokemon) >= 8 ? 12 : points(pokemon) <= 5 ? -7 : 0;
        if (round <= 5) return points(pokemon) >= 7 ? 7 : points(pokemon) >= 4 ? 3 : 0;
        return points(pokemon) >= 4 && points(pokemon) <= 6 ? 13 : points(pokemon) <= 2 ? -12 : points(pokemon) === 3 ? -4 : 0;
      }
      if (team.draftStrategy === "all-around") {
        if (round <= 2) return points(pokemon) >= 6 && points(pokemon) <= 8 ? 24 : points(pokemon) === 5 ? 7 : points(pokemon) >= 9 ? -16 : points(pokemon) <= 3 ? -12 : 2;
        if (round <= 5) return points(pokemon) >= 5 && points(pokemon) <= 7 ? 20 : points(pokemon) === 8 ? 8 : points(pokemon) >= 9 ? -14 : points(pokemon) <= 3 ? -10 : 3;
        return points(pokemon) >= 4 && points(pokemon) <= 6 ? 18 : points(pokemon) === 7 ? 6 : points(pokemon) >= 8 ? -10 : points(pokemon) <= 2 ? -12 : 5;
      }
      if (team.draftStrategy === "specific-core") {
        const core = SPECIFIC_CORES[team.specificCore];
        if (!core) return 0;
        const owned = new Set(pickNames(team));
        const hasSetter = core.setters.some((name) => owned.has(name));
        const hasAnchor = core.anchors.some((name) => owned.has(name));
        if (core.setters.includes(pokemon.name)) return !hasSetter && hasAnchor ? (round <= 4 ? 34 : 26) : !hasSetter && team.picks.length <= 3 ? 12 : !hasSetter ? -18 : 4;
        if (core.anchors.includes(pokemon.name)) return hasSetter ? 26 : 16;
        if (core.support.includes(pokemon.name)) return hasSetter || hasAnchor ? 12 : 5;
        return hasSetter && hasAnchor ? 3 : 0;
      }
      return 0;
    };

    const scoreCandidate = (team, pokemon, context, isCpu) => {
      const overall = context.pickIndex + 1;
      const round = roundForPick(context.pickIndex);
      let score = baseMarket(pokemon, round)
        + marketBonus(pokemon, round)
        + premiumBonus(pokemon, overall)
        + timingScore(pokemon, overall)
        + budgetScore(team, pokemon)
        + needScore(team, pokemon)
        + repeatPenalty(team, pokemon)
        + typeDiversity(team, pokemon)
        + weaknessPenalty(team, pokemon)
        + dependencyScore(team, pokemon, context)
        + redundancyScore(team, pokemon)
        + effectiveSynergy(team, pokemon, round)
        + weatherScore(team, pokemon)
        + swampertRisk(team, pokemon, context)
        + turnDistanceScore(team, pokemon, context)
        + profileScore(team, pokemon, isCpu)
        + strategyScore(team, pokemon, round, isCpu);
      if (round === 1) score += ROUND_ONE_PROMINENCE[pokemon.name] || 0;
      return score * (team.aggression || 1);
    };

    const remainingCpuSelections = (context, roundEnd) => {
      let count = 0;
      for (let index = context.pickIndex; index < roundEnd; index += 1) {
        const teamId = teamForPick(index);
        if (!context.humanTeamId || teamId !== context.humanTeamId) count += 1;
      }
      return count;
    };

    const marketPool = (team, legal, context, isCpu) => {
      const round = roundForPick(context.pickIndex);
      if (!isCpu && round === 1) {
        const premium = legal.filter((pokemon) => points(pokemon) >= 9);
        if (premium.length) {
          const nonNiche = premium.filter((pokemon) => !["Sableye", "Sinistcha"].includes(pokemon.name));
          return nonNiche.length ? nonNiche : premium;
        }
      }
      if (isCpu && round >= 2 && team.draftStrategy !== "all-around") {
        const tens = legal.filter((pokemon) => points(pokemon) === 10);
        if (tens.length) return tens;
      }
      if (isCpu && round === 1) {
        const tens = legal.filter((pokemon) => points(pokemon) === 10);
        const remaining = remainingCpuSelections(context, teamCount);
        if (tens.length && tens.length >= remaining) return tens;
      }
      if (isCpu && round === 2) {
        const nines = legal.filter((pokemon) => points(pokemon) === 9);
        const remaining = remainingCpuSelections(context, teamCount * 2);
        if (nines.length && nines.length >= remaining) return nines;
      }
      return legal;
    };

    const allAroundOpeningPool = (team, pool) => {
      if (team.draftStrategy !== "all-around" || team.picks.filter((pick) => !pick.mascot).length) return pool;
      const target = pool.filter((pokemon) => points(pokemon) >= 6 && points(pokemon) <= 8);
      const narrowed = (target.length ? target : pool).filter((pokemon) => !isSupportHeavy(pokemon) && !hasRole(pokemon, "Prankster") && !DEDICATED_TR.includes(pokemon.name) && !weatherTypesFor(pokemon).length);
      return narrowed.length ? narrowed : target.length ? target : pool;
    };

    const reasonsFor = (team, pokemon, context, forcedRule, scored) => {
      const reasons = [];
      if (forcedRule) reasons.push(forcedRule);
      const synergy = effectiveSynergy(team, pokemon, roundForPick(context.pickIndex));
      if (!forcedRule && synergy >= 10) reasons.push("strong existing-core synergy");
      if (!rosterHasRole(team, "Heavy Hitter") && hasRole(pokemon, "Heavy Hitter")) reasons.push("fills missing high-end physical offense");
      if (!rosterHasRole(team, "Special Powerhouse") && hasRole(pokemon, "Special Powerhouse")) reasons.push("fills missing high-end special offense");
      if (!rosterHasRole(team, "Speedster") && hasRole(pokemon, "Speedster")) reasons.push("adds a missing Speedster");
      if (!rosterHasRole(team, "Support") && hasRole(pokemon, "Support")) reasons.push("adds a true support piece");
      if (!rosterHasRole(team, "Prankster") && hasRole(pokemon, "Prankster")) reasons.push("adds Prankster utility");
      if (!rosterHasRole(team, "Fake Out") && hasRole(pokemon, "Fake Out")) reasons.push("adds Fake Out tempo");
      if (!rosterHasRole(team, "Intimidate") && hasRole(pokemon, "Intimidate")) reasons.push("adds Intimidate");
      if (team.picks.filter(isBulky).length < 2 && isBulky(pokemon)) reasons.push("adds reliable bulk");
      if (team.picks.filter(isMega).length < 2 && isMega(pokemon)) reasons.push("adds Mega flexibility");
      if (!reasons.length) reasons.push("best blend of standalone value, roster fit and board scarcity");
      if (points(pokemon) <= 4 && roundForPick(context.pickIndex) >= 3) reasons.push("strong point-value efficiency");
      if (scored?.length && points(pokemon) >= 9) reasons.push("elite remaining market value");
      return [...new Set(reasons)].slice(0, 3);
    };

    const choose = (team, context, { isCpu = false } = {}) => {
      let legal = legalCandidates(team, context, isCpu);
      if (!legal.length) return { pokemon: null, reasons: [], forcedRule: "No legal pick" };
      const overall = context.pickIndex + 1;
      let forcedRule = "";

      if (overall === 1) {
        const elite = namedLegal(legal, OPENING_ELITE);
        if (elite.length) {
          const pokemon = isCpu
            ? weightedPick(elite, (candidate) => PICK_ONE_WEIGHTS[candidate.name] || 0, rng)
            : elite.find((candidate) => candidate.name === "Charizard") || elite[0];
          return { pokemon, reasons: [isCpu ? "elite weighted opening pick" : "locked Pick 1 recommendation"], forcedRule: "Opening elite" };
        }
      }

      const deadline = hardDeadlinePool(legal, overall);
      if (deadline?.length) {
        legal = deadline;
        forcedRule = overall >= 7 && legal.some((pokemon) => pokemon.name === "Charizard") ? "Charizard market deadline" : "Pick-5 premium market deadline";
      } else if (overall <= 4) {
        const elite = namedLegal(legal, OPENING_ELITE);
        if (elite.length) {
          legal = elite;
          forcedRule = "opening elite candidate gate";
        }
      }

      if (!forcedRule) {
        const dependency = forcedDependency(team, legal, context);
        if (dependency?.pool.length) {
          legal = dependency.pool;
          forcedRule = dependency.rule;
        }
      }

      if (!forcedRule) {
        const lastOverall = context.log?.at(-1);
        if (lastOverall?.team === team.id && isSupportHeavy(lastOverall.pokemon)) {
          const attackers = legal.filter(isAttacker);
          if (attackers.length) {
            legal = attackers;
            forcedRule = "support-heavy wheel turn needs attacking pressure";
          }
        }
      }

      if (!forcedRule) legal = marketPool(team, legal, context, isCpu);
      if (isCpu && team.draftStrategy === "top-heavy" && !forcedRule) {
        const highest = Math.max(...legal.map(points));
        legal = legal.filter((pokemon) => points(pokemon) === highest);
      }
      if (isCpu && !forcedRule) legal = allAroundOpeningPool(team, legal);

      const scored = legal.map((pokemon) => ({ pokemon, score: scoreCandidate(team, pokemon, context, isCpu) }))
        .sort((a, b) => b.score - a.score || points(b.pokemon) - points(a.pokemon) || a.pokemon.name.localeCompare(b.pokemon.name));
      let selected = scored[0];
      if (isCpu && scored.length > 1) {
        const range = team.draftStrategy === "all-around" ? 18 : 10;
        const cap = team.draftStrategy === "all-around" ? 10 : 7;
        const divisor = team.draftStrategy === "all-around" ? 9 : 5.5;
        const pool = scored.filter((entry) => entry.score >= scored[0].score - range).slice(0, cap);
        selected = rng() < (team.chaos ?? 0.1) && pool.length > 2
          ? pool[Math.floor(rng() * pool.length)]
          : weightedPick(pool, (entry) => Math.exp((entry.score - pool[0].score) / divisor), rng);
      }
      return {
        pokemon: selected?.pokemon || null,
        score: selected?.score ?? -Infinity,
        reasons: selected ? reasonsFor(team, selected.pokemon, context, forcedRule, scored) : [],
        forcedRule,
        candidates: scored,
      };
    };

    const assignTeamPlans = (teamIds) => {
      const ids = shuffle(teamIds, rng);
      const eligibleAllAround = ids.filter((id) => Number(id) >= 7);
      const allAround = eligibleAllAround[Math.floor(rng() * eligibleAllAround.length)];
      const remaining = ids.filter((id) => id !== allAround);
      const coreTeams = remaining.slice(0, 2);
      const corePlans = shuffle(["rain", "sun", "trickRoom"], rng).slice(0, 2);
      const afterCore = remaining.slice(2);
      const topHeavy = new Set(afterCore.slice(0, 5));
      const balanced = new Set(afterCore.slice(5));
      const profiles = ["balanced", "offense", "support", "value", "mega", "speed", "bulk", "weather"];
      return Object.fromEntries(teamIds.map((id) => {
        let draftStrategy = balanced.has(id) ? "balanced" : topHeavy.has(id) ? "top-heavy" : id === allAround ? "all-around" : "specific-core";
        const coreIndex = coreTeams.indexOf(id);
        return [id, {
          draftStrategy,
          specificCore: coreIndex >= 0 ? corePlans[coreIndex] : null,
          primaryProfile: profiles[Math.floor(rng() * profiles.length)],
          aggression: 0.8 + rng() * 0.45,
          chaos: 0.05 + rng() * 0.16,
        }];
      }));
    };

    return { choose, isLegal, legalCandidates, assignTeamPlans, teamForPick, roundForPick, nextPickDistance, points };
  };

  return { create, constants: { OPENING_ELITE, HARD_DEADLINES, PICK_ONE_WEIGHTS, FORM_FAMILIES } };
});
