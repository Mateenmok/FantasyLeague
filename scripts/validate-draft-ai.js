#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const DraftAI = require("../js/draft-ai.js");

const ROOT = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pokemon-catalog.json"), "utf8"));
const details = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pokemon-details.json"), "utf8")).pokemon || {};
const detailIndex = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pokemon-detail-index.json"), "utf8"));
const source = fs.readFileSync(path.join(ROOT, "js/draft-room.js"), "utf8");
const groupStart = source.indexOf("  const names =");
const groupEnd = source.indexOf("\n\n  const ROLE_MEMBERSHIP", groupStart);
if (groupStart < 0 || groupEnd < 0) throw new Error("Could not read Draft Room role groups.");
const roleGroups = vm.runInNewContext(`(() => {${source.slice(groupStart, groupEnd)}; return ROLE_GROUPS;})()`);
const memberships = Object.fromEntries(Object.entries(roleGroups).map(([role, members]) => [role, new Set(members)]));

const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
const roleCache = new Map();
const rolesFor = (pokemon) => {
  if (roleCache.has(pokemon.name)) return roleCache.get(pokemon.name);
  const roles = new Set();
  const formes = details[normalize(pokemon.name)]?.formes?.filter((forme) => forme.stats) || [];
  if (formes.length) {
    const max = (key) => Math.max(...formes.map((forme) => Number(forme.stats[key]) || 0));
    const attack = max("attack");
    const specialAttack = max("sp_atk");
    const speed = max("speed");
    const defense = max("defense");
    const specialDefense = max("sp_def");
    if (attack >= 120) roles.add("Heavy Hitter"); else if (attack >= 100) roles.add("Physical Attacker");
    if (specialAttack >= 120) roles.add("Special Powerhouse"); else if (specialAttack >= 100) roles.add("Special Attacker");
    if (speed >= 120) roles.add("Speedster"); else if (speed >= 100) roles.add("Fast");
    if (defense >= 120) roles.add("Physical Stronghold"); else if (defense >= 100) roles.add("Physical Tank");
    if (specialDefense >= 120) roles.add("Special Fortress"); else if (specialDefense >= 100) roles.add("Special Wall");
    if (formes.some((forme) => Number(forme.stats.attack) >= 100 && Number(forme.stats.sp_atk) >= 100)) roles.add("Mixed Attacker");
    if (formes.some((forme) => Number(forme.stats.hp) >= 90 && Number(forme.stats.defense) >= 105 && Number(forme.stats.sp_def) >= 105)) roles.add("Bulk City");
  }
  Object.entries(memberships).forEach(([role, members]) => { if (members.has(pokemon.name)) roles.add(role); });
  const result = [...roles];
  roleCache.set(pokemon.name, result);
  return result;
};

const mascots = [
  "Torterra", "Krookodile", "Houndoom", "Conkeldurr", "Feraligatr", "Ceruledge", "Hisuian Arcanine",
  "Eelektross", "Hisuian Goodra", "Umbreon", "Dragapult", "Chandelure", "Rotom-Wash", "Mimikyu",
];
const byName = new Map(catalog.map((pokemon) => [pokemon.name, pokemon]));
const pointValue = (pokemon) => Number(pokemon?.sortPoints ?? pokemon?.points ?? 0);
const seededRandom = (seed) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const requested = Number(process.argv[2] || 10000);
const seedOffset = Number(process.argv[3] || 0);
if (!Number.isInteger(requested) || requested < 1) throw new Error("Pass a positive mock count.");
const pickStats = new Map();
const pickOne = new Map();
const availableEntering = Object.fromEntries([2, 3, 4, 5, 6].map((pick) => [pick, 0]));
let invalidBudgets = 0;
let incompleteRosters = 0;
let invalidForms = 0;
let invalidDependencies = 0;
const dependencyExamples = [];
let strategyMixFailures = 0;
const requiredV113Additions = ["Arboliva", "Baxcalibur", "Cinderace", "Farfetch'd", "Gogoat", "Golisopod", "Grapploct", "Indeedee", "Inteleon", "Mabosstiff", "Mr. Mime", "Musharna", "Pawmot", "Perrserker", "Persian", "Persian-Alola", "Pincurchin", "Sirfetch'd", "Squawkabilly-Blue", "Squawkabilly-Green", "Squawkabilly-White", "Squawkabilly-Yellow", "Swalot", "Thievul", "Toxtricity-Amped", "Toxtricity-Low-Key", "Wigglytuff"];
const sameMembers = (role, expected) => {
  const actual = memberships[role] || new Set();
  return actual.size === expected.length && expected.every((name) => actual.has(name));
};
const catalogDataFailures = [];
if (catalog.length !== 256) catalogDataFailures.push(`Expected 256 board entries, found ${catalog.length}`);
requiredV113Additions.forEach((name) => { if (!byName.has(name)) catalogDataFailures.push(`Missing ${name}`); });
catalog.forEach((pokemon) => {
  if (!pokemon.sprite?.startsWith("images/sprites/champions/Menu CP ")) catalogDataFailures.push(`${pokemon.name} is not using a static Champions sprite`);
  else if (!fs.existsSync(path.join(ROOT, pokemon.sprite))) catalogDataFailures.push(`Missing static Champions sprite for ${pokemon.name}`);
});
if (Object.values(detailIndex).filter((entry) => entry.hasMega).length !== 76) catalogDataFailures.push("Expected 76 Mega-capable draft assets");
if (details.staraptor?.moves?.length !== 43 || details.staraptor.moves.some((move) => move.name === "Attract")) catalogDataFailures.push("Staraptor is not using its current Champions learnset");
for (const [name, expected] of [["Alakazam", 6], ["Armarouge", 7], ["Hatterene", 7], ["Indeedee", 9]]) {
  if (pointValue(byName.get(name)) !== expected) catalogDataFailures.push(`${name} should cost ${expected}`);
}
if (!sameMembers("Rain Abuser", ["Archaludon", "Swampert", "Basculegion"])) catalogDataFailures.push("Rain Abuser role is not the strict v113 set");
if (!sameMembers("Snow Abuser", ["Beartic", "Glaceon"])) catalogDataFailures.push("Snow Abuser role is not the strict v113 set");
if (!sameMembers("Snow Setter", ["Alolan Ninetales", "Abomasnow", "Vanilluxe", "Aurorus"])) catalogDataFailures.push("Snow Setter role is not the v113 set");

for (let mock = 0; mock < requested; mock += 1) {
  const rng = seededRandom(0xFFDA + (seedOffset + mock) * 7919);
  const ai = DraftAI.create({ catalog, rolesFor, pointCap: 50, teamCount: 14, rosterSize: 10, rng });
  const plans = ai.assignTeamPlans(Array.from({ length: 14 }, (_, index) => index + 1));
  const counts = Object.values(plans).reduce((sum, plan) => ({ ...sum, [plan.draftStrategy]: (sum[plan.draftStrategy] || 0) + 1 }), {});
  const cores = Object.values(plans).filter((plan) => plan.draftStrategy === "specific-core").map((plan) => plan.specificCore);
  if (counts["top-heavy"] !== 5 || counts.balanced !== 6 || counts["specific-core"] !== 2 || counts["all-around"] !== 1 || new Set(cores).size !== 2) strategyMixFailures += 1;
  const allAroundId = Number(Object.entries(plans).find(([, plan]) => plan.draftStrategy === "all-around")?.[0]);
  if (allAroundId < 7) strategyMixFailures += 1;

  const teams = {};
  for (let id = 1; id <= 14; id += 1) {
    teams[id] = { id, ...plans[id], picks: byName.has(mascots[id - 1]) ? [{ ...byName.get(mascots[id - 1]), mascot: true, overall: null }] : [] };
  }
  const state = {
    available: new Set(catalog.map((pokemon) => pokemon.name)),
    teams,
    pickIndex: 0,
    log: [],
    humanTeamId: null,
  };
  mascots.forEach((name) => state.available.delete(name));

  while (state.pickIndex < 140) {
    while (state.pickIndex < 140 && teams[ai.teamForPick(state.pickIndex)].picks.length >= 10) state.pickIndex += 1;
    if (state.pickIndex >= 140) break;
    const overall = state.pickIndex + 1;
    if (availableEntering[overall] !== undefined && state.available.has("Basculegion")) availableEntering[overall] += 1;
    const teamId = ai.teamForPick(state.pickIndex);
    const team = teams[teamId];
    const choice = ai.choose(team, state, { isCpu: true });
    if (!choice.pokemon) {
      state.pickIndex += 1;
      continue;
    }
    const pokemon = choice.pokemon;
    team.picks.push({ ...pokemon, mascot: false, overall });
    state.available.delete(pokemon.name);
    state.log.push({ team: teamId, pokemon, overall });
    if (!pickStats.has(pokemon.name)) pickStats.set(pokemon.name, []);
    pickStats.get(pokemon.name).push(overall);
    if (overall === 1) pickOne.set(pokemon.name, (pickOne.get(pokemon.name) || 0) + 1);
    state.pickIndex += 1;
  }

  Object.values(teams).forEach((team) => {
    if (team.picks.length !== 10) incompleteRosters += 1;
    if (team.picks.reduce((sum, pokemon) => sum + pointValue(pokemon), 0) > 50) invalidBudgets += 1;
    for (const family of DraftAI.constants.FORM_FAMILIES) {
      if (team.picks.filter((pokemon) => family.has(pokemon.name)).length > 1) invalidForms += 1;
    }
    const owned = new Set(team.picks.map((pokemon) => pokemon.name));
    const dependencyFailure = (label) => {
      invalidDependencies += 1;
      if (dependencyExamples.length < 5) dependencyExamples.push({ mock: seedOffset + mock, team: team.id, label, picks: [...owned] });
    };
    if (owned.has("Swampert") && !["Pelipper", "Politoed", "Sableye"].some((name) => owned.has(name))) dependencyFailure("Swampert rain");
    if (owned.has("Archaludon") && !["Pelipper", "Politoed", "Sableye"].some((name) => owned.has(name))) dependencyFailure("Archaludon rain");
    if (owned.has("Vileplume") && !["Charizard", "Torkoal", "Ninetales"].some((name) => owned.has(name))) dependencyFailure("Vileplume sun");
    if (owned.has("Houndstone") && !["Tyranitar", "Hippowdon"].some((name) => owned.has(name))) dependencyFailure("Houndstone sand");
    if (["Torkoal", "Snorlax", "Mawile"].some((name) => owned.has(name)) && !["Farigiraf", "Oranguru", "Gallade"].some((name) => owned.has(name))) dependencyFailure("Trick Room sweeper");
  });
}

const summaryFor = (name) => {
  const picks = pickStats.get(name) || [];
  return {
    count: picks.length,
    min: picks.length ? Math.min(...picks) : null,
    average: picks.length ? Number((picks.reduce((sum, pick) => sum + pick, 0) / picks.length).toFixed(2)) : null,
    max: picks.length ? Math.max(...picks) : null,
  };
};
const pickOneDistribution = Object.fromEntries([...pickOne].map(([name, count]) => [name, Number((count * 100 / requested).toFixed(2))]));
const report = {
  mocks: requested,
  seedOffset,
  featured: Object.fromEntries(["Basculegion", "Garchomp", "Charizard", "Salamence", "Farigiraf"].map((name) => [name, summaryFor(name)])),
  pickOneDistribution,
  basculegionAvailableEntering: Object.fromEntries(Object.entries(availableEntering).map(([pick, count]) => [pick, Number((count * 100 / requested).toFixed(2))])),
  violations: { invalidBudgets, incompleteRosters, invalidForms, invalidDependencies, strategyMixFailures, catalogDataFailures: catalogDataFailures.length },
  dependencyExamples,
};
console.log(JSON.stringify(report, null, 2));

const failures = [];
if (report.featured.Basculegion.max > 5) failures.push("Basculegion survived past Pick 5");
if (report.featured.Garchomp.max > 5) failures.push("Garchomp survived past Pick 5");
if (report.featured.Charizard.max > 7) failures.push("Charizard survived past Pick 7");
if (report.featured.Farigiraf.min !== null && report.featured.Farigiraf.min <= 4) failures.push("Farigiraf entered the opening elite gate");
if (availableEntering[6] !== 0) failures.push("Basculegion was available entering Pick 6");
if (Object.values(report.violations).some(Boolean)) failures.push(`Validation violations: ${JSON.stringify(report.violations)}`);
if (catalogDataFailures.length) failures.push(...catalogDataFailures);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
