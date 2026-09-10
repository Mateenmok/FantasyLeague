import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const sourceRevision = "152057b^";
const catalog = JSON.parse(readFileSync("data/pokemon-catalog.json", "utf8"));
const historical = JSON.parse(execFileSync(
  "git",
  ["show", `${sourceRevision}:data/champions-details.json`],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
)).pokemon;

const normalize = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "")
  .trim();

const titleCase = (value) => String(value || "")
  .split("-")
  .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
  .join(" ");

const aliases = {
  alolanraichu: "raichualola",
  alolanninetales: "ninetalesalola",
  eternalfloette: "floetteeternal",
  galarianslowbro: "slowbrogalar",
  galarianslowking: "slowkinggalar",
  galarianstunfisk: "stunfiskgalar",
  hisuianarcanine: "arcaninehisui",
  hisuianavalugg: "avalugghisui",
  hisuiandecidueye: "decidueyehisui",
  hisuiangoodra: "goodrahisui",
  hisuiansamurott: "samurotthisui",
  hisuiantyphlosion: "typhlosionhisui",
  hisuianzoroark: "zoroarkhisui",
  taurosaqua: "taurospaldeaaqua",
  taurosblaze: "taurospaldeablaze",
  tauroscombat: "taurospaldeacombat",
};

const fallbackMegaSlugs = {
  blaziken: ["blaziken-mega"],
  mawile: ["mawile-mega"],
  metagross: ["metagross-mega"],
  salamence: ["salamence-mega"],
  sceptile: ["sceptile-mega"],
  swampert: ["swampert-mega"],
};

const championsMegaPatch = {
  Absol: [{ name: "Absol-Mega-Z", types: ["Dark", "Ghost"], stats: { hp: 65, attack: 154, defense: 60, sp_atk: 75, sp_def: 60, speed: 151 }, ability: "Sharpness" }],
  Garchomp: [{ name: "Garchomp-Mega-Z", types: ["Dragon"], stats: { hp: 108, attack: 130, defense: 85, sp_atk: 141, sp_def: 85, speed: 151 }, ability: "Levitate" }],
  Lucario: [{ name: "Lucario-Mega-Z", types: ["Fighting", "Steel"], stats: { hp: 70, attack: 100, defense: 70, sp_atk: 164, sp_def: 70, speed: 151 }, ability: "Aura Guard" }],
  Salamence: [{ name: "Salamence-Mega", types: ["Dragon", "Flying"], stats: { hp: 95, attack: 145, defense: 130, sp_atk: 120, sp_def: 90, speed: 120 }, ability: "Aerilate" }],
  Golisopod: [{ name: "Golisopod-Mega", types: ["Bug", "Steel"], stats: { hp: 75, attack: 150, defense: 175, sp_atk: 70, sp_def: 120, speed: 40 }, ability: "Tough Claws" }],
  Baxcalibur: [{ name: "Baxcalibur-Mega", types: ["Dragon", "Ice"], stats: { hp: 115, attack: 175, defense: 117, sp_atk: 105, sp_def: 101, speed: 87 }, ability: "Thermal Exchange" }],
};

const championsBaseOverrides = {
  Indeedee: { hp: 70, attack: 55, defense: 65, sp_atk: 95, sp_def: 105, speed: 85 },
};

const apiSlugOverrides = {
  Indeedee: "indeedee-female",
  "Persian-Alola": "persian-alola",
};

const championsDexBase = "https://www.smogon.com/dex/champions/pokemon";
const championsRefreshNames = new Set(["Raichu", "Eternal Floette"]);

const statNames = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "sp_atk",
  "special-defense": "sp_def",
  speed: "speed",
};

const parseDexSettings = (html) => {
  const marker = "dexSettings = ";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("Champions dex payload was not found");

  const jsonStart = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return JSON.parse(html.slice(jsonStart, index + 1));
  }

  throw new Error("Champions dex payload was incomplete");
};

const fetchDexSettings = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return parseDexSettings(await response.text());
};

const injectedRpc = (settings, name) => (
  (settings.injectRpcs || []).find(([key]) => key.includes(`"${name}"`))?.[1]
);

const rowLookup = (rows) => new Map((rows || []).map((row) => [normalize(row.name), row]));

let championsBasicsPromise;
const loadChampionsBasics = async () => {
  if (!championsBasicsPromise) {
    championsBasicsPromise = fetchDexSettings(`${championsDexBase}/charizard/`).then((settings) => {
      const basics = injectedRpc(settings, "dump-basics");
      if (!basics) throw new Error("Champions basics payload was not found");
      return {
        pokemon: rowLookup(basics.pokemon),
        moves: rowLookup(basics.moves),
        abilities: rowLookup(basics.abilities),
      };
    });
  }
  return championsBasicsPromise;
};

const championsCandidates = (catalogPokemon) => {
  const key = normalize(catalogPokemon.name);
  const candidates = [key, aliases[key]];
  if (key === "indeedee") candidates.push("indeedeef");
  return [...new Set(candidates.filter(Boolean))];
};

const championsForme = (pokemon, abilityLookup) => {
  const stats = {
    hp: pokemon.hp,
    attack: pokemon.atk,
    defense: pokemon.def,
    sp_atk: pokemon.spa,
    sp_def: pokemon.spd,
    speed: pokemon.spe,
  };
  return {
    name: pokemon.name,
    types: pokemon.types || [],
    tier: pokemon.formats?.[0] || "",
    stats,
    bst: Object.values(stats).reduce((sum, value) => sum + Number(value || 0), 0),
    abilities: (pokemon.abilities || []).map((name) => ({
      name,
      description: abilityLookup.get(normalize(name))?.description || "",
    })),
  };
};

const championsMove = (name, moveLookup) => {
  const move = moveLookup.get(normalize(name));
  return {
    name: move?.name || name,
    type: move?.type || "",
    category: move?.category || "",
    power: Number(move?.power || 0) || null,
    accuracy: Number(move?.accuracy || 0) || null,
    pp: Number(move?.pp || 0) || null,
    priority: Number(move?.priority || 0),
    target: move?.target || "",
    description: move?.description || "",
  };
};

const championsDetail = async (catalogPokemon) => {
  const basics = await loadChampionsBasics();
  const base = championsCandidates(catalogPokemon)
    .map((candidate) => basics.pokemon.get(candidate))
    .find(Boolean);
  if (!base) return null;

  const slug = base.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const sourceUrl = `${championsDexBase}/${slug}/`;
  const settings = await fetchDexSettings(sourceUrl);
  const dump = injectedRpc(settings, "dump-pokemon");
  if (!dump) return null;

  const formeNames = [base.name, ...(base.oob?.alts || [])];
  const formes = [...new Set(formeNames.map(normalize))]
    .map((name) => basics.pokemon.get(name))
    .filter(Boolean)
    .map((forme) => championsForme(forme, basics.abilities));

  return {
    name: catalogPokemon.name,
    abilities: championsForme(base, basics.abilities).abilities,
    formes,
    moves: (dump.learnset || []).map((name) => championsMove(name, basics.moves)),
    source_url: sourceUrl,
  };
};

const historicalByName = new Map();
for (const [key, pokemon] of Object.entries(historical)) {
  const names = [key, pokemon.name, pokemon.smogon_name, ...(pokemon.formes || []).map((forme) => forme.name)];
  for (const name of names.filter(Boolean)) historicalByName.set(normalize(name), pokemon);
}

const apiCache = new Map();
const fetchPokemon = async (idOrSlug) => {
  const key = String(idOrSlug);
  if (!apiCache.has(key)) {
    apiCache.set(key, fetch(`https://pokeapi.co/api/v2/pokemon/${key}`).then((response) => {
      if (!response.ok) throw new Error(`PokeAPI ${key} returned ${response.status}`);
      return response.json();
    }));
  }
  return apiCache.get(key);
};

const apiForme = (pokemon, displayName) => {
  const stats = Object.fromEntries(pokemon.stats.map((entry) => [statNames[entry.stat.name], entry.base_stat]));
  return {
    name: displayName,
    types: pokemon.types.sort((a, b) => a.slot - b.slot).map((entry) => titleCase(entry.type.name)),
    tier: "",
    stats,
    bst: Object.values(stats).reduce((sum, value) => sum + value, 0),
    abilities: pokemon.abilities.map((entry) => ({ name: titleCase(entry.ability.name), description: "" })),
  };
};

const apiDetail = async (catalogPokemon) => {
  const base = await fetchPokemon(apiSlugOverrides[catalogPokemon.name] || catalogPokemon.dex);
  const megaSlugs = fallbackMegaSlugs[normalize(catalogPokemon.name)] || [];
  const megas = await Promise.all(megaSlugs.map(async (slug) => apiForme(
    await fetchPokemon(slug),
    slug.split("-").map(titleCase).join("-"),
  )));

  return {
    name: catalogPokemon.name,
    abilities: base.abilities.map((entry) => ({ name: titleCase(entry.ability.name), description: "" })),
    formes: [apiForme(base, catalogPokemon.name), ...megas],
    moves: base.moves
      .map((entry) => ({ name: titleCase(entry.move.name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
};

const details = {};
const index = {};

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
};

await mapWithConcurrency(catalog, 8, async (catalogPokemon) => {
  const key = normalize(catalogPokemon.name);
  const matched = historicalByName.get(key) || historicalByName.get(aliases[key]);
  let detail = matched && !championsRefreshNames.has(catalogPokemon.name) ? {
    name: catalogPokemon.name,
    abilities: matched.abilities || [],
    formes: matched.formes || [],
    moves: matched.moves || [],
  } : null;
  if (!detail) {
    try {
      detail = await championsDetail(catalogPokemon);
    } catch (error) {
      console.warn(`Champions detail fallback failed for ${catalogPokemon.name}: ${error.message}`);
    }
  }
  if (!detail) detail = await apiDetail(catalogPokemon);
  if (championsBaseOverrides[catalogPokemon.name] && detail.formes[0]) {
    detail.formes[0].name = "Indeedee-F";
    detail.formes[0].stats = championsBaseOverrides[catalogPokemon.name];
  }
  for (const patch of championsMegaPatch[catalogPokemon.name] || []) {
    if (detail.formes.some((forme) => normalize(forme.name) === normalize(patch.name))) continue;
    detail.formes.push({
      name: patch.name,
      types: patch.types,
      tier: "",
      stats: patch.stats,
      bst: Object.values(patch.stats).reduce((sum, value) => sum + value, 0),
      abilities: [{ name: patch.ability, description: "" }],
    });
  }
  const megaForms = detail.formes.filter((forme) => /-Mega(?:-|$)/i.test(forme.name));

  details[key] = detail;
  index[key] = {
    hasMega: megaForms.length > 0,
    megaForms: megaForms.map((forme) => forme.name),
  };
});

writeFileSync("data/pokemon-details.json", `${JSON.stringify({ pokemon: details }, null, 2)}\n`);
writeFileSync("data/pokemon-detail-index.json", `${JSON.stringify(index, null, 2)}\n`);

console.log(`Wrote details for ${Object.keys(details).length} Pokemon.`);
console.log(`Marked ${Object.values(index).filter((entry) => entry.hasMega).length} Mega-capable Pokemon.`);
