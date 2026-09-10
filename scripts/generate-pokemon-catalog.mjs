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
  persianalola: "persianalola",
  toxtricityamped: "toxtricity",
  toxtricitylowkey: "toxtricitylowkey",
  indeedee: "indeedeef",
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
  persianalola: "persian",
  squawkabilly: "squawkabilly",
  toxtricity: "toxtricity",
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
  persianalola: "Alola",
  indeedee: "Female",
};

// Regulation M-C additions are embedded so rebuilding the catalog never depends on an older git snapshot.
const embeddedCatalog = {
  Arboliva: [930, ["Grass", "Normal"]], Baxcalibur: [998, ["Dragon", "Ice"]], Cinderace: [815, ["Fire"]],
  "Farfetch'd": [83, ["Normal", "Flying"]], Gogoat: [673, ["Grass"]], Golisopod: [768, ["Bug", "Water"]],
  Grapploct: [853, ["Fighting"]], Indeedee: [876, ["Psychic", "Normal"]], Inteleon: [818, ["Water"]],
  Mabosstiff: [943, ["Dark"]], "Mr. Mime": [122, ["Psychic", "Fairy"]], Musharna: [518, ["Psychic"]],
  Pawmot: [923, ["Electric", "Fighting"]], Perrserker: [863, ["Steel"]], Persian: [53, ["Normal"]],
  "Persian-Alola": [53, ["Dark"]], Pincurchin: [871, ["Electric"]], "Sirfetch'd": [865, ["Fighting"]],
  Squawkabilly: [931, ["Normal", "Flying"]], Swalot: [317, ["Poison"]], Thievul: [828, ["Dark"]],
  Toxtricity: [849, ["Electric", "Poison"]], Wigglytuff: [40, ["Normal", "Fairy"]],
};

for (const [name, [dex, types]] of Object.entries(embeddedCatalog)) {
  typeLookup.set(normalize(name), types);
  dexLookup.set(normalize(name), dex);
}

const corrections = {
  Annhilape: "Annihilape",
  Elektross: "Eelektross",
  Starraptor: "Staraptor",
};

const buckets = [
  ["Diamond", 10, "Basculegion; Charizard; Eternal Floette; Garchomp; Metagross; Salamence; Sneasler; Starraptor"],
  ["Diamond", 9, "Aerodactyl; Archaludon; Farigiraf; Gengar; Gholdengo; Grimmsnarl; Incineroar; Indeedee; Kangaskhan; Kingambit; Pelipper; Raichu; Rillaboom; Sableye; Sinistcha; Swampert; Tyranitar; Whimsicott"],
  ["Diamond", 8, "Annhilape; Baxcalibur; Blastoise; Blaziken; Delphox; Dragonite; Froslass; Gardevoir; Glimmora; Golisopod; Lucario; Maushold; Mawile; Politoed; Sylveon; Talonflame; Torkoal; Venusaur"],
  ["Gold", 7, "Absol; Aegislash; Alolan Ninetales; Armarouge; Clefable; Corviknight; Dragapult; Excadrill; Gyarados; Hatterene; Hisuian Arcanine; Hydreigon; Kommo-o; Lopunny; Meowscarada; Milotic; Primarina; Rotom-Wash; Scizor; Scovillain; Vivillon"],
  ["Gold", 6, "Aggron; Alakazam; Arcanine; Ceruledge; Feraligatr; Greninja; Hisuian Typhlosion; Hisuian Zoroark; Houndstone; Klefki; Meowstic; Oranguru; Pawmot; Pyroar; Rotom-Heat; Sceptile; Scrafty; Starmie; Tauros-Aqua; Tinkaton; Tsareena; Volcarona; Weavile"],
  ["Gold", 5, "Chandelure; Cinderace; Crabominable; Empoleon; Espathra; Gallade; Golurk; Hawlucha; Hisuian Goodra; Infernape; Krookodile; Liepard; Mamoswine; Meganium; Mimikyu; Palafin; Rotom-Frost; Sharpedo; Tauros-Blaze; Vileplume"],
  ["Silver", 4, "Altaria; Ampharos; Araquanid; Azumarill; Bellibolt; Camerupt; Chesnaught; Dragalge; Drampa; Elektross; Falinks; Galarian Slowking; Gliscor; Heliolisk; Hisuian Decidueye; Hisuian Samurott; Inteleon; Kleavor; Lycanroc; Manectric; Noivern; Rotom-Mow; Skarmory; Slowbro; Snorlax; Steelix; Toxapex; Toxtricity; Umbreon"],
  ["Silver", 3, "Alolan Raichu; Arboliva; Banette; Conkeldurr; Galarian Slowbro; Goodra; Hippowdon; Jolteon; Malamar; Medicham; Mudsdale; Ninetales; Orthworm; Overqwil; Persian-Alola; Rampardos; Rotom-Fan; Runerigus; Scolipede; Spiritomb; Tauros-Combat; Toxicroak; Vanilluxe; Zoroark"],
  ["Bronze", 2, "Abomasnow; Alcremie; Ariados; Aurorus; Barbaracle; Beartic; Beedrill; Cofagrigus; Ditto; Espeon; Florges; Garganacl; Gogoat; Heracross; Houndoom; Mr. Mime; Mr. Rime; Musharna; Perrserker; Pincurchin; Pinsir; Polteageist; Quaquaval; Qwilfish; Reuniclus; Rhyperior; Sirfetch'd; Slowking; Squawkabilly; Toucannon; Trevenant; Victreebel; Watchog; Wigglytuff; Wyrdeer"],
  ["Bronze", 1, "Appletun; Arbok; Aromatisse; Audino; Avalugg; Bastiodon; Castform; Chimecho; Clawitzer; Decidueye; Dedenne; Diggersby; Emboar; Emolga; Farfetch'd; Flapple; Flareon; Forretress; Furfrou; Galarian Stunfisk; Garbodor; Glaceon; Glalie; Gourgeist; Grapploct; Hisuian Avalugg; Hydrapple; Leafeon; Luxray; Mabosstiff; Machamp; Morpeko; Pangoro; Passimian; Persian; Pidgeot; Pikachu; Roserade; Rotom; Salazzle; Samurott; Sandaconda; Serperior; Simipour; Simisage; Simisear; Skeledirge; Slurpuff; Stunfisk; Swalot; Tauros; Thievul; Torterra; Typhlosion; Tyrantrum; Vaporeon"],
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
  Palafin: {
    points: "5",
    sortPoints: 5,
    note: "",
  },
  Conkeldurr: {
    points: "3",
    sortPoints: 3,
    note: "",
  },
};

const catalog = new Map();
const missingCatalogData = [];

for (const [tier, points, names] of buckets) {
  for (const sourceName of names.split(";").map((name) => name.trim()).filter(Boolean)) {
    const displayName = corrections[sourceName] || sourceName;
    const searchKey = normalize(sourceName);
    const lookupKey = aliases[searchKey] || normalize(displayName);
    const types = typeLookup.get(lookupKey) || embeddedCatalog[displayName]?.[1];
    const dex = dexLookup.get(dexAliases[searchKey] || normalize(displayName)) || embeddedCatalog[displayName]?.[0];

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
