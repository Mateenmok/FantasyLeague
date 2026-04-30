let selectedTeamId = getTeamIdFromUrl() || localStorage.getItem("selected-team-id") || "team-1";

let allPokemon = [];
let allTeams = [];
let allMatchups = [];
let teamProfilesById = {};

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

    await loadTeamProfiles();

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

async function loadTeamProfiles() {
  const { data, error } = await supabaseClient
    .from("team_profiles")
    .select("*");

  if (error) {
    console.error("Error loading team profiles from Supabase:", error);
    return;
  }

  teamProfilesById = {};

  data.forEach(profile => {
    teamProfilesById[profile.team_id] = profile;
  });
}

function getTeamDisplay(team) {
  const profile = teamProfilesById[team.id];

  return {
    id: team.id,
    name: profile?.team_name || team.name,
    owner: profile?.owner_name || team.owner,
    record: profile?.record || team.record,
    logo: profile?.logo_url || team.logo || "",
    roster: team.roster || []
  };
}

function displayTeamSelector() {
  const container = document.getElementById("teamSelectorContainer");

  const optionsHtml = allTeams.map(team => {
    const display = getTeamDisplay(team);
    const selected = team.id === selectedTeamId ? "selected" : "";
    return `<option value="${team.id}" ${selected}>${display.name} — ${display.owner}</option>`;
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

    displayTeamSelector();
    displayMyTeam();
    displayNextMatch();
    displayMyRoster();
  });
}

function displayMyTeam() {
  const baseTeam = allTeams.find(team => team.id === selectedTeamId);
  const container = document.getElementById("myTeamCard");

  if (!baseTeam) {
    container.innerHTML = "<p>Team not found.</p>";
    return;
  }

  const team = getTeamDisplay(baseTeam);

  const logoHtml = team.logo
    ? `<img class="my-team-logo" src="${team.logo}" alt="${team.name} logo">`
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

    <div class="team-editor">
      <label for="teamNameInput">Team Name:</label>
      <input id="teamNameInput" type="text" value="${escapeHtml(team.name)}">

      <label for="ownerInput">Owner:</label>
      <input id="ownerInput" type="text" value="${escapeHtml(team.owner)}">

      <label for="recordInput">Record:</label>
      <input id="recordInput" type="text" value="${escapeHtml(team.record)}">

      <label for="logoInput">Logo URL:</label>
      <textarea id="logoInput" rows="3" placeholder="Paste image URL here">${escapeHtml(team.logo)}</textarea>

      <button id="saveTeamButton">Save Team Info</button>
      <p id="teamSaveStatus" class="small-note">This saves to Supabase, so everyone can see it.</p>
    </div>
  `;

  document.getElementById("saveTeamButton").addEventListener("click", saveTeamInfo);
}

async function saveTeamInfo() {
  const status = document.getElementById("teamSaveStatus");

  const newTeamName = document.getElementById("teamNameInput").value.trim();
  const newOwnerName = document.getElementById("ownerInput").value.trim();
  const newRecord = document.getElementById("recordInput").value.trim();
  const newLogo = document.getElementById("logoInput").value.trim();

  status.textContent = "Saving team info...";

  const { error } = await supabaseClient
    .from("team_profiles")
    .update({
      team_name: newTeamName,
      owner_name: newOwnerName,
      record: newRecord,
      logo_url: newLogo,
      updated_at: new Date().toISOString()
    })
    .eq("team_id", selectedTeamId);

  if (error) {
    console.error("Error saving team info:", error);
    status.textContent = "Error saving team info. Check the console.";
    return;
  }

  teamProfilesById[selectedTeamId] = {
    team_id: selectedTeamId,
    team_name: newTeamName,
    owner_name: newOwnerName,
    record: newRecord,
    logo_url: newLogo
  };

  status.textContent = "Team info saved permanently.";

  displayTeamSelector();
  displayMyTeam();
  displayNextMatch();
  displayMyRoster();
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

  const myBaseTeam = allTeams.find(team => team.id === selectedTeamId);
  const opponentId = nextMatch.teamA === selectedTeamId ? nextMatch.teamB : nextMatch.teamA;
  const opponentBaseTeam = allTeams.find(team => team.id === opponentId);

  const myTeam = getTeamDisplay(myBaseTeam);
  const opponent = getTeamDisplay(opponentBaseTeam);

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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
