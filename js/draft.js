let allTeams = [];
let championsPokemon = [];
let teamProfilesById = {};
let allRosterRows = [];
let allDraftPicks = [];

Promise.all([
  fetch("data/teams.json").then(response => response.json()),
  fetch("data/champions-pokemon.json").then(response => response.json())
])
  .then(async ([teamsData, championsData]) => {
    allTeams = teamsData;
    championsPokemon = championsData;

    await refreshDraftData();
    renderDraftPage();
  })
  .catch(error => {
    console.error("Error loading draft board:", error);
  });

async function refreshDraftData() {
  await loadTeamProfiles();
  await loadTeamRosters();
  await loadDraftPicks();
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
    console.error("Error loading rosters:", error);
    return;
  }

  allRosterRows = data || [];
}

async function loadDraftPicks() {
  const { data, error } = await supabaseClient
    .from("draft_picks")
    .select("*")
    .order("overall_pick", { ascending: true });

  if (error) {
    console.error("Error loading draft picks:", error);
    return;
  }

  allDraftPicks = data || [];
}

function renderDraftPage() {
  renderDraftControls();
  renderDraftSummary();
  renderDraftBoard();
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

function getPokemonBySlug(slug) {
  return championsPokemon.find(pokemon => pokemon.slug === slug);
}

function findPokemonFromInput(inputValue) {
  const cleaned = inputValue.trim().toLowerCase();

  return championsPokemon.find(pokemon =>
    pokemon.name.toLowerCase() === cleaned ||
    pokemon.slug.toLowerCase() === cleaned
  );
}

function getNextPickInfo() {
  const nextOverallPick = allDraftPicks.length > 0
    ? Math.max(...allDraftPicks.map(pick => pick.overall_pick)) + 1
    : 1;

  const roundNumber = Math.ceil(nextOverallPick / 12);
  const pickInRound = ((nextOverallPick - 1) % 12) + 1;

  return {
    overallPick: nextOverallPick,
    roundNumber,
    pickInRound
  };
}

function renderDraftControls() {
  const teamSelect = document.getElementById("draftTeamSelect");
  const pokemonOptions = document.getElementById("draftPokemonOptions");
  const nextPickText = document.getElementById("nextPickText");

  const nextPick = getNextPickInfo();

  nextPickText.textContent = `Next Pick: #${nextPick.overallPick} — Round ${nextPick.roundNumber}, Pick ${nextPick.pickInRound}`;

  teamSelect.innerHTML = allTeams.map(team => {
    const display = getTeamDisplay(team);
    const rosterCount = getRosterForTeam(team.id).length;

    return `<option value="${team.id}">${escapeHtml(display.name)} — ${escapeHtml(display.owner)} (${rosterCount}/10)</option>`;
  }).join("");

  const draftedSlugs = new Set(allDraftPicks.map(pick => pick.pokemon_slug));

  const availablePokemon = championsPokemon.filter(pokemon => !draftedSlugs.has(pokemon.slug));

  pokemonOptions.innerHTML = availablePokemon.map(pokemon => {
    return `<option value="${escapeHtml(pokemon.name)}"></option>`;
  }).join("");

  document.getElementById("makePickButton").onclick = makeDraftPick;
  document.getElementById("undoPickButton").onclick = undoLastPick;
}

function renderDraftSummary() {
  const container = document.getElementById("draftSummary");

  const draftedCount = allDraftPicks.length;
  const totalSlots = 12 * 10;
  const availableCount = championsPokemon.length - draftedCount;

  container.innerHTML = `
    <div class="draft-summary-grid">
      <div>
        <strong>${draftedCount}</strong>
        <span>Drafted</span>
      </div>
      <div>
        <strong>${availableCount}</strong>
        <span>Available</span>
      </div>
      <div>
        <strong>${totalSlots}</strong>
        <span>Total Roster Slots</span>
      </div>
    </div>
  `;
}

function renderDraftBoard() {
  const container = document.getElementById("draftBoard");

  if (allDraftPicks.length === 0) {
    container.innerHTML = `<p class="empty-roster">No picks made yet.</p>`;
    return;
  }

  const rowsHtml = allDraftPicks.map(pick => {
    const team = allTeams.find(team => team.id === pick.team_id);
    const display = team ? getTeamDisplay(team) : { name: pick.team_id, owner: "" };
    const pokemon = getPokemonBySlug(pick.pokemon_slug);

    const pokemonCell = pokemon
      ? `
        <div class="draft-pokemon-cell">
          <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">
          <span>${escapeHtml(pokemon.name)}</span>
        </div>
      `
      : escapeHtml(pick.pokemon_slug);

    return `
      <tr>
        <td>#${pick.overall_pick}</td>
        <td>${pick.round_number}</td>
        <td>${pick.pick_in_round}</td>
        <td>${escapeHtml(display.name)}</td>
        <td>${pokemonCell}</td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <table class="draft-table">
      <thead>
        <tr>
          <th>Overall</th>
          <th>Round</th>
          <th>Pick</th>
          <th>Team</th>
          <th>Pokémon</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

async function makeDraftPick() {
  const status = document.getElementById("draftStatus");
  const teamId = document.getElementById("draftTeamSelect").value;
  const input = document.getElementById("draftPokemonInput");
  const pokemon = findPokemonFromInput(input.value);

  if (!teamId) {
    status.textContent = "Choose a team first.";
    return;
  }

  if (!pokemon) {
    status.textContent = "Pokémon not found in the Champions legal pool. Use the dropdown name.";
    return;
  }

  const teamRoster = getRosterForTeam(teamId);

  if (teamRoster.length >= 10) {
    status.textContent = "That team already has 10 Pokémon.";
    return;
  }

  const alreadyDrafted = allDraftPicks.find(pick => pick.pokemon_slug === pokemon.slug);
  const alreadyRostered = allRosterRows.find(row => row.pokemon_slug === pokemon.slug);

  if (alreadyDrafted || alreadyRostered) {
    status.textContent = `${pokemon.name} is already taken.`;
    return;
  }

  const nextPick = getNextPickInfo();

  const nextSlot = teamRoster.length > 0
    ? Math.max(...teamRoster.map(row => row.slot_number)) + 1
    : 1;

  status.textContent = `Drafting ${pokemon.name}...`;

  const { error: rosterError } = await supabaseClient
    .from("team_rosters")
    .insert({
      team_id: teamId,
      pokemon_slug: pokemon.slug,
      slot_number: nextSlot
    });

  if (rosterError) {
    console.error("Error adding Pokémon to roster:", rosterError);
    status.textContent = "Error adding Pokémon to roster. Check the console.";
    return;
  }

  const { error: draftError } = await supabaseClient
    .from("draft_picks")
    .insert({
      overall_pick: nextPick.overallPick,
      round_number: nextPick.roundNumber,
      pick_in_round: nextPick.pickInRound,
      team_id: teamId,
      pokemon_slug: pokemon.slug
    });

  if (draftError) {
    console.error("Error saving draft pick:", draftError);

    await supabaseClient
      .from("team_rosters")
      .delete()
      .eq("team_id", teamId)
      .eq("pokemon_slug", pokemon.slug);

    status.textContent = "Error saving draft pick. Roster change was rolled back.";
    return;
  }

  input.value = "";
  status.textContent = `${pokemon.name} drafted successfully.`;

  await refreshDraftData();
  renderDraftPage();
}

async function undoLastPick() {
  const status = document.getElementById("draftStatus");

  if (allDraftPicks.length === 0) {
    status.textContent = "There are no picks to undo.";
    return;
  }

  const lastPick = allDraftPicks[allDraftPicks.length - 1];
  const pokemon = getPokemonBySlug(lastPick.pokemon_slug);
  const pokemonName = pokemon ? pokemon.name : lastPick.pokemon_slug;

  status.textContent = `Undoing last pick: ${pokemonName}...`;

  const { error: draftError } = await supabaseClient
    .from("draft_picks")
    .delete()
    .eq("id", lastPick.id);

  if (draftError) {
    console.error("Error deleting draft pick:", draftError);
    status.textContent = "Error undoing draft pick. Check the console.";
    return;
  }

  const { error: rosterError } = await supabaseClient
    .from("team_rosters")
    .delete()
    .eq("team_id", lastPick.team_id)
    .eq("pokemon_slug", lastPick.pokemon_slug);

  if (rosterError) {
    console.error("Error removing Pokémon from roster:", rosterError);
    status.textContent = "Draft pick removed, but roster cleanup failed. Check console.";
    return;
  }

  await refreshDraftData();
  await renumberRosterSlots(lastPick.team_id);
  await refreshDraftData();

  status.textContent = `Undid last pick: ${pokemonName}.`;
  renderDraftPage();
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
