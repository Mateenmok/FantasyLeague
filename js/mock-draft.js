const mockDraftSubtitle = document.getElementById("mockDraftSubtitle");
const mockDraftContent = document.getElementById("mockDraftContent");
const mockDraftStatus = document.getElementById("mockDraftStatus");

const selectedLeagueId = localStorage.getItem("selected-league-id");
const ROSTER_SIZE = 10;
const DRAFT_TIER_ORDER = ["Diamond", "Gold", "Silver", "Bronze"];

let currentLeague = null;
let currentMembership = null;
let leagueTeams = [];
let draftOrderTeamIds = [];
let draftState = null;
let realDraftPicks = [];
let baseRosterRows = [];
let championsPokemon = [];
let mockPicks = [];
let selectedPokemonSlug = "";
let draftLocked = false;

const TYPE_COLORS = {
  normal: "#9da3a8",
  fire: "#f06f35",
  water: "#5297d8",
  electric: "#f0ca43",
  grass: "#63bb5b",
  ice: "#73cec0",
  fighting: "#cf4069",
  poison: "#ab6ac8",
  ground: "#d97845",
  flying: "#8fa8dd",
  psychic: "#f87178",
  bug: "#91c12f",
  rock: "#c7b78b",
  ghost: "#5269ad",
  dragon: "#7b61d1",
  dark: "#5a5366",
  steel: "#5a9bb0",
  fairy: "#ec8fe6"
};

loadMockDraftPage();

async function loadMockDraftPage() {
  if (!selectedLeagueId) {
    mockDraftSubtitle.textContent = "No league selected.";
    renderLockedState("Select a league before opening a mock draft.", "Go to My Leagues and choose a league first.");
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    mockDraftSubtitle.textContent = "Not signed in.";
    renderLockedState("Sign in to use mock drafts.", "Mock drafts use your selected league settings.");
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
    mockDraftSubtitle.textContent = "No access.";
    renderLockedState("You are not a member of this league.", "Select a different league from My Leagues.");
    return;
  }

  currentMembership = membership;

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    mockDraftSubtitle.textContent = "Could not load league.";
    renderLockedState("League data could not be loaded.", "Try refreshing or selecting the league again.");
    return;
  }

  currentLeague = league;
  mockDraftSubtitle.textContent = league.name;

  try {
    championsPokemon = await fetch("data/champions-pokemon.json?v=garchomp9").then(response => response.json());
  } catch (error) {
    console.error("Pokémon data load error:", error);
    renderLockedState("Pokémon data could not be loaded.", "Refresh the page and try again.");
    return;
  }

  await loadLeagueDraftData();
  mockPicks = loadMockPicks();
  sanitizeMockPicks();
  renderMockDraft();
}

async function loadLeagueDraftData() {
  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
    leagueTeams = [];
  } else {
    leagueTeams = teams || [];
  }

  const { data: orderRows, error: orderError } = await supabaseClient
    .from("league_draft_order")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("slot_number", { ascending: true });

  if (orderError || !orderRows || orderRows.length === 0) {
    if (orderError) {
      console.error("Draft order error:", orderError);
    }

    draftOrderTeamIds = leagueTeams.map(team => team.id);
  } else {
    draftOrderTeamIds = orderRows.map(row => row.league_team_id);
  }

  const { data: state, error: stateError } = await supabaseClient
    .from("league_draft_state")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .maybeSingle();

  if (stateError) {
    console.error("Draft state error:", stateError);
  }

  draftState = state || null;

  const { data: picks, error: picksError } = await supabaseClient
    .from("league_draft_picks")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("overall_pick", { ascending: true });

  if (picksError) {
    console.error("Draft picks error:", picksError);
    realDraftPicks = [];
  } else {
    realDraftPicks = picks || [];
  }

  const { data: rosterRows, error: rosterError } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("slot_number", { ascending: true });

  if (rosterError) {
    console.error("Roster error:", rosterError);
    baseRosterRows = [];
  } else {
    baseRosterRows = rosterRows || [];
  }

  draftLocked = Boolean(draftState?.is_started) || realDraftPicks.length > 0;
}

function renderMockDraft() {
  if (draftLocked) {
    renderLockedState(
      "Mock drafts are closed because the real draft has started.",
      "Practice drafts are only available before any real draft picks are made."
    );
    return;
  }

  const sequence = getDraftPickSequence();
  const nextPick = getNextPickInfo();
  const availableCount = getAvailablePokemon().length;
  const picksMade = mockPicks.length;

  mockDraftContent.innerHTML = `
    <section class="mock-draft-status">
      Mock drafts are practice-only. Picks are saved in this browser and do not change the real draft board or rosters.
    </section>

    <section class="mock-draft-stat-grid">
      <div class="mock-draft-stat">
        <span>Practice Picks</span>
        <strong>${picksMade}/${sequence.length}</strong>
      </div>
      <div class="mock-draft-stat">
        <span>On The Clock</span>
        <strong>${nextPick ? escapeHtml(nextPick.team.team_name) : "Complete"}</strong>
      </div>
      <div class="mock-draft-stat">
        <span>Available</span>
        <strong>${availableCount}</strong>
      </div>
      <div class="mock-draft-stat">
        <span>Point Cap</span>
        <strong>${Number(currentLeague?.roster_point_cap || 50)}</strong>
      </div>
    </section>

    <section class="mock-draft-layout">
      <main class="mock-draft-left">
        <section class="mock-draft-panel">
          <span class="mock-panel-kicker">Practice Controls</span>
          <h2>${nextPick ? `Pick #${nextPick.overallPick}: ${escapeHtml(nextPick.team.team_name)}` : "Mock draft complete"}</h2>
          <div class="mock-controls-grid">
            <label class="mock-field">
              <span>Pokémon</span>
              <input id="mockPokemonInput" class="mock-input" list="mockPokemonOptions" type="text" placeholder="Search available Pokémon">
              <datalist id="mockPokemonOptions">${renderPokemonOptions()}</datalist>
            </label>
            <button id="mockMakePickButton" class="mock-draft-button primary" type="button" ${nextPick ? "" : "disabled"}>Make Pick</button>
            <button id="mockAutoPickButton" class="mock-draft-button" type="button" ${nextPick ? "" : "disabled"}>Auto Pick</button>
          </div>

          <div class="mock-draft-actions" style="justify-content:flex-start;margin-top:10px;">
            <button id="mockAutoDraftAllButton" class="mock-draft-button" type="button" ${nextPick ? "" : "disabled"}>Auto Draft All</button>
            <button id="mockUndoPickButton" class="mock-draft-button" type="button" ${mockPicks.length ? "" : "disabled"}>Undo Pick</button>
            <button id="mockResetButton" class="mock-draft-button danger" type="button" ${mockPicks.length ? "" : "disabled"}>Reset Mock</button>
          </div>
        </section>

        <section class="mock-draft-panel">
          <span class="mock-panel-kicker">Draft Board</span>
          <h2>Practice Board</h2>
          <div id="mockDraftBoard">${renderDraftBoard()}</div>
        </section>

        <section class="mock-draft-panel">
          <span class="mock-panel-kicker">Available Pokémon</span>
          <h2>Draft Pool</h2>
          <div class="mock-filter-grid">
            <label class="mock-field">
              <span>Search</span>
              <input id="mockSearchInput" class="mock-input" type="text" placeholder="Name, type, or tier" value="${escapeHtml(getSavedFilter("search"))}">
            </label>
            <label class="mock-field">
              <span>Tier</span>
              <select id="mockTierSelect" class="mock-select">
                ${renderTierOptions()}
              </select>
            </label>
            <label class="mock-field">
              <span>Type</span>
              <select id="mockTypeSelect" class="mock-select">
                ${renderTypeOptions()}
              </select>
            </label>
          </div>
          <p id="mockAvailableCount" class="mock-small-note"></p>
          <div id="mockAvailableGrid" class="mock-available-grid"></div>
        </section>
      </main>

      <aside class="mock-draft-right">
        <section class="mock-draft-panel">
          <span class="mock-panel-kicker">Team Rosters</span>
          <h2>Practice Rosters</h2>
          <div id="mockRosterList" class="mock-roster-list">${renderRosters()}</div>
        </section>
      </aside>
    </section>
  `;

  bindMockDraftControls();
  renderAvailablePokemonGrid();
  mockDraftStatus.textContent = nextPick
    ? `Round ${nextPick.roundNumber}, pick ${nextPick.pickInRound}.`
    : "Mock draft complete.";
}

function renderLockedState(title, message) {
  mockDraftContent.innerHTML = `
    <section class="mock-draft-panel mock-empty-state">
      <p class="mock-lock-title">${escapeHtml(title)}</p>
      <p class="mock-small-note">${escapeHtml(message)}</p>
      <div class="mock-draft-actions" style="justify-content:center;margin-top:16px;">
        <a class="mock-draft-link light" href="draft-room.html?v=draft-room-live1">Go To Draft Room</a>
        <a class="mock-draft-link" href="league-home.html?v=leaguehome-icons4">League Home</a>
      </div>
    </section>
  `;
  mockDraftStatus.textContent = title;
}

function bindMockDraftControls() {
  const input = document.getElementById("mockPokemonInput");
  const makePickButton = document.getElementById("mockMakePickButton");
  const autoPickButton = document.getElementById("mockAutoPickButton");
  const autoDraftAllButton = document.getElementById("mockAutoDraftAllButton");
  const undoPickButton = document.getElementById("mockUndoPickButton");
  const resetButton = document.getElementById("mockResetButton");
  const searchInput = document.getElementById("mockSearchInput");
  const tierSelect = document.getElementById("mockTierSelect");
  const typeSelect = document.getElementById("mockTypeSelect");

  if (selectedPokemonSlug && input) {
    const selected = getPokemonBySlug(selectedPokemonSlug);
    input.value = selected ? getPokemonLabel(selected) : "";
  }

  makePickButton?.addEventListener("click", makeMockPickFromInput);
  autoPickButton?.addEventListener("click", autoMockPick);
  autoDraftAllButton?.addEventListener("click", autoDraftAll);
  undoPickButton?.addEventListener("click", undoMockPick);
  resetButton?.addEventListener("click", resetMockDraft);

  input?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      makeMockPickFromInput();
    }
  });

  searchInput?.addEventListener("input", function () {
    saveFilter("search", this.value);
    renderAvailablePokemonGrid();
  });

  tierSelect?.addEventListener("change", function () {
    saveFilter("tier", this.value);
    renderAvailablePokemonGrid();
  });

  typeSelect?.addEventListener("change", function () {
    saveFilter("type", this.value);
    renderAvailablePokemonGrid();
  });
}

function makeMockPickFromInput() {
  const input = document.getElementById("mockPokemonInput");
  const pokemon = findPokemonFromInput(input?.value || "");

  if (!pokemon) {
    mockDraftStatus.textContent = "Choose an available Pokémon from the list.";
    return;
  }

  makeMockPick(pokemon);
}

function autoMockPick() {
  const nextPick = getNextPickInfo();

  if (!nextPick) {
    mockDraftStatus.textContent = "Mock draft is already complete.";
    return;
  }

  const pokemon = getSmartAutoPickPokemon(nextPick.team.id);

  if (!pokemon) {
    mockDraftStatus.textContent = `${nextPick.team.team_name} has no legal Pokémon under the point cap.`;
    return;
  }

  makeMockPick(pokemon);
}

function autoDraftAll() {
  let safety = 0;

  while (getNextPickInfo() && safety < 500) {
    const nextPick = getNextPickInfo();
    const pokemon = getSmartAutoPickPokemon(nextPick.team.id);

    if (!pokemon) {
      mockDraftStatus.textContent = `Auto draft stopped. ${nextPick.team.team_name} has no legal Pokémon under the point cap.`;
      break;
    }

    addMockPick(nextPick, pokemon);
    safety += 1;
  }

  saveMockPicks();
  renderMockDraft();
}

function makeMockPick(pokemon) {
  const nextPick = getNextPickInfo();

  if (!nextPick) {
    mockDraftStatus.textContent = "Mock draft is already complete.";
    return;
  }

  if (!getAvailablePokemon().some(candidate => candidate.slug === pokemon.slug)) {
    mockDraftStatus.textContent = `${pokemon.name} is no longer available.`;
    return;
  }

  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(nextPick.team.id);
  const points = getPokemonPoints(pokemon);
  const rosterRows = getRosterForTeam(nextPick.team.id);

  if (usedPoints + points > pointCap) {
    mockDraftStatus.textContent = `${pokemon.name} costs ${points}. ${nextPick.team.team_name} only has ${pointCap - usedPoints} points remaining.`;
    return;
  }

  if (rosterRows.length >= ROSTER_SIZE) {
    mockDraftStatus.textContent = `${nextPick.team.team_name} already has ${ROSTER_SIZE} Pokémon.`;
    return;
  }

  addMockPick(nextPick, pokemon);
  saveMockPicks();
  selectedPokemonSlug = "";
  renderMockDraft();
}

function addMockPick(nextPick, pokemon) {
  mockPicks.push({
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
  const removed = mockPicks.pop();
  saveMockPicks();
  renderMockDraft();

  const pokemon = removed ? getPokemonBySlug(removed.pokemon_slug) : null;
  mockDraftStatus.textContent = pokemon ? `Undid ${pokemon.name}.` : "No mock picks to undo.";
}

function resetMockDraft() {
  mockPicks = [];
  saveMockPicks();
  selectedPokemonSlug = "";
  renderMockDraft();
  mockDraftStatus.textContent = "Mock draft reset.";
}

function renderDraftBoard() {
  const orderedTeams = getOrderedTeams();
  const sequence = getDraftPickSequence();
  const maxRounds = sequence.reduce((max, pick) => Math.max(max, pick.roundNumber), 0);
  const nextPick = getNextPickInfo();

  if (!orderedTeams.length || !maxRounds) {
    return `<div class="mock-empty-state"><p class="mock-small-note">No draft board available yet.</p></div>`;
  }

  const picksByRoundTeam = new Map();
  const sequenceByRoundTeam = new Map();

  mockPicks.forEach(pick => {
    picksByRoundTeam.set(`${pick.round_number}:${pick.league_team_id}`, pick);
  });

  sequence.forEach(pick => {
    sequenceByRoundTeam.set(`${pick.roundNumber}:${pick.team.id}`, pick);
  });

  const teamColumnWidth = 128;
  const boardMinWidth = 70 + orderedTeams.length * teamColumnWidth;
  const columns = `70px repeat(${orderedTeams.length}, minmax(${teamColumnWidth}px, ${teamColumnWidth}px))`;
  const cells = [`<div class="mock-board-header" style="grid-column:1;grid-row:1;">Round</div>`];

  orderedTeams.forEach((team, index) => {
    cells.push(`
      <div class="mock-board-header" style="grid-column:${index + 2};grid-row:1;" title="${escapeHtml(team.team_name)}">
        ${escapeHtml(team.team_name)}
      </div>
    `);
  });

  for (let round = 1; round <= maxRounds; round++) {
    cells.push(`<div class="mock-board-round" style="grid-column:1;grid-row:${round + 1};">${round}</div>`);

    orderedTeams.forEach((team, index) => {
      const pick = picksByRoundTeam.get(`${round}:${team.id}`);
      const pendingPick = sequenceByRoundTeam.get(`${round}:${team.id}`);
      const isOnClock = nextPick && pendingPick && nextPick.overallPick === pendingPick.overallPick;
      const cellClass = pick ? "picked" : isOnClock ? "on-clock" : "";

      cells.push(`
        <div class="mock-board-cell ${cellClass}" style="grid-column:${index + 2};grid-row:${round + 1};">
          ${renderDraftBoardCell(pick, pendingPick)}
        </div>
      `);
    });
  }

  return `
    <div class="mock-draft-board-shell">
      <div class="mock-draft-board-grid" style="grid-template-columns:${columns};min-width:${boardMinWidth}px;">
        ${cells.join("")}
      </div>
    </div>
  `;
}

function renderDraftBoardCell(pick, pendingPick) {
  if (pick) {
    const pokemon = getPokemonBySlug(pick.pokemon_slug);

    return `
      <div class="mock-board-pick">
        ${pokemon?.image ? `<img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">` : `<span></span>`}
        <div>
          <div class="mock-board-name">${escapeHtml(pokemon ? pokemon.name : pick.pokemon_slug)}</div>
          <div class="mock-board-meta">#${pick.overall_pick} • ${pokemon ? `${escapeHtml(pokemon.tier)} • ${getPokemonPoints(pokemon)} pts` : "Mock pick"}</div>
        </div>
      </div>
    `;
  }

  if (pendingPick) {
    return `
      <div>
        <div class="mock-board-name">Pick #${pendingPick.overallPick}</div>
        <div class="mock-board-meta">Waiting</div>
      </div>
    `;
  }

  return `<div class="mock-board-meta">No pick</div>`;
}

function renderRosters() {
  const pointCap = Number(currentLeague?.roster_point_cap || 50);

  if (!leagueTeams.length) {
    return `<p class="mock-small-note">No teams loaded.</p>`;
  }

  return leagueTeams.map(team => {
    const rosterRows = getRosterForTeam(team.id);
    const pointUsage = getTeamPointUsage(team.id);

    return `
      <div class="mock-roster-team">
        <h3>${escapeHtml(team.team_name)}</h3>
        <div class="mock-roster-meta">${rosterRows.length}/${ROSTER_SIZE} Pokémon • ${pointUsage}/${pointCap} points</div>
        <div class="mock-point-bar"><div style="width:${Math.min((pointUsage / pointCap) * 100, 100)}%"></div></div>
        ${rosterRows.length ? rosterRows.map(row => renderRosterRow(row)).join("") : `<p class="mock-small-note">Empty</p>`}
      </div>
    `;
  }).join("");
}

function renderRosterRow(row) {
  const pokemon = getPokemonBySlug(row.pokemon_slug);
  const mascotLabel = row.is_mascot ? "Mascot • " : "";

  return `
    <div class="mock-roster-row">
      ${pokemon?.image ? `<img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">` : `<span></span>`}
      <div>
        <div class="mock-roster-name">${escapeHtml(pokemon ? `${mascotLabel}${pokemon.name}` : row.pokemon_slug)}</div>
        <div class="mock-roster-meta">${pokemon ? `${escapeHtml((pokemon.types || []).join(" / "))}` : "Unknown"}</div>
      </div>
      <strong>${pokemon ? getPokemonPoints(pokemon) : "?"}</strong>
    </div>
  `;
}

function renderAvailablePokemonGrid() {
  const grid = document.getElementById("mockAvailableGrid");
  const count = document.getElementById("mockAvailableCount");

  if (!grid) {
    return;
  }

  const availablePokemon = getFilteredAvailablePokemon().slice(0, 24);

  if (count) {
    const total = getFilteredAvailablePokemon().length;
    count.textContent = total
      ? `${total} available Pokémon match current filters. Showing ${availablePokemon.length}.`
      : "No available Pokémon match current filters.";
  }

  if (!availablePokemon.length) {
    grid.innerHTML = `<div class="mock-empty-state"><p class="mock-small-note">No available Pokémon found.</p></div>`;
    return;
  }

  grid.innerHTML = availablePokemon.map(pokemon => renderPokemonCard(pokemon)).join("");

  grid.querySelectorAll(".mock-pokemon-card").forEach(button => {
    button.addEventListener("click", function () {
      const pokemon = getPokemonBySlug(this.dataset.slug);

      if (!pokemon) {
        return;
      }

      selectedPokemonSlug = pokemon.slug;
      const input = document.getElementById("mockPokemonInput");

      if (input) {
        input.value = getPokemonLabel(pokemon);
      }

      renderAvailablePokemonGrid();
      mockDraftStatus.textContent = `${pokemon.name} selected for the next practice pick.`;
    });
  });
}

function renderPokemonCard(pokemon) {
  const selected = selectedPokemonSlug === pokemon.slug ? "selected" : "";
  const primaryType = getTypeSlug((pokemon.types || [])[0]);
  const secondaryType = getTypeSlug((pokemon.types || [])[1] || (pokemon.types || [])[0]);
  const primaryColor = TYPE_COLORS[primaryType] || TYPE_COLORS.normal;
  const secondaryColor = TYPE_COLORS[secondaryType] || primaryColor;
  const border = primaryType === secondaryType
    ? `linear-gradient(${primaryColor}, ${primaryColor})`
    : `linear-gradient(135deg, ${primaryColor}, ${primaryColor} 49%, ${secondaryColor} 51%, ${secondaryColor})`;

  return `
    <button
      class="mock-pokemon-card ${selected}"
      type="button"
      data-slug="${escapeHtml(pokemon.slug)}"
      style="border-color: transparent; background:
        linear-gradient(var(--mock-card-bg, rgba(31,34,40,0.96)), var(--mock-card-bg, rgba(31,34,40,0.96))) padding-box,
        ${border} border-box;">
      <img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">
      <div>
        <div class="mock-pokemon-name">${escapeHtml(getPokemonLabel(pokemon))}</div>
        <div class="mock-pokemon-meta">Rank ${pokemon.rank || "--"} • ${getPokemonPoints(pokemon)} pts</div>
      </div>
      <div>
        ${renderPokemonTierBadge(pokemon)}
        ${renderPokemonTypes(pokemon)}
      </div>
    </button>
  `;
}

function renderPokemonTierBadge(pokemon) {
  const tier = pokemon.tier || "Bronze";
  const points = pokemon.points || 1;
  const icon = pokemon.tier_icon || "images/tiers/BronzeButton.png";

  return `
    <span class="mock-tier-pill">
      <img src="${escapeHtml(icon)}" alt="">
      ${escapeHtml(tier)} ${points}
    </span>
  `;
}

function renderPokemonTypes(pokemon) {
  const types = pokemon.types || [];

  if (!types.length) {
    return "";
  }

  return `
    <span class="mock-type-strip">
      ${types.map(type => {
        const typeSlug = getTypeSlug(type);
        return `<span style="background:${TYPE_COLORS[typeSlug] || TYPE_COLORS.normal};">${escapeHtml(type)}</span>`;
      }).join("")}
    </span>
  `;
}

function renderPokemonOptions() {
  return getAvailablePokemon()
    .map(pokemon => `<option value="${escapeHtml(getPokemonLabel(pokemon))}"></option>`)
    .join("");
}

function renderTierOptions() {
  const selected = getSavedFilter("tier") || "all";

  return ["all", ...DRAFT_TIER_ORDER].map(tier => {
    const label = tier === "all" ? "All Tiers" : tier;
    return `<option value="${escapeHtml(tier)}" ${selected === tier ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function renderTypeOptions() {
  const selected = getSavedFilter("type") || "all";
  const types = Array.from(new Set(championsPokemon.flatMap(pokemon => pokemon.types || []))).sort();

  return [
    `<option value="all">All Types</option>`,
    ...types.map(type => `<option value="${escapeHtml(type)}" ${selected === type ? "selected" : ""}>${escapeHtml(type)}</option>`)
  ].join("");
}

function getFilteredAvailablePokemon() {
  const searchTerm = (document.getElementById("mockSearchInput")?.value || getSavedFilter("search") || "").trim().toLowerCase();
  const tierFilter = document.getElementById("mockTierSelect")?.value || getSavedFilter("tier") || "all";
  const typeFilter = document.getElementById("mockTypeSelect")?.value || getSavedFilter("type") || "all";

  return sortPokemonForDraft(getAvailablePokemon().filter(pokemon => {
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

function getNextPickInfo() {
  const sequence = getDraftPickSequence();

  if (mockPicks.length >= sequence.length) {
    return null;
  }

  return sequence[mockPicks.length] || null;
}

function getDraftPickSequence() {
  const orderedTeams = getOrderedTeams();
  const sequence = [];
  const capacities = new Map();
  let maxRounds = 0;

  orderedTeams.forEach(team => {
    const capacity = Math.max(ROSTER_SIZE - getBaseRosterForTeam(team.id).length, 0);
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

function getBaseRosterForTeam(teamId) {
  return baseRosterRows
    .filter(row => row.team_id === teamId)
    .sort((a, b) => Number(a.slot_number || 0) - Number(b.slot_number || 0));
}

function getRosterForTeam(teamId) {
  const baseRows = getBaseRosterForTeam(teamId);
  const mockRows = mockPicks
    .filter(pick => pick.league_team_id === teamId)
    .map((pick, index) => ({
      team_id: teamId,
      pokemon_slug: pick.pokemon_slug,
      slot_number: baseRows.length + index + 1,
      is_mock: true
    }));

  return [...baseRows, ...mockRows];
}

function getTeamPointUsage(teamId) {
  return getRosterForTeam(teamId).reduce((total, row) => {
    return total + getPokemonPoints(getPokemonBySlug(row.pokemon_slug));
  }, 0);
}

function getDraftedSlugSet() {
  return new Set([
    ...baseRosterRows.map(row => row.pokemon_slug),
    ...mockPicks.map(pick => pick.pokemon_slug)
  ]);
}

function getAvailablePokemon() {
  const draftedSlugs = getDraftedSlugSet();
  return championsPokemon.filter(pokemon => !draftedSlugs.has(pokemon.slug));
}

function getSmartAutoPickPokemon(teamId) {
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(teamId);
  const remainingPoints = pointCap - usedPoints;
  const rosterRows = getRosterForTeam(teamId);
  const openSlots = Math.max(ROSTER_SIZE - rosterRows.length, 0);

  const legalPokemon = getAvailablePokemon()
    .map(pokemon => {
      const points = getPokemonPoints(pokemon);
      const pointsLeftAfterPick = remainingPoints - points;
      const minimumPointsNeededAfterPick = Math.max(openSlots - 1, 0);

      return {
        pokemon,
        points,
        rank: Number(pokemon.rank || 9999),
        keepsRosterPossible: points <= remainingPoints && pointsLeftAfterPick >= minimumPointsNeededAfterPick
      };
    })
    .filter(candidate => candidate.keepsRosterPossible);

  if (!legalPokemon.length) {
    return null;
  }

  return legalPokemon.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.pokemon.name.localeCompare(b.pokemon.name);
  })[0].pokemon;
}

function findPokemonFromInput(inputValue) {
  const cleaned = String(inputValue || "").trim().toLowerCase();

  if (!cleaned) {
    return null;
  }

  return getAvailablePokemon().find(pokemon =>
    pokemon.name.toLowerCase() === cleaned ||
    pokemon.slug.toLowerCase() === cleaned ||
    getPokemonLabel(pokemon).toLowerCase() === cleaned
  ) || getAvailablePokemon().find(pokemon =>
    pokemon.name.toLowerCase().includes(cleaned) ||
    getPokemonLabel(pokemon).toLowerCase().includes(cleaned)
  );
}

function sortPokemonForDraft(pokemonList) {
  return pokemonList.slice().sort((a, b) => {
    const tierDiff = getDraftTierSortValue(a.tier) - getDraftTierSortValue(b.tier);
    if (tierDiff !== 0) return tierDiff;

    const pointDiff = getPokemonPoints(b) - getPokemonPoints(a);
    if (pointDiff !== 0) return pointDiff;

    const rankDiff = Number(a.rank || 9999) - Number(b.rank || 9999);
    if (rankDiff !== 0) return rankDiff;

    return a.name.localeCompare(b.name);
  });
}

function getDraftTierSortValue(tier) {
  const tierIndex = DRAFT_TIER_ORDER.indexOf(tier);
  return tierIndex === -1 ? DRAFT_TIER_ORDER.length : tierIndex;
}

function getPokemonBySlug(slug) {
  return championsPokemon.find(pokemon => pokemon.slug === slug);
}

function getPokemonPoints(pokemon) {
  return Number(pokemon?.points || 1);
}

function getPokemonLabel(pokemon) {
  if (!pokemon) {
    return "";
  }

  const sameNameCount = championsPokemon.filter(candidate => candidate.name.toLowerCase() === pokemon.name.toLowerCase()).length;
  return sameNameCount > 1 ? `${pokemon.name} (${(pokemon.types || []).join("/")})` : pokemon.name;
}

function getTypeSlug(type) {
  return String(type || "normal").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "normal";
}

function getMockStorageKey() {
  const cleanLeagueId = String(selectedLeagueId || "league").replace(/[^a-zA-Z0-9_-]/g, "");
  return `pokeleague_mock_draft_${cleanLeagueId}`;
}

function getFilterStorageKey(name) {
  const cleanLeagueId = String(selectedLeagueId || "league").replace(/[^a-zA-Z0-9_-]/g, "");
  return `pokeleague_mock_draft_filter_${cleanLeagueId}_${name}`;
}

function loadMockPicks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getMockStorageKey()) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveMockPicks() {
  localStorage.setItem(getMockStorageKey(), JSON.stringify(mockPicks));
}

function sanitizeMockPicks() {
  const teamIds = new Set(leagueTeams.map(team => team.id));
  const pokemonSlugs = new Set(championsPokemon.map(pokemon => pokemon.slug));
  const seenSlugs = new Set(baseRosterRows.map(row => row.pokemon_slug));
  const sequence = getDraftPickSequence();

  mockPicks = mockPicks
    .filter((pick, index) => {
      const sequencePick = sequence[index];

      if (!sequencePick || !teamIds.has(pick.league_team_id) || !pokemonSlugs.has(pick.pokemon_slug) || seenSlugs.has(pick.pokemon_slug)) {
        return false;
      }

      seenSlugs.add(pick.pokemon_slug);
      pick.league_team_id = sequencePick.team.id;
      pick.overall_pick = sequencePick.overallPick;
      pick.round_number = sequencePick.roundNumber;
      pick.pick_in_round = sequencePick.pickInRound;
      return true;
    });

  saveMockPicks();
}

function saveFilter(name, value) {
  localStorage.setItem(getFilterStorageKey(name), value || "");
}

function getSavedFilter(name) {
  return localStorage.getItem(getFilterStorageKey(name)) || (name === "tier" || name === "type" ? "all" : "");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
