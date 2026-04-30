let allTeams = [];
let championsPokemon = [];
let teamProfilesById = {};
let allRosterRows = [];
let selectedTeamId = localStorage.getItem("selected-team-id") || "team-1";

Promise.all([
  fetch("data/teams.json").then(response => response.json()),
  fetch("data/champions-pokemon.json").then(response => response.json())
])
  .then(async ([teamsData, championsData]) => {
    allTeams = teamsData;
    championsPokemon = championsData;

    await refreshWaiverData();
    renderWaiverPage();
  })
  .catch(error => {
    console.error("Error loading waiver wire:", error);
  });

async function refreshWaiverData() {
  await loadTeamProfiles();
  await loadTeamRosters();
}

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

function renderWaiverPage() {
  renderTeamSelect();
  renderRosterPanel();
  renderDropSelector();
  renderAvailableOptions();
  renderAvailableGrid();
  renderWaiverSummary();

  document.getElementById("submitWaiverButton").onclick = submitWaiverMove;
  document.getElementById("availableSearchInput").oninput = renderAvailableGrid;
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

function getTeamDisplayById(teamId) {
  const baseTeam = allTeams.find(team => team.id === teamId);

  if (!baseTeam) {
    return {
      id: teamId,
      name: teamId,
      owner: "",
      record: "",
      logo: ""
    };
  }

  return getTeamDisplay(baseTeam);
}

function getRosterForTeam(teamId) {
  return allRosterRows
    .filter(row => row.team_id === teamId)
    .sort((a, b) => a.slot_number - b.slot_number);
}

function getPokemonBySlug(slug) {
  return championsPokemon.find(pokemon => pokemon.slug === slug);
}

function getRosteredSlugSet() {
  return new Set(allRosterRows.map(row => row.pokemon_slug));
}

function getAvailablePokemon() {
  const rosteredSlugs = getRosteredSlugSet();
  return championsPokemon.filter(pokemon => !rosteredSlugs.has(pokemon.slug));
}

function getNameCounts() {
  const counts = {};

  championsPokemon.forEach(pokemon => {
    const key = pokemon.name.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  });

  return counts;
}

function getPokemonLabel(pokemon) {
  const nameCounts = getNameCounts();
  const count = nameCounts[pokemon.name.toLowerCase()] || 0;

  if (count > 1) {
    return `${pokemon.name} (${pokemon.types.join("/")})`;
  }

  return pokemon.name;
}

function findAvailablePokemonFromInput(inputValue) {
  const cleaned = inputValue.trim().toLowerCase();
  const availablePokemon = getAvailablePokemon();

  return availablePokemon.find(pokemon =>
    pokemon.name.toLowerCase() === cleaned ||
    pokemon.slug.toLowerCase() === cleaned ||
    getPokemonLabel(pokemon).toLowerCase() === cleaned
  );
}

function renderTeamSelect() {
  const teamSelect = document.getElementById("waiverTeamSelect");

  teamSelect.innerHTML = allTeams.map(team => {
    const display = getTeamDisplay(team);
    const rosterCount = getRosterForTeam(team.id).length;
    const selected = team.id === selectedTeamId ? "selected" : "";

    return `<option value="${team.id}" ${selected}>${escapeHtml(display.name)} — ${escapeHtml(display.owner)} (${rosterCount}/10)</option>`;
  }).join("");

  teamSelect.onchange = function () {
    selectedTeamId = this.value;
    localStorage.setItem("selected-team-id", selectedTeamId);

    renderRosterPanel();
    renderDropSelector();
    renderTeamSelect();
  };
}

function renderRosterPanel() {
  const rosterContainer = document.getElementById("selectedTeamRoster");
  const countText = document.getElementById("selectedRosterCount");
  const rosterRows = getRosterForTeam(selectedTeamId);
  const team = getTeamDisplayById(selectedTeamId);

  countText.textContent = `${team.name}: ${rosterRows.length}/10 Pokémon`;

  if (rosterRows.length === 0) {
    rosterContainer.innerHTML = `<p class="empty-roster">No Pokémon on this roster yet.</p>`;
    return;
  }

  rosterContainer.innerHTML = rosterRows.map(row => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);

    if (!pokemon) {
      return `
        <div class="waiver-roster-card missing-pokemon">
          <div class="missing-image">?</div>
          <p>${escapeHtml(row.pokemon_slug)}</p>
        </div>
      `;
    }

    return `
      <div class="waiver-roster-card">
        <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">
        <p>${escapeHtml(pokemon.name)}</p>
      </div>
    `;
  }).join("");
}

function renderDropSelector() {
  const dropContainer = document.getElementById("dropPokemonContainer");
  const dropSelect = document.getElementById("waiverDropSelect");
  const submitButton = document.getElementById("submitWaiverButton");
  const rosterRows = getRosterForTeam(selectedTeamId);

  if (rosterRows.length < 10) {
    dropContainer.classList.add("hidden");
    dropSelect.innerHTML = "";
    submitButton.textContent = "Add Pokémon";
    return;
  }

  dropContainer.classList.remove("hidden");
  submitButton.textContent = "Drop & Add Pokémon";

  dropSelect.innerHTML = `
    <option value="">Choose Pokémon to drop...</option>
    ${rosterRows.map(row => {
      const pokemon = getPokemonBySlug(row.pokemon_slug);
      const name = pokemon ? pokemon.name : row.pokemon_slug;

      return `<option value="${row.pokemon_slug}">${escapeHtml(name)}</option>`;
    }).join("")}
  `;
}

function renderAvailableOptions() {
  const options = document.getElementById("availablePokemonOptions");
  const availablePokemon = getAvailablePokemon();

  options.innerHTML = availablePokemon.map(pokemon => {
    return `<option value="${escapeHtml(getPokemonLabel(pokemon))}"></option>`;
  }).join("");
}

function renderAvailableGrid() {
  const grid = document.getElementById("availablePokemonGrid");
  const searchTerm = document.getElementById("availableSearchInput").value.trim().toLowerCase();

  let availablePokemon = getAvailablePokemon();

  if (searchTerm) {
    availablePokemon = availablePokemon.filter(pokemon =>
      pokemon.name.toLowerCase().includes(searchTerm) ||
      pokemon.slug.toLowerCase().includes(searchTerm) ||
      pokemon.types.join(" ").toLowerCase().includes(searchTerm) ||
      getPokemonLabel(pokemon).toLowerCase().includes(searchTerm)
    );
  }

  if (availablePokemon.length === 0) {
    grid.innerHTML = `<p class="empty-roster">No available Pokémon found.</p>`;
    return;
  }

  grid.innerHTML = availablePokemon.map(pokemon => {
    return `
      <div class="available-pokemon-card">
        <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">
        <h3>${escapeHtml(getPokemonLabel(pokemon))}</h3>
        <p>${escapeHtml(pokemon.types.join(" / "))}</p>
        <button class="claim-pokemon-button" data-slug="${pokemon.slug}">Select</button>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".claim-pokemon-button").forEach(button => {
    button.addEventListener("click", function () {
      const pokemon = championsPokemon.find(pokemon => pokemon.slug === this.dataset.slug);

      if (pokemon) {
        document.getElementById("waiverAddInput").value = getPokemonLabel(pokemon);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });
}

function renderWaiverSummary() {
  const container = document.getElementById("waiverSummary");
  const rosteredCount = allRosterRows.length;
  const availableCount = getAvailablePokemon().length;
  const totalLegal = championsPokemon.length;
  const fullTeams = allTeams.filter(team => getRosterForTeam(team.id).length >= 10).length;

  container.innerHTML = `
    <div class="waiver-summary-grid">
      <div>
        <strong>${availableCount}</strong>
        <span>Available</span>
      </div>
      <div>
        <strong>${rosteredCount}</strong>
        <span>Rostered</span>
      </div>
      <div>
        <strong>${totalLegal}</strong>
        <span>Legal Pool</span>
      </div>
      <div>
        <strong>${fullTeams}</strong>
        <span>Full Teams</span>
      </div>
    </div>
  `;
}

async function submitWaiverMove() {
  const status = document.getElementById("waiverStatus");
  const input = document.getElementById("waiverAddInput");
  const dropSelect = document.getElementById("waiverDropSelect");

  const pokemonToAdd = findAvailablePokemonFromInput(input.value);
  const rosterRows = getRosterForTeam(selectedTeamId);
  const team = getTeamDisplayById(selectedTeamId);

  if (!pokemonToAdd) {
    status.textContent = "That Pokémon is not available. Use the exact name from the dropdown or available list.";
    return;
  }

  const alreadyRostered = allRosterRows.find(row => row.pokemon_slug === pokemonToAdd.slug);

  if (alreadyRostered) {
    const owner = getTeamDisplayById(alreadyRostered.team_id);
    status.textContent = `${pokemonToAdd.name} is already on ${owner.name}.`;
    return;
  }

  if (rosterRows.length >= 10) {
    const dropSlug = dropSelect.value;

    if (!dropSlug) {
      status.textContent = `${team.name} already has 10 Pokémon. Choose one to drop first.`;
      return;
    }

    await swapPokemon(status, selectedTeamId, pokemonToAdd, dropSlug);
    return;
  }

  await addPokemonWithoutDrop(status, selectedTeamId, pokemonToAdd);
}

async function addPokemonWithoutDrop(status, teamId, pokemonToAdd) {
  const rosterRows = getRosterForTeam(teamId);
  const team = getTeamDisplayById(teamId);

  const nextSlot = rosterRows.length > 0
    ? Math.max(...rosterRows.map(row => row.slot_number)) + 1
    : 1;

  status.textContent = `Adding ${pokemonToAdd.name} to ${team.name}...`;

  const { error } = await supabaseClient
    .from("team_rosters")
    .insert({
      team_id: teamId,
      pokemon_slug: pokemonToAdd.slug,
      slot_number: nextSlot
    });

  if (error) {
    console.error("Error adding Pokémon:", error);
    status.textContent = "Error adding Pokémon. Check the console.";
    return;
  }

  status.textContent = `${pokemonToAdd.name} added to ${team.name}.`;

  document.getElementById("waiverAddInput").value = "";

  await refreshWaiverData();
  renderWaiverPage();
}

async function swapPokemon(status, teamId, pokemonToAdd, dropSlug) {
  const team = getTeamDisplayById(teamId);
  const rosterRows = getRosterForTeam(teamId);
  const dropRow = rosterRows.find(row => row.pokemon_slug === dropSlug);
  const pokemonToDrop = getPokemonBySlug(dropSlug);

  if (!dropRow) {
    status.textContent = "Could not find that Pokémon on this roster.";
    return;
  }

  const dropName = pokemonToDrop ? pokemonToDrop.name : dropSlug;

  status.textContent = `Dropping ${dropName} and adding ${pokemonToAdd.name}...`;

  const { error: deleteError } = await supabaseClient
    .from("team_rosters")
    .delete()
    .eq("id", dropRow.id);

  if (deleteError) {
    console.error("Error dropping Pokémon:", deleteError);
    status.textContent = "Error dropping Pokémon. Check the console.";
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("team_rosters")
    .insert({
      team_id: teamId,
      pokemon_slug: pokemonToAdd.slug,
      slot_number: dropRow.slot_number
    });

  if (insertError) {
    console.error("Error adding replacement Pokémon:", insertError);

    await supabaseClient
      .from("team_rosters")
      .insert({
        team_id: teamId,
        pokemon_slug: dropSlug,
        slot_number: dropRow.slot_number
      });

    status.textContent = "Error adding replacement. Original Pokémon was restored.";
    return;
  }

  status.textContent = `${team.name} dropped ${dropName} and added ${pokemonToAdd.name}.`;

  document.getElementById("waiverAddInput").value = "";

  await refreshWaiverData();
  renderWaiverPage();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
