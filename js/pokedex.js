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
      <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">
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
