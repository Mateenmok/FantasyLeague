import json
import re
from pathlib import Path

DATA_PATH = Path("data/champions-pokemon.json")
OUTPUT_TIERS_PATH = Path("data/pokemon-tiers.json")
MISSING_PATH = Path("data/tier-missing.txt")

REMOVALS = {
    "Goodra",
    "Basculegion-F",
    "Aegislash-Blade",
    "Meowstic-F",
    "Raichu-Alola (alt)",
    "Aegislash-Blade (alt)",
}

RANKED_TEXT = """
Sneasler
Incineroar
Garchomp
Kingambit
Basculegion
Sinistcha
Aerodactyl
Charizard
Floette-Eternal
Rotom-Wash
Whimsicott
Pelipper
Tyranitar
Milotic
Archaludon
Farigiraf
Venusaur
Dragonite
Froslass
Corviknight
Delphox
Gengar
Aegislash
Meganium
Maushold
Talonflame
Excadrill
Scizor
Gardevoir
Kommo-o
Primarina
Torkoal
Politoed
Kangaskhan
Glimmora
Sylveon
Palafin
Dragapult
Arcanine-Hisui
Clefable
Gyarados
Hydreigon
Sableye
Scovillain
Ninetales-Alola
Blastoise
Volcarona
Typhlosion-Hisui
Aggron
Golurk
Starmie
Mimikyu
Tsareena
Meowscarada
Hatterene
Lucario
Gallade
Orthworm
Zoroark-Hisui
Crabominable
Arcanine
Tauros-Aqua
Drampa
Tinkaton
Rotom-Frost
Azumarill
Lopunny
Oranguru
Manectric
Empoleon
Skarmory
Greninja
Raichu
Mamoswine
Araquanid
Ceruledge
Meowstic
Vivillon
Feraligatr
Chandelure
Weavile
Klefki
Camerupt
Chesnaught
Conkeldurr
Armarouge
Umbreon
Hawlucha
Altaria
Snorlax
Heliolisk
Alakazam
Cofagrigus
Quaquaval
Jolteon
Kleavor
Rotom-Mow
Ampharos
Goodra-Hisui
Espathra
Samurott-Hisui
Rhyperior
Slowking-Galarian
Abomasnow
Slowbro
Glaceon
Vanilluxe
Bellibolt
Decidueye-Hisui
Lycanroc
Chimecho
Ditto
Hydrapple
Serperior
Victreebel
Steelix
Mudsdale
Toxicroak
Leafeon
Noivern
Alcremie
Basculegion-F
Garganacl
Ninetales
Heracross
Pikachu
Torterra
Emboar
Slowbro-Galarian
Sharpedo
Tyrantrum
Espeon
Luxray
Skeledirge
Krookodile
Slowking
Gliscor
Toxapex
Medicham
Infernape
Houndoom
Salazzle
Clawitzer
Hippowdon
Reuniclus
Bastiodon
Roserade
Mr. Rime
Beedrill
Ariados
Absol
Tauros-Blaze
Aurorus
Tauros
Zoroark
Goodra
Spiritomb
Typhlosion
Wyrdeer
Trevenant
Morpeko
Pinsir
Pangoro
Runerigus
Diggersby
Audino
Simisear
Simipour
Aromatisse
Rotom
Aegislash-Blade
Banette
Gourgeist
Machamp
Meowstic-F
Rampardos
Glalie
Arbok
Avalugg-Hisui
Toucannon
Beartic
Sandaconda
Raichu-Alola
Liepard
Pidgeot
Slurpuff
Simisage
Avalugg
Flapple
Dedenne
Florges
Stunfisk
Flareon
Rotom-Fan
Stunfisk-Galarian
Samurott
Emolga
Decidueye
Appletun
Passimian
Castform
Forretress
Polteageist
Furfrou
Garbodor
Watchog
Raichu-Alola (alt)
Aegislash-Blade (alt)
"""

def normalize(value):
    value = str(value or "").lower()
    value = value.replace("é", "e")
    value = value.replace("♀", "f").replace("♂", "m")
    value = re.sub(r"\(.*?\)", "", value)
    value = re.sub(r"[^a-z0-9]+", "", value)
    return value

def tier_for_rank(rank):
    if rank <= 13:
        return "Diamond", 8, "images/tiers/Diamond.webp"
    if rank <= 32:
        return "Diamond", 7, "images/tiers/Diamond.webp"
    if rank <= 50:
        return "Gold", 6, "images/tiers/GoldButton.png"
    if rank <= 70:
        return "Gold", 5, "images/tiers/GoldButton.png"
    if rank <= 90:
        return "Silver", 4, "images/tiers/SilverButton.png"
    if rank <= 110:
        return "Silver", 3, "images/tiers/SilverButton.png"
    if rank <= 130:
        return "Bronze", 2, "images/tiers/BronzeButton.png"
    return "Bronze", 1, "images/tiers/BronzeButton.png"

def aliases_for_rank_name(name):
    aliases = {name}

    manual_aliases = {
        "Floette-Eternal": [
            "Eternal Floette",
            "Floette Eternal",
            "Floette Eternal Flower",
            "Eternal Flower Floette",
            "Floette-Eternal-Flower",
        ],
        "Rotom-Wash": [
            "Wash Rotom",
            "Rotom Wash",
            "Rotom-W",
            "Rotom W",
        ],
        "Rotom-Frost": [
            "Frost Rotom",
            "Rotom Frost",
            "Rotom-F",
            "Rotom F",
        ],
        "Rotom-Mow": [
            "Mow Rotom",
            "Rotom Mow",
            "Rotom-C",
            "Rotom C",
        ],
        "Rotom-Fan": [
            "Fan Rotom",
            "Rotom Fan",
            "Rotom-S",
            "Rotom S",
        ],
        "Goodra-Hisui": [
            "Hisuian Goodra",
            "Goodra Hisui",
            "Goodra-H",
            "Goodra H",
        ],
        "Tauros-Aqua": [
            "Aqua Tauros",
            "Tauros Aqua",
            "Paldean Tauros Aqua",
            "Paldean Tauros Aqua Breed",
            "Tauros Paldea Aqua",
            "Tauros-Paldea-Aqua",
            "Tauros-Paldea-Aqua-Breed",
        ],
        "Tauros-Blaze": [
            "Blaze Tauros",
            "Tauros Blaze",
            "Paldean Tauros Blaze",
            "Paldean Tauros Blaze Breed",
            "Tauros Paldea Blaze",
            "Tauros-Paldea-Blaze",
            "Tauros-Paldea-Blaze-Breed",
        ],
    }

    aliases.update(manual_aliases.get(name, []))

    if "-Hisui" in name:
        base = name.replace("-Hisui", "")
        aliases.add(f"Hisuian {base}")
        aliases.add(f"{base} Hisui")
        aliases.add(f"{base}-H")

    if "-Galarian" in name:
        base = name.replace("-Galarian", "")
        aliases.add(f"Galarian {base}")
        aliases.add(f"{base} Galarian")
        aliases.add(f"{base}-Galar")

    if "-Alola" in name:
        base = name.replace("-Alola", "")
        aliases.add(f"Alolan {base}")
        aliases.add(f"{base} Alola")
        aliases.add(f"{base}-Alola")

    return {normalize(alias) for alias in aliases}

ranked_names = [
    line.strip()
    for line in RANKED_TEXT.strip().splitlines()
    if line.strip() and line.strip() not in REMOVALS
]

pokemon = json.loads(DATA_PATH.read_text())

lookup = {}

for mon in pokemon:
    possible = {
        mon.get("name", ""),
        mon.get("slug", ""),
    }

    for key in possible:
        if key:
            lookup[normalize(key)] = mon

tier_rows = []
missing = []
matched_slugs = set()

for rank, ranked_name in enumerate(ranked_names, start=1):
    tier, points, tier_icon = tier_for_rank(rank)
    matched = None

    for alias in aliases_for_rank_name(ranked_name):
        if alias in lookup:
            matched = lookup[alias]
            break

    if not matched:
        missing.append(f"{rank}. {ranked_name}")
        continue

    matched["rank"] = rank
    matched["tier"] = tier
    matched["points"] = points
    matched["tier_icon"] = tier_icon
    matched["tier_label"] = f"{tier} {points}"

    matched_slugs.add(matched.get("slug"))

    tier_rows.append({
        "rank": rank,
        "name": matched.get("name"),
        "slug": matched.get("slug"),
        "tier": tier,
        "points": points,
        "tier_icon": tier_icon,
        "tier_label": f"{tier} {points}",
        "ranked_name": ranked_name,
    })

# Any Pokémon in the dataset not matched get Bronze 1 by default, so nothing breaks.
for mon in pokemon:
    if mon.get("slug") not in matched_slugs:
        mon.setdefault("rank", None)
        mon.setdefault("tier", "Bronze")
        mon.setdefault("points", 1)
        mon.setdefault("tier_icon", "images/tiers/BronzeButton.png")
        mon.setdefault("tier_label", "Bronze 1")

DATA_PATH.write_text(json.dumps(pokemon, indent=2))
OUTPUT_TIERS_PATH.write_text(json.dumps(tier_rows, indent=2))
MISSING_PATH.write_text("\n".join(missing) + ("\n" if missing else ""))

print(f"Clean ranked list count: {len(ranked_names)}")
print(f"Matched Pokémon: {len(tier_rows)}")
print(f"Missing/unmatched names: {len(missing)}")

if missing:
    print("Check data/tier-missing.txt")
else:
    print("All ranked names matched.")
