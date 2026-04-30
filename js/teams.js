let allPokemon = [];
let allTeams = [];

Promise.all([
  fetch("data/pokemon.json").then(response => response.json()),
  fetch("data/teams.json").then(response => response.json())
])
  .then(([pokemonData, teamsData]) => {
    allPokemon = pokemonData;
    allTeams = teamsData;
    displayTeams();
  })
  .catch(error => {
    console.error("Error loading team data:", error);
  });

function displayTeams() {
  const teamsGrid = document.getElementById("teamsGrid");
  teamsGrid.innerHTML = "";

  const pokemonBySlug = {};

  allPokemon.forEach(pokemon => {
    pokemonBySlug[pokemon.slug] = pokemon;
  });

  allTeams.forEach(team => {
    const teamCard = document.createElement("section");
    teamCard.className = "team-card";

    const logoHtml = team.logo
      ? `<img class="team-logo" src="${team.logo}" alt="${team.name} logo">`
      : `<div class="team-logo-placeholder">${getInitials(team.name)}</div>`;

    const rosterHtml = team.roster.length > 0
      ? team.roster.map(slug => {
          const pokemon = pokemonBySlug[slug];

          if (!pokemon) {
            return `
              <div class="team-pokemon missing-pokemon">
                <div class="missing-image">?</div>
                <p>${slug}</p>
              </div>
            `;
          }

          return `
            <div class="team-pokemon">
              <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">
              <p>${pokemon.name}</p>
            </div>
          `;
        }).join("")
      : `<p class="empty-roster">No Pokémon drafted yet.</p>`;

    teamCard.innerHTML = `
      <div class="team-card-header">
        ${logoHtml}
        <div>
          <h2>${team.name}</h2>
          <p>Owner: ${team.owner}</p>
          <p>Record: ${team.record}</p>
        </div>
      </div>

      <div class="team-roster">
        ${rosterHtml}
      </div>
    `;

    teamsGrid.appendChild(teamCard);
  });
}

function getInitials(teamName) {
  return teamName
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}
