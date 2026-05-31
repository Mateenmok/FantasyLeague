const waiverSubtitle = document.getElementById("waiverSubtitle");
const waiverAdminPanel = document.getElementById("waiverAdminPanel");
const waiverAdminText = document.getElementById("waiverAdminText");
const openWaiversButton = document.getElementById("openWaiversButton");
const closeWaiversButton = document.getElementById("closeWaiversButton");
const waiverStatusText = document.getElementById("waiverStatusText");
const waiverHeaderStatus = document.getElementById("waiverHeaderStatus");
const waiverHeaderTeamSummary = document.getElementById("waiverHeaderTeamSummary");
const waiverClosedMessage = document.getElementById("waiverClosedMessage");
const waiverContent = document.getElementById("waiverContent");
const waiverPointStatus = document.getElementById("waiverPointStatus");
const waiverRosterList = document.getElementById("waiverRosterList");
const waiverAvailableGrid = document.getElementById("waiverAvailableGrid");
const waiverAvailableCount = document.getElementById("waiverAvailableCount");
const waiverPageStatus = document.getElementById("waiverPageStatus");

const waiverPokemonSearch = document.getElementById("waiverPokemonSearch");
const waiverMegaFilterSelect = document.getElementById("waiverMegaFilterSelect");
const waiverTierFilterSelect = document.getElementById("waiverTierFilterSelect");
const waiverTypeFilterSelect = document.getElementById("waiverTypeFilterSelect");

const selectedLeagueId = localStorage.getItem("selected-league-id");
const DEFAULT_ROSTER_SIZE = 10;
const WAIVER_STAT_ROWS = [
  ["hp", "HP"],
  ["attack", "ATK"],
  ["defense", "DEF"],
  ["sp_atk", "SpA"],
  ["sp_def", "SpD"],
  ["speed", "Spe"]
];

let currentLeague = null;
let currentMembership = null;
let myTeam = null;
let leagueTeams = [];
let allRosterRows = [];
let myRosterRows = [];
let championsPokemon = [];
let pokemonBstBySlug = {};
let isAdmin = false;
const WAIVER_AVAILABLE_POKEMON_PAGE_SIZE = 12;
let waiverAvailablePokemonPage = 0;
let waiverAvailablePokemonFilterSignature = "";

function getRosterSize() {
  const configuredSize = Number(currentLeague?.roster_pokemon_cap || DEFAULT_ROSTER_SIZE);
  return Number.isFinite(configuredSize) && configuredSize >= 1
    ? configuredSize
    : DEFAULT_ROSTER_SIZE;
}

openWaiversButton.addEventListener("click", () => setWaiversOpen(true));
closeWaiversButton.addEventListener("click", () => setWaiversOpen(false));

waiverPokemonSearch.addEventListener("input", renderAvailablePokemonGrid);
waiverMegaFilterSelect.addEventListener("change", renderAvailablePokemonGrid);
waiverTierFilterSelect.addEventListener("change", renderAvailablePokemonGrid);
waiverTypeFilterSelect.addEventListener("change", renderAvailablePokemonGrid);

loadWaiverPage();

async function loadWaiverPage() {
  if (!selectedLeagueId) {
    waiverSubtitle.textContent = "No league selected.";
    waiverPageStatus.textContent = "Go to My Leagues and select a league first.";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    waiverSubtitle.textContent = "Not signed in.";
    waiverPageStatus.textContent = "Sign in before viewing waivers.";
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
    waiverSubtitle.textContent = "No access.";
    waiverPageStatus.textContent = "You are not a member of this league.";
    return;
  }

  currentMembership = membership;
  isAdmin = membership.role === "admin";

  try {
    championsPokemon = await fetch("data/champions-pokemon.json?v=garchomp9").then(response => response.json());
  } catch (error) {
    console.error("Pokémon data load error:", error);
    waiverPageStatus.textContent = "Could not load Pokémon data.";
    return;
  }

  try {
    pokemonBstBySlug = await fetch("data/pokemon-bst.json?v=waiver-modern1").then(response => response.json());
  } catch (error) {
    console.warn("Pokémon BST data unavailable:", error);
    pokemonBstBySlug = {};
  }

  renderTypeFilterOptions();
  await refreshWaiverData();
}

async function refreshWaiverData() {
  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    waiverSubtitle.textContent = "Could not load league.";
    waiverPageStatus.textContent = "Try selecting the league again.";
    return;
  }

  currentLeague = league;
  waiverSubtitle.textContent = league.name;

  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
    waiverPageStatus.textContent = "Could not load league teams.";
    return;
  }

  leagueTeams = teams || [];
  myTeam = currentMembership.league_team_id
    ? leagueTeams.find(team => team.id === currentMembership.league_team_id)
    : null;

  const { data: rosterRows, error: rosterError } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("slot_number", { ascending: true });

  if (rosterError) {
    console.error("Roster error:", rosterError);
    waiverPageStatus.textContent = "Could not load rosters.";
    return;
  }

  allRosterRows = rosterRows || [];
  myRosterRows = myTeam
    ? allRosterRows.filter(row => row.team_id === myTeam.id).sort((a, b) => a.slot_number - b.slot_number)
    : [];

  renderWaiverPage();
}

function renderWaiverPage() {
  const waiversOpen = Boolean(currentLeague.waiver_open);

  waiverStatusText.textContent = waiversOpen
    ? "Waivers are currently open."
    : "Waiver period is currently closed. Ask a league administrator to open.";

  if (waiverHeaderStatus) {
    waiverHeaderStatus.textContent = waiversOpen ? "Open" : "Closed";
  }

  renderWaiverHeaderTeamSummary();

  if (isAdmin) {
    waiverAdminPanel.classList.remove("hidden");
    waiverAdminText.textContent = waiversOpen
      ? "Waivers are open. You can close them at any time."
      : "Waivers are closed. Open them when managers are allowed to make changes.";

    openWaiversButton.disabled = waiversOpen;
    closeWaiversButton.disabled = !waiversOpen;
  } else {
    waiverAdminPanel.classList.add("hidden");
  }

  if (!waiversOpen) {
    waiverClosedMessage.classList.remove("hidden");
    waiverContent.classList.add("hidden");
    waiverPageStatus.textContent = "Waivers closed.";
    return;
  }

  waiverClosedMessage.classList.add("hidden");
  waiverContent.classList.remove("hidden");

  if (!myTeam) {
    waiverContent.innerHTML = `
      <div class="pkmn-panel">
        <p><strong>No team assigned.</strong></p>
        <p class="small-note">Ask a league administrator to assign your account to a team.</p>
      </div>
    `;
    waiverPageStatus.textContent = "No team assigned.";
    return;
  }

  renderPointStatus();
  renderRosterList();
  renderAvailablePokemonGrid();

  waiverPageStatus.textContent = "Waivers open.";
}

async function setWaiversOpen(open) {
  if (!isAdmin) {
    waiverPageStatus.textContent = "Only admins can change waiver status.";
    return;
  }

  openWaiversButton.disabled = true;
  closeWaiversButton.disabled = true;

  const { error } = await supabaseClient
    .from("leagues")
    .update({ waiver_open: open })
    .eq("id", selectedLeagueId);

  if (error) {
    console.error("Waiver status update error:", error);
    waiverPageStatus.textContent = "Could not update waiver status.";
    openWaiversButton.disabled = false;
    closeWaiversButton.disabled = false;
    return;
  }

  waiverPageStatus.textContent = open ? "Waivers opened." : "Waivers closed.";
  await refreshWaiverData();
}

async function logLeagueActivityEvent({ eventType, pokemonName, pokemonSlug, title, description }) {
  if (!selectedLeagueId || !myTeam) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("league_activity_events")
      .insert({
        league_id: selectedLeagueId,
        team_id: myTeam.id,
        team_name: myTeam.team_name,
        event_type: eventType,
        pokemon_name: pokemonName || null,
        pokemon_slug: pokemonSlug || null,
        title,
        description
      });

    if (error) {
      console.warn("League activity log skipped:", error);
    }
  } catch (error) {
    console.warn("League activity log failed:", error);
  }
}

function renderPointStatus() {
  const pointCap = Number(currentLeague.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(myTeam.id);
  const remaining = pointCap - usedPoints;
  const rosterSize = getRosterSize();

  waiverPointStatus.innerHTML = `
    <div class="draft-point-grid">
      <div class="draft-point-card">
        <p><strong>My Team Points</strong></p>
        <p>${escapeHtml(myTeam.team_name)}: ${usedPoints}/${pointCap}</p>
        <p class="small-note">Remaining: ${remaining}</p>
        <div class="draft-point-bar">
          <div style="width:${Math.min((usedPoints / pointCap) * 100, 100)}%"></div>
        </div>
      </div>

      <div class="draft-point-card">
        <p><strong>Roster Spots</strong></p>
        <p>${myRosterRows.length}/${rosterSize} Pokémon</p>
        <p class="small-note">Drop a Pokémon if your roster is full or your cap is too tight.</p>
      </div>
    </div>
  `;
}

function renderWaiverHeaderTeamSummary() {
  if (!waiverHeaderTeamSummary) {
    return;
  }

  if (!myTeam) {
    waiverHeaderTeamSummary.innerHTML = `
      <p class="waiver-kicker">Your Team</p>
      <strong>No team assigned</strong>
      <p class="small-note">Ask an admin to assign your account.</p>
    `;
    return;
  }

  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(myTeam.id);
  const rosterSize = getRosterSize();

  waiverHeaderTeamSummary.innerHTML = `
    <p class="waiver-kicker">Your Team</p>
    <strong>${escapeHtml(myTeam.team_name)}</strong>
    <p class="small-note">${myRosterRows.length}/${rosterSize} roster - ${usedPoints}/${pointCap} points</p>
  `;
}

function renderRosterList() {
  if (!myRosterRows.length) {
    waiverRosterList.innerHTML = `<div class="empty-state"><p>Your roster is empty.</p></div>`;
    return;
  }

  waiverRosterList.innerHTML = myRosterRows.map(row => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);
    const name = pokemon ? pokemon.name : row.pokemon_slug;
    const points = pokemon ? getPokemonPoints(pokemon) : 1;
    const primaryType = getPokemonPrimaryType(pokemon);
    const secondaryType = getPokemonSecondaryType(pokemon);

    return `
      <div class="waiver-roster-row waiver-roster-row-with-drop draft-type-card draft-primary-${primaryType} draft-secondary-${secondaryType}">
        ${pokemon ? `<img class="waiver-roster-sprite" src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(name)}">` : `<span class="waiver-roster-sprite missing"></span>`}
        <span class="waiver-roster-copy">
          <span class="waiver-roster-name">${escapeHtml(name)}</span>
          <span class="waiver-roster-meta">${pokemon ? escapeHtml((pokemon.types || []).join(" / ")) : "Unknown"}</span>
        </span>
        <span class="waiver-roster-points">${points} pts</span>
        <button class="waiver-roster-drop-button" type="button" data-roster-id="${escapeHtml(row.id)}" data-pokemon-name="${escapeHtml(name)}">Drop</button>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".waiver-roster-drop-button").forEach(button => {
    button.addEventListener("click", function () {
      dropWaiverRosterPokemon(this.dataset.rosterId, this.dataset.pokemonName);
    });
  });
}

async function dropWaiverRosterPokemon(rosterId, pokemonName) {
  if (!rosterId || !myTeam) {
    waiverPageStatus.textContent = "Could not identify that roster slot.";
    return;
  }

  if (!window.confirm(`Drop ${pokemonName || "this Pokémon"} from your roster?`)) {
    waiverPageStatus.textContent = "Drop cancelled.";
    return;
  }

  waiverPageStatus.textContent = `Dropping ${pokemonName || "Pokémon"}...`;

  const { error } = await supabaseClient
    .from("team_rosters")
    .delete()
    .eq("id", rosterId)
    .eq("league_id", selectedLeagueId)
    .eq("team_id", myTeam.id);

  if (error) {
    console.error("Waiver direct drop error:", error);
    waiverPageStatus.textContent = "Could not drop Pokémon. Check console.";
    return;
  }

  await logLeagueActivityEvent({
    eventType: "drop",
    pokemonName: pokemonName || "Pokémon",
    pokemonSlug: "",
    title: `${myTeam.team_name} dropped ${pokemonName || "a Pokémon"}`,
    description: `${myTeam.team_name} dropped ${pokemonName || "a Pokémon"} from its roster.`
  });

  waiverPageStatus.textContent = `Dropped ${pokemonName || "Pokémon"}.`;
  await refreshWaiverData();
}


function getWaiverAvailablePokemonFilterSignature() {
  return [
    waiverPokemonSearch ? waiverPokemonSearch.value.trim().toLowerCase() : "",
    waiverMegaFilterSelect ? waiverMegaFilterSelect.value : "all",
    waiverTierFilterSelect ? waiverTierFilterSelect.value : "all",
    waiverTypeFilterSelect ? waiverTypeFilterSelect.value : "all"
  ].join("|");
}

function getWaiverAvailablePokemonPaginationElement() {
  if (!waiverAvailableGrid) {
    return null;
  }

  let paginationEl = document.getElementById("waiverAvailablePokemonPagination");

  if (!paginationEl) {
    paginationEl = document.createElement("div");
    paginationEl.id = "waiverAvailablePokemonPagination";
    paginationEl.style.cssText = "display:flex;align-items:center;justify-content:center;gap:12px;margin:16px 0 0;flex-wrap:wrap;";
    waiverAvailableGrid.insertAdjacentElement("afterend", paginationEl);
  }

  return paginationEl;
}

function renderWaiverAvailablePokemonPagination(totalCount) {
  const paginationEl = getWaiverAvailablePokemonPaginationElement();

  if (!paginationEl) {
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / WAIVER_AVAILABLE_POKEMON_PAGE_SIZE));

  if (totalCount <= WAIVER_AVAILABLE_POKEMON_PAGE_SIZE) {
    paginationEl.innerHTML = "";
    return;
  }

  paginationEl.innerHTML = `
    <button id="waiverAvailablePokemonPrevPage" class="pkmn-button" type="button" ${waiverAvailablePokemonPage <= 0 ? "disabled" : ""}>Previous Page</button>
    <span class="small-note">Page ${waiverAvailablePokemonPage + 1} of ${totalPages}</span>
    <button id="waiverAvailablePokemonNextPage" class="pkmn-button" type="button" ${waiverAvailablePokemonPage >= totalPages - 1 ? "disabled" : ""}>Next Page</button>
  `;

  const prevButton = document.getElementById("waiverAvailablePokemonPrevPage");
  const nextButton = document.getElementById("waiverAvailablePokemonNextPage");

  if (prevButton) {
    prevButton.addEventListener("click", function () {
      waiverAvailablePokemonPage = Math.max(0, waiverAvailablePokemonPage - 1);
      renderAvailablePokemonGrid();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      waiverAvailablePokemonPage = Math.min(totalPages - 1, waiverAvailablePokemonPage + 1);
      renderAvailablePokemonGrid();
    });
  }
}

function renderAvailablePokemonGrid() {
  let availablePokemon = getFilteredAvailablePokemon();

  const activeFilterSignature = getWaiverAvailablePokemonFilterSignature();

  if (activeFilterSignature !== waiverAvailablePokemonFilterSignature) {
    waiverAvailablePokemonFilterSignature = activeFilterSignature;
    waiverAvailablePokemonPage = 0;
  }

  const totalFilteredCount = availablePokemon.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / WAIVER_AVAILABLE_POKEMON_PAGE_SIZE));

  if (waiverAvailablePokemonPage >= totalPages) {
    waiverAvailablePokemonPage = totalPages - 1;
  }

  const startIndex = waiverAvailablePokemonPage * WAIVER_AVAILABLE_POKEMON_PAGE_SIZE;
  const endIndex = startIndex + WAIVER_AVAILABLE_POKEMON_PAGE_SIZE;

  if (totalFilteredCount === 0) {
    waiverAvailableCount.textContent = "0 available Pokémon match current filters.";
  } else {
    waiverAvailableCount.textContent = `${totalFilteredCount} available Pokémon match current filters. Showing ${startIndex + 1}-${Math.min(endIndex, totalFilteredCount)}.`;
  }

  availablePokemon = availablePokemon.slice(startIndex, endIndex);
  renderWaiverAvailablePokemonPagination(totalFilteredCount);

  if (!availablePokemon.length) {
    waiverAvailableGrid.innerHTML = `<div class="empty-state"><p>No available Pokémon found.</p></div>`;
    return;
  }

  waiverAvailableGrid.innerHTML = availablePokemon.map(pokemon => {
    const primaryType = getPokemonPrimaryType(pokemon);
    const secondaryType = getPokemonSecondaryType(pokemon);

    return `
      <article class="draft-pokemon-card waiver-pokemon-card draft-type-card draft-primary-${primaryType} draft-secondary-${secondaryType}" data-slug="${pokemon.slug}" data-primary-type="${primaryType}" data-secondary-type="${secondaryType}">
        ${renderPokemonTypeIconBadge(pokemon)}
        <img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">
        ${renderMegaBadge(pokemon)}
        <span>${escapeHtml(getPokemonLabel(pokemon))}</span>
        ${renderPokemonTierBadge(pokemon)}
        ${renderPokemonTypeBadges(pokemon)}
        ${renderPokemonStatBars(pokemon)}

        <div class="waiver-card-actions">
          <div class="waiver-drop-row">
            <select class="pkmn-select waiver-drop-select" id="dropSelect-${pokemon.slug}">
              <option value="">Drop nobody</option>
              ${myRosterRows.map(row => {
                const rosterPokemon = getPokemonBySlug(row.pokemon_slug);
                return `<option value="${escapeHtml(row.id)}">${escapeHtml(rosterPokemon ? rosterPokemon.name : row.pokemon_slug)}</option>`;
              }).join("")}
            </select>
          </div>

          <button class="pkmn-button small waiver-add-button" data-slug="${pokemon.slug}">
            Add
          </button>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".waiver-add-button").forEach(button => {
    button.addEventListener("click", function () {
      addWaiverPokemon(this.dataset.slug);
    });
  });
}

async function addWaiverPokemon(pokemonSlug) {
  if (!currentLeague.waiver_open) {
    waiverPageStatus.textContent = "Waiver period is currently closed. Ask a league administrator to open.";
    return;
  }

  if (!myTeam) {
    waiverPageStatus.textContent = "No team assigned.";
    return;
  }

  const pokemon = getPokemonBySlug(pokemonSlug);

  if (!pokemon) {
    waiverPageStatus.textContent = "Could not find that Pokémon.";
    return;
  }

  const dropSelect = document.getElementById(`dropSelect-${pokemonSlug}`);
  const dropRosterId = dropSelect ? dropSelect.value : "";
  const dropRow = dropRosterId ? myRosterRows.find(row => String(row.id) === String(dropRosterId)) : null;
  const dropPokemon = dropRow ? getPokemonBySlug(dropRow.pokemon_slug) : null;

  const pointCap = Number(currentLeague.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(myTeam.id);
  const addPoints = getPokemonPoints(pokemon);
  const dropPoints = dropPokemon ? getPokemonPoints(dropPokemon) : 0;
  const projectedPoints = usedPoints - dropPoints + addPoints;

  const projectedRosterSize = myRosterRows.length - (dropRow ? 1 : 0) + 1;

  if (projectedRosterSize > getRosterSize()) {
    waiverPageStatus.textContent = "Your roster is full. Select a Pokémon to drop first.";
    return;
  }

  if (projectedPoints > pointCap) {
    waiverPageStatus.textContent =
      `${pokemon.name} costs ${addPoints}. You would be at ${projectedPoints}/${pointCap}. Select a drop or choose a cheaper Pokémon.`;
    return;
  }

  const confirmed = window.confirm(
    dropPokemon
      ? `Add ${pokemon.name} and drop ${dropPokemon.name}?`
      : `Add ${pokemon.name}?`
  );

  if (!confirmed) {
    waiverPageStatus.textContent = "Waiver move cancelled.";
    return;
  }

  waiverPageStatus.textContent = "Processing waiver move...";

  if (dropRow) {
    const { error: deleteError } = await supabaseClient
      .from("team_rosters")
      .delete()
      .eq("id", dropRow.id)
      .eq("team_id", myTeam.id)
      .eq("league_id", selectedLeagueId);

    if (deleteError) {
      console.error("Drop Pokémon error:", deleteError);
      waiverPageStatus.textContent = "Could not drop Pokémon. Check console.";
      return;
    }
  }

  const nextSlot = getNextRosterSlot();

  const { error: addError } = await supabaseClient
    .from("team_rosters")
    .insert({
      league_id: selectedLeagueId,
      team_id: myTeam.id,
      pokemon_slug: pokemon.slug,
      slot_number: nextSlot
    });

  if (addError) {
    console.error("Add Pokémon error:", addError);
    waiverPageStatus.textContent = "Could not add Pokémon. It may already be rostered.";
    return;
  }

  await logLeagueActivityEvent({
    eventType: dropPokemon ? "add_drop" : "add",
    pokemonName: pokemon.name,
    pokemonSlug: pokemon.slug,
    title: dropPokemon
      ? `${myTeam.team_name} added ${pokemon.name} and dropped ${dropPokemon.name}`
      : `${myTeam.team_name} added ${pokemon.name}`,
    description: dropPokemon
      ? `${myTeam.team_name} added ${pokemon.name} and dropped ${dropPokemon.name}.`
      : `${myTeam.team_name} added ${pokemon.name} to its roster.`
  });

  waiverPageStatus.textContent = dropPokemon
    ? `Added ${pokemon.name} and dropped ${dropPokemon.name}.`
    : `Added ${pokemon.name}.`;

  await refreshWaiverData();
}

function getNextRosterSlot() {
  if (!myRosterRows.length) {
    return 1;
  }

  return Math.max(...myRosterRows.map(row => Number(row.slot_number || 0))) + 1;
}

function getAvailablePokemon() {
  const rosteredSlugs = new Set(allRosterRows.map(row => row.pokemon_slug));
  return championsPokemon.filter(pokemon => !rosteredSlugs.has(pokemon.slug));
}

function getFilteredAvailablePokemon() {
  const searchTerm = waiverPokemonSearch.value.trim().toLowerCase();
  const megaFilter = waiverMegaFilterSelect.value;
  const tierFilter = waiverTierFilterSelect.value;
  const typeFilter = waiverTypeFilterSelect.value;

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
    availablePokemon = availablePokemon.filter(pokemon => (pokemon.types || []).includes(typeFilter));
  }

  return availablePokemon;
}

function renderTypeFilterOptions() {
  const selectedType = waiverTypeFilterSelect.value || "all";
  const typeSet = new Set();

  championsPokemon.forEach(pokemon => {
    (pokemon.types || []).forEach(type => typeSet.add(type));
  });

  const sortedTypes = Array.from(typeSet).sort();

  waiverTypeFilterSelect.innerHTML = `
    <option value="all">All Types</option>
    ${sortedTypes.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}
  `;

  waiverTypeFilterSelect.value = sortedTypes.includes(selectedType) ? selectedType : "all";
}

function getTeamPointUsage(teamId) {
  return allRosterRows
    .filter(row => row.team_id === teamId)
    .reduce((total, row) => {
      const pokemon = getPokemonBySlug(row.pokemon_slug);
      return total + getPokemonPoints(pokemon);
    }, 0);
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

function getPokemonBySlug(slug) {
  return championsPokemon.find(pokemon => pokemon.slug === slug);
}

function getPokemonLabel(pokemon) {
  const sameNameCount = championsPokemon.filter(p => p.name.toLowerCase() === pokemon.name.toLowerCase()).length;

  if (sameNameCount > 1) {
    return `${pokemon.name} (${(pokemon.types || []).join("/")})`;
  }

  return pokemon.name;
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

function renderPokemonStatBars(pokemon) {
  const stats = getPokemonStatData(pokemon)?.stats;

  if (!stats) {
    return "";
  }

  return `
    <div class="draft-card-stat-bars">
      ${WAIVER_STAT_ROWS.map(([key, label]) => {
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

function renderMegaBadge(pokemon) {
  if (!pokemon || pokemon.can_mega_evolve !== true) {
    return "";
  }

  return `<img class="mega-badge-overlay" src="images/MegaEvolution.png" alt="Mega Evolution">`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
