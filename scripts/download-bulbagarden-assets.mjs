import { basename, dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync("data/pokemon-catalog.json", "utf8"));
const apiUrl = "https://archives.bulbagarden.net/w/api.php";
const typeNames = [
  "Normal", "Fighting", "Flying", "Poison", "Ground", "Rock",
  "Bug", "Ghost", "Steel", "Fire", "Water", "Grass", "Electric",
  "Psychic", "Ice", "Dragon", "Dark", "Fairy",
];

const spriteFallbacks = {
  Salamence: "File:Menu SV 0373.png",
  Rillaboom: "File:Menu SV 0812.png",
};

const assets = [
  ...catalog.map((pokemon) => ({
    title: spriteFallbacks[pokemon.name] || `File:${basename(pokemon.sprite)}`,
    target: pokemon.sprite,
  })),
  ...typeNames.map((type) => ({
    title: `File:${type} icon HOME3.png`,
    target: `images/types/${type.toLowerCase()}.png`,
  })),
];

const chunks = (items, size) => {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
};

const imageUrls = new Map();

for (const batch of chunks(assets, 40)) {
  const params = new URLSearchParams({
    action: "query",
    prop: "imageinfo",
    iiprop: "url",
    titles: batch.map((asset) => asset.title).join("|"),
    format: "json",
    formatversion: "2",
  });
  const response = await fetch(`${apiUrl}?${params}`, {
    headers: { "User-Agent": "PokeLeague asset build (pokeleague.org)" },
  });
  if (!response.ok) throw new Error(`Bulbagarden API returned ${response.status}`);
  const data = await response.json();

  for (const page of data.query.pages) {
    if (!page.imageinfo?.[0]?.url) continue;
    imageUrls.set(page.title.replaceAll("_", " "), page.imageinfo[0].url);
  }
}

const missing = assets.filter((asset) => !imageUrls.has(asset.title));
if (missing.length) {
  throw new Error(`Missing Bulbagarden files:\n${missing.map((asset) => asset.title).join("\n")}`);
}

let downloaded = 0;
for (const batch of chunks(assets, 12)) {
  await Promise.all(batch.map(async (asset) => {
    const response = await fetch(imageUrls.get(asset.title), {
      headers: { "User-Agent": "PokeLeague asset build (pokeleague.org)" },
    });
    if (!response.ok) throw new Error(`${asset.title} returned ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100 || bytes.subarray(1, 4).toString("ascii") !== "PNG") {
      throw new Error(`${asset.title} did not return a valid PNG`);
    }
    mkdirSync(dirname(asset.target), { recursive: true });
    writeFileSync(asset.target, bytes);
    downloaded += 1;
  }));
}

console.log(`Downloaded ${downloaded} Bulbagarden assets (${catalog.length} sprites and ${typeNames.length} type icons).`);
