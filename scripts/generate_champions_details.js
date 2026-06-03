const fs = require("fs/promises");

const SOURCE_PAGE = "https://www.smogon.com/dex/champions/pokemon/charizard/";
const SOURCE_BASE_URL = "https://www.smogon.com/dex/champions/pokemon";
const LOCAL_POKEMON_PATH = "data/champions-pokemon.json";
const OUTPUT_PATH = "data/champions-details.json";

function toId(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toUrlSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDexSettings(html) {
  const key = "dexSettings = ";
  const start = html.indexOf(key);

  if (start === -1) {
    throw new Error("Could not find dexSettings payload.");
  }

  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  const jsonStart = start + key.length;

  for (let index = jsonStart; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error("Could not parse dexSettings JSON.");
  }

  return JSON.parse(html.slice(jsonStart, end));
}

async function fetchDexSettings(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return parseDexSettings(await response.text());
}

function getInjectedRpc(settings, rpcName) {
  const row = (settings.injectRpcs || []).find(([key]) => key.includes(`"${rpcName}"`));
  return row ? row[1] : null;
}

function buildLookup(rows) {
  return new Map((rows || []).map(row => [toId(row.name), row]));
}

function getLocalPokemonCandidates(pokemon) {
  const slug = pokemon.slug || "";
  const name = pokemon.name || "";
  const candidates = [slug, name];

  const regionalPrefix = slug.match(/^(alolan|galarian|hisuian)-(.+)$/);
  if (regionalPrefix) {
    const regionMap = {
      alolan: "alola",
      galarian: "galar",
      hisuian: "hisui"
    };
    candidates.push(`${regionalPrefix[2]}-${regionMap[regionalPrefix[1]]}`);
  }

  if (slug === "paldean-tauros-fighting") {
    candidates.push("tauros-paldea-combat");
  }

  if (slug === "tauros-aqua") {
    candidates.push("tauros-paldea-aqua");
  }

  if (slug === "tauros-blaze") {
    candidates.push("tauros-paldea-blaze");
  }

  if (slug === "meowstic") {
    candidates.push("meowstic-m", "meowstic-f");
  }

  if (slug === "eternal-flower-floette") {
    candidates.push("floette-eternal");
  }

  return [...new Set(candidates.map(toId).filter(Boolean))];
}

function findSmogonPokemon(localPokemon, pokemonLookup) {
  for (const candidate of getLocalPokemonCandidates(localPokemon)) {
    if (pokemonLookup.has(candidate)) {
      return pokemonLookup.get(candidate);
    }
  }

  return null;
}

function formatAbility(name, abilityLookup) {
  const ability = abilityLookup.get(toId(name));

  return {
    name,
    description: ability?.description || ""
  };
}

function formatForm(pokemon, abilityLookup) {
  if (!pokemon) {
    return null;
  }

  return {
    name: pokemon.name,
    types: pokemon.types || [],
    tier: (pokemon.formats || [])[0] || "",
    stats: {
      hp: pokemon.hp,
      attack: pokemon.atk,
      defense: pokemon.def,
      sp_atk: pokemon.spa,
      sp_def: pokemon.spd,
      speed: pokemon.spe
    },
    bst: [pokemon.hp, pokemon.atk, pokemon.def, pokemon.spa, pokemon.spd, pokemon.spe]
      .reduce((sum, value) => sum + Number(value || 0), 0),
    abilities: (pokemon.abilities || []).map(name => formatAbility(name, abilityLookup))
  };
}

function formatMove(name, moveLookup) {
  const move = moveLookup.get(toId(name));

  if (!move) {
    return {
      name,
      type: "",
      category: "",
      power: null,
      accuracy: null,
      pp: null,
      description: ""
    };
  }

  return {
    name: move.name,
    type: move.type || "",
    category: move.category || "",
    power: Number(move.power || 0) || null,
    accuracy: Number(move.accuracy || 0) || null,
    pp: Number(move.pp || 0) || null,
    priority: Number(move.priority || 0),
    target: move.target || "",
    description: move.description || ""
  };
}

function getRelatedFormes(basePokemon, pokemonLookup) {
  const names = [basePokemon.name, ...(basePokemon.oob?.alts || [])];

  if (basePokemon.name === "Meowstic-M") {
    names.push("Meowstic-F", "Meowstic-M-Mega", "Meowstic-F-Mega");
  }

  return [...new Set(names)]
    .map(name => pokemonLookup.get(toId(name)))
    .filter(Boolean);
}

async function main() {
  const localPokemon = JSON.parse(await fs.readFile(LOCAL_POKEMON_PATH, "utf8"));
  const baseSettings = await fetchDexSettings(SOURCE_PAGE);
  const basics = getInjectedRpc(baseSettings, "dump-basics");

  if (!basics) {
    throw new Error("Could not find Champions basics payload.");
  }

  const pokemonLookup = buildLookup(basics.pokemon);
  const moveLookup = buildLookup(basics.moves);
  const abilityLookup = buildLookup(basics.abilities);
  const details = {
    source: {
      name: "Smogon Strategy Pokedex - Champions",
      url: "https://www.smogon.com/dex/champions/pokemon/",
      generated_at: new Date().toISOString()
    },
    pokemon: {}
  };
  const misses = [];

  for (const localMon of localPokemon) {
    const smogonMon = findSmogonPokemon(localMon, pokemonLookup);

    if (!smogonMon) {
      misses.push(localMon.slug);
      continue;
    }

    const sourceUrl = `${SOURCE_BASE_URL}/${toUrlSlug(smogonMon.name)}/`;
    const settings = await fetchDexSettings(sourceUrl);
    const dump = getInjectedRpc(settings, "dump-pokemon");

    if (!dump) {
      misses.push(localMon.slug);
      continue;
    }

    details.pokemon[localMon.slug] = {
      name: localMon.name,
      smogon_name: smogonMon.name,
      source_url: sourceUrl,
      abilities: (smogonMon.abilities || []).map(name => formatAbility(name, abilityLookup)),
      formes: getRelatedFormes(smogonMon, pokemonLookup).map(form => formatForm(form, abilityLookup)),
      moves: (dump.learnset || []).map(name => formatMove(name, moveLookup))
    };
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(details, null, 2)}\n`);

  console.log(JSON.stringify({
    pokemon: Object.keys(details.pokemon).length,
    misses
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
