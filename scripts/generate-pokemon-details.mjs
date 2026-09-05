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

const statNames = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "sp_atk",
  "special-defense": "sp_def",
  speed: "speed",
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
  const base = await fetchPokemon(catalogPokemon.dex);
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

for (const catalogPokemon of catalog) {
  const key = normalize(catalogPokemon.name);
  const matched = historicalByName.get(key) || historicalByName.get(aliases[key]);
  const detail = matched ? {
    name: catalogPokemon.name,
    abilities: matched.abilities || [],
    formes: matched.formes || [],
    moves: matched.moves || [],
  } : await apiDetail(catalogPokemon);
  const megaForms = detail.formes.filter((forme) => /-Mega(?:-|$)/i.test(forme.name));

  details[key] = detail;
  index[key] = {
    hasMega: megaForms.length > 0,
    megaForms: megaForms.map((forme) => forme.name),
  };
}

writeFileSync("data/pokemon-details.json", `${JSON.stringify({ pokemon: details }, null, 2)}\n`);
writeFileSync("data/pokemon-detail-index.json", `${JSON.stringify(index, null, 2)}\n`);

console.log(`Wrote details for ${Object.keys(details).length} Pokemon.`);
console.log(`Marked ${Object.values(index).filter((entry) => entry.hasMega).length} Mega-capable Pokemon.`);
