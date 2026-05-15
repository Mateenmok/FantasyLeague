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
const draftRoomStatus = document.getElementById("draftRoomStatus");
const draftPointStatus = document.getElementById("draftPointStatus");
const draftControls = document.getElementById("draftControls");
const draftSetupSection = document.getElementById("draftSetupSection");
const draftOrderList = document.getElementById("draftOrderList");

const ROSTER_SIZE = 10;
function getPickSeconds() {
  return Number(currentLeague?.draft_pick_seconds || 120);
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
    championsPokemon = await fetch("data/champions-pokemon.json?v=tiers2").then(response => response.json());
  } catch (error) {
    console.error("Champions Pokémon load error:", error);
    draftRoomStatus.textContent = "Could not load Pokémon data.";
    disableDraftControls();
    return;
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

  renderDraftRoom(isBackgroundRefresh);
}

function renderDraftRoom(isBackgroundRefresh = false) {
  const totalPicks = leagueTeams.length * ROSTER_SIZE;
  const picksMade = draftPicks.length;
  const availableCount = getAvailablePokemon().length;
  const nextPick = getNextPickInfo();

  draftStatusLine.textContent =
    `${picksMade}/${totalPicks} picks made • ${availableCount} Pokémon available • ${ROSTER_SIZE} roster spots per team`;

  if (nextPick) {
    nextPickLine.textContent =
      `Next Pick: #${nextPick.overallPick} • Round ${nextPick.roundNumber}, Pick ${nextPick.pickInRound} • ${nextPick.team.team_name}`;
  } else {
    nextPickLine.textContent = "Draft complete.";
  }

  renderDraftOrderControls();
  const typedPick = pokemonDraftInput ? pokemonDraftInput.value : "";

  renderPokemonOptions();
  renderDraftPicksList();
  renderTeamRosters();
  renderDraftPointStatus();
  renderAvailablePokemonGrid();
  renderDraftButtons();
  updatePickControls();
  startDraftTimer();

  if (isBackgroundRefresh && pokemonDraftInput && document.activeElement === pokemonDraftInput) {
    pokemonDraftInput.value = typedPick;
  }

  draftRoomStatus.textContent = isAdmin
    ? "Admin draft controls enabled."
    : "Viewing draft room. You can pick when your team is on the clock.";
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

function updateDraftClock() {
  const nextPick = getNextPickInfo();

  if (!draftState?.is_started) {
    draftClockLine.textContent = "Draft has not started.";
    return;
  }

  if (draftState?.is_paused) {
    draftClockLine.textContent = "Draft is stopped.";
    return;
  }

  if (!nextPick) {
    draftClockLine.textContent = "Draft complete.";
    return;
  }

  if (!draftState.current_pick_started_at) {
    draftClockLine.textContent = "Clock waiting...";
    return;
  }

  const startedAt = new Date(draftState.current_pick_started_at).getTime();
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - startedAt) / 1000);
  const remainingSeconds = Math.max(getPickSeconds() - elapsedSeconds, 0);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, "0");

  draftClockLine.textContent =
    `${minutes}:${seconds} remaining • On the clock: ${nextPick.team.team_name}`;

  if (remainingSeconds <= 0 && !autoPickInProgress) {
    autoPickInProgress = true;
    draftActionStatus.textContent = "Time expired. Random pick incoming...";
    makeDraftPick(true).finally(() => {
      autoPickInProgress = false;
    });
  }
}

function getNextPickInfo() {
  const orderedTeams = getOrderedTeams();
  const totalPicks = orderedTeams.length * ROSTER_SIZE;

  if (draftPicks.length >= totalPicks || orderedTeams.length === 0) {
    return null;
  }

  const overallPick = draftPicks.length + 1;
  const roundNumber = Math.floor((overallPick - 1) / orderedTeams.length) + 1;
  const pickInRound = ((overallPick - 1) % orderedTeams.length) + 1;

  const teamIndex = roundNumber % 2 === 1
    ? pickInRound - 1
    : orderedTeams.length - pickInRound;

  return {
    overallPick,
    roundNumber,
    pickInRound,
    team: orderedTeams[teamIndex]
  };
}

function getDraftedSlugSet() {
  return new Set(draftPicks.map(pick => pick.pokemon_slug));
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
  if (draftPicks.length === 0) {
    draftPicksList.innerHTML = `<div class="empty-state"><p>No picks made yet.</p></div>`;
    return;
  }

  draftPicksList.innerHTML = draftPicks.map(pick => {
    const team = getTeamById(pick.league_team_id);
    const pokemon = getPokemonBySlug(pick.pokemon_slug);

    return `
      <div class="draft-pick-row">
        <span>#${pick.overall_pick}</span>
        <span>R${pick.round_number}.${pick.pick_in_round}</span>
        <span>${escapeHtml(team ? team.team_name : "Unknown Team")}</span>
        <strong>${escapeHtml(pokemon ? pokemon.name : pick.pokemon_slug)}</strong>
      </div>
    `;
  }).join("");
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

    return `
      <div class="draft-roster-team">
        <h3>${escapeHtml(getDraftRoomTeamLabel(team))}</h3>
        <p>${rosterRows.length}/${ROSTER_SIZE} Pokémon • ${pointUsage}/${pointCap} points</p>

        <div class="draft-point-bar">
          <div style="width:${Math.min((pointUsage / pointCap) * 100, 100)}%"></div>
        </div>

        <div class="draft-roster-pills">
          ${
            rosterRows.length === 0
              ? `<span class="draft-empty-pill">Empty</span>`
              : rosterRows.map(row => {
                  const pokemon = getPokemonBySlug(row.pokemon_slug);
                  return `<span>${escapeHtml(pokemon ? `${pokemon.name} (${pokemon.points || 1})` : row.pokemon_slug)}</span>`;
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

function getTeamPointUsage(teamId) {
  return getRosterForTeam(teamId).reduce((total, row) => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);
    return total + getPokemonPoints(pokemon);
  }, 0);
}

function getPokemonPoints(pokemon) {
  return Number(pokemon?.points || 1);
}

function getPokemonThatFitTeamCap(teamId) {
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(teamId);
  const remainingPoints = pointCap - usedPoints;

  return getAvailablePokemon().filter(pokemon => getPokemonPoints(pokemon) <= remainingPoints);
}

function getSmartAutoPickPokemon(teamId) {
  const legalPokemon = getPokemonThatFitTeamCap(teamId);

  if (!legalPokemon.length) {
    return null;
  }

  const rosterRows = getRosterForTeam(teamId);
  const openRosterSlots = ROSTER_SIZE - rosterRows.length;
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(teamId);
  const remainingPoints = pointCap - usedPoints;

  return legalPokemon
    .map(pokemon => {
      const points = getPokemonPoints(pokemon);
      const rank = Number(pokemon.rank || 9999);

      /*
        If a team still has several open roster spots, avoid burning too many points
        in a way that makes the rest of the roster impossible.
        Example: 9 slots left and 9 points remaining means only 1-point Pokémon are realistic.
      */
      const minimumPointsNeededAfterPick = Math.max(openRosterSlots - 1, 0);
      const pointsLeftAfterPick = remainingPoints - points;
      const keepsRosterPossible = pointsLeftAfterPick >= minimumPointsNeededAfterPick;

      return {
        pokemon,
        points,
        rank,
        keepsRosterPossible
      };
    })
    .filter(candidate => candidate.keepsRosterPossible)
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }

      return a.pokemon.name.localeCompare(b.pokemon.name);
    })[0]?.pokemon || legalPokemon
      .sort((a, b) => {
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
      })[0];
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
    availablePokemon = availablePokemon.filter(pokemon => pokemon.mega_eligible);
  }

  if (megaFilter === "non-mega") {
    availablePokemon = availablePokemon.filter(pokemon => !pokemon.mega_eligible);
  }

  if (tierFilter !== "all") {
    availablePokemon = availablePokemon.filter(pokemon => pokemon.tier === tierFilter);
  }

  if (typeFilter !== "all") {
    availablePokemon = availablePokemon.filter(pokemon => {
      return (pokemon.types || []).includes(typeFilter);
    });
  }

  return availablePokemon;
}

function renderAvailablePokemonGrid() {
  let availablePokemon = getFilteredAvailablePokemon();
  const totalFilteredCount = availablePokemon.length;

  if (availablePokemonCount) {
    availablePokemonCount.textContent = `${totalFilteredCount} available Pokémon match current filters. Showing up to 60.`;
  }

  availablePokemon = availablePokemon.slice(0, 60);

  if (availablePokemon.length === 0) {
    availablePokemonGrid.innerHTML = `<div class="empty-state"><p>No available Pokémon found.</p></div>`;
    return;
  }

  availablePokemonGrid.innerHTML = availablePokemon.map(pokemon => {
    return `
      <button class="draft-pokemon-card" data-slug="${pokemon.slug}">
        <img src="${pokemon.image}" alt="${escapeHtml(pokemon.name)}">
        ${renderMegaBadge(pokemon)}
        <span>${escapeHtml(getPokemonLabel(pokemon))}</span>
        ${renderPokemonTierBadge(pokemon)}
        ${renderPokemonTypeBadges(pokemon)}
      </button>
    `;
  }).join("");

  document.querySelectorAll(".draft-pokemon-card").forEach(button => {
    button.addEventListener("click", function () {
      const pokemon = championsPokemon.find(p => p.slug === this.dataset.slug);

      if (pokemon) {
        pokemonDraftInput.value = getPokemonLabel(pokemon);
        window.scrollTo({ top: 0, behavior: "smooth" });
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
  const pointCap = Number(currentLeague?.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(nextPick.team.id);
  const pokemonPoints = getPokemonPoints(pokemon);

  if (usedPoints + pokemonPoints > pointCap) {
    draftActionStatus.textContent =
      `${pokemon.name} costs ${pokemonPoints}. ${nextPick.team.team_name} only has ${pointCap - usedPoints} points remaining.`;
    makePickButton.disabled = false;
    return;
  }

  if (rosterRows.length >= ROSTER_SIZE) {
    draftActionStatus.textContent = `${nextPick.team.team_name} already has ${ROSTER_SIZE} Pokémon.`;
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

  const nextSlot = rosterRows.length > 0
    ? Math.max(...rosterRows.map(row => row.slot_number)) + 1
    : 1;

  const { error: rosterError } = await supabaseClient
    .from("team_rosters")
    .insert({
      league_id: selectedLeagueId,
      team_id: nextPick.team.id,
      pokemon_slug: pokemon.slug,
      slot_number: nextSlot
    });

  if (rosterError) {
    console.error("Roster insert error:", rosterError);

    await supabaseClient
      .from("league_draft_picks")
      .delete()
      .eq("league_id", selectedLeagueId)
      .eq("overall_pick", nextPick.overallPick);

    draftActionStatus.textContent = "Roster update failed. Draft pick was undone.";
    makePickButton.disabled = false;
    return;
  }

  pokemonDraftInput.value = "";

  const upcomingPick = draftPicks.length + 1;
  const totalPicks = leagueTeams.length * ROSTER_SIZE;

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
