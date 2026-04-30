import json
import re
from pathlib import Path

RAW_PATH = Path("data/champions-raw.txt")
MASTER_PATH = Path("data/pokemon.json")
OUTPUT_PATH = Path("data/champions-pokemon.json")

def slugify(value):
    value = value.lower().strip()
    value = value.replace(".", "")
    value = value.replace("'", "")
    value = value.replace(":", "")
    value = value.replace("(", "")
    value = value.replace(")", "")
    value = value.replace("/", "-")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value)
    return value.strip("-")

with MASTER_PATH.open() as file:
    master_pokemon = json.load(file)

image_by_id = {
    pokemon["id"]: pokemon.get("image", "")
    for pokemon in master_pokemon
}

rows = []

for line in RAW_PATH.read_text().splitlines():
    line = line.strip()

    if not line:
        continue

    match = re.match(r"^(\d+)\s+(.+?)\s+([A-Za-z]+(?:/[A-Za-z]+)*)$", line)

    if not match:
        raise ValueError(f"Could not parse line: {line}")

    pokemon_id = int(match.group(1))
    name = match.group(2).strip()
    type_text = match.group(3).strip()

    rows.append({
        "id": pokemon_id,
        "name": name,
        "type_text": type_text
    })

name_counts = {}

for row in rows:
    key = row["name"].lower()
    name_counts[key] = name_counts.get(key, 0) + 1

champions_pokemon = []

for row in rows:
    base_slug = slugify(row["name"])
    type_slug = slugify(row["type_text"])

    if name_counts[row["name"].lower()] > 1:
        slug = f"{base_slug}-{type_slug}"
    else:
        slug = base_slug

    champions_pokemon.append({
        "id": row["id"],
        "name": row["name"],
        "slug": slug,
        "image": image_by_id.get(
            row["id"],
            f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{row['id']}.png"
        ),
        "types": [part.title() for part in row["type_text"].split("/")]
    })

with OUTPUT_PATH.open("w") as file:
    json.dump(champions_pokemon, file, indent=2)

print(f"Saved {len(champions_pokemon)} legal Pokémon to {OUTPUT_PATH}")

duplicate_slugs = {}

for pokemon in champions_pokemon:
    duplicate_slugs[pokemon["slug"]] = duplicate_slugs.get(pokemon["slug"], 0) + 1

duplicates = [slug for slug, count in duplicate_slugs.items() if count > 1]

if duplicates:
    print("Duplicate slugs found:")
    for slug in duplicates:
        print(slug)
else:
    print("No duplicate slugs found.")
