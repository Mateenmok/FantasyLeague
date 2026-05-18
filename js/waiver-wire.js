const waiverSubtitle = document.getElementById("waiverSubtitle");
const waiverAdminPanel = document.getElementById("waiverAdminPanel");
const waiverAdminText = document.getElementById("waiverAdminText");
const openWaiversButton = document.getElementById("openWaiversButton");
const closeWaiversButton = document.getElementById("closeWaiversButton");
const waiverStatusText = document.getElementById("waiverStatusText");
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
const ROSTER_SIZE = 10;

let currentLeague = null;
let currentMembership = null;
let myTeam = null;
let leagueTeams = [];
let allRosterRows = [];
let myRosterRows = [];
let championsPokemon = [];
let isAdmin = false;

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
    championsPokemon = await fetch("data/champions-pokemon.json?v=waivers1").then(response => response.json());
  } catch (error) {
    console.error("Pokémon data load error:", error);
    waiverPageStatus.textContent = "Could not load Pokémon data.";
    return;
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

function renderPointStatus() {
  const pointCap = Number(currentLeague.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(myTeam.id);
  const remaining = pointCap - usedPoints;

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
        <p>${myRosterRows.length}/${ROSTER_SIZE} Pokémon</p>
        <p class="small-note">Drop a Pokémon if your roster is full or your cap is too tight.</p>
      </div>
    </div>
  `;
}

function renderRosterList() {
  if (!myRosterRows.length) {
    waiverRosterList.innerHTML = `<div class="empty-state"><p>Your roster is empty.</p></div>`;
    return;
  }

  waiverRosterList.innerHTML = myRosterRows.map(row => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);
    const points = pokemon ? getPokemonPoints(pokemon) : 1;

    return `
      <div class="waiver-roster-row">
        <span>${escapeHtml(pokemon ? pokemon.name : row.pokemon_slug)}</span>
        <span>${points} pts</span>
      </div>
    `;
  }).join("");
}

function renderAvailablePokemonGrid() {
  let availablePokemon = getFilteredAvailablePokemon();
  const totalFilteredCount = availablePokemon.length;

  waiverAvailableCount.textContent = `${totalFilteredCount} available Pokémon match current filters. Showing up to 60.`;

  availablePokemon = availablePokemon.slice(0, 60);

  if (!availablePokemon.length) {
    waiverAvailableGrid.innerHTML = `<div class="empty-state"><p>No available Pokémon found.</p></div>`;
    return;
  }

  waiverAvailableGrid.innerHTML = availablePokemon.map(pokemon => {
    return `
      <article class="draft-pokemon-card waiver-pokemon-card" data-slug="${pokemon.slug}">
        <img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">
        ${renderMegaBadge(pokemon)}
        <span>${escapeHtml(getPokemonLabel(pokemon))}</span>
        ${renderPokemonTierBadge(pokemon)}
        ${renderPokemonTypeBadges(pokemon)}

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

  if (projectedRosterSize > ROSTER_SIZE) {
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
    availablePokemon = availablePokemon.filter(pokemon => pokemon.mega_eligible);
  }

  if (megaFilter === "non-mega") {
    availablePokemon = availablePokemon.filter(pokemon => !pokemon.mega_eligible);
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
  return `type-${String(type || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
  if (!pokemon || !pokemon.mega_eligible) {
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
