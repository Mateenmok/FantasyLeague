let selectedTeamId = getTeamIdFromUrl() || localStorage.getItem("selected-team-id") || "team-1";

let allPokemon = [];
let championsPokemon = [];
let allTeams = [];
let allMatchups = [];
let teamProfilesById = {};
let allRosterRows = [];

Promise.all([
  fetch("data/pokemon.json").then(response => response.json()),
  fetch("data/teams.json").then(response => response.json()),
  fetch("data/matchups.json").then(response => response.json()),
  fetch("data/champions-pokemon.json").then(response => response.json())
])
  .then(async ([pokemonData, teamsData, matchupsData, championsData]) => {
    allPokemon = pokemonData;
    allTeams = teamsData;
    allMatchups = matchupsData;
    championsPokemon = championsData;

    localStorage.setItem("selected-team-id", selectedTeamId);

    await loadTeamProfiles();
    await loadTeamRosters();

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

async function loadTeamRosters() {
  const { data, error } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .order("slot_number", { ascending: true });

  if (error) {
    console.error("Error loading team rosters from Supabase:", error);
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
  const container = document.getElementById("myRosterCard");
  const rosterRows = getRosterForTeam(selectedTeamId);

  const pokemonSource = championsPokemon.length > 0 ? championsPokemon : allPokemon;

  const pokemonBySlug = {};
  pokemonSource.forEach(pokemon => {
    pokemonBySlug[pokemon.slug] = pokemon;
  });

  const datalistOptions = pokemonSource.map(pokemon => {
    return `<option value="${escapeHtml(pokemon.name)}"></option>`;
  }).join("");

  const rosterHtml = rosterRows.length > 0
    ? rosterRows.map(row => {
        const pokemon = pokemonBySlug[row.pokemon_slug];

        if (!pokemon) {
          return `
            <div class="team-pokemon missing-pokemon">
              <div class="missing-image">?</div>
              <p>${row.pokemon_slug}</p>
              <button class="remove-pokemon-button" data-slug="${row.pokemon_slug}">Remove</button>
            </div>
          `;
        }

        return `
          <div class="team-pokemon">
            <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">
            <p>${pokemon.name}</p>
            <button class="remove-pokemon-button" data-slug="${pokemon.slug}">Remove</button>
          </div>
        `;
      }).join("")
    : `<p class="empty-roster">No Pokémon drafted yet.</p>`;

  container.innerHTML = `
    <h2>Roster</h2>
    <p class="small-note">${rosterRows.length}/10 Pokémon</p>

    <div class="roster-editor">
      <label for="pokemonSearchInput">Add Pokémon:</label>
      <input id="pokemonSearchInput" list="pokemonOptions" type="text" placeholder="Type Pokémon name, e.g. Gyarados">
      <datalist id="pokemonOptions">
        ${datalistOptions}
      </datalist>
      <button id="addPokemonButton">Add to Roster</button>
      <p id="rosterSaveStatus" class="small-note">Each Pokémon can only belong to one team.</p>
    </div>

    <div class="team-roster roster-grid-with-buttons">
      ${rosterHtml}
    </div>
  `;

  document.getElementById("addPokemonButton").addEventListener("click", addPokemonToRoster);

  document.querySelectorAll(".remove-pokemon-button").forEach(button => {
    button.addEventListener("click", function () {
      removePokemonFromRoster(this.dataset.slug);
    });
  });
}

function findPokemonFromInput(inputValue) {
  const cleaned = inputValue.trim().toLowerCase();

  const pokemonSource = championsPokemon.length > 0 ? championsPokemon : allPokemon;

  return pokemonSource.find(pokemon =>
    pokemon.name.toLowerCase() === cleaned ||
    pokemon.slug.toLowerCase() === cleaned
  );
}

async function addPokemonToRoster() {
  const input = document.getElementById("pokemonSearchInput");
  const status = document.getElementById("rosterSaveStatus");

  const pokemon = findPokemonFromInput(input.value);

  if (!pokemon) {
    status.textContent = "Pokémon not found in the Pokémon Champions legal pool. Try typing the exact name from the dropdown.";
    return;
  }

  const currentRoster = getRosterForTeam(selectedTeamId);

  if (currentRoster.length >= 10) {
    status.textContent = "This roster already has 10 Pokémon.";
    return;
  }

  const alreadyOwned = allRosterRows.find(row => row.pokemon_slug === pokemon.slug);

  if (alreadyOwned) {
    const ownerTeam = allTeams.find(team => team.id === alreadyOwned.team_id);
    const ownerDisplay = ownerTeam ? getTeamDisplay(ownerTeam) : null;
    const ownerName = ownerDisplay ? ownerDisplay.name : alreadyOwned.team_id;

    status.textContent = `${pokemon.name} is already owned by ${ownerName}.`;
    return;
  }

  const nextSlot = currentRoster.length > 0
    ? Math.max(...currentRoster.map(row => row.slot_number)) + 1
    : 1;

  status.textContent = `Adding ${pokemon.name}...`;

  const { error } = await supabaseClient
    .from("team_rosters")
    .insert({
      team_id: selectedTeamId,
      pokemon_slug: pokemon.slug,
      slot_number: nextSlot
    });

  if (error) {
    console.error("Error adding Pokémon:", error);
    status.textContent = "Error adding Pokémon. Check the console.";
    return;
  }

  input.value = "";
  await loadTeamRosters();
  displayMyRoster();
}

async function removePokemonFromRoster(pokemonSlug) {
  const status = document.getElementById("rosterSaveStatus");

  status.textContent = "Removing Pokémon...";

  const { error } = await supabaseClient
    .from("team_rosters")
    .delete()
    .eq("team_id", selectedTeamId)
    .eq("pokemon_slug", pokemonSlug);

  if (error) {
    console.error("Error removing Pokémon:", error);
    status.textContent = "Error removing Pokémon. Check the console.";
    return;
  }

  await loadTeamRosters();
  await renumberRosterSlots(selectedTeamId);
  await loadTeamRosters();
  displayMyRoster();
}

async function renumberRosterSlots(teamId) {
  const rosterRows = getRosterForTeam(teamId);

  for (let i = 0; i < rosterRows.length; i++) {
    await supabaseClient
      .from("team_rosters")
      .update({ slot_number: i + 1 })
      .eq("id", rosterRows[i].id);
  }
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
