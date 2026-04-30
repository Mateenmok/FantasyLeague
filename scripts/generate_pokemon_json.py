import json
import time
import urllib.request
import urllib.error

BASE_URL = "https://pokeapi.co/api/v2/pokemon"
LIMIT = 1025

pokemon_list = []

def get_json(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "FantasyLeagueDemo/1.0"
        }
    )

    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode())

for pokemon_id in range(1, LIMIT + 1):
    url = f"{BASE_URL}/{pokemon_id}"

    try:
        data = get_json(url)

        name = data["name"].replace("-", " ").title()
        slug = data["name"]

        official_artwork = data["sprites"]["other"]["official-artwork"]["front_default"]
        fallback_sprite = data["sprites"]["front_default"]

        pokemon = {
            "id": data["id"],
            "name": name,
            "slug": slug,
            "image": official_artwork or fallback_sprite,
            "types": [t["type"]["name"].title() for t in data["types"]]
        }

        pokemon_list.append(pokemon)
        print(f"Added {pokemon_id}: {name}")

        time.sleep(0.15)

    except urllib.error.HTTPError as error:
        print(f"Skipped {pokemon_id}: HTTP {error.code}")

    except Exception as error:
        print(f"Skipped {pokemon_id}: {error}")

with open("data/pokemon.json", "w") as file:
    json.dump(pokemon_list, file, indent=2)

print(f"Done. Saved {len(pokemon_list)} Pokemon to data/pokemon.json")
