import json
import re
from pathlib import Path

DATA_PATH = Path("data/champions-pokemon.json")

FORMS_TO_ADD = [
    {
        "name": "Rotom-Wash",
        "slug": "rotom-wash",
        "base_names": ["Rotom"],
        "types": ["Electric", "Water"],
    },
    {
        "name": "Rotom-Frost",
        "slug": "rotom-frost",
        "base_names": ["Rotom"],
        "types": ["Electric", "Ice"],
    },
    {
        "name": "Rotom-Mow",
        "slug": "rotom-mow",
        "base_names": ["Rotom"],
        "types": ["Electric", "Grass"],
    },
    {
        "name": "Rotom-Fan",
        "slug": "rotom-fan",
        "base_names": ["Rotom"],
        "types": ["Electric", "Flying"],
    },
    {
        "name": "Goodra-Hisui",
        "slug": "goodra-hisui",
        "base_names": ["Goodra"],
        "types": ["Dragon", "Steel"],
    },
    {
        "name": "Tauros-Aqua",
        "slug": "tauros-aqua",
        "base_names": ["Tauros"],
        "types": ["Fighting", "Water"],
    },
    {
        "name": "Tauros-Blaze",
        "slug": "tauros-blaze",
        "base_names": ["Tauros"],
        "types": ["Fighting", "Fire"],
    },
]

def normalize(value):
    value = str(value or "").lower()
    value = re.sub(r"[^a-z0-9]+", "", value)
    return value

pokemon = json.loads(DATA_PATH.read_text())

by_name = {normalize(mon.get("name")): mon for mon in pokemon}
by_slug = {normalize(mon.get("slug")): mon for mon in pokemon}

added = []

for form in FORMS_TO_ADD:
    if normalize(form["name"]) in by_name or normalize(form["slug"]) in by_slug:
        continue

    base = None

    for base_name in form["base_names"]:
        base = by_name.get(normalize(base_name)) or by_slug.get(normalize(base_name))

        if base:
            break

    if not base:
        print(f"Could not find base Pokémon for {form['name']}")
        continue

    new_mon = dict(base)
    new_mon["name"] = form["name"]
    new_mon["slug"] = form["slug"]
    new_mon["types"] = form["types"]

    # Keep the base image for now so nothing breaks visually.
    # We can replace these with better form-specific images later.
    new_mon["rank"] = None
    new_mon["tier"] = "Bronze"
    new_mon["points"] = 1
    new_mon["tier_icon"] = "images/tiers/BronzeButton.png"
    new_mon["tier_label"] = "Bronze 1"

    pokemon.append(new_mon)
    added.append(form["name"])

DATA_PATH.write_text(json.dumps(pokemon, indent=2))

print(f"Added {len(added)} form entries:")
for name in added:
    print(f"- {name}")
