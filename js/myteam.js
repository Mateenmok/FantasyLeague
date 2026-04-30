let selectedTeamId = getTeamIdFromUrl() || localStorage.getItem("selected-team-id") || "team-1";

let allPokemon = [];
let allTeams = [];
let allMatchups = [];
let teamLogosById = {};

Promise.all([
  fetch("data/pokemon.json").then(response => response.json()),
  fetch("data/teams.json").then(response => response.json()),
  fetch("data/matchups.json").then(response => response.json())
])
  .then(async ([pokemonData, teamsData, matchupsData]) => {
    allPokemon = pokemonData;
    allTeams = teamsData;
    allMatchups = matchupsData;

    localStorage.setItem("selected-team-id", selectedTeamId);

    await loadTeamLogos();

    displayTeamSelector();
    displayMyTeam();
    displayNextMatch();
    displayMyRoster();
  })
  .catch(error => {
    console.error("Error loading My Team data:", error);
  });

function getTeamIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("team");
}

async function loadTeamLogos() {
  const { data, error } = await supabaseClient
    .from("team_logos")
    .select("*");

  if (error) {
    console.error("Error loading logos from Supabase:", error);
    return;
  }

  teamLogosById = {};

  data.forEach(row => {
    teamLogosById[row.team_id] = row.logo_url;
  });
}

function displayTeamSelector() {
  const container = document.getElementById("teamSelectorContainer");

  const optionsHtml = allTeams.map(team => {
    const selected = team.id === selectedTeamId ? "selected" : "";
    return `<option value="${team.id}" ${selected}>${team.name} — ${team.owner}</option>`;
  }).join("");

  container.innerHTML = `
    <label for="teamSelect">Select Team:</label>
    <select id="teamSelect">
      ${optionsHtml}
    </select>
  `;

  document.getElementById("teamSelect").addEventListener("change", function () {
    selectedTeamId = this.value;
    localStorage.setItem("selected-team-id", selectedTeamId);

    const newUrl = `myteam.html?team=${selectedTeamId}`;
    window.history.replaceState({}, "", newUrl);

    displayMyTeam();
    displayNextMatch();
    displayMyRoster();
  });
}

function displayMyTeam() {
  const team = allTeams.find(team => team.id === selectedTeamId);
  const container = document.getElementById("myTeamCard");

  if (!team) {
    container.innerHTML = "<p>Team not found.</p>";
    return;
  }

  const logo = teamLogosById[team.id] || team.logo || "";

  const logoHtml = logo
    ? `<img class="my-team-logo" src="${logo}" alt="${team.name} logo">`
    : `<div class="my-team-logo-placeholder">${getInitials(team.name)}</div>`;

  container.innerHTML = `
    <div class="my-team-header">
      ${logoHtml}
      <div>
        <h2>${team.name}</h2>
        <p>Owner: ${team.owner}</p>
        <p>Record: ${team.record}</p>
      </div>
    </div>

    <div class="logo-editor">
      <label for="logoInput">Permanent logo URL:</label>
      <textarea id="logoInput" rows="3" placeholder="Paste image URL here">${logo}</textarea>
      <button id="saveLogoButton">Save Logo</button>
      <p id="logoSaveStatus" class="small-note">This saves to Supabase, so everyone can see it.</p>
    </div>
  `;

  document.getElementById("saveLogoButton").addEventListener("click", saveLogo);
}

async function saveLogo() {
  const logoInput = document.getElementById("logoInput");
  const status = document.getElementById("logoSaveStatus");
  const newLogo = logoInput.value.trim();

  status.textContent = "Saving logo...";

  const { error } = await supabaseClient
    .from("team_logos")
    .update({
      logo_url: newLogo,
      updated_at: new Date().toISOString()
    })
    .eq("team_id", selectedTeamId);

  if (error) {
    console.error("Error saving logo:", error);
    status.textContent = "Error saving logo. Check the console.";
    return;
  }

  teamLogosById[selectedTeamId] = newLogo;
  status.textContent = "Logo saved permanently.";
  displayMyTeam();
}

function displayNextMatch() {
  const container = document.getElementById("nextMatchCard");

  const nextMatch = allMatchups.find(matchup =>
    (matchup.teamA === selectedTeamId || matchup.teamB === selectedTeamId) &&
    matchup.scoreA === null &&
    matchup.scoreB === null
  );

  if (!nextMatch) {
    container.innerHTML = `
      <h2>Next Match</h2>
      <p>No upcoming match found.</p>
    `;
    return;
  }

  const myTeam = allTeams.find(team => team.id === selectedTeamId);
  const opponentId = nextMatch.teamA === selectedTeamId ? nextMatch.teamB : nextMatch.teamA;
  const opponent = allTeams.find(team => team.id === opponentId);

  container.innerHTML = `
    <h2>Next Match</h2>
    <p>Week ${nextMatch.week}</p>
    <div class="next-match-row">
      <div>
        <h3>${myTeam.name}</h3>
        <p>${myTeam.record}</p>
      </div>
      <span class="versus">vs</span>
      <div>
        <h3>${opponent.name}</h3>
        <p>${opponent.record}</p>
      </div>
    </div>
  `;
}

function displayMyRoster() {
  const team = allTeams.find(team => team.id === selectedTeamId);
  const container = document.getElementById("myRosterCard");

  const pokemonBySlug = {};
  allPokemon.forEach(pokemon => {
    pokemonBySlug[pokemon.slug] = pokemon;
  });

  if (!team.roster || team.roster.length === 0) {
    container.innerHTML = `
      <h2>Roster</h2>
      <p class="empty-roster">No Pokémon drafted yet.</p>
    `;
    return;
  }

  const rosterHtml = team.roster.map(slug => {
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
  }).join("");

  container.innerHTML = `
    <h2>Roster</h2>
    <div class="team-roster">
      ${rosterHtml}
    </div>
  `;
}

function getInitials(teamName) {
  return teamName
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}
