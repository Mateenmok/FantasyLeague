let allTeams = [];
let championsPokemon = [];
let draftSettings = {};
let teamProfilesById = {};
let allRosterRows = [];
let allDraftPicks = [];

Promise.all([
  fetch("data/teams.json").then(response => response.json()),
  fetch("data/champions-pokemon.json").then(response => response.json()),
  fetch("data/draft-settings.json").then(response => response.json())
])
  .then(async ([teamsData, championsData, settingsData]) => {
    allTeams = teamsData;
    championsPokemon = championsData;
    draftSettings = settingsData;

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
  renderUpcomingPicks();
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

function findPokemonFromInput(inputValue) {
  const cleaned = inputValue.trim().toLowerCase();

  return championsPokemon.find(pokemon =>
    pokemon.name.toLowerCase() === cleaned ||
    pokemon.slug.toLowerCase() === cleaned
  );
}

function getTeamIdForPick(overallPick) {
  const teams = draftSettings.teams || [];
  const teamsPerRound = teams.length;

  if (teamsPerRound === 0) {
    return null;
  }

  const roundNumber = Math.ceil(overallPick / teamsPerRound);
  const pickIndex = (overallPick - 1) % teamsPerRound;

  if (draftSettings.type === "snake" && roundNumber % 2 === 0) {
    return teams[teamsPerRound - 1 - pickIndex];
  }

  return teams[pickIndex];
}

function getNextPickInfo() {
  const nextOverallPick = allDraftPicks.length > 0
    ? Math.max(...allDraftPicks.map(pick => pick.overall_pick)) + 1
    : 1;

  const teamsPerRound = draftSettings.teams.length;
  const totalPicks = draftSettings.rounds * teamsPerRound;

  if (nextOverallPick > totalPicks) {
    return {
      overallPick: nextOverallPick,
      roundNumber: null,
      pickInRound: null,
      teamId: null,
      draftComplete: true
    };
  }

  const roundNumber = Math.ceil(nextOverallPick / teamsPerRound);
  const pickInRound = ((nextOverallPick - 1) % teamsPerRound) + 1;
  const teamId = getTeamIdForPick(nextOverallPick);

  return {
    overallPick: nextOverallPick,
    roundNumber,
    pickInRound,
    teamId,
    draftComplete: false
  };
}

function renderDraftControls() {
  const pokemonOptions = document.getElementById("draftPokemonOptions");
  const nextPickText = document.getElementById("nextPickText");
  const onClockTeam = document.getElementById("onClockTeam");
  const overallPickNumber = document.getElementById("overallPickNumber");

  const nextPick = getNextPickInfo();

  if (nextPick.draftComplete) {
    onClockTeam.textContent = "Draft Complete";
    nextPickText.textContent = "All roster slots have been filled.";
    overallPickNumber.textContent = "Done";
    document.getElementById("makePickButton").disabled = true;
    return;
  }

  const onClock = getTeamDisplayById(nextPick.teamId);

  onClockTeam.textContent = onClock.name;
  nextPickText.textContent = `Round ${nextPick.roundNumber}, Pick ${nextPick.pickInRound}`;
  overallPickNumber.textContent = `#${nextPick.overallPick}`;

  const unavailableSlugs = new Set([
    ...allDraftPicks.map(pick => pick.pokemon_slug),
    ...allRosterRows.map(row => row.pokemon_slug)
  ]);

  const availablePokemon = championsPokemon.filter(pokemon => !unavailableSlugs.has(pokemon.slug));

  pokemonOptions.innerHTML = availablePokemon.map(pokemon => {
    return `<option value="${escapeHtml(pokemon.name)}"></option>`;
  }).join("");

  document.getElementById("makePickButton").onclick = makeDraftPick;
  document.getElementById("undoPickButton").onclick = undoLastPick;
}

function renderDraftSummary() {
  const container = document.getElementById("draftSummary");

  const draftedCount = allDraftPicks.length;
  const rosteredCount = allRosterRows.length;
  const totalSlots = draftSettings.rounds * draftSettings.teams.length;
  const availableCount = championsPokemon.length - new Set([
    ...allDraftPicks.map(pick => pick.pokemon_slug),
    ...allRosterRows.map(row => row.pokemon_slug)
  ]).size;

  container.innerHTML = `
    <div class="draft-summary-grid clean-summary">
      <div>
        <strong>${draftedCount}</strong>
        <span>Draft Picks</span>
      </div>
      <div>
        <strong>${rosteredCount}</strong>
        <span>Rostered</span>
      </div>
      <div>
        <strong>${availableCount}</strong>
        <span>Available</span>
      </div>
      <div>
        <strong>${totalSlots}</strong>
        <span>Total Slots</span>
      </div>
    </div>
  `;
}

function renderUpcomingPicks() {
  const container = document.getElementById("upcomingPicks");
  const nextPick = getNextPickInfo();

  if (nextPick.draftComplete) {
    container.innerHTML = `<p class="empty-roster">No upcoming picks.</p>`;
    return;
  }

  const upcoming = [];

  for (let pickNumber = nextPick.overallPick; pickNumber < nextPick.overallPick + 6; pickNumber++) {
    const totalPicks = draftSettings.rounds * draftSettings.teams.length;

    if (pickNumber > totalPicks) {
      break;
    }

    const teamsPerRound = draftSettings.teams.length;
    const roundNumber = Math.ceil(pickNumber / teamsPerRound);
    const pickInRound = ((pickNumber - 1) % teamsPerRound) + 1;
    const teamId = getTeamIdForPick(pickNumber);
    const team = getTeamDisplayById(teamId);

    upcoming.push(`
      <div class="upcoming-pick-row">
        <span>#${pickNumber}</span>
        <div>
          <strong>${escapeHtml(team.name)}</strong>
          <small>Round ${roundNumber}, Pick ${pickInRound}</small>
        </div>
      </div>
    `);
  }

  container.innerHTML = upcoming.join("");
}

function renderDraftBoard() {
  const container = document.getElementById("draftBoard");

  if (allDraftPicks.length === 0) {
    container.innerHTML = `<p class="empty-roster">No picks made yet.</p>`;
    return;
  }

  const rowsHtml = allDraftPicks.map(pick => {
    const display = getTeamDisplayById(pick.team_id);
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
    <div class="draft-table-wrapper">
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
    </div>
  `;
}

async function makeDraftPick() {
  const status = document.getElementById("draftStatus");
  const input = document.getElementById("draftPokemonInput");
  const pokemon = findPokemonFromInput(input.value);
  const nextPick = getNextPickInfo();

  if (nextPick.draftComplete) {
    status.textContent = "The draft is already complete.";
    return;
  }

  const teamId = nextPick.teamId;

  if (!teamId) {
    status.textContent = "Could not find the next team in the draft order.";
    return;
  }

  if (!pokemon) {
    status.textContent = "Pokémon not found in the Champions legal pool. Use the dropdown name.";
    return;
  }

  const teamRoster = getRosterForTeam(teamId);

  if (teamRoster.length >= 10) {
    status.textContent = "The team on the clock already has 10 Pokémon.";
    return;
  }

  const alreadyDrafted = allDraftPicks.find(pick => pick.pokemon_slug === pokemon.slug);
  const alreadyRostered = allRosterRows.find(row => row.pokemon_slug === pokemon.slug);

  if (alreadyDrafted || alreadyRostered) {
    status.textContent = `${pokemon.name} is already taken.`;
    return;
  }

  const nextSlot = teamRoster.length > 0
    ? Math.max(...teamRoster.map(row => row.slot_number)) + 1
    : 1;

  const onClock = getTeamDisplayById(teamId);

  status.textContent = `Drafting ${pokemon.name} to ${onClock.name}...`;

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
  status.textContent = `${pokemon.name} drafted to ${onClock.name}.`;

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
