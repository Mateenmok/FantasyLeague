import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const sourceRevision = "152057b^";

const readHistoricalJson = (path) => JSON.parse(
  execFileSync("git", ["show", `${sourceRevision}:${path}`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
);

const basePokemon = readHistoricalJson("data/pokemon.json");
const detailedPokemon = readHistoricalJson("data/champions-details.json").pokemon;

const normalize = (value) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "")
  .trim();

const typeLookup = new Map();
const dexLookup = new Map();

for (const pokemon of basePokemon) {
  typeLookup.set(normalize(pokemon.name), pokemon.types);
  typeLookup.set(normalize(pokemon.slug), pokemon.types);
  dexLookup.set(normalize(pokemon.name), pokemon.id);
  dexLookup.set(normalize(pokemon.slug), pokemon.id);
}

for (const [key, pokemon] of Object.entries(detailedPokemon)) {
  const defaultTypes = pokemon.formes?.[0]?.types;
  if (defaultTypes) {
    typeLookup.set(normalize(key), defaultTypes);
    typeLookup.set(normalize(pokemon.name), defaultTypes);
  }

  for (const forme of pokemon.formes || []) {
    typeLookup.set(normalize(forme.name), forme.types);
  }
}

const aliases = {
  alolanraichu: "raichualola",
  alolanninetales: "ninetalesalola",
  eternalfloette: "floetteeternal",
  galarianslowbro: "slowbrogalar",
  galarianslowking: "slowkinggalar",
  hisuianarcanine: "arcaninehisui",
  hisuianavalugg: "avalugghisui",
  hisuiandecidueye: "decidueyehisui",
  hisuiangoodra: "goodrahisui",
  hisuiansamurott: "samurotthisui",
  hisuiantyphlosion: "typhlosionhisui",
  hisuianzoroark: "zoroarkhisui",
  pyroar: "pyroarmale",
  taurosaqua: "taurospaldeaaqua",
  taurosblaze: "taurospaldeablaze",
  tauroscombat: "taurospaldeacombat",
};

const dexAliases = {
  aegislash: "aegislashshield",
  basculegion: "basculegionmale",
  alolanraichu: "raichu",
  alolanninetales: "ninetales",
  eternalfloette: "floette",
  galarianslowbro: "slowbro",
  galarianslowking: "slowking",
  galarianstunfisk: "stunfisk",
  hisuianarcanine: "arcanine",
  hisuianavalugg: "avalugg",
  hisuiandecidueye: "decidueye",
  hisuiangoodra: "goodra",
  hisuiansamurott: "samurott",
  hisuiantyphlosion: "typhlosion",
  hisuianzoroark: "zoroark",
  gourgeist: "gourgeistaverage",
  lycanroc: "lycanrocmidday",
  maushold: "mausholdfamilyoffour",
  meowstic: "meowsticmale",
  mimikyu: "mimikyudisguised",
  morpeko: "morpekofullbelly",
  palafin: "palafinzero",
  pyroar: "pyroarmale",
  rotomfan: "rotom",
  rotomfrost: "rotom",
  rotomheat: "rotom",
  rotommow: "rotom",
  rotomwash: "rotom",
  taurosaqua: "tauros",
  taurosblaze: "tauros",
  tauroscombat: "tauros",
};

const spriteSuffixes = {
  alolanraichu: "Alola",
  alolanninetales: "Alola",
  eternalfloette: "Eternal",
  galarianslowbro: "Galar",
  galarianslowking: "Galar",
  hisuianarcanine: "Hisui",
  hisuianavalugg: "Hisui",
  hisuiandecidueye: "Hisui",
  hisuiangoodra: "Hisui",
  hisuiansamurott: "Hisui",
  hisuiantyphlosion: "Hisui",
  hisuianzoroark: "Hisui",
  rotomfan: "Fan",
  rotomfrost: "Frost",
  rotomheat: "Heat",
  rotommow: "Mow",
  rotomwash: "Wash",
  taurosaqua: "Paldea Aqua",
  taurosblaze: "Paldea Blaze",
  tauroscombat: "Paldea Combat",
};

const corrections = {
  Annhilape: "Annihilape",
  Elektross: "Eelektross",
  Starraptor: "Staraptor",
};

const buckets = [
  ["Diamond", 10, "Archaludon; Basculegion; Charizard; Eternal Floette; Garchomp; Metagross; Salamence; Sneasler; Starraptor; Tyranitar"],
  ["Diamond", 9, "Aerodactyl; Archaludon; Farigiraf; Gengar; Gholdengo; Grimmsnarl; Incineroar; Kangaskhan; Kingambit; Pelipper; Tyranitar; Raichu; Rillaboom; Sableye; Sinistcha; Swampert; Whimsicott"],
  ["Diamond", 8, "Annhilape; Blastoise; Blaziken; Delphox; Dragonite; Froslass; Gardevoir; Glimmora; Lucario; Maushold; Mawile; Politoed; Sylveon; Talonflame; Torkoal; Venusaur"],
  ["Gold", 7, "Absol; Aegislash; Alolan Ninetales; Armarouge; Clefable; Corviknight; Dragapult; Excadrill; Gyarados; Hisuian Arcanine; Hydreigon; Kommo-o; Lopunny; Meowscarada; Milotic; Primarina; Rotom-Wash; Scizor; Scovillain; Vivillon"],
  ["Gold", 6, "Arcanine; Aggron; Ceruledge; Feraligatr; Greninja; Hisuian Typhlosion; Hisuian Zoroark; Houndstone; Klefki; Meowstic; Oranguru; Pyroar; Rotom-Heat; Sceptile; Scrafty; Starmie; Tauros-Aqua; Tinkaton; Tsareena; Volcarona; Weavile"],
  ["Gold", 5, "Armarouge; Chandelure; Crabominable; Empoleon; Espathra; Gallade; Golurk; Hatterene; Hawlucha; Hisuian Goodra; Infernape; Krookodile; Liepard; Mamoswine; Meganium; Mimikyu; Palafin; Rotom-Frost; Sharpedo; Tauros-Blaze; Vileplume"],
  ["Silver", 4, "Altaria; Ampharos; Araquanid; Azumarill; Bellibolt; Camerupt; Chesnaught; Dragalge; Drampa; Elektross; Falinks; Galarian Slowking; Gliscor; Heliolisk; Hisuian Decidueye; Hisuian Samurott; Kleavor; Lycanroc; Manectric; Noivern; Rotom-Mow; Skarmory; Slowbro; Snorlax; Steelix; Toxapex; Umbreon"],
  ["Silver", 3, "Alakazam; Alolan Raichu; Banette; Conkeldurr; Galarian Slowbro; Goodra; Hippowdon; Jolteon; Malamar; Medicham; Mudsdale; Ninetales; Orthworm; Overqwil; Rampardos; Rotom-Fan; Runerigus; Scolipede; Spiritomb; Tauros-Combat; Toxicroak; Vanilluxe; Zoroark"],
  ["Bronze", 2, "Abomasnow; Alcremie; Ariados; Aurorus; Barbaracle; Beartic; Beedrill; Cofagrigus; Ditto; Espeon; Florges; Garganacl; Heracross; Houndoom; Mr. Rime; Pinsir; Polteageist; Reuniclus; Rhyperior; Slowking; Toucannon; Trevenant; Quaquaval; Qwilfish; Victreebel; Watchog; Wyrdeer"],
  ["Bronze", 1, "Appletun; Arbok; Aromatisse; Audino; Avalugg; Bastiodon; Castform; Chimecho; Clawitzer; Decidueye; Dedenne; Diggersby; Emboar; Emolga; Flapple; Flareon; Forretress; Furfrou; Galarian Stunfisk; Garbodor; Glaceon; Glalie; Gourgeist; Hisuian Avalugg; Hydrapple; Leafeon; Luxray; Machamp; Morpeko; Pangoro; Passimian; Pidgeot; Pikachu; Roserade; Rotom; Salazzle; Samurott; Sandaconda; Serperior; Simipour; Simisage; Simisear; Skeledirge; Slurpuff; Stunfisk; Tauros; Torterra; Typhlosion; Tyrantrum; Vaporeon"],
];

const conditionalValues = {
  Archaludon: {
    points: "9",
    sortPoints: 9,
    note: "",
  },
  Tyranitar: {
    points: "9",
    sortPoints: 9,
    note: "",
  },
  Armarouge: {
    points: "5-7",
    sortPoints: 7,
    note: "5 pts without Indeedee · 7 pts with Indeedee",
  },
  Hatterene: {
    points: "5+",
    sortPoints: 5,
    note: "5 pts; the PDF notes a higher value if Indeedee is added",
  },
  Palafin: {
    points: "5-6",
    sortPoints: 6,
    note: "5 pts normally · 6 pts if Band is added",
  },
  Alakazam: {
    points: "3+",
    sortPoints: 3,
    note: "3 pts; the PDF notes a higher value if Indeedee is added",
  },
  Conkeldurr: {
    points: "3-5",
    sortPoints: 5,
    note: "3 pts normally · 4 or 5 pts if Flame Orb is added",
  },
};

const catalog = new Map();
const missingCatalogData = [];

for (const [tier, points, names] of buckets) {
  for (const sourceName of names.split(";").map((name) => name.trim()).filter(Boolean)) {
    const displayName = corrections[sourceName] || sourceName;
    const searchKey = normalize(sourceName);
    const lookupKey = aliases[searchKey] || normalize(displayName);
    const types = typeLookup.get(lookupKey);
    const dex = dexLookup.get(dexAliases[searchKey] || normalize(displayName));

    if (!types || !dex) {
      missingCatalogData.push(`${sourceName} (${lookupKey}, dex ${dex})`);
      continue;
    }

    const existing = catalog.get(displayName);
    if (existing) {
      continue;
    }

    const conditional = conditionalValues[displayName] || {};
    catalog.set(displayName, {
      name: displayName,
      aliases: displayName === sourceName ? [] : [sourceName],
      tier,
      points: conditional.points || String(points),
      sortPoints: conditional.sortPoints || points,
      note: conditional.note || "",
      types,
      dex,
      sprite: `images/sprites/champions/Menu CP ${String(dex).padStart(4, "0")}${spriteSuffixes[searchKey] ? `-${spriteSuffixes[searchKey]}` : ""}.png`,
    });
  }
}

if (missingCatalogData.length) {
  throw new Error(`Missing catalog data:\n${missingCatalogData.join("\n")}`);
}

const tierOrder = { Diamond: 0, Gold: 1, Silver: 2, Bronze: 3 };
const output = [...catalog.values()].sort((a, b) => (
  tierOrder[a.tier] - tierOrder[b.tier]
  || b.sortPoints - a.sortPoints
  || a.name.localeCompare(b.name)
));

mkdirSync("data", { recursive: true });
writeFileSync("data/pokemon-catalog.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${output.length} unique Pokemon to data/pokemon-catalog.json`);
