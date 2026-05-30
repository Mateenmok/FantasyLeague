const draftLeagueSubtitle = document.getElementById("draftLeagueSubtitle");
const draftClockLine = document.getElementById("draftClockLine");
const draftStatusLine = document.getElementById("draftStatusLine");
const nextPickLine = document.getElementById("nextPickLine");
const pokemonDraftInput = document.getElementById("pokemonDraftInput");
const availablePokemonOptions = document.getElementById("availablePokemonOptions");
const makePickButton = document.getElementById("makePickButton");
const undoPickButton = document.getElementById("undoPickButton");
const saveDraftOrderButton = document.getElementById("saveDraftOrderButton");
const startDraftButton = document.getElementById("startDraftButton");
const stopDraftButton = document.getElementById("stopDraftButton");
const draftActionStatus = document.getElementById("draftActionStatus");
const draftPicksList = document.getElementById("draftPicksList");
const draftTeamRosters = document.getElementById("draftTeamRosters");
const availablePokemonGrid = document.getElementById("availablePokemonGrid");
const availablePokemonSearch = document.getElementById("availablePokemonSearch");
const megaFilterSelect = document.getElementById("megaFilterSelect");
const tierFilterSelect = document.getElementById("tierFilterSelect");
const typeFilterSelect = document.getElementById("typeFilterSelect");
const availablePokemonCount = document.getElementById("availablePokemonCount");
const AVAILABLE_POKEMON_PAGE_SIZE = 18;
let availablePokemonPage = 0;
let availablePokemonFilterSignature = "";
const draftRoomStatus = document.getElementById("draftRoomStatus");
const draftPointStatus = document.getElementById("draftPointStatus");
const draftControls = document.getElementById("draftControls");
const draftSetupSection = document.getElementById("draftSetupSection");
const draftOrderList = document.getElementById("draftOrderList");
const draftRoundNumber = document.getElementById("draftRoundNumber");
const draftRoundMeta = document.getElementById("draftRoundMeta");
const draftHeaderTeamSummary = document.getElementById("draftHeaderTeamSummary");
const selectedPokemonScoutBody = document.getElementById("selectedPokemonScoutBody");
const mockDraftPanel = document.getElementById("mockDraftPanel");
const mockDraftInlineStatus = document.getElementById("mockDraftInlineStatus");
const mockDraftInlineContent = document.getElementById("mockDraftInlineContent");
const mockDraftResetHeaderButton = document.getElementById("mockDraftResetHeaderButton");

const DEFAULT_ROSTER_SIZE = 10;
const DRAFT_TIER_ORDER = ["Diamond", "Gold", "Silver", "Bronze"];
const DRAFT_STAT_ROWS = [
  ["hp", "HP"],
  ["attack", "ATK"],
  ["defense", "DEF"],
  ["sp_atk", "SpA"],
  ["sp_def", "SpD"],
  ["speed", "Spe"]
];
function getPickSeconds() {
  return Number(currentLeague?.draft_pick_seconds || 120);
}

function getRosterSize() {
  const configuredSize = Number(currentLeague?.roster_pokemon_cap || DEFAULT_ROSTER_SIZE);
  return Number.isFinite(configuredSize) && configuredSize >= 1
    ? configuredSize
    : DEFAULT_ROSTER_SIZE;
}

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let currentLeague = null;
let leagueTeams = [];
let draftOrderTeamIds = [];
let draftState = null;
let draftPicks = [];
let allRosterRows = [];
let championsPokemon = [];
let pokemonBstBySlug = {};
let selectedPokemonSlug = "";
let mockDraftPicks = [];
let mockSelectedPokemonSlug = "";
let mockDraftStatusMessage = "Mock draft picks are saved in this browser only.";
let isAdmin = false;
let timerInterval = null;
let autoPickInProgress = false;
let draftSyncInterval = null;

makePickButton.addEventListener("click", function () {
  makeDraftPick(false);
});

undoPickButton.addEventListener("click", undoLastPick);
saveDraftOrderButton.addEventListener("click", function () {
  saveCurrentDraftOrder(true);
});
startDraftButton.addEventListener("click", startOrResumeDraft);
stopDraftButton.addEventListener("click", stopDraft);
availablePokemonSearch.addEventListener("input", renderAvailablePokemonGrid);

if (megaFilterSelect) {
  megaFilterSelect.addEventListener("change", renderAvailablePokemonGrid);
}

if (tierFilterSelect) {
  tierFilterSelect.addEventListener("change", renderAvailablePokemonGrid);
}

if (typeFilterSelect) {
  typeFilterSelect.addEventListener("change", renderAvailablePokemonGrid);
}

if (mockDraftResetHeaderButton) {
  mockDraftResetHeaderButton.addEventListener("click", resetMockDraft);
}

draftQueueForceInit();
loadDraftRoom();

async function loadDraftRoom() {
  if (!selectedLeagueId) {
    draftLeagueSubtitle.textContent = "No league selected.";
    draftRoomStatus.textContent = "Go to My Leagues and select a league first.";
    disableDraftControls();
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    draftLeagueSubtitle.textContent = "Not signed in.";
    draftRoomStatus.textContent = "Sign in before viewing the draft room.";
    disableDraftControls();
    return;
  }

  const userId = sessionData.session.user.id;

  const { data: membership, error: membershipError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("league_id", selectedLeagueId)
    .single();

  if (membershipError || !membership) {
    console.error("Membership error:", membershipError);
    draftLeagueSubtitle.textContent = "No access.";
    draftRoomStatus.textContent = "You are not a member of this league.";
    disableDraftControls();
    return;
  }

  currentMembership = membership;
  isAdmin = currentMembership.role === "admin";

  if (!isAdmin) {
    draftSetupSection.style.display = "none";
  }

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    draftLeagueSubtitle.textContent = "Could not load league.";
    draftRoomStatus.textContent = "Try selecting the league again.";
    disableDraftControls();
    return;
  }

  currentLeague = league;
  draftLeagueSubtitle.textContent = league.name;

  try {
    championsPokemon = await fetch("data/champions-pokemon.json?v=tiers3").then(response => response.json());
  } catch (error) {
    console.error("Champions Pokémon load error:", error);
    draftRoomStatus.textContent = "Could not load Pokémon data.";
    disableDraftControls();
    return;
  }

  try {
    pokemonBstBySlug = await fetch("data/pokemon-bst.json?v=draft-war-room3").then(response => response.json());
  } catch (error) {
    console.warn("Pokémon BST data unavailable:", error);
    pokemonBstBySlug = {};
  }

  await ensureDraftState();
  renderAvailablePokemonFilters();
  await refreshDraftData();
  startDraftSync();
}

async function ensureDraftState() {
  const { data, error } = await supabaseClient
    .from("league_draft_state")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .maybeSingle();

  if (error) {
    console.error("Draft state check error:", error);
    return;
  }

  if (data) {
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("league_draft_state")
    .insert({
      league_id: selectedLeagueId,
      is_started: false,
      is_paused: true,
      current_pick_started_at: null
    });

  if (insertError) {
    console.error("Draft state insert error:", insertError);
  }
}

function startDraftSync() {
  if (draftSyncInterval) {
    clearInterval(draftSyncInterval);
  }

  draftSyncInterval = setInterval(async function () {
    await refreshDraftData(true);
  }, 5000);
}

async function refreshDraftData(isBackgroundRefresh = false) {
  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
    draftRoomStatus.textContent = "Could not load teams.";
    return;
  }

  leagueTeams = teams || [];

  const { data: orderRows, error: orderError } = await supabaseClient
    .from("league_draft_order")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("slot_number", { ascending: true });

  if (orderError) {
    console.error("Draft order error:", orderError);
    draftOrderTeamIds = leagueTeams.map(team => team.id);
  } else if (!orderRows || orderRows.length === 0) {
    draftOrderTeamIds = leagueTeams.map(team => team.id);
  } else {
    draftOrderTeamIds = orderRows.map(row => row.league_team_id);
  }

  const { data: state, error: stateError } = await supabaseClient
    .from("league_draft_state")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .single();

  if (stateError) {
    console.error("Draft state error:", stateError);
  } else {
    draftState = state;
  }

  const { data: picks, error: picksError } = await supabaseClient
    .from("league_draft_picks")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("overall_pick", { ascending: true });

  if (picksError) {
    console.error("Draft picks error:", picksError);
    draftRoomStatus.textContent = "Could not load draft picks.";
    return;
  }

  draftPicks = picks || [];

  const { data: rosterRows, error: rosterError } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("slot_number", { ascending: true });

  if (rosterError) {
    console.error("Roster error:", rosterError);
    allRosterRows = [];
  } else {
    allRosterRows = rosterRows || [];
  }

  mockDraftPicks = loadMockDraftPicks();
  sanitizeMockDraftPicks();

  renderDraftRoom(isBackgroundRefresh);
}

function renderDraftRoom(isBackgroundRefresh = false) {
  const rosterSize = getRosterSize();
  const totalPicks = getTotalDraftPicks();
  const picksMade = draftPicks.length;
  const availableCount = getAvailablePokemon().length;
  const nextPick = getNextPickInfo();
  const maxDraftRounds = getMaxDraftRounds();

  draftStatusLine.textContent =
    `${picksMade}/${totalPicks} picks made • ${availableCount} Pokémon available • ${rosterSize} roster spots per team`;

  if (nextPick) {
    nextPickLine.textContent =
      `Next Pick: #${nextPick.overallPick} • Round ${nextPick.roundNumber}, Pick ${nextPick.pickInRound} • ${nextPick.team.team_name}`;
  } else {
    nextPickLine.textContent = "Draft complete.";
  }

  renderDraftHeaderSummary(nextPick, maxDraftRounds);

  renderDraftOrderControls();
  const typedPick = pokemonDraftInput ? pokemonDraftInput.value : "";
  const activeMockFieldId = mockDraftPanel?.contains(document.activeElement) ? document.activeElement.id : "";
  const mockTypedPick = document.getElementById("mockPokemonInput")?.value || "";
  const mockTypedSearch = document.getElementById("mockSearchInput")?.value || "";

  renderPokemonOptions();
  renderDraftPicksList();
  renderTeamRosters();
  renderDraftPointStatus();
  renderSelectedPokemonScout();
  renderAvailablePokemonGrid();
  draftQueueForceRender();
  renderDraftButtons();
  renderMockDraftPanel();
  updatePickControls();
  startDraftTimer();

  if (isBackgroundRefresh && pokemonDraftInput && document.activeElement === pokemonDraftInput) {
    pokemonDraftInput.value = typedPick;
  }

  if (isBackgroundRefresh && activeMockFieldId) {
    const mockPickInput = document.getElementById("mockPokemonInput");
    const mockSearchInput = document.getElementById("mockSearchInput");
    const activeMockField = document.getElementById(activeMockFieldId);

    if (mockPickInput) {
      mockPickInput.value = mockTypedPick;
    }

    if (mockSearchInput) {
      mockSearchInput.value = mockTypedSearch;
    }

    activeMockField?.focus();
  }

  draftRoomStatus.textContent = isAdmin
    ? "Admin draft controls enabled."
    : "Viewing draft room. You can pick when your team is on the clock.";
}

function renderMockDraftPanel() {
  if (!mockDraftPanel || !mockDraftInlineContent || !mockDraftInlineStatus) {
    return;
  }

  mockDraftPanel.style.display = "block";

  if (!leagueTeams.length || !championsPokemon.length) {
    mockDraftInlineStatus.textContent = "Practice draft will appear once league data loads.";
    mockDraftInlineContent.innerHTML = `
      <div class="mock-draft-inline-lock">
        <strong>Loading practice draft...</strong>
        <p class="small-note">Draft Room is still gathering teams and Pokémon.</p>
      </div>
    `;
    if (mockDraftResetHeaderButton) {
      mockDraftResetHeaderButton.disabled = true;
    }
    return;
  }

  if (!isMockDraftOpen()) {
    mockDraftInlineStatus.textContent = "Practice drafts close once the real draft starts.";
    mockDraftInlineContent.innerHTML = `
      <div class="mock-draft-inline-lock">
        <strong>Practice Draft Locked</strong>
        <p class="small-note">
          Mock drafts are only available before the real draft begins and before any real picks are made.
        </p>
      </div>
    `;
    if (mockDraftResetHeaderButton) {
      mockDraftResetHeaderButton.disabled = mockDraftPicks.length === 0;
    }
    return;
  }

  const sequence = getMockDraftPickSequence();
  const nextPick = getMockNextPickInfo();
  const availablePokemon = getMockAvailablePokemon();
  const pointCap = Number(currentLeague?.roster_point_cap || 50);

  mockDraftInlineStatus.textContent =
    "Practice-only picks are saved locally and never touch the real draft board.";

  if (mockDraftResetHeaderButton) {
    mockDraftResetHeaderButton.disabled = mockDraftPicks.length === 0;
  }

  mockDraftInlineContent.innerHTML = `
    <div class="mock-draft-stats">
      <div class="mock-draft-inline-stat">
        <span>Practice Picks</span>
        <strong>${mockDraftPicks.length}/${sequence.length}</strong>
      </div>
      <div class="mock-draft-inline-stat">
        <span>On The Clock</span>
        <strong>${nextPick ? escapeHtml(nextPick.team.team_name) : "Complete"}</strong>
      </div>
      <div class="mock-draft-inline-stat">
        <span>Available</span>
        <strong>${availablePokemon.length}</strong>
      </div>
      <div class="mock-draft-inline-stat">
        <span>Point Cap</span>
        <strong>${pointCap}</strong>
      </div>
    </div>

    <div class="mock-draft-inline-mini-panel">
      <h3>${nextPick ? `Practice Pick #${nextPick.overallPick}` : "Practice Complete"}</h3>
      <div class="mock-draft-controls-grid">
        <label class="mock-draft-field">
          <span>Pokémon</span>
          <input id="mockPokemonInput" class="pkmn-input" list="mockPokemonOptions" type="text" placeholder="Search available Pokémon">
          <datalist id="mockPokemonOptions">${renderMockPokemonOptions()}</datalist>
        </label>
        <button id="mockMakePickButton" class="pkmn-button small" type="button" ${nextPick ? "" : "disabled"}>Make Pick</button>
        <button id="mockAutoPickButton" class="pkmn-button small" type="button" ${nextPick ? "" : "disabled"}>Auto Pick</button>
      </div>
      <div class="mock-draft-actions">
        <button id="mockAutoDraftAllButton" class="pkmn-button small" type="button" ${nextPick ? "" : "disabled"}>Auto Draft All</button>
        <button id="mockUndoPickButton" class="pkmn-button small" type="button" ${mockDraftPicks.length ? "" : "disabled"}>Undo Pick</button>
      </div>
      <p id="mockDraftInlineMessage" class="mock-draft-inline-message">${escapeHtml(mockDraftStatusMessage)}</p>
    </div>

    <div class="mock-draft-inline-mini-panel">
      <h3>Practice Board</h3>
      ${renderMockDraftBoard()}
    </div>

    <div class="mock-draft-inline-mini-panel">
      <h3>Practice Pool</h3>
      <div class="mock-draft-filter-grid">
        <label class="mock-draft-field">
          <span>Search</span>
          <input id="mockSearchInput" class="pkmn-input" type="text" placeholder="Name, type, or tier" value="${escapeHtml(getMockSavedFilter("search"))}">
        </label>
        <label class="mock-draft-field">
          <span>Tier</span>
          <select id="mockTierSelect" class="pkmn-select">${renderMockTierOptions()}</select>
        </label>
        <label class="mock-draft-field">
          <span>Type</span>
          <select id="mockTypeSelect" class="pkmn-select">${renderMockTypeOptions()}</select>
        </label>
      </div>
      <p id="mockAvailableCount" class="small-note"></p>
      <div id="mockAvailableGrid" class="mock-draft-pool-grid"></div>
    </div>

    <div class="mock-draft-inline-mini-panel">
      <h3>Practice Rosters</h3>
      <div class="mock-draft-roster-list">
        ${renderMockRosters()}
      </div>
    </div>
  `;

  bindMockDraftControls();
  renderMockAvailablePokemonGrid();
}

function isMockDraftOpen() {
  return !draftState?.is_started && draftPicks.length === 0;
}

function bindMockDraftControls() {
  const input = document.getElementById("mockPokemonInput");
  const makePickButton = document.getElementById("mockMakePickButton");
  const autoPickButton = document.getElementById("mockAutoPickButton");
  const autoDraftAllButton = document.getElementById("mockAutoDraftAllButton");
  const undoPickButton = document.getElementById("mockUndoPickButton");
  const searchInput = document.getElementById("mockSearchInput");
  const tierSelect = document.getElementById("mockTierSelect");
  const typeSelect = document.getElementById("mockTypeSelect");

  if (mockSelectedPokemonSlug && input) {
    const selected = getPokemonBySlug(mockSelectedPokemonSlug);
    input.value = selected ? getPokemonLabel(selected) : "";
  }

  makePickButton?.addEventListener("click", makeMockPickFromInput);
  autoPickButton?.addEventListener("click", autoMockPick);
  autoDraftAllButton?.addEventListener("click", autoMockDraftAll);
  undoPickButton?.addEventListener("click", undoMockPick);

  input?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      makeMockPickFromInput();
    }
  });

  searchInput?.addEventListener("input", function () {
    saveMockFilter("search", this.value);
    renderMockAvailablePokemonGrid();
  });

  tierSelect?.addEventListener("change", function () {
    saveMockFilter("tier", this.value);
    renderMockAvailablePokemonGrid();
  });

  typeSelect?.addEventListener("change", function () {
    saveMockFilter("type", this.value);
    renderMockAvailablePokemonGrid();
  });
}

function setMockDraftStatus(message) {
  mockDraftStatusMessage = message;
  const messageEl = document.getElementById("mockDraftInlineMessage");

  if (messageEl) {
    messageEl.textContent = message;
  }
}

function makeMockPickFromInput() {
  const input = document.getElementById("mockPokemonInput");
  const pokemon = findMockPokemonFromInput(input?.value || "");

  if (!pokemon) {
    setMockDraftStatus("Choose an available Pokémon from the practice list.");
    return;
  }

  makeMockPick(pokemon);
}

function autoMockPick() {
  const nextPick = getMockNextPickInfo();

  if (!nextPick) {
    setMockDraftStatus("Practice draft is already complete.");
    return;
  }

  const pokemon = getMockSmartAutoPickPokemon(nextPick.team.id);

  if (!pokemon) {
    setMockDraftStatus(`${nextPick.team.team_name} has no legal Pokémon under the point cap.`);
    return;
  }

  makeMockPick(pokemon);
}

function autoMockDraftAll() {
  let safety = 0;
  let stoppedTeamName = "";

  while (getMockNextPickInfo() && safety < 500) {
    const nextPick = getMockNextPickInfo();
    const pokemon = getMockSmartAutoPickPokemon(nextPick.team.id);

    if (!pokemon) {
      stoppedTeamName = nextPick.team.team_name;
      break;
    }

    addMockPick(nextPick, pokemon);
    safety += 1;
  }

  saveMockDraftPicks();
  mockSelectedPokemonSlug = "";
  renderMockDraftPanel();

  setMockDraftStatus(stoppedTeamName
    ? `Auto draft stopped. ${stoppedTeamName} has no legal Pokémon under the point cap.`
    : "Practice draft filled out.");
}

function makeMockPick(pokemon) {
  if (!isMockDraftOpen()) {
    setMockDraftStatus("Practice draft is locked because the real draft has started.");
    renderMockDraftPanel();
    return;
  }

  const nextPick = getMockNextPickInfo();

  if (!nextPick) {
    setMockDraftStatus("Practice draft is already complete.");
    return;
  }

  if (!getMockAvailablePokemon().some(candidate => candidate.slug === pokemon.slug)) {
    setMockDraftStatus(`${pokemon.name} is no longer available in this practice draft.`);
    return;
  }

  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getMockTeamPointUsage(nextPick.team.id);
  const points = getPokemonPoints(pokemon);
  const rosterRows = getMockRosterForTeam(nextPick.team.id);
  const rosterSize = getRosterSize();

  if (usedPoints + points > pointCap) {
    setMockDraftStatus(`${pokemon.name} costs ${points}. ${nextPick.team.team_name} only has ${pointCap - usedPoints} points remaining.`);
    return;
  }

  if (rosterRows.length >= rosterSize) {
    setMockDraftStatus(`${nextPick.team.team_name} already has ${rosterSize} Pokémon.`);
    return;
  }

  addMockPick(nextPick, pokemon);
  saveMockDraftPicks();
  mockSelectedPokemonSlug = "";
  renderMockDraftPanel();
  setMockDraftStatus(`Mock drafted ${pokemon.name} to ${nextPick.team.team_name}.`);
}

function addMockPick(nextPick, pokemon) {
  mockDraftPicks.push({
    league_id: selectedLeagueId,
    league_team_id: nextPick.team.id,
    overall_pick: nextPick.overallPick,
    round_number: nextPick.roundNumber,
    pick_in_round: nextPick.pickInRound,
    pokemon_slug: pokemon.slug,
    created_at: new Date().toISOString()
  });
}

function undoMockPick() {
  const removed = mockDraftPicks.pop();
  saveMockDraftPicks();
  mockSelectedPokemonSlug = "";
  renderMockDraftPanel();

  const pokemon = removed ? getPokemonBySlug(removed.pokemon_slug) : null;
  setMockDraftStatus(pokemon ? `Undid mock pick: ${pokemon.name}.` : "No mock picks to undo.");
}

function resetMockDraft() {
  mockDraftPicks = [];
  mockSelectedPokemonSlug = "";
  saveMockDraftPicks();
  renderMockDraftPanel();
  setMockDraftStatus("Practice draft reset.");
}

function renderMockDraftBoard() {
  const orderedTeams = getOrderedTeams();
  const sequence = getMockDraftPickSequence();
  const maxRounds = sequence.reduce((max, pick) => Math.max(max, pick.roundNumber), 0);
  const nextPick = getMockNextPickInfo();

  if (!orderedTeams.length || !maxRounds) {
    return `<div class="empty-state"><p>No practice board available yet.</p></div>`;
  }

  const picksByRoundTeam = new Map();
  const sequenceByRoundTeam = new Map();

  mockDraftPicks.forEach(pick => {
    picksByRoundTeam.set(`${pick.round_number}:${pick.league_team_id}`, pick);
  });

  sequence.forEach(pick => {
    sequenceByRoundTeam.set(`${pick.roundNumber}:${pick.team.id}`, pick);
  });

  const teamColumnWidth = 132;
  const boardMinWidth = 72 + (orderedTeams.length * teamColumnWidth);
  const columns = `72px repeat(${orderedTeams.length}, minmax(${teamColumnWidth}px, ${teamColumnWidth}px))`;
  const cells = [
    `<div class="draft-board-header-cell draft-board-corner" style="grid-column:1;grid-row:1;">Round</div>`
  ];

  orderedTeams.forEach((team, index) => {
    const isActiveTeam = nextPick?.team?.id === team.id ? "active-team" : "";
    cells.push(`
      <div
        class="draft-board-header-cell draft-board-logo-header ${isActiveTeam}"
        style="grid-column:${index + 2};grid-row:1;"
        title="${escapeHtml(team.team_name)}"
        aria-label="${escapeHtml(team.team_name)}">
        ${renderDraftBoardTeamLogo(team)}
      </div>
    `);
  });

  for (let round = 1; round <= maxRounds; round++) {
    cells.push(`<div class="draft-board-round-cell" style="grid-column:1;grid-row:${round + 1};">${round}</div>`);

    orderedTeams.forEach((team, index) => {
      const pick = picksByRoundTeam.get(`${round}:${team.id}`);
      const pendingPick = sequenceByRoundTeam.get(`${round}:${team.id}`);
      const isOnClock = nextPick && pendingPick && nextPick.overallPick === pendingPick.overallPick;
      const isUpNext = pendingPick && !pick && !isOnClock;
      const cellClass = pick ? "picked" : isOnClock ? "on-clock" : isUpNext ? "up-next" : "";

      cells.push(`
        <div class="draft-board-pick-cell ${cellClass}" style="grid-column:${index + 2};grid-row:${round + 1};">
          ${renderDraftBoardCell(pick, pendingPick, isOnClock)}
        </div>
      `);
    });
  }

  return `
    <div class="mock-draft-board-shell">
      <div class="draft-board-grid mock-draft-board-grid" style="grid-template-columns:${columns};min-width:${boardMinWidth}px;">
        ${cells.join("")}
      </div>
    </div>
  `;
}

function renderMockRosters() {
  const pointCap = Number(currentLeague?.roster_point_cap || 50);

  return getOrderedTeams().map(team => {
    const rosterRows = getMockRosterForTeam(team.id);
    const pointUsage = getMockTeamPointUsage(team.id);
    const rosterSize = getRosterSize();
    const mockNames = rosterRows.slice(0, 5).map(row => {
      const pokemon = getPokemonBySlug(row.pokemon_slug);
      return pokemon ? pokemon.name : row.pokemon_slug;
    });

    return `
      <div class="mock-draft-roster-team">
        <h4>${escapeHtml(team.team_name)}</h4>
        <div class="mock-draft-roster-meta">${rosterRows.length}/${rosterSize} Pokémon • ${pointUsage}/${pointCap} points</div>
        <div class="draft-point-bar"><div style="width:${Math.min((pointUsage / pointCap) * 100, 100)}%"></div></div>
        <div class="mock-draft-roster-picks">
          ${mockNames.length
            ? mockNames.map(name => `<span class="mock-draft-roster-pick">${escapeHtml(name)}</span>`).join("")
            : `<span class="mock-draft-roster-pick">Empty</span>`}
          ${rosterRows.length > mockNames.length ? `<span class="mock-draft-roster-pick">+${rosterRows.length - mockNames.length}</span>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderMockAvailablePokemonGrid() {
  const grid = document.getElementById("mockAvailableGrid");
  const count = document.getElementById("mockAvailableCount");

  if (!grid) {
    return;
  }

  const filteredPokemon = getMockFilteredAvailablePokemon();
  const visiblePokemon = filteredPokemon.slice(0, 12);

  if (count) {
    count.textContent = filteredPokemon.length
      ? `${filteredPokemon.length} available Pokémon match current filters. Showing ${visiblePokemon.length}.`
      : "No available Pokémon match current filters.";
  }

  if (!visiblePokemon.length) {
    grid.innerHTML = `<div class="empty-state"><p>No available Pokémon found.</p></div>`;
    return;
  }

  grid.innerHTML = visiblePokemon.map(pokemon => renderMockPokemonCard(pokemon)).join("");

  grid.querySelectorAll(".mock-draft-pokemon-card").forEach(button => {
    button.addEventListener("click", function () {
      const pokemon = getPokemonBySlug(this.dataset.slug);

      if (!pokemon) {
        return;
      }

      mockSelectedPokemonSlug = pokemon.slug;
      const input = document.getElementById("mockPokemonInput");

      if (input) {
        input.value = getPokemonLabel(pokemon);
      }

      renderMockAvailablePokemonGrid();
      setMockDraftStatus(`${pokemon.name} selected for the next practice pick.`);
    });
  });
}

function renderMockPokemonCard(pokemon) {
  const selected = mockSelectedPokemonSlug === pokemon.slug ? "selected" : "";
  const primaryType = getPokemonPrimaryType(pokemon);
  const secondaryType = getPokemonSecondaryType(pokemon);

  return `
    <button
      class="mock-draft-pokemon-card draft-type-card draft-primary-${primaryType} draft-secondary-${secondaryType} ${selected}"
      type="button"
      data-slug="${escapeHtml(pokemon.slug)}"
      data-primary-type="${primaryType}"
      data-secondary-type="${secondaryType}">
      ${renderPokemonTypeIconBadge(pokemon)}
      ${pokemon.image ? `<img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">` : `<span></span>`}
      <div>
        <div class="mock-draft-pokemon-name">${escapeHtml(getPokemonLabel(pokemon))}</div>
        <div class="mock-draft-pokemon-meta">Rank ${pokemon.rank || "--"} • ${escapeHtml(pokemon.tier || "Bronze")} • ${getPokemonPoints(pokemon)} pts</div>
        ${renderPokemonTypeBadges(pokemon)}
      </div>
    </button>
  `;
}

function renderMockPokemonOptions() {
  return getMockAvailablePokemon()
    .map(pokemon => `<option value="${escapeHtml(getPokemonLabel(pokemon))}"></option>`)
    .join("");
}

function renderMockTierOptions() {
  const selected = getMockSavedFilter("tier") || "all";

  return ["all", ...DRAFT_TIER_ORDER].map(tier => {
    const label = tier === "all" ? "All Tiers" : tier;
    return `<option value="${escapeHtml(tier)}" ${selected === tier ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function renderMockTypeOptions() {
  const selected = getMockSavedFilter("type") || "all";
  const types = Array.from(new Set(championsPokemon.flatMap(pokemon => pokemon.types || []))).sort();

  return [
    `<option value="all">All Types</option>`,
    ...types.map(type => `<option value="${escapeHtml(type)}" ${selected === type ? "selected" : ""}>${escapeHtml(type)}</option>`)
  ].join("");
}

function getMockFilteredAvailablePokemon() {
  const searchTerm = (document.getElementById("mockSearchInput")?.value || getMockSavedFilter("search") || "").trim().toLowerCase();
  const tierFilter = document.getElementById("mockTierSelect")?.value || getMockSavedFilter("tier") || "all";
  const typeFilter = document.getElementById("mockTypeSelect")?.value || getMockSavedFilter("type") || "all";

  return sortAvailablePokemonForDraft(getMockAvailablePokemon().filter(pokemon => {
    const haystack = [
      pokemon.name,
      pokemon.slug,
      pokemon.tier,
      (pokemon.types || []).join(" "),
      getPokemonLabel(pokemon)
    ].join(" ").toLowerCase();

    if (searchTerm && !haystack.includes(searchTerm)) {
      return false;
    }

    if (tierFilter !== "all" && pokemon.tier !== tierFilter) {
      return false;
    }

    if (typeFilter !== "all" && !(pokemon.types || []).includes(typeFilter)) {
      return false;
    }

    return true;
  }));
}

function getMockNextPickInfo() {
  const sequence = getMockDraftPickSequence();

  if (mockDraftPicks.length >= sequence.length) {
    return null;
  }

  return sequence[mockDraftPicks.length] || null;
}

function getMockDraftPickSequence() {
  const orderedTeams = getOrderedTeams();
  const capacities = new Map();
  const sequence = [];
  let maxRounds = 0;

  orderedTeams.forEach(team => {
    const capacity = Math.max(getRosterSize() - getMockBaseRosterForTeam(team.id).length, 0);
    capacities.set(team.id, capacity);
    maxRounds = Math.max(maxRounds, capacity);
  });

  for (let roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
    const roundTeams = roundNumber % 2 === 1 ? orderedTeams : [...orderedTeams].reverse();
    let pickInRound = 0;

    roundTeams.forEach(team => {
      if ((capacities.get(team.id) || 0) < roundNumber) {
        return;
      }

      pickInRound += 1;
      sequence.push({
        overallPick: sequence.length + 1,
        roundNumber,
        pickInRound,
        team
      });
    });
  }

  return sequence;
}

function getMockBaseRosterForTeam(teamId) {
  return allRosterRows
    .filter(row => row.team_id === teamId)
    .sort((a, b) => Number(a.slot_number || 0) - Number(b.slot_number || 0));
}

function getMockRosterForTeam(teamId) {
  const baseRows = getMockBaseRosterForTeam(teamId);
  const mockRows = mockDraftPicks
    .filter(pick => pick.league_team_id === teamId)
    .map((pick, index) => ({
      league_id: selectedLeagueId,
      team_id: teamId,
      pokemon_slug: pick.pokemon_slug,
      slot_number: baseRows.length + index + 1,
      is_mock: true
    }));

  return [...baseRows, ...mockRows];
}

function getMockTeamPointUsage(teamId) {
  return getMockRosterForTeam(teamId).reduce((total, row) => {
    return total + getPokemonPoints(getPokemonBySlug(row.pokemon_slug));
  }, 0);
}

function getMockDraftedSlugSet() {
  return new Set([
    ...allRosterRows.map(row => row.pokemon_slug),
    ...draftPicks.map(pick => pick.pokemon_slug),
    ...mockDraftPicks.map(pick => pick.pokemon_slug)
  ]);
}

function getMockAvailablePokemon() {
  const draftedSlugs = getMockDraftedSlugSet();
  return championsPokemon.filter(pokemon => !draftedSlugs.has(pokemon.slug));
}

function getMockPokemonThatFitTeamCap(teamId) {
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getMockTeamPointUsage(teamId);
  const remainingPoints = pointCap - usedPoints;
  const rosterRows = getMockRosterForTeam(teamId);
  const openRosterSlots = Math.max(getRosterSize() - rosterRows.length, 0);

  return getMockAvailablePokemon().filter(pokemon => {
    const points = getPokemonPoints(pokemon);
    const pointsLeftAfterPick = remainingPoints - points;
    const minimumPointsNeededAfterPick = Math.max(openRosterSlots - 1, 0);

    return points <= remainingPoints && pointsLeftAfterPick >= minimumPointsNeededAfterPick;
  });
}

function getMockSmartAutoPickPokemon(teamId) {
  return getBalancedAutoPickPokemon(teamId, {
    availablePokemonGetter: getMockAvailablePokemon,
    rosterGetter: getMockRosterForTeam,
    pointUsageGetter: getMockTeamPointUsage
  });
}

function findMockPokemonFromInput(inputValue) {
  const cleaned = String(inputValue || "").trim().toLowerCase();

  if (!cleaned) {
    return null;
  }

  return getMockAvailablePokemon().find(pokemon =>
    pokemon.name.toLowerCase() === cleaned ||
    pokemon.slug.toLowerCase() === cleaned ||
    getPokemonLabel(pokemon).toLowerCase() === cleaned
  ) || getMockAvailablePokemon().find(pokemon =>
    pokemon.name.toLowerCase().includes(cleaned) ||
    getPokemonLabel(pokemon).toLowerCase().includes(cleaned)
  );
}

function getMockDraftStorageKey() {
  const cleanLeagueId = String(selectedLeagueId || "league").replace(/[^a-zA-Z0-9_-]/g, "");
  return `pokeleague_mock_draft_${cleanLeagueId}`;
}

function getMockFilterStorageKey(name) {
  const cleanLeagueId = String(selectedLeagueId || "league").replace(/[^a-zA-Z0-9_-]/g, "");
  return `pokeleague_mock_draft_filter_${cleanLeagueId}_${name}`;
}

function loadMockDraftPicks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getMockDraftStorageKey()) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveMockDraftPicks() {
  localStorage.setItem(getMockDraftStorageKey(), JSON.stringify(mockDraftPicks));
}

function sanitizeMockDraftPicks() {
  if (!leagueTeams.length || !championsPokemon.length) {
    return;
  }

  const teamIds = new Set(leagueTeams.map(team => team.id));
  const pokemonSlugs = new Set(championsPokemon.map(pokemon => pokemon.slug));
  const seenSlugs = new Set(allRosterRows.map(row => row.pokemon_slug));
  const sequence = getMockDraftPickSequence();

  mockDraftPicks = mockDraftPicks.filter((pick, index) => {
    const sequencePick = sequence[index];

    if (!sequencePick || !teamIds.has(pick.league_team_id) || !pokemonSlugs.has(pick.pokemon_slug) || seenSlugs.has(pick.pokemon_slug)) {
      return false;
    }

    seenSlugs.add(pick.pokemon_slug);
    pick.league_id = selectedLeagueId;
    pick.league_team_id = sequencePick.team.id;
    pick.overall_pick = sequencePick.overallPick;
    pick.round_number = sequencePick.roundNumber;
    pick.pick_in_round = sequencePick.pickInRound;
    return true;
  });

  saveMockDraftPicks();
}

function saveMockFilter(name, value) {
  localStorage.setItem(getMockFilterStorageKey(name), value || "");
}

function getMockSavedFilter(name) {
  return localStorage.getItem(getMockFilterStorageKey(name)) || (name === "tier" || name === "type" ? "all" : "");
}

function updatePickControls() {
  const nextPick = getNextPickInfo();
  const draftRunning = Boolean(draftState?.is_started) && !draftState?.is_paused;
  const isMyTurn = Boolean(
    currentMembership?.league_team_id &&
    nextPick?.team?.id === currentMembership.league_team_id
  );

  if (makePickButton) {
    makePickButton.disabled = !draftRunning || (!isAdmin && !isMyTurn);

    if (isAdmin) {
      makePickButton.textContent = "Make Pick";
    } else if (isMyTurn && draftRunning) {
      makePickButton.textContent = "Make My Pick";
    } else {
      makePickButton.textContent = "Waiting";
    }
  }

  if (undoPickButton) {
    undoPickButton.style.display = isAdmin ? "inline-flex" : "none";
  }

  if (draftActionStatus) {
    if (!draftState?.is_started) {
      draftActionStatus.textContent = "Draft has not started.";
    } else if (draftState?.is_paused) {
      draftActionStatus.textContent = "Draft is stopped.";
    } else if (isAdmin) {
      draftActionStatus.textContent = "Admin can make or undo picks.";
    } else if (isMyTurn) {
      draftActionStatus.textContent = "Your team is on the clock.";
    } else if (nextPick) {
      draftActionStatus.textContent = `${nextPick.team.team_name} is on the clock.`;
    } else {
      draftActionStatus.textContent = "Draft complete.";
    }
  }
}

function renderDraftHeaderSummary(nextPick, maxDraftRounds) {
  if (draftRoundNumber) {
    draftRoundNumber.textContent = nextPick ? String(nextPick.roundNumber) : "--";
  }

  if (draftRoundMeta) {
    draftRoundMeta.textContent = maxDraftRounds ? `of ${maxDraftRounds}` : "of --";
  }

  if (!draftHeaderTeamSummary) {
    return;
  }

  const teamId = currentMembership?.league_team_id || nextPick?.team?.id;
  const team = teamId ? getTeamById(teamId) : null;
  const pointCap = Number(currentLeague?.roster_point_cap || 50);

  if (!team) {
    draftHeaderTeamSummary.innerHTML = `
      <p class="draft-kicker">Your Team</p>
      <p class="small-note">No team assigned.</p>
    `;
    return;
  }

  const rosterRows = getRosterForTeam(team.id);
  const pointUsage = getTeamPointUsage(team.id);
  const nextPickText = nextPick ? `${nextPick.roundNumber}.${nextPick.pickInRound}` : "--";
  const rosterSize = getRosterSize();

  draftHeaderTeamSummary.innerHTML = `
    <p class="draft-kicker">${currentMembership?.league_team_id ? "Your Team" : "On The Clock"}</p>
    <p class="draft-board-pokemon-name">${escapeHtml(team.team_name)}</p>
    <p class="small-note">${rosterRows.length}/${rosterSize} roster • ${pointUsage}/${pointCap} points • Next ${escapeHtml(nextPickText)}</p>
  `;
}

function renderDraftButtons() {
  if (!isAdmin) {
    return;
  }

  const draftStarted = draftState?.is_started;
  const draftPaused = draftState?.is_paused;

  startDraftButton.textContent = !draftStarted ? "Start Draft" : draftPaused ? "Resume Draft" : "Draft Running";
  startDraftButton.disabled = draftStarted && !draftPaused;

  stopDraftButton.disabled = !draftStarted || draftPaused;

  const orderLocked = draftStarted || draftPicks.length > 0;
  saveDraftOrderButton.disabled = orderLocked;
}

function renderDraftOrderControls() {
  if (!isAdmin) {
    return;
  }

  const orderLocked = draftState?.is_started || draftPicks.length > 0;

  draftOrderList.innerHTML = getOrderedTeams().map((team, index) => {
    const options = leagueTeams.map(optionTeam => {
      const selected = optionTeam.id === team.id ? "selected" : "";
      return `<option value="${optionTeam.id}" ${selected}>${optionTeam.team_name}</option>`;
    }).join("");

    return `
      <div class="draft-order-row">
        <span>Pick ${index + 1}</span>
        <select class="pkmn-select draft-order-select" ${orderLocked ? "disabled" : ""}>
          ${options}
        </select>
      </div>
    `;
  }).join("");
}

function getOrderedTeams() {
  const teamsById = {};

  leagueTeams.forEach(team => {
    teamsById[team.id] = team;
  });

  const orderedTeams = draftOrderTeamIds
    .map(teamId => teamsById[teamId])
    .filter(Boolean);

  const missingTeams = leagueTeams.filter(team => !draftOrderTeamIds.includes(team.id));

  return [...orderedTeams, ...missingTeams];
}

async function saveCurrentDraftOrder(showStatus) {
  if (!isAdmin) {
    draftActionStatus.textContent = "Only admins can edit draft order.";
    return false;
  }

  if (draftState?.is_started || draftPicks.length > 0) {
    draftActionStatus.textContent = "Draft order cannot be changed after the draft starts.";
    return false;
  }

  const selectedTeamIds = Array.from(document.querySelectorAll(".draft-order-select"))
    .map(select => select.value);

  const uniqueTeamIds = new Set(selectedTeamIds);

  if (selectedTeamIds.length !== leagueTeams.length || uniqueTeamIds.size !== leagueTeams.length) {
    draftActionStatus.textContent = "Each team must appear exactly once in the draft order.";
    return false;
  }

  if (showStatus) {
    draftActionStatus.textContent = "Saving draft order...";
  }

  const { error: deleteError } = await supabaseClient
    .from("league_draft_order")
    .delete()
    .eq("league_id", selectedLeagueId);

  if (deleteError) {
    console.error("Delete draft order error:", deleteError);
    draftActionStatus.textContent = "Could not clear old draft order.";
    return false;
  }

  const rows = selectedTeamIds.map((teamId, index) => ({
    league_id: selectedLeagueId,
    slot_number: index + 1,
    league_team_id: teamId
  }));

  const { error: insertError } = await supabaseClient
    .from("league_draft_order")
    .insert(rows);

  if (insertError) {
    console.error("Insert draft order error:", insertError);
    draftActionStatus.textContent = "Could not save draft order.";
    return false;
  }

  draftOrderTeamIds = selectedTeamIds;

  if (showStatus) {
    draftActionStatus.textContent = "Draft order saved.";
  }

  await refreshDraftData();
  return true;
}

async function startOrResumeDraft() {
  if (!isAdmin) {
    draftActionStatus.textContent = "Only admins can start the draft.";
    return;
  }

  if (!draftState?.is_started) {
    const orderSaved = await saveCurrentDraftOrder(false);

    if (!orderSaved) {
      return;
    }
  }

  draftActionStatus.textContent = draftState?.is_started ? "Resuming draft..." : "Starting draft...";

  const { error } = await supabaseClient
    .from("league_draft_state")
    .upsert({
      league_id: selectedLeagueId,
      is_started: true,
      is_paused: false,
      current_pick_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: "league_id"
    });

  if (error) {
    console.error("Start draft error:", error);
    draftActionStatus.textContent = "Could not start draft.";
    return;
  }

  draftActionStatus.textContent = "Draft started.";
  await refreshDraftData();
}

async function stopDraft() {
  if (!isAdmin) {
    draftActionStatus.textContent = "Only admins can stop the draft.";
    return;
  }

  draftActionStatus.textContent = "Stopping draft...";

  const { error } = await supabaseClient
    .from("league_draft_state")
    .update({
      is_paused: true,
      updated_at: new Date().toISOString()
    })
    .eq("league_id", selectedLeagueId);

  if (error) {
    console.error("Stop draft error:", error);
    draftActionStatus.textContent = "Could not stop draft.";
    return;
  }

  draftActionStatus.textContent = "Draft stopped.";
  await refreshDraftData();
}

function startDraftTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  updateDraftClock();

  timerInterval = setInterval(updateDraftClock, 1000);
}

function setDraftClockLine(message, state = "") {
  if (!draftClockLine) {
    return;
  }

  draftClockLine.textContent = message;
  draftClockLine.dataset.clockState = state;
}

function updateDraftClock() {
  const nextPick = getNextPickInfo();

  if (!draftState?.is_started) {
    setDraftClockLine("Draft has not started.", "idle");
    return;
  }

  if (draftState?.is_paused) {
    setDraftClockLine("Draft is stopped.", "stopped");
    return;
  }

  if (!nextPick) {
    setDraftClockLine("Draft complete.", "complete");
    return;
  }

  if (!draftState.current_pick_started_at) {
    setDraftClockLine("Clock waiting...", "waiting");
    return;
  }

  const startedAt = new Date(draftState.current_pick_started_at).getTime();
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - startedAt) / 1000);
  const remainingSeconds = Math.max(getPickSeconds() - elapsedSeconds, 0);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, "0");

  setDraftClockLine(
    `${minutes}:${seconds} remaining • On the clock: ${nextPick.team.team_name}`,
    "running"
  );

  if (remainingSeconds <= 0 && !autoPickInProgress) {
    autoPickInProgress = true;
    draftActionStatus.textContent = "Time expired. Random pick incoming...";
    makeDraftPick(true).finally(() => {
      autoPickInProgress = false;
    });
  }
}

function getNextPickInfo() {
  const draftSequence = getDraftPickSequence();

  if (draftPicks.length >= draftSequence.length || draftSequence.length === 0) {
    return null;
  }

  return draftSequence[draftPicks.length];
}

function getDraftPickSequence() {
  const orderedTeams = getOrderedTeams();
  const draftCapacities = new Map();
  let maxRounds = 0;
  const sequence = [];

  orderedTeams.forEach(team => {
    const capacity = Math.max(getRosterSize() - getMascotCountForTeam(team.id), 0);
    draftCapacities.set(team.id, capacity);
    maxRounds = Math.max(maxRounds, capacity);
  });

  for (let roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
    const roundTeams = roundNumber % 2 === 1
      ? orderedTeams
      : [...orderedTeams].reverse();
    let pickInRound = 0;

    roundTeams.forEach(team => {
      if ((draftCapacities.get(team.id) || 0) < roundNumber) {
        return;
      }

      pickInRound += 1;
      sequence.push({
        overallPick: sequence.length + 1,
        roundNumber,
        pickInRound,
        team
      });
    });
  }

  return sequence;
}

function getTotalDraftPicks() {
  return getDraftPickSequence().length;
}

function getMaxDraftRounds() {
  return getDraftPickSequence().reduce((maxRound, pick) => {
    return Math.max(maxRound, pick.roundNumber);
  }, 0);
}

function getMascotCountForTeam(teamId) {
  return getRosterForTeam(teamId).filter(row => row.is_mascot === true).length;
}

function getDraftedSlugSet() {
  return new Set([
    ...draftPicks.map(pick => pick.pokemon_slug),
    ...allRosterRows.map(row => row.pokemon_slug)
  ]);
}

function getAvailablePokemon() {
  const draftedSlugs = getDraftedSlugSet();
  return championsPokemon.filter(pokemon => !draftedSlugs.has(pokemon.slug));
}

function getPokemonBySlug(slug) {
  return championsPokemon.find(pokemon => pokemon.slug === slug);
}

function getTeamById(teamId) {
  return leagueTeams.find(team => team.id === teamId);
}

function getRosterForTeam(teamId) {
  return allRosterRows
    .filter(row => row.team_id === teamId)
    .sort((a, b) => a.slot_number - b.slot_number);
}

function getPokemonLabel(pokemon) {
  const sameNameCount = championsPokemon.filter(p => p.name.toLowerCase() === pokemon.name.toLowerCase()).length;

  if (sameNameCount > 1) {
    return `${pokemon.name} (${pokemon.types.join("/")})`;
  }

  return pokemon.name;
}

function findPokemonFromInput(inputValue) {
  const cleaned = inputValue.trim().toLowerCase();

  return getAvailablePokemon().find(pokemon =>
    pokemon.name.toLowerCase() === cleaned ||
    pokemon.slug.toLowerCase() === cleaned ||
    getPokemonLabel(pokemon).toLowerCase() === cleaned
  );
}

function renderPokemonOptions() {
  availablePokemonOptions.innerHTML = getAvailablePokemon().map(pokemon => {
    return `<option value="${escapeHtml(getPokemonLabel(pokemon))}"></option>`;
  }).join("");
}

function renderDraftPicksList() {
  const orderedTeams = getOrderedTeams();
  const maxRounds = getMaxDraftRounds();

  if (!orderedTeams.length || !maxRounds) {
    draftPicksList.innerHTML = `<div class="empty-state"><p>No draft board yet.</p></div>`;
    return;
  }

  const nextPick = getNextPickInfo();
  const picksByRoundTeam = new Map();
  const sequenceByRoundTeam = new Map();

  draftPicks.forEach(pick => {
    picksByRoundTeam.set(`${pick.round_number}:${pick.league_team_id}`, pick);
  });

  getDraftPickSequence().forEach(pick => {
    sequenceByRoundTeam.set(`${pick.roundNumber}:${pick.team.id}`, pick);
  });

  const teamColumnWidth = 132;
  const boardMinWidth = 72 + (orderedTeams.length * teamColumnWidth);
  const columns = `72px repeat(${orderedTeams.length}, minmax(${teamColumnWidth}px, ${teamColumnWidth}px))`;
  const cells = [];

  cells.push(`<div class="draft-board-header-cell draft-board-corner" style="grid-column:1;grid-row:1;">Round</div>`);

  orderedTeams.forEach((team, index) => {
    const isActiveTeam = nextPick?.team?.id === team.id ? "active-team" : "";
    cells.push(`
      <div
        class="draft-board-header-cell draft-board-logo-header ${isActiveTeam}"
        style="grid-column:${index + 2};grid-row:1;"
        title="${escapeHtml(team.team_name)}"
        aria-label="${escapeHtml(team.team_name)}">
        ${renderDraftBoardTeamLogo(team)}
      </div>
    `);
  });

  for (let round = 1; round <= maxRounds; round++) {
    cells.push(`
      <div class="draft-board-round-cell" style="grid-column:1;grid-row:${round + 1};">
        ${round}
      </div>
    `);

    orderedTeams.forEach((team, index) => {
      const pick = picksByRoundTeam.get(`${round}:${team.id}`);
      const pendingPick = sequenceByRoundTeam.get(`${round}:${team.id}`);
      const isOnClock = nextPick && pendingPick && nextPick.overallPick === pendingPick.overallPick;
      const isUpNext = pendingPick && !pick && !isOnClock;
      const cellClass = pick ? "picked" : isOnClock ? "on-clock" : isUpNext ? "up-next" : "";

      cells.push(`
        <div class="draft-board-pick-cell ${cellClass}" style="grid-column:${index + 2};grid-row:${round + 1};">
          ${renderDraftBoardCell(pick, pendingPick, isOnClock)}
        </div>
      `);
    });
  }

  draftPicksList.innerHTML = `
    <div class="draft-board-shell">
      <div class="draft-board-grid" style="grid-template-columns:${columns};min-width:${boardMinWidth}px;">
        ${cells.join("")}
      </div>
    </div>
  `;
}

function renderDraftBoardTeamLogo(team) {
  if (team.logo_url) {
    return `
      <img
        class="draft-board-team-logo"
        src="${escapeHtml(team.logo_url)}"
        alt="${escapeHtml(team.team_name)} logo">
    `;
  }

  const fallbackText = team.team_number ? `T${team.team_number}` : getTeamInitials(team.team_name);

  return `
    <span class="draft-board-team-logo-placeholder" aria-hidden="true">
      ${escapeHtml(fallbackText)}
    </span>
  `;
}

function getTeamInitials(teamName) {
  return String(teamName || "T")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase() || "T";
}

function renderDraftBoardCell(pick, pendingPick, isOnClock) {
  if (pick) {
    const pokemon = getPokemonBySlug(pick.pokemon_slug);
    const tier = pokemon?.tier || "Drafted";
    const points = pokemon ? getPokemonPoints(pokemon) : "--";
    const bst = pokemon ? getPokemonBst(pokemon) : null;

    return `
      <div class="draft-board-pokemon">
        ${pokemon?.image
          ? `<img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">`
          : `<div class="draft-board-empty-img"></div>`}
        <div>
          <div class="draft-board-pokemon-name">${escapeHtml(pokemon ? pokemon.name : pick.pokemon_slug)}</div>
          <div class="draft-board-pokemon-meta">#${pick.overall_pick} • ${escapeHtml(tier)} • ${points} pts${bst ? ` • BST ${bst}` : ""}</div>
        </div>
      </div>
    `;
  }

  if (isOnClock) {
    return `
      <div>
        <div class="draft-board-cell-label">On The Clock</div>
        <div class="draft-board-cell-meta">Pick #${pendingPick.overallPick}</div>
      </div>
    `;
  }

  if (pendingPick) {
    return `
      <div>
        <div class="draft-board-cell-label">Up Next</div>
        <div class="draft-board-cell-meta">Pick #${pendingPick.overallPick}</div>
      </div>
    `;
  }

  return `
    <div>
      <div class="draft-board-cell-label">-</div>
      <div class="draft-board-cell-meta">No pick</div>
    </div>
  `;
}

function getManagerDisplayName(team) {
  return (
    team.owner_name ||
    team.manager_name ||
    team.display_name ||
    team.manager_email ||
    "Unassigned"
  );
}

function getDraftRoomTeamLabel(team) {
  const manager = getManagerDisplayName(team);
  return manager && manager !== "Unassigned"
    ? `${team.team_name} (${manager})`
    : team.team_name;
}

function renderTeamRosters() {
  const pointCap = Number(currentLeague?.roster_point_cap || 50);

  draftTeamRosters.innerHTML = leagueTeams.map(team => {
    const rosterRows = getRosterForTeam(team.id);
    const pointUsage = getTeamPointUsage(team.id);
    const rosterSize = getRosterSize();

    return `
      <div class="draft-roster-team ${getNextPickInfo()?.team?.id === team.id ? "on-clock-roster" : ""}">
        <h3>${escapeHtml(getDraftRoomTeamLabel(team))}</h3>
        <p>${rosterRows.length}/${rosterSize} Pokémon • ${pointUsage}/${pointCap} points</p>

        <div class="draft-point-bar">
          <div style="width:${Math.min((pointUsage / pointCap) * 100, 100)}%"></div>
        </div>

        <div class="draft-roster-list">
          ${
            rosterRows.length === 0
              ? `<span class="draft-empty-pill">Empty</span>`
              : rosterRows.map(row => {
                  const pokemon = getPokemonBySlug(row.pokemon_slug);
                  const mascotLabel = row.is_mascot === true ? "Mascot • " : "";
                  const bst = getPokemonBst(pokemon);

                  return `
                    <div class="draft-roster-slot">
                      ${pokemon?.image
                        ? `<img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">`
                        : `<div class="draft-board-empty-img"></div>`}
                      <div>
                        <div class="draft-roster-slot-name">${escapeHtml(pokemon ? `${mascotLabel}${pokemon.name}` : row.pokemon_slug)}</div>
                        <div class="draft-roster-slot-meta">${pokemon ? `${escapeHtml((pokemon.types || []).join(" / "))}${bst ? ` • BST ${bst}` : ""}` : "Unknown"}</div>
                      </div>
                      <span class="draft-roster-slot-points">${pokemon ? getPokemonPoints(pokemon) : "?"}</span>
                    </div>
                  `;
                }).join("")
          }
        </div>
      </div>
    `;
  }).join("");
}


function renderDraftPointStatus() {
  if (!draftPointStatus) {
    return;
  }

  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const nextPick = getNextPickInfo();

  let myTeamHtml = "";

  if (currentMembership?.league_team_id) {
    const myTeam = getTeamById(currentMembership.league_team_id);
    const myUsed = getTeamPointUsage(currentMembership.league_team_id);
    const myRemaining = pointCap - myUsed;

    if (myTeam) {
      myTeamHtml = `
        <div class="draft-point-card">
          <p><strong>My Team Points</strong></p>
          <p>${escapeHtml(myTeam.team_name)}: ${myUsed}/${pointCap}</p>
          <p class="small-note">Remaining: ${myRemaining}</p>
          <div class="draft-point-bar">
            <div style="width:${Math.min((myUsed / pointCap) * 100, 100)}%"></div>
          </div>
        </div>
      `;
    }
  }

  let onClockHtml = "";

  if (nextPick) {
    const onClockUsed = getTeamPointUsage(nextPick.team.id);
    const onClockRemaining = pointCap - onClockUsed;

    onClockHtml = `
      <div class="draft-point-card">
        <p><strong>On The Clock</strong></p>
        <p>${escapeHtml(nextPick.team.team_name)}: ${onClockUsed}/${pointCap}</p>
        <p class="small-note">Remaining: ${onClockRemaining}</p>
        <div class="draft-point-bar">
          <div style="width:${Math.min((onClockUsed / pointCap) * 100, 100)}%"></div>
        </div>
      </div>
    `;
  }

  draftPointStatus.innerHTML = `
    <div class="draft-point-grid">
      ${myTeamHtml || `<div class="draft-point-card"><p><strong>My Team Points</strong></p><p class="small-note">No team assigned.</p></div>`}
      ${onClockHtml || `<div class="draft-point-card"><p><strong>On The Clock</strong></p><p class="small-note">Draft complete or not started.</p></div>`}
    </div>
  `;
}

function getDefaultScoutPokemon() {
  if (selectedPokemonSlug) {
    const selectedPokemon = getPokemonBySlug(selectedPokemonSlug);

    if (selectedPokemon && !getDraftedSlugSet().has(selectedPokemon.slug)) {
      return selectedPokemon;
    }
  }

  return getFilteredAvailablePokemon()[0] || null;
}

function setSelectedPokemon(pokemon, fillPickInput = true) {
  if (!pokemon) {
    return;
  }

  selectedPokemonSlug = pokemon.slug;

  if (fillPickInput && pokemonDraftInput) {
    pokemonDraftInput.value = getPokemonLabel(pokemon);
  }

  renderSelectedPokemonScout();
}

function renderSelectedPokemonScout() {
  if (!selectedPokemonScoutBody) {
    return;
  }

  const pokemon = getDefaultScoutPokemon();

  if (!pokemon) {
    selectedPokemonScoutBody.innerHTML = `<p class="small-note">No available Pokémon to scout.</p>`;
    return;
  }

  const bst = getPokemonBst(pokemon);
  const points = getPokemonPoints(pokemon);

  selectedPokemonScoutBody.innerHTML = `
    <div class="draft-scout-card">
      <div class="draft-scout-main">
        <img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">
        <div>
          <p class="draft-scout-name">${escapeHtml(getPokemonLabel(pokemon))}</p>
          <p class="draft-scout-meta">${escapeHtml(pokemon.tier || "Tier")} • ${points} pts • BST ${bst || "--"} • ${escapeHtml(getPokemonDraftRole(pokemon))}</p>
          ${renderPokemonTypeBadges(pokemon)}
        </div>
      </div>

      ${renderPokemonStatBars(pokemon)}

      <div class="draft-scout-actions">
        <button id="useScoutPokemonButton" class="draft-theme-link" type="button">Use Pick</button>
        <button id="queueScoutPokemonButton" class="draft-theme-link light" type="button">Queue</button>
      </div>
    </div>
  `;

  const useButton = document.getElementById("useScoutPokemonButton");
  const queueButton = document.getElementById("queueScoutPokemonButton");

  if (useButton) {
    useButton.addEventListener("click", function () {
      setSelectedPokemon(pokemon, true);
      draftControls?.scrollIntoView({ behavior: "smooth", block: "center" });
      pokemonDraftInput?.focus();
    });
  }

  if (queueButton) {
    queueButton.addEventListener("click", function () {
      const queueInput = document.getElementById("draftQueueInput");

      if (queueInput) {
        queueInput.value = getPokemonLabel(pokemon);
      }

      draftQueueForceAdd();
    });
  }
}

function getTeamPointUsage(teamId) {
  return getRosterForTeam(teamId).reduce((total, row) => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);
    return total + getPokemonPoints(pokemon);
  }, 0);
}

function getNextRosterSlotNumber(rosterRows) {
  return rosterRows.length > 0
    ? Math.max(...rosterRows.map(row => Number(row.slot_number || 0))) + 1
    : 1;
}

async function insertDraftRosterRow({ teamId, pokemonSlug, slotNumber }) {
  let nextSlot = slotNumber;
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabaseClient
      .from("team_rosters")
      .insert({
        league_id: selectedLeagueId,
        team_id: teamId,
        pokemon_slug: pokemonSlug,
        slot_number: nextSlot
      });

    if (!error) {
      return null;
    }

    lastError = error;

    if (!isRosterSlotConflict(error)) {
      return error;
    }

    const { data: latestRosterRows, error: reloadError } = await supabaseClient
      .from("team_rosters")
      .select("*")
      .eq("league_id", selectedLeagueId)
      .eq("team_id", teamId)
      .order("slot_number", { ascending: true });

    if (reloadError) {
      console.error("Roster reload after slot conflict failed:", reloadError);
      return error;
    }

    nextSlot = getNextRosterSlotNumber(latestRosterRows || []);
  }

  return lastError;
}

function isRosterSlotConflict(error) {
  const errorText = getSupabaseErrorText(error);

  return errorText.includes("unique_team_slot") ||
    errorText.includes("slot_number");
}

function getRosterInsertFailureMessage(error) {
  const errorText = getSupabaseErrorText(error);

  if (errorText.includes("unique_pokemon_owner")) {
    return "Roster update failed because the database is still enforcing old global roster uniqueness. Draft pick was undone.";
  }

  if (errorText.includes("unique_league_pokemon_owner") || errorText.includes("pokemon_slug")) {
    return "Roster update failed because that Pokémon is already rostered in this league. Draft pick was undone.";
  }

  if (isRosterSlotConflict(error)) {
    return "Roster slot was taken by another draft update. Draft pick was undone; refresh and try again.";
  }

  return "Roster update failed. Draft pick was undone.";
}

function getSupabaseErrorText(error) {
  return [
    error?.message,
    error?.details,
    error?.hint,
    error?.code
  ].filter(Boolean).join(" ").toLowerCase();
}

function getPokemonPoints(pokemon) {
  return Number(pokemon?.points || 1);
}

function getPokemonStatData(pokemon) {
  if (!pokemon) {
    return null;
  }

  return pokemonBstBySlug[pokemon.slug] || null;
}

function getPokemonBst(pokemon) {
  const statData = getPokemonStatData(pokemon);
  return statData?.bst ? Number(statData.bst) : null;
}

function getPokemonStatsUrl(pokemon) {
  const statData = getPokemonStatData(pokemon);

  if (statData?.source_url) {
    return statData.source_url;
  }

  if (pokemon?.id) {
    return `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(String(pokemon.id))}`;
  }

  return "https://pokeapi.co/";
}

function getPokemonDraftRole(pokemon) {
  const stats = getPokemonStatData(pokemon)?.stats;

  if (!stats) {
    return "Scout";
  }

  const attack = Number(stats.attack || 0);
  const specialAttack = Number(stats.sp_atk || 0);
  const defense = Number(stats.defense || 0);
  const specialDefense = Number(stats.sp_def || 0);
  const hp = Number(stats.hp || 0);
  const speed = Number(stats.speed || 0);
  const bulk = hp + defense + specialDefense;

  if (speed >= attack && speed >= specialAttack && speed >= defense && speed >= specialDefense) {
    return "Speed";
  }

  if (bulk >= (attack + specialAttack + speed) * 1.15) {
    return "Tank";
  }

  if (specialAttack > attack + 12) {
    return "Special";
  }

  if (attack > specialAttack + 12) {
    return "Physical";
  }

  return "Balanced";
}

function renderPokemonStatBars(pokemon, compact = false) {
  const stats = getPokemonStatData(pokemon)?.stats;

  if (!stats) {
    return compact ? "" : `<div class="draft-card-role-row">BST loading</div>`;
  }

  const rows = compact ? DRAFT_STAT_ROWS.slice(0, 6) : DRAFT_STAT_ROWS;

  return `
    <div class="draft-card-stat-bars">
      ${rows.map(([key, label]) => {
        const value = Number(stats[key] || 0);
        const width = Math.min((value / 120) * 100, 100);
        const tone = getStatTone(value);

        return `
          <div class="draft-stat-row">
            <span>${label}</span>
            <span class="draft-stat-track"><span class="draft-stat-fill ${tone}" style="width:${width}%"></span></span>
            <span>${value}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function getStatTone(value) {
  if (value >= 120) {
    return "stat-elite";
  }

  if (value >= 95) {
    return "stat-high";
  }

  if (value >= 70) {
    return "stat-medium";
  }

  return "stat-low";
}

function getPokemonThatFitTeamCap(teamId) {
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(teamId);
  const remainingPoints = pointCap - usedPoints;

  return getAvailablePokemon().filter(pokemon => getPokemonPoints(pokemon) <= remainingPoints);
}

function getSmartAutoPickPokemon(teamId) {
  const queuedPokemon = draftQueueForceGetFirstLegalPokemon(teamId);

  if (queuedPokemon) {
    if (draftActionStatus) {
      draftActionStatus.textContent = `Auto-draft selected queued Pokémon: ${queuedPokemon.name}.`;
    }
    return queuedPokemon;
  }

  return getBalancedAutoPickPokemon(teamId);
}

function getBalancedAutoPickPokemon(teamId, options = {}) {
  const availablePokemonGetter = options.availablePokemonGetter || getAvailablePokemon;
  const rosterGetter = options.rosterGetter || getRosterForTeam;
  const pointUsageGetter = options.pointUsageGetter || getTeamPointUsage;
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = pointUsageGetter(teamId);
  const remainingPoints = pointCap - usedPoints;
  const rosterRows = rosterGetter(teamId);
  const openRosterSlots = getRosterSize() - rosterRows.length;
  const profile = getRosterAutoDraftProfile(rosterRows);

  const scoredCandidates = availablePokemonGetter()
    .map(pokemon => {
      const points = getPokemonPoints(pokemon);
      const rank = Number(pokemon.rank || 9999);
      const minimumPointsNeededAfterPick = Math.max(openRosterSlots - 1, 0);
      const pointsLeftAfterPick = remainingPoints - points;

      return {
        pokemon,
        points,
        rank,
        keepsRosterPossible: pointsLeftAfterPick >= minimumPointsNeededAfterPick,
        score: scoreAutoDraftPokemon(pokemon, profile, {
          openRosterSlots,
          pointCap,
          remainingPoints
        })
      };
    })
    .filter(candidate => candidate.points <= remainingPoints);

  const preferredCandidates = scoredCandidates.filter(candidate => candidate.keepsRosterPossible);
  const candidates = preferredCandidates.length ? preferredCandidates : scoredCandidates;

  if (!candidates.length) {
    return null;
  }

  return candidates.sort(compareAutoDraftCandidates)[0].pokemon;
}

function compareAutoDraftCandidates(a, b) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  if (b.points !== a.points) {
    return b.points - a.points;
  }

  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }

  return a.pokemon.name.localeCompare(b.pokemon.name);
}

function getRosterAutoDraftProfile(rosterRows) {
  const profile = {
    rosterCount: rosterRows.length,
    typeCounts: {},
    roleCounts: {},
    statTotals: {},
    statCounts: {}
  };

  rosterRows.forEach(row => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);

    if (!pokemon) {
      return;
    }

    (pokemon.types || []).forEach(type => {
      const typeSlug = getTypeSlug(type);
      profile.typeCounts[typeSlug] = (profile.typeCounts[typeSlug] || 0) + 1;
    });

    const role = getPokemonDraftRole(pokemon);
    profile.roleCounts[role] = (profile.roleCounts[role] || 0) + 1;

    const stats = getPokemonStatData(pokemon)?.stats;

    if (!stats) {
      return;
    }

    DRAFT_STAT_ROWS.forEach(([key]) => {
      const value = Number(stats[key] || 0);
      profile.statTotals[key] = (profile.statTotals[key] || 0) + value;
      profile.statCounts[key] = (profile.statCounts[key] || 0) + 1;
    });
  });

  return profile;
}

function scoreAutoDraftPokemon(pokemon, profile, context) {
  const points = getPokemonPoints(pokemon);
  const rank = Number(pokemon.rank || 9999);
  const bst = getPokemonBst(pokemon) || 0;
  const types = (pokemon.types || []).map(getTypeSlug).filter(Boolean);
  const primaryType = types[0] || "normal";
  const secondaryType = types[1] || "";
  const role = getPokemonDraftRole(pokemon);
  const stats = getPokemonStatData(pokemon)?.stats || {};

  let score = points * 140;
  score += Math.max(0, 180 - Math.min(rank, 180)) * 1.4;
  score += bst ? bst / 6 : 0;
  score += getTypeFitScore(primaryType, profile.typeCounts, true);

  if (secondaryType && secondaryType !== primaryType) {
    score += getTypeFitScore(secondaryType, profile.typeCounts, false);
  }

  score += getRoleFitScore(role, profile.roleCounts);
  score += getStatNeedScore(stats, profile);
  score += getPointPacingScore(points, context);

  return score;
}

function getTypeFitScore(type, typeCounts, isPrimary) {
  const count = typeCounts[type] || 0;

  if (count === 0) {
    return isPrimary ? 95 : 42;
  }

  if (count === 1) {
    return isPrimary ? -14 : -6;
  }

  return isPrimary ? -34 * count : -16 * count;
}

function getRoleFitScore(role, roleCounts) {
  const count = roleCounts[role] || 0;
  const keyRoles = ["Speed", "Tank", "Physical", "Special"];

  if (keyRoles.includes(role) && count === 0) {
    return 92;
  }

  if (role === "Balanced" && count === 0) {
    return 46;
  }

  return -18 * count;
}

function getStatNeedScore(stats, profile) {
  if (!stats || Object.keys(stats).length === 0) {
    return 0;
  }

  if (profile.rosterCount === 0) {
    return DRAFT_STAT_ROWS.reduce((total, [key]) => {
      return total + Math.min(Number(stats[key] || 0), 125) / 14;
    }, 0);
  }

  return DRAFT_STAT_ROWS.reduce((total, [key]) => {
    const candidateValue = Number(stats[key] || 0);
    const rosterAverage = (profile.statTotals[key] || 0) / Math.max(profile.statCounts[key] || 1, 1);
    const needMultiplier = rosterAverage < 75 ? 1.4 : rosterAverage < 90 ? 0.9 : 0.35;

    return total + (Math.min(candidateValue, 130) * needMultiplier / 8);
  }, 0);
}

function getPointPacingScore(points, context) {
  const openSlots = Math.max(context.openRosterSlots || 1, 1);
  const averageRemainingBudget = context.remainingPoints / openSlots;
  const scarcityPressure = openSlots <= 2 ? 1.25 : 1;

  if (points >= averageRemainingBudget - 0.5) {
    return 18 * scarcityPressure;
  }

  return -Math.min((averageRemainingBudget - points) * 10, 28);
}



function draftQueueForceInit() {
  setTimeout(function () {
    const addButton = document.getElementById("addQueueButton");
    const clearButton = document.getElementById("clearQueueButton");
    const input = document.getElementById("draftQueueInput");

    if (addButton && !addButton.dataset.queueBound) {
      addButton.dataset.queueBound = "true";
      addButton.addEventListener("click", draftQueueForceAdd);
    }

    if (clearButton && !clearButton.dataset.queueBound) {
      clearButton.dataset.queueBound = "true";
      clearButton.addEventListener("click", draftQueueForceClear);
    }

    if (input && !input.dataset.queueBound) {
      input.dataset.queueBound = "true";
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          draftQueueForceAdd();
        }
      });
    }

    draftQueueForceRender();
  }, 0);
}

function draftQueueForceGetTeamId() {
  return currentMembership?.league_team_id || "";
}

function draftQueueForceStorageKey(teamId = draftQueueForceGetTeamId()) {
  const leaguePart = String(selectedLeagueId || "league").replace(/[^a-zA-Z0-9_-]/g, "");
  const teamPart = String(teamId || "team").replace(/[^a-zA-Z0-9_-]/g, "");

  return `pokeleague_draft_queue_${leaguePart}_${teamPart}`;
}

function draftQueueForceGet(teamId = draftQueueForceGetTeamId()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(draftQueueForceStorageKey(teamId)) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function draftQueueForceSave(queue, teamId = draftQueueForceGetTeamId()) {
  localStorage.setItem(draftQueueForceStorageKey(teamId), JSON.stringify(queue.filter(Boolean)));
}

function draftQueueForceClean(teamId = draftQueueForceGetTeamId()) {
  const queue = draftQueueForceGet(teamId);

  if (!championsPokemon || !championsPokemon.length) {
    return queue;
  }

  const draftedSlugs = getDraftedSlugSet();
  const availableSlugSet = new Set(getAvailablePokemon().map(pokemon => pokemon.slug));
  const cleaned = queue.filter(slug => !draftedSlugs.has(slug) && availableSlugSet.has(slug));

  draftQueueForceSave(cleaned, teamId);
  return cleaned;
}

function draftQueueForceAdd() {
  const input = document.getElementById("draftQueueInput");
  const status = document.getElementById("draftQueueStatus");

  if (!input) return;

  const requested = input.value.trim();

  if (!requested) {
    if (status) status.textContent = "Choose a Pokémon to queue.";
    return;
  }

  const pokemon = findPokemonFromInput(requested);

  if (!pokemon) {
    if (status) status.textContent = `Could not find "${requested}" in available Pokémon.`;
    return;
  }

  const teamId = draftQueueForceGetTeamId();

  if (!teamId) {
    if (status) status.textContent = "No team assigned for this queue.";
    return;
  }

  const queue = draftQueueForceClean(teamId);

  if (queue.includes(pokemon.slug)) {
    if (status) status.textContent = `${pokemon.name} is already in your queue.`;
    input.value = "";
    draftQueueForceRender();
    return;
  }

  queue.push(pokemon.slug);
  draftQueueForceSave(queue, teamId);

  input.value = "";
  if (status) status.textContent = `${pokemon.name} added to your queue.`;

  draftQueueForceRender();
}

function draftQueueForceClear() {
  const teamId = draftQueueForceGetTeamId();
  const status = document.getElementById("draftQueueStatus");

  draftQueueForceSave([], teamId);

  if (status) {
    status.textContent = "Queue cleared.";
  }

  draftQueueForceRender();
}

function draftQueueForceMove(index, direction) {
  const teamId = draftQueueForceGetTeamId();
  const queue = draftQueueForceClean(teamId);
  const targetIndex = index + direction;

  if (targetIndex < 0 || targetIndex >= queue.length) return;

  const temp = queue[index];
  queue[index] = queue[targetIndex];
  queue[targetIndex] = temp;

  draftQueueForceSave(queue, teamId);
  draftQueueForceRender();
}

function draftQueueForceRemove(index) {
  const teamId = draftQueueForceGetTeamId();
  const queue = draftQueueForceClean(teamId);
  const removedSlug = queue.splice(index, 1)[0];
  const status = document.getElementById("draftQueueStatus");

  draftQueueForceSave(queue, teamId);

  const removedPokemon = removedSlug ? getPokemonBySlug(removedSlug) : null;

  if (status) {
    status.textContent = removedPokemon
      ? `${removedPokemon.name} removed from your queue.`
      : "Removed from queue.";
  }

  draftQueueForceRender();
}

function draftQueueForceRender() {
  const list = document.getElementById("draftQueueList");
  const status = document.getElementById("draftQueueStatus");

  if (!list) return;

  draftQueueForceInit();

  const teamId = draftQueueForceGetTeamId();

  if (!teamId) {
    list.innerHTML = `<div class="draft-queue-empty">No team assigned yet.</div>`;
    if (status) status.textContent = "Queue unavailable until your team is assigned.";
    return;
  }

  const team = getTeamById(teamId);
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(teamId);
  const remainingPoints = pointCap - usedPoints;
  const queue = draftQueueForceClean(teamId);

  if (!queue.length) {
    list.innerHTML = `<div class="draft-queue-empty">No queued Pokémon yet. Add Pokémon here before the draft starts.</div>`;
    if (status) {
      status.textContent = team
        ? `Queue is for ${team.team_name}. Remaining points: ${remainingPoints}.`
        : "Queue is ready.";
    }
    return;
  }

  list.innerHTML = queue.map((slug, index) => {
    const pokemon = getPokemonBySlug(slug);
    const points = getPokemonPoints(pokemon);
    const fits = pokemon && points <= remainingPoints;
    const queuedName = pokemon ? pokemon.name : slug;
    const bst = getPokemonBst(pokemon);

    return `
      <div class="draft-queue-row">
        <span class="draft-queue-rank">${index + 1}</span>
        ${pokemon?.image
          ? `<img class="draft-queue-sprite" src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">`
          : `<span class="draft-queue-sprite"></span>`}
        <span class="draft-queue-name">
          ${escapeHtml(queuedName)}
          <span class="draft-queue-meta">
            ${pokemon ? `${points} point${points === 1 ? "" : "s"}${bst ? ` • BST ${bst}` : ""} • ${fits ? "fits current cap" : "would exceed cap right now"}` : "Not available"}
          </span>
        </span>
        <button class="draft-queue-mini-button" type="button" data-queue-action="up" data-queue-index="${index}">Up</button>
        <button class="draft-queue-mini-button" type="button" data-queue-action="down" data-queue-index="${index}">Down</button>
        <button class="draft-queue-mini-button danger" type="button" data-queue-action="remove" data-queue-index="${index}">Remove</button>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-queue-action]").forEach(button => {
    button.addEventListener("click", function () {
      const index = Number(this.dataset.queueIndex);
      const action = this.dataset.queueAction;

      if (action === "up") draftQueueForceMove(index, -1);
      if (action === "down") draftQueueForceMove(index, 1);
      if (action === "remove") draftQueueForceRemove(index);
    });
  });

  if (status) {
    status.textContent = `${queue.length} queued for ${team ? team.team_name : "your team"}. Remaining points: ${remainingPoints}.`;
  }
}

function draftQueueForceGetFirstLegalPokemon(teamId) {
  const queue = draftQueueForceClean(teamId);

  if (!queue.length) return null;

  const draftedSlugs = getDraftedSlugSet();
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(teamId);
  const remainingPoints = pointCap - usedPoints;
  const rosterRows = getRosterForTeam(teamId);
  const openRosterSlots = getRosterSize() - rosterRows.length;

  for (const slug of queue) {
    if (draftedSlugs.has(slug)) continue;

    const pokemon = getPokemonBySlug(slug);

    if (!pokemon) continue;

    const points = getPokemonPoints(pokemon);
    const minimumPointsNeededAfterPick = Math.max(openRosterSlots - 1, 0);
    const pointsLeftAfterPick = remainingPoints - points;
    const keepsRosterPossible = pointsLeftAfterPick >= minimumPointsNeededAfterPick;

    if (points <= remainingPoints && keepsRosterPossible) {
      return pokemon;
    }
  }

  return null;
}


function renderAvailablePokemonFilters() {
  if (!typeFilterSelect || !championsPokemon.length) {
    return;
  }

  const selectedType = typeFilterSelect.value || "all";

  const typeSet = new Set();

  championsPokemon.forEach(pokemon => {
    (pokemon.types || []).forEach(type => {
      typeSet.add(type);
    });
  });

  const sortedTypes = Array.from(typeSet).sort();

  typeFilterSelect.innerHTML = `
    <option value="all">All Types</option>
    ${sortedTypes.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}
  `;

  typeFilterSelect.value = sortedTypes.includes(selectedType) ? selectedType : "all";
}

function getFilteredAvailablePokemon() {
  const searchTerm = availablePokemonSearch.value.trim().toLowerCase();
  const megaFilter = megaFilterSelect ? megaFilterSelect.value : "all";
  const tierFilter = tierFilterSelect ? tierFilterSelect.value : "all";
  const typeFilter = typeFilterSelect ? typeFilterSelect.value : "all";

  let availablePokemon = getAvailablePokemon();

  if (searchTerm) {
    availablePokemon = availablePokemon.filter(pokemon =>
      pokemon.name.toLowerCase().includes(searchTerm) ||
      pokemon.slug.toLowerCase().includes(searchTerm) ||
      (pokemon.types || []).join(" ").toLowerCase().includes(searchTerm) ||
      getPokemonLabel(pokemon).toLowerCase().includes(searchTerm)
    );
  }

  if (megaFilter === "mega") {
    availablePokemon = availablePokemon.filter(pokemon => pokemon.can_mega_evolve === true);
  }

  if (megaFilter === "non-mega") {
    availablePokemon = availablePokemon.filter(pokemon => pokemon.can_mega_evolve !== true);
  }

  if (tierFilter !== "all") {
    availablePokemon = availablePokemon.filter(pokemon => pokemon.tier === tierFilter);
  }

  if (typeFilter !== "all") {
    availablePokemon = availablePokemon.filter(pokemon => {
      return (pokemon.types || []).includes(typeFilter);
    });
  }

  return sortAvailablePokemonForDraft(availablePokemon);
}

function sortAvailablePokemonForDraft(pokemonList) {
  return pokemonList.slice().sort((a, b) => {
    const tierDiff = getDraftTierSortValue(a.tier) - getDraftTierSortValue(b.tier);

    if (tierDiff !== 0) {
      return tierDiff;
    }

    const pointDiff = getPokemonPoints(b) - getPokemonPoints(a);

    if (pointDiff !== 0) {
      return pointDiff;
    }

    const aRank = Number(a.rank || 9999);
    const bRank = Number(b.rank || 9999);

    if (aRank !== bRank) {
      return aRank - bRank;
    }

    return a.name.localeCompare(b.name);
  });
}

function getDraftTierSortValue(tier) {
  const tierIndex = DRAFT_TIER_ORDER.indexOf(tier);
  return tierIndex === -1 ? DRAFT_TIER_ORDER.length : tierIndex;
}

function getAvailablePokemonFilterSignature() {
  return [
    availablePokemonSearch ? availablePokemonSearch.value.trim().toLowerCase() : "",
    megaFilterSelect ? megaFilterSelect.value : "all",
    tierFilterSelect ? tierFilterSelect.value : "all",
    typeFilterSelect ? typeFilterSelect.value : "all"
  ].join("|");
}

function getAvailablePokemonPaginationElement() {
  if (!availablePokemonGrid) {
    return null;
  }

  let paginationEl = document.getElementById("availablePokemonPagination");

  if (!paginationEl) {
    paginationEl = document.createElement("div");
    paginationEl.id = "availablePokemonPagination";
    paginationEl.style.cssText = "display:flex;align-items:center;justify-content:center;gap:12px;margin:16px 0 0;flex-wrap:wrap;";
    availablePokemonGrid.insertAdjacentElement("afterend", paginationEl);
  }

  return paginationEl;
}

function renderAvailablePokemonPagination(totalCount) {
  const paginationEl = getAvailablePokemonPaginationElement();

  if (!paginationEl) {
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / AVAILABLE_POKEMON_PAGE_SIZE));

  if (totalCount <= AVAILABLE_POKEMON_PAGE_SIZE) {
    paginationEl.innerHTML = "";
    return;
  }

  paginationEl.innerHTML = `
    <button id="availablePokemonPrevPage" class="pkmn-button" type="button" ${availablePokemonPage <= 0 ? "disabled" : ""}>Previous Page</button>
    <span class="small-note">Page ${availablePokemonPage + 1} of ${totalPages}</span>
    <button id="availablePokemonNextPage" class="pkmn-button" type="button" ${availablePokemonPage >= totalPages - 1 ? "disabled" : ""}>Next Page</button>
  `;

  const prevButton = document.getElementById("availablePokemonPrevPage");
  const nextButton = document.getElementById("availablePokemonNextPage");

  if (prevButton) {
    prevButton.addEventListener("click", function () {
      availablePokemonPage = Math.max(0, availablePokemonPage - 1);
      renderAvailablePokemonGrid();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      availablePokemonPage = Math.min(totalPages - 1, availablePokemonPage + 1);
      renderAvailablePokemonGrid();
    });
  }
}

function renderAvailablePokemonGrid() {
  let availablePokemon = getFilteredAvailablePokemon();

  const activeFilterSignature = getAvailablePokemonFilterSignature();

  if (activeFilterSignature !== availablePokemonFilterSignature) {
    availablePokemonFilterSignature = activeFilterSignature;
    availablePokemonPage = 0;
  }

  const totalFilteredCount = availablePokemon.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / AVAILABLE_POKEMON_PAGE_SIZE));

  if (availablePokemonPage >= totalPages) {
    availablePokemonPage = totalPages - 1;
  }

  const startIndex = availablePokemonPage * AVAILABLE_POKEMON_PAGE_SIZE;
  const endIndex = startIndex + AVAILABLE_POKEMON_PAGE_SIZE;

  if (availablePokemonCount) {
    if (totalFilteredCount === 0) {
      availablePokemonCount.textContent = "0 available Pokémon match current filters.";
    } else {
      availablePokemonCount.textContent = `${totalFilteredCount} available Pokémon match current filters. Showing ${startIndex + 1}-${Math.min(endIndex, totalFilteredCount)}.`;
    }
  }

  availablePokemon = availablePokemon.slice(startIndex, endIndex);
  renderAvailablePokemonPagination(totalFilteredCount);

  if (availablePokemon.length === 0) {
    availablePokemonGrid.innerHTML = `<div class="empty-state"><p>No available Pokémon found.</p></div>`;
    return;
  }

  availablePokemonGrid.innerHTML = availablePokemon.map(pokemon => {
    const primaryType = getPokemonPrimaryType(pokemon);
    const secondaryType = getPokemonSecondaryType(pokemon);

    return `
      <div class="draft-pokemon-card draft-type-card draft-primary-${primaryType} draft-secondary-${secondaryType}" data-slug="${pokemon.slug}" data-primary-type="${primaryType}" data-secondary-type="${secondaryType}">
        ${renderPokemonTypeIconBadge(pokemon)}
        <button class="draft-pokemon-pick-button" type="button" data-slug="${pokemon.slug}">
          <img src="${pokemon.image}" alt="${escapeHtml(pokemon.name)}">
          ${renderMegaBadge(pokemon)}
          <span>${escapeHtml(getPokemonLabel(pokemon))}</span>
          ${renderPokemonTierBadge(pokemon)}
          ${renderPokemonTypeBadges(pokemon)}
          ${renderPokemonStatBars(pokemon, true)}
        </button>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".draft-pokemon-pick-button").forEach(button => {
    button.addEventListener("click", function () {
      const pokemon = championsPokemon.find(p => p.slug === this.dataset.slug);

      if (pokemon) {
        setSelectedPokemon(pokemon, true);
      }
    });
  });
}

async function makeDraftPick(randomPick) {
  const permissionPickInfo = getNextPickInfo();
  const isMyTurn = Boolean(
    currentMembership?.league_team_id &&
    permissionPickInfo?.team?.id === currentMembership.league_team_id
  );

  if (!isAdmin && !isMyTurn && !randomPick) {
    draftActionStatus.textContent = "You can only pick when your team is on the clock.";
    return;
  }

  if (!isAdmin && randomPick === true) {
    // Timer auto-pick is allowed from any open league member page.
    // Database uniqueness rules prevent duplicate successful auto-picks.
  }

  if (!draftState?.is_started || draftState?.is_paused) {
    draftActionStatus.textContent = "Start the draft clock before making picks.";
    return;
  }

  const nextPick = getNextPickInfo();

  if (!nextPick) {
    draftActionStatus.textContent = "Draft is already complete.";
    return;
  }

  let pokemon = null;

  if (randomPick) {
    pokemon = getSmartAutoPickPokemon(nextPick.team.id);

    if (!pokemon) {
      draftActionStatus.textContent = `${nextPick.team.team_name} has no legal Pokémon available under the point cap.`;
      return;
    }
  } else {
    pokemon = findPokemonFromInput(pokemonDraftInput.value);
  }

  if (!pokemon) {
    draftActionStatus.textContent = "That Pokémon is not available. Use the exact name from the list.";
    return;
  }

  const rosterRows = getRosterForTeam(nextPick.team.id);
  const rosterSize = getRosterSize();
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(nextPick.team.id);
  const pokemonPoints = getPokemonPoints(pokemon);

  if (usedPoints + pokemonPoints > pointCap) {
    draftActionStatus.textContent =
      `${pokemon.name} costs ${pokemonPoints}. ${nextPick.team.team_name} only has ${pointCap - usedPoints} points remaining.`;
    makePickButton.disabled = false;
    return;
  }

  if (rosterRows.length >= rosterSize) {
    draftActionStatus.textContent = `${nextPick.team.team_name} already has ${rosterSize} Pokémon.`;
    return;
  }

  makePickButton.disabled = true;
  draftActionStatus.textContent = `Drafting ${pokemon.name} to ${nextPick.team.team_name}...`;

  const { error: pickError } = await supabaseClient
    .from("league_draft_picks")
    .insert({
      league_id: selectedLeagueId,
      league_team_id: nextPick.team.id,
      overall_pick: nextPick.overallPick,
      round_number: nextPick.roundNumber,
      pick_in_round: nextPick.pickInRound,
      pokemon_slug: pokemon.slug
    });

  if (pickError) {
    console.error("Draft pick error:", pickError);
    draftActionStatus.textContent = "Pick could not be saved. Refreshing draft state...";
    await refreshDraftData(true);
    makePickButton.disabled = false;
    return;
  }

  const nextSlot = getNextRosterSlotNumber(rosterRows);
  const rosterError = await insertDraftRosterRow({
    teamId: nextPick.team.id,
    pokemonSlug: pokemon.slug,
    slotNumber: nextSlot
  });

  if (rosterError) {
    console.error("Roster insert error:", rosterError);

    await supabaseClient
      .from("league_draft_picks")
      .delete()
      .eq("league_id", selectedLeagueId)
      .eq("overall_pick", nextPick.overallPick);

    draftActionStatus.textContent = getRosterInsertFailureMessage(rosterError);
    await refreshDraftData(true);
    makePickButton.disabled = false;
    return;
  }

  pokemonDraftInput.value = "";

  const upcomingPick = draftPicks.length + 1;
  const totalPicks = getTotalDraftPicks();

  await supabaseClient
    .from("league_draft_state")
    .update({
      is_paused: upcomingPick >= totalPicks,
      current_pick_started_at: upcomingPick >= totalPicks ? null : new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("league_id", selectedLeagueId);

  draftActionStatus.textContent = randomPick
    ? `Timer expired. ${pokemon.name} was randomly drafted to ${nextPick.team.team_name}.`
    : `${pokemon.name} drafted to ${nextPick.team.team_name}.`;

  await refreshDraftData();
  makePickButton.disabled = false;
}

async function undoLastPick() {
  if (!isAdmin) {
    draftActionStatus.textContent = "Only admins can undo draft picks.";
    return;
  }

  if (draftPicks.length === 0) {
    draftActionStatus.textContent = "No picks to undo.";
    return;
  }

  const lastPick = draftPicks[draftPicks.length - 1];
  const pokemon = getPokemonBySlug(lastPick.pokemon_slug);
  const team = getTeamById(lastPick.league_team_id);

  undoPickButton.disabled = true;
  draftActionStatus.textContent = "Undoing last pick...";

  const { error: deletePickError } = await supabaseClient
    .from("league_draft_picks")
    .delete()
    .eq("id", lastPick.id);

  if (deletePickError) {
    console.error("Delete pick error:", deletePickError);
    draftActionStatus.textContent = "Could not undo draft pick.";
    undoPickButton.disabled = false;
    return;
  }

  const { error: deleteRosterError } = await supabaseClient
    .from("team_rosters")
    .delete()
    .eq("league_id", selectedLeagueId)
    .eq("team_id", lastPick.league_team_id)
    .eq("pokemon_slug", lastPick.pokemon_slug);

  if (deleteRosterError) {
    console.error("Delete roster error:", deleteRosterError);
    draftActionStatus.textContent = "Draft pick removed, but roster cleanup failed.";
    undoPickButton.disabled = false;
    await refreshDraftData();
    return;
  }

  await supabaseClient
    .from("league_draft_state")
    .update({
      is_started: true,
      is_paused: false,
      current_pick_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("league_id", selectedLeagueId);

  draftActionStatus.textContent =
    `Undid ${pokemon ? pokemon.name : lastPick.pokemon_slug} from ${team ? team.team_name : "team"}.`;

  await refreshDraftData();
  undoPickButton.disabled = false;
}


function renderMegaBadge(pokemon) {
  if (!pokemon || !pokemon.can_mega_evolve) {
    return "";
  }

  return `<img class="mega-badge-overlay" src="images/MegaEvolution.png" alt="Mega Evolution">`;
}


function getTypeClass(type) {
  return `type-${getTypeSlug(type)}`;
}

function getTypeSlug(type) {
  return String(type || "normal").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "normal";
}

function getPokemonPrimaryType(pokemon) {
  return getTypeSlug((pokemon?.types || [])[0]);
}

function getPokemonSecondaryType(pokemon) {
  const types = (pokemon?.types || []).map(getTypeSlug).filter(Boolean);
  return types[1] || types[0] || "normal";
}

function getTypeDisplayName(type) {
  return String(type || "normal")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const TYPE_ICON_SVGS = {
  normal: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="6"/></svg>`,
  fire: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M17 3c4 5-1 7 4 11 2 2 4 5 4 8 0 5-4 8-9 8s-9-3-9-8c0-4 3-8 8-13 0 4 3 5 2 9 3-2 4-7 0-15Z"/></svg>`,
  water: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C10 11 7 16 7 21c0 5 4 9 9 9s9-4 9-9c0-5-3-10-9-18Zm-4 17c0 3 2 5 5 5-4 1-7-1-7-5 0-2 1-4 3-6-1 2-1 4-1 6Z"/></svg>`,
  electric: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M18 2 7 18h8l-2 12 12-17h-8l1-11Z"/></svg>`,
  grass: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M27 5C15 5 7 11 7 20c0 4 3 7 7 7 9 0 13-10 13-22Zm-15 17c4-6 8-9 13-12-4 4-7 9-9 16l-4-4Z"/></svg>`,
  ice: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M14 3h4v8l7-4 2 4-7 4 7 4-2 4-7-4v8h-4v-8l-7 4-2-4 7-4-7-4 2-4 7 4V3Z"/></svg>`,
  fighting: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 14h4V6h4v8h2V5h4v9h2V7h4v12c0 6-4 10-10 10h-4l-6-6v-9Z"/></svg>`,
  poison: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4c7 0 11 4 11 10 0 4-2 7-6 9v5H11v-5c-4-2-6-5-6-9C5 8 9 4 16 4Zm-5 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm10 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 6-3 5h6l-3-5Z"/></svg>`,
  ground: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 24 13 7h14v17H5Zm5-4h12v-9h-7l-5 9Z"/></svg>`,
  flying: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 19c9-1 14-5 22-14-1 8-5 14-13 17 5 0 9-1 14-4-4 6-10 9-18 9H4l6-5c-3 0-5-1-6-3Z"/></svg>`,
  psychic: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="5" d="M22 16c0-4-3-7-7-7s-7 3-7 7 3 7 7 7c3 0 5-2 5-5 0-2-2-4-4-4s-4 2-4 4c0 1 1 2 2 2"/></svg>`,
  bug: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M12 8 8 4 5 7l4 4c-2 2-3 5-3 8h5c0 4 2 8 5 8s5-4 5-8h5c0-3-1-6-3-8l4-4-3-3-4 4c-1-1-3-2-4-2s-3 1-4 2Zm4 3c3 0 5 3 5 8H11c0-5 2-8 5-8Z"/></svg>`,
  rock: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12 14 5l10 2 4 12-8 9-12-3-3-13Zm7 2-2 7 8 2 5-5-2-7-6-1-3 4Z"/></svg>`,
  ghost: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 28V15C6 8 10 4 16 4s10 4 10 11v13l-4-3-3 3-3-3-3 3-3-3-4 3Zm7-15a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>`,
  dragon: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M27 3c-2 7-6 11-13 12l-5 7 8-2c4-2 8-7 10-17Zm-7 14c5 1 8 4 8 8 0 4-4 6-10 6H7c5-2 8-5 9-9l-8 2 5-7h7Zm-1-7 4-4-1 6-5 1 2-3Z"/></svg>`,
  dark: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M25 5a12 12 0 1 0 0 22 14 14 0 1 1 0-22Z"/></svg>`,
  steel: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 28 10v12l-12 7-12-7V10L16 3Zm0 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" fill-rule="evenodd"/></svg>`,
  fairy: `<svg class="draft-type-icon-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Zm0 9-2 4 2 4 2-4-2-4Z"/></svg>`
};

function renderTypeIconSvg(type) {
  return TYPE_ICON_SVGS[getTypeSlug(type)] || TYPE_ICON_SVGS.normal;
}

function renderPokemonTypeIconBadge(pokemon) {
  const typeSlugs = (pokemon?.types || []).map(getTypeSlug).filter(Boolean).slice(0, 2);
  const displayedTypes = typeSlugs.length > 0 ? typeSlugs : ["normal"];
  const ariaLabel = `${displayedTypes.map(getTypeDisplayName).join(" / ")} type`;
  const stackClass = displayedTypes.length > 1 ? "dual" : "single";

  return `
    <span class="draft-type-icon-stack ${stackClass}" role="group" aria-label="${escapeHtml(ariaLabel)}" title="${escapeHtml(ariaLabel)}">
      ${displayedTypes.map(type => `
        <span class="draft-type-icon-badge draft-type-icon-${type}" role="img" aria-label="${escapeHtml(`${getTypeDisplayName(type)} type`)}">
          ${renderTypeIconSvg(type)}
        </span>
      `).join("")}
    </span>
  `;
}

function renderPokemonTypeBadges(pokemon) {
  const types = pokemon.types || [];

  if (!types.length) {
    return "";
  }

  const typeClass = types.length === 1 ? "single" : "dual";

  return `
    <div class="pokemon-type-strip ${typeClass}">
      ${types.map(type => `
        <span class="pokemon-type-segment ${getTypeClass(type)}">
          ${escapeHtml(type)}
        </span>
      `).join("")}
    </div>
  `;
}

function renderPokemonTierBadge(pokemon) {
  const tier = pokemon.tier || "Bronze";
  const points = pokemon.points || 1;
  const icon = pokemon.tier_icon || "images/tiers/BronzeButton.png";

  return `
    <div class="pokemon-tier-badge">
      <img src="${icon}" alt="${tier}">
      <span>${tier} ${points}</span>
    </div>
  `;
}

function disableDraftControls() {
  makePickButton.disabled = true;
  undoPickButton.disabled = true;
  saveDraftOrderButton.disabled = true;
  startDraftButton.disabled = true;
  stopDraftButton.disabled = true;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
