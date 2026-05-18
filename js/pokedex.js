
const POKEMON_IMAGE_OVERRIDES = {
  "galarian-slowbro": "images/pokemon-fixes/galarian-slowbro.png",
  "slowbro-galarian": "images/pokemon-fixes/galarian-slowbro.png",

  "galarian-slowking": "images/pokemon-fixes/galarian-slowking.png",
  "slowking-galarian": "images/pokemon-fixes/galarian-slowking.png",

  "galarian-stunfisk": "images/pokemon-fixes/galarian-stunfisk.png",
  "stunfisk-galarian": "images/pokemon-fixes/galarian-stunfisk.png",

  "alolan-raichu": "images/pokemon-fixes/alolan-raichu.png",
  "raichu-alolan": "images/pokemon-fixes/alolan-raichu.png",

  "alolan-ninetales": "images/pokemon-fixes/alolan-ninetales.png",
  "ninetales-alolan": "images/pokemon-fixes/alolan-ninetales.png",

  "water-tauros": "images/pokemon-fixes/water-tauros.png",
  "tauros-water": "images/pokemon-fixes/water-tauros.png",
  "paldean-tauros-water": "images/pokemon-fixes/water-tauros.png",
  "tauros-paldea-aqua": "images/pokemon-fixes/water-tauros.png",
  "tauros-aqua": "images/pokemon-fixes/water-tauros.png",

  "fire-tauros": "images/pokemon-fixes/fire-tauros.png",
  "tauros-fire": "images/pokemon-fixes/fire-tauros.png",
  "paldean-tauros-fire": "images/pokemon-fixes/fire-tauros.png",
  "tauros-paldea-blaze": "images/pokemon-fixes/fire-tauros.png",
  "tauros-blaze": "images/pokemon-fixes/fire-tauros.png"
};

function normalizePokemonImageKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFixedPokemonImage(pokemon) {
  if (!pokemon) {
    return "";
  }

  const keys = [
    pokemon.slug,
    pokemon.name,
    pokemon.ranked_name,
    pokemon.display_name,
    pokemon.species,
    pokemon.form
  ].map(normalizePokemonImageKey).filter(Boolean);

  const combined = keys.join("-");

  for (const key of keys) {
    if (POKEMON_IMAGE_OVERRIDES[key]) {
      return POKEMON_IMAGE_OVERRIDES[key];
    }
  }

  if (combined.includes("galarian-slowbro") || combined.includes("slowbro-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-slowbro"];
  }

  if (combined.includes("galarian-slowking") || combined.includes("slowking-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-slowking"];
  }

  if (combined.includes("galarian-stunfisk") || combined.includes("stunfisk-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-stunfisk"];
  }

  if (combined.includes("alolan-raichu") || combined.includes("raichu-alolan")) {
    return POKEMON_IMAGE_OVERRIDES["alolan-raichu"];
  }

  if (combined.includes("alolan-ninetales") || combined.includes("ninetales-alolan")) {
    return POKEMON_IMAGE_OVERRIDES["alolan-ninetales"];
  }

  if (combined.includes("tauros") && (combined.includes("water") || combined.includes("aqua"))) {
    return POKEMON_IMAGE_OVERRIDES["water-tauros"];
  }

  if (combined.includes("tauros") && (combined.includes("fire") || combined.includes("blaze"))) {
    return POKEMON_IMAGE_OVERRIDES["fire-tauros"];
  }

  return pokemon.image || pokemon.img || pokemon.icon || pokemon.sprite || pokemon.artwork || "";
}


let allPokemon = [];

fetch("data/pokemon.json")
  .then(response => response.json())
  .then(data => {
    allPokemon = data;
    displayPokemon(allPokemon);
  })
  .catch(error => {
    console.error("Error loading Pokémon:", error);
  });

function displayPokemon(pokemonList) {
  const grid = document.getElementById("pokemonGrid");
  grid.innerHTML = "";

  pokemonList.forEach(pokemon => {
    const card = document.createElement("div");
    card.className = "pokemon-card";

    card.innerHTML = `
      <img src="${getFixedPokemonImage(pokemon)}" alt="${pokemon.name}" loading="lazy">
      <h3>${pokemon.name}</h3>
      <p>#${pokemon.id}</p>
      <p>${pokemon.types.join(" / ")}</p>
    `;

    grid.appendChild(card);
  });
}

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", function () {
  const searchTerm = searchInput.value.toLowerCase();

  const filteredPokemon = allPokemon.filter(pokemon =>
    pokemon.name.toLowerCase().includes(searchTerm) ||
    pokemon.slug.toLowerCase().includes(searchTerm)
  );

  displayPokemon(filteredPokemon);
});
