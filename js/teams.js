let allTeams = [];
let championsPokemon = [];
let teamProfilesById = {};
let allRosterRows = [];

Promise.all([
  fetch("data/teams.json").then(response => response.json()),
  fetch("data/champions-pokemon.json").then(response => response.json())
])
  .then(async ([teamsData, championsData]) => {
    allTeams = teamsData;
    championsPokemon = championsData;

    await loadTeamProfiles();
    await loadTeamRosters();

    displayTeams();
  })
  .catch(error => {
    console.error("Error loading teams page:", error);
  });

async function loadTeamProfiles() {
  const { data, error } = await supabaseClient
    .from("team_profiles")
    .select("*");

  if (error) {
    console.error("Error loading team profiles:", error);
    return;
  }

  teamProfilesById = {};

  data.forEach(profile => {
    teamProfilesById[profile.team_id] = profile;
  });
}

async function loadTeamRosters() {
  const { data, error } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .order("slot_number", { ascending: true });

  if (error) {
    console.error("Error loading team rosters:", error);
    return;
  }

  allRosterRows = data || [];
}

function getTeamDisplay(team) {
  const profile = teamProfilesById[team.id];

  return {
    id: team.id,
    name: profile?.team_name || team.name,
    owner: profile?.owner_name || team.owner,
    record: profile?.record || team.record,
    logo: profile?.logo_url || team.logo || ""
  };
}

function getRosterForTeam(teamId) {
  return allRosterRows
    .filter(row => row.team_id === teamId)
    .sort((a, b) => a.slot_number - b.slot_number);
}

function displayTeams() {
  const teamsGrid = document.getElementById("teamsGrid");
  teamsGrid.innerHTML = "";

  const pokemonBySlug = {};

  championsPokemon.forEach(pokemon => {
    pokemonBySlug[pokemon.slug] = pokemon;
  });

  allTeams.forEach(baseTeam => {
    const team = getTeamDisplay(baseTeam);
    const rosterRows = getRosterForTeam(team.id);

    const teamCard = document.createElement("section");
    teamCard.className = "team-card";

    const logoHtml = team.logo
      ? `<img class="team-logo" src="${team.logo}" alt="${team.name} logo">`
      : `<div class="team-logo-placeholder">${getInitials(team.name)}</div>`;

    const rosterHtml = rosterRows.length > 0
      ? rosterRows.map(row => {
          const pokemon = pokemonBySlug[row.pokemon_slug];

          if (!pokemon) {
            return `
              <div class="team-pokemon missing-pokemon">
                <div class="missing-image">?</div>
                <p>${escapeHtml(row.pokemon_slug)}</p>
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
          <h2>${escapeHtml(team.name)}</h2>
          <p>Owner: ${escapeHtml(team.owner)}</p>
          <p>Record: ${escapeHtml(team.record)}</p>
          <p class="small-note">${rosterRows.length}/10 Pokémon</p>
        </div>
      </div>

      <div class="team-roster">
        ${rosterHtml}
      </div>

      <a class="team-page-link" href="myteam.html?team=${team.id}">View / Edit Team</a>
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
