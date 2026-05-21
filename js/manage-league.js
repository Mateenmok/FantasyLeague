const manageLeagueSubtitle = document.getElementById("manageLeagueSubtitle");
const manageLeagueStatus = document.getElementById("manageLeagueStatus");
const teamManagerList = document.getElementById("teamManagerList");
const saveManagersButton = document.getElementById("saveManagersButton");
const divisionEditor = document.getElementById("divisionEditor");
const draftClockSecondsInput = document.getElementById("draftClockSecondsInput");
const playoffTeamCountSelect = document.getElementById("playoffTeamCountSelect");
const draftOrderEditor = document.getElementById("draftOrderEditor");
const mascotAssignmentList = document.getElementById("mascotAssignmentList");
const mascotPokemonOptions = document.getElementById("mascotPokemonOptions");
const saveMascotsButton = document.getElementById("saveMascotsButton");
const mascotStatus = document.getElementById("mascotStatus");

const deleteLeagueButton = document.getElementById("deleteLeagueButton");
const deleteLeagueConfirmInput = document.getElementById("deleteLeagueConfirmInput");
const deleteLeagueStatus = document.getElementById("deleteLeagueStatus");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let currentLeague = null;
let leagueTeams = [];
let leagueDivisions = [];
let draftOrderTeamIds = [];
let draftState = null;
let draftPicks = [];
let mascotRows = [];
let championsPokemon = [];

saveManagersButton.addEventListener("click", saveLeagueSettings);

if (saveMascotsButton) {
  saveMascotsButton.addEventListener("click", saveMascotAssignments);
}

if (deleteLeagueButton) {
  deleteLeagueButton.addEventListener("click", deleteLeague);
}

loadManageLeaguePage();

async function loadManageLeaguePage() {
  if (!selectedLeagueId) {
    manageLeagueSubtitle.textContent = "No league selected.";
    manageLeagueStatus.textContent = "Go to My Leagues and select a league first.";
    saveManagersButton.disabled = true;
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    manageLeagueSubtitle.textContent = "Not signed in.";
    manageLeagueStatus.textContent = "Sign in before managing a league.";
    saveManagersButton.disabled = true;
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
    manageLeagueSubtitle.textContent = "No access.";
    manageLeagueStatus.textContent = "You are not a member of this league.";
    saveManagersButton.disabled = true;
    return;
  }

  currentMembership = membership;

  if (currentMembership.role !== "admin") {
    manageLeagueSubtitle.textContent = "Admin only.";
    manageLeagueStatus.textContent = "Only league admins can manage league settings.";
    saveManagersButton.disabled = true;
    return;
  }

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    manageLeagueSubtitle.textContent = "Could not load league.";
    manageLeagueStatus.textContent = "Try selecting the league again.";
    saveManagersButton.disabled = true;
    return;
  }

  currentLeague = league;
  manageLeagueSubtitle.textContent = league.name;

  await loadPokemonData();
  await loadTeamsAndDivisions();
  await ensureLeagueDivisions();
  await loadDraftSettings();
  await loadMascotRows();

  renderDivisionEditor();
  renderDraftSettings();
  renderMascotAssignments();
  renderTeamManagerRows();

  manageLeagueStatus.textContent = "Edit divisions, draft settings, teams, manager emails, and admin status.";
}

async function loadTeamsAndDivisions() {
  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
    manageLeagueStatus.textContent = "Could not load league teams.";
    saveManagersButton.disabled = true;
    return;
  }

  leagueTeams = teams || [];

  const { data: divisions, error: divisionsError } = await supabaseClient
    .from("league_divisions")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("division_number", { ascending: true });

  if (divisionsError) {
    console.error("Divisions error:", divisionsError);
    manageLeagueStatus.textContent = "Could not load league divisions.";
    saveManagersButton.disabled = true;
    return;
  }

  leagueDivisions = divisions || [];
}

async function loadPokemonData() {
  try {
    championsPokemon = await fetch("data/champions-pokemon.json?v=manage-mascots1")
      .then(response => response.json());
  } catch (error) {
    console.error("Pokemon data load error:", error);
    championsPokemon = [];
    if (mascotStatus) {
      mascotStatus.textContent = "Could not load Pokemon data for mascots.";
    }
  }
}

async function loadDraftSettings() {
  const { data: orderRows, error: orderError } = await supabaseClient
    .from("league_draft_order")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("slot_number", { ascending: true });

  if (orderError) {
    console.error("Draft order load error:", orderError);
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
    .maybeSingle();

  if (stateError) {
    console.error("Draft state load error:", stateError);
    draftState = null;
  } else {
    draftState = state;
  }

  const { data: picks, error: picksError } = await supabaseClient
    .from("league_draft_picks")
    .select("id")
    .eq("league_id", selectedLeagueId)
    .limit(1);

  if (picksError) {
    console.error("Draft picks load error:", picksError);
    draftPicks = [];
  } else {
    draftPicks = picks || [];
  }
}

async function loadMascotRows() {
  const { data, error } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("is_mascot", true)
    .order("slot_number", { ascending: true });

  if (error) {
    console.error("Mascot load error:", error);
    mascotRows = [];
    if (mascotStatus) {
      mascotStatus.textContent = "Could not load mascot assignments.";
    }
    return;
  }

  mascotRows = data || [];
}

function renderDraftSettings() {
  if (!draftOrderEditor || !draftClockSecondsInput) {
    return;
  }

  draftClockSecondsInput.value = currentLeague.draft_pick_seconds || 120;
  renderPlayoffTeamOptions();

  const orderLocked = Boolean(draftState?.is_started) || draftPicks.length > 0;
  const teamsById = {};

  leagueTeams.forEach(team => {
    teamsById[team.id] = team;
  });

  const orderedTeams = draftOrderTeamIds
    .map(teamId => teamsById[teamId])
    .filter(Boolean);

  const missingTeams = leagueTeams.filter(team => !draftOrderTeamIds.includes(team.id));
  const finalOrder = [...orderedTeams, ...missingTeams];

  draftOrderEditor.innerHTML = `
    ${orderLocked ? `<p class="small-note">Draft order is locked because the draft has started or picks already exist.</p>` : ""}
    <div class="manage-draft-order-grid">
      ${finalOrder.map((team, index) => {
        const options = leagueTeams.map(optionTeam => {
          const selected = optionTeam.id === team.id ? "selected" : "";
          return `<option value="${optionTeam.id}" ${selected}>${escapeHtml(optionTeam.team_name)}</option>`;
        }).join("");

        return `
          <label class="manage-draft-order-row">
            <span>Pick ${index + 1}</span>
            <select class="pkmn-select manage-draft-order-select" ${orderLocked ? "disabled" : ""}>
              ${options}
            </select>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function renderMascotAssignments() {
  if (!mascotAssignmentList || !mascotPokemonOptions) {
    return;
  }

  renderMascotPokemonOptions();

  const locked = isMascotLocked();
  const mascotByTeamId = {};

  mascotRows.forEach(row => {
    mascotByTeamId[row.team_id] = row;
  });

  mascotAssignmentList.innerHTML = leagueTeams.map(team => {
    const mascot = getPokemonBySlug(mascotByTeamId[team.id]?.pokemon_slug);
    const mascotValue = mascot ? getPokemonLabel(mascot) : "";
    const pointText = mascot ? `${getPokemonPoints(mascot)} pts` : "Required";

    return `
      <label class="mascot-assignment-row">
        <span class="mascot-team-name">${escapeHtml(team.team_name)}</span>
        <input
          id="mascot-${team.id}"
          class="pkmn-input mascot-input"
          type="text"
          list="mascotPokemonOptions"
          value="${escapeHtml(mascotValue)}"
          placeholder="Choose mascot"
          ${locked ? "disabled" : ""}>
        <span class="mascot-points" id="mascotPoints-${team.id}">${escapeHtml(pointText)}</span>
      </label>
    `;
  }).join("");

  document.querySelectorAll(".mascot-input").forEach(input => {
    input.addEventListener("input", updateMascotPointLabels);
  });

  if (saveMascotsButton) {
    saveMascotsButton.disabled = locked || championsPokemon.length === 0;
  }

  if (mascotStatus) {
    if (locked) {
      mascotStatus.textContent = "Mascots are locked because the draft has started or picks already exist.";
    } else if (mascotRows.length === leagueTeams.length) {
      mascotStatus.textContent = "Mascots saved. You can still change them before the draft begins.";
    } else {
      mascotStatus.textContent = "Choose a mascot for every team before saving.";
    }
  }
}

function renderMascotPokemonOptions() {
  mascotPokemonOptions.innerHTML = championsPokemon.map(pokemon => {
    return `<option value="${escapeHtml(getPokemonLabel(pokemon))}"></option>`;
  }).join("");
}

function updateMascotPointLabels() {
  leagueTeams.forEach(team => {
    const input = document.getElementById(`mascot-${team.id}`);
    const pointLabel = document.getElementById(`mascotPoints-${team.id}`);

    if (!input || !pointLabel) {
      return;
    }

    const pokemon = findPokemonFromInput(input.value);
    pointLabel.textContent = pokemon ? `${getPokemonPoints(pokemon)} pts` : "Required";
  });
}

function isMascotLocked() {
  return Boolean(draftState?.is_started) || draftPicks.length > 0;
}

async function ensureLeagueDivisions() {
  if (leagueDivisions.length === 0) {
    const fallbackDivisionCount = Math.min(2, Math.max(1, leagueTeams.length));
    const divisions = Array.from({ length: fallbackDivisionCount }, (_, index) => ({
      id: makeId(),
      league_id: selectedLeagueId,
      division_number: index + 1,
      name: `Division ${String.fromCharCode(65 + index)}`
    }));

    const { error } = await supabaseClient
      .from("league_divisions")
      .insert(divisions);

    if (error) {
      console.error("Create divisions error:", error);
      manageLeagueStatus.textContent = "Could not create default divisions.";
      return;
    }

    await loadTeamsAndDivisions();
  }

  const missingDivisionTeams = leagueTeams.filter(team => !team.division_id);

  if (leagueDivisions.length && missingDivisionTeams.length) {
    for (const team of missingDivisionTeams) {
      const divisionIndex = getDefaultDivisionIndexForTeam(
        team.team_number,
        leagueTeams.length,
        leagueDivisions.length
      );
      const divisionId = leagueDivisions[divisionIndex]?.id || leagueDivisions[0].id;

      await supabaseClient
        .from("league_teams")
        .update({
          division_id: divisionId,
          updated_at: new Date().toISOString()
        })
        .eq("id", team.id);
    }

    await loadTeamsAndDivisions();
  }
}

function renderDivisionEditor() {
  if (!divisionEditor) {
    return;
  }

  divisionEditor.innerHTML = leagueDivisions.map(division => {
    return `
      <label class="division-name-row">
        <span>Division ${division.division_number}</span>
        <input
          id="divisionName-${division.id}"
          class="pkmn-input"
          type="text"
          maxlength="40"
          value="${escapeHtml(division.name)}"
          placeholder="Division name">
      </label>
    `;
  }).join("");
}

function renderPlayoffTeamOptions() {
  if (!playoffTeamCountSelect) {
    return;
  }

  const teamCount = Number(currentLeague.team_count || leagueTeams.length || 0);
  const defaultCount = getDefaultPlayoffTeamCount(teamCount);
  const configuredCount = Number(currentLeague.playoff_team_count || defaultCount);
  const options = [];

  for (let count = 2; count <= teamCount; count += 2) {
    options.push(count);
  }

  playoffTeamCountSelect.innerHTML = options.map(count => {
    const label = count === 2 ? "2 Teams" : `${count} Teams`;
    return `<option value="${count}">${label}</option>`;
  }).join("");

  playoffTeamCountSelect.value = options.includes(configuredCount)
    ? String(configuredCount)
    : String(defaultCount);
}

function getDefaultPlayoffTeamCount(teamCount) {
  if (teamCount >= 10) return 6;
  if (teamCount >= 4) return 4;
  return 2;
}

function renderTeamManagerRows() {
  teamManagerList.innerHTML = leagueTeams.map(team => {
    const checked = team.is_admin ? "checked" : "";
    const divisionOptions = leagueDivisions.map(division => {
      const selected = division.id === team.division_id ? "selected" : "";
      return `<option value="${division.id}" ${selected}>${escapeHtml(division.name)}</option>`;
    }).join("");

    return `
      <div class="team-manager-row" data-team-id="${team.id}">
        <div class="team-row-label">Team ${team.team_number}</div>

        <input
          class="pkmn-input"
          type="text"
          id="teamName-${team.id}"
          value="${escapeHtml(team.team_name)}"
          placeholder="Team Name">

        <input
          class="pkmn-input"
          type="email"
          id="managerEmail-${team.id}"
          value="${escapeHtml(team.manager_email || "")}"
          placeholder="manager@email.com">

        <select id="division-${team.id}" class="pkmn-select">
          ${divisionOptions}
        </select>

        <label class="team-admin-toggle">
          <input id="isAdmin-${team.id}" type="checkbox" ${checked}>
          Admin
        </label>
      </div>
    `;
  }).join("");
}

async function saveLeagueSettings() {
  if (!currentMembership || currentMembership.role !== "admin") {
    manageLeagueStatus.textContent = "Only admins can save changes.";
    return;
  }

  const clockSeconds = Number(draftClockSecondsInput?.value || 120);
  const playoffTeamCount = Number(playoffTeamCountSelect?.value || currentLeague.playoff_team_count || getDefaultPlayoffTeamCount(leagueTeams.length));

  if (clockSeconds < 15 || clockSeconds > 600) {
    manageLeagueStatus.textContent = "Draft clock must be between 15 and 600 seconds.";
    return;
  }

  if (playoffTeamCount < 2 || playoffTeamCount > leagueTeams.length || playoffTeamCount % 2 !== 0) {
    manageLeagueStatus.textContent = "Playoff teams must be an even number between 2 and the league size.";
    return;
  }

  const divisionNames = getDivisionNames();

  if (divisionNames.some(name => !name)) {
    manageLeagueStatus.textContent = "Every division needs a name.";
    return;
  }

  if (hasDuplicateDivisionName(divisionNames)) {
    manageLeagueStatus.textContent = "Division names must be unique.";
    return;
  }

  const seenEmails = new Set();

  for (const team of leagueTeams) {
    const email = document.getElementById(`managerEmail-${team.id}`).value.trim().toLowerCase();

    if (email) {
      if (seenEmails.has(email)) {
        manageLeagueStatus.textContent = `${email} is assigned to more than one team.`;
        return;
      }

      seenEmails.add(email);
    }
  }

  saveManagersButton.disabled = true;
  manageLeagueStatus.textContent = "Saving league settings...";

  const { error: leagueUpdateError } = await supabaseClient
    .from("leagues")
    .update({
      draft_pick_seconds: clockSeconds,
      playoff_team_count: playoffTeamCount
    })
    .eq("id", selectedLeagueId);

  if (leagueUpdateError) {
    console.error("Save league draft clock error:", leagueUpdateError);
    manageLeagueStatus.textContent = "Error saving league settings. Check the console.";
    saveManagersButton.disabled = false;
    return;
  }

  for (const division of leagueDivisions) {
    const divisionName = document.getElementById(`divisionName-${division.id}`).value.trim() || `Division ${division.division_number}`;

    const { error } = await supabaseClient
      .from("league_divisions")
      .update({
        name: divisionName,
        updated_at: new Date().toISOString()
      })
      .eq("id", division.id)
      .eq("league_id", selectedLeagueId);

    if (error) {
      console.error("Save division error:", error);
      manageLeagueStatus.textContent = "Error saving divisions. Check the console.";
      saveManagersButton.disabled = false;
      return;
    }
  }

  for (const team of leagueTeams) {
    const teamName = document.getElementById(`teamName-${team.id}`).value.trim() || `Team ${team.team_number}`;
    const managerEmailRaw = document.getElementById(`managerEmail-${team.id}`).value.trim().toLowerCase();
    const divisionId = document.getElementById(`division-${team.id}`).value;
    const isAdmin = document.getElementById(`isAdmin-${team.id}`).checked;

    const managerEmail = managerEmailRaw ? managerEmailRaw : null;

    const { error } = await supabaseClient
      .from("league_teams")
      .update({
        team_name: teamName,
        manager_email: managerEmail,
        division_id: divisionId,
        is_admin: isAdmin,
        updated_at: new Date().toISOString()
      })
      .eq("id", team.id);

    if (error) {
      console.error("Save team error:", error);
      manageLeagueStatus.textContent = "Error saving team settings. Check the console.";
      saveManagersButton.disabled = false;
      return;
    }
  }

  const orderSaved = await saveDraftOrderIfUnlocked();

  if (!orderSaved) {
    saveManagersButton.disabled = false;
    return;
  }

  manageLeagueStatus.textContent = "League settings saved.";

  const { data: refreshedLeague } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (refreshedLeague) {
    currentLeague = refreshedLeague;
  }

  await loadTeamsAndDivisions();
  await loadDraftSettings();
  renderDivisionEditor();
  renderDraftSettings();
  renderTeamManagerRows();
  renderMascotAssignments();

  saveManagersButton.disabled = false;
}

async function saveMascotAssignments() {
  if (!currentMembership || currentMembership.role !== "admin") {
    mascotStatus.textContent = "Only admins can save mascots.";
    return;
  }

  if (isMascotLocked()) {
    mascotStatus.textContent = "Mascots can only be saved before the draft begins.";
    return;
  }

  if (championsPokemon.length === 0) {
    mascotStatus.textContent = "Pokemon data is not loaded yet.";
    return;
  }

  const mascotAssignments = [];
  const usedSlugs = new Set();

  for (const team of leagueTeams) {
    const input = document.getElementById(`mascot-${team.id}`);
    const pokemon = findPokemonFromInput(input?.value || "");

    if (!pokemon) {
      mascotStatus.textContent = `Choose a valid mascot for ${team.team_name}. Every team needs one.`;
      return;
    }

    if (usedSlugs.has(pokemon.slug)) {
      mascotStatus.textContent = `${pokemon.name} is already assigned. Mascots must be unique.`;
      return;
    }

    usedSlugs.add(pokemon.slug);
    mascotAssignments.push({
      team_id: team.id,
      pokemon_slug: pokemon.slug
    });
  }

  if (mascotAssignments.length !== leagueTeams.length) {
    mascotStatus.textContent = "A mascot must be assigned for every team.";
    return;
  }

  saveMascotsButton.disabled = true;
  mascotStatus.textContent = "Saving mascots...";

  const { error } = await supabaseClient
    .rpc("save_league_mascots", {
      p_league_id: selectedLeagueId,
      p_mascots: mascotAssignments
    });

  if (error) {
    console.error("Save mascots error:", error);
    mascotStatus.textContent = getMascotSaveErrorMessage(error);
    saveMascotsButton.disabled = false;
    return;
  }

  await loadMascotRows();
  renderMascotAssignments();
  mascotStatus.textContent = "Mascots saved for every team.";
  saveMascotsButton.disabled = false;
}

function getDivisionNames() {
  return leagueDivisions.map(division => {
    const input = document.getElementById(`divisionName-${division.id}`);
    return (input?.value || "").trim();
  });
}

function hasDuplicateDivisionName(divisionNames) {
  const seen = new Set();

  return divisionNames.some(name => {
    const normalizedName = name.trim().toLowerCase();

    if (seen.has(normalizedName)) {
      return true;
    }

    seen.add(normalizedName);
    return false;
  });
}

function getDefaultDivisionIndexForTeam(teamNumber, teamCount, divisionCount) {
  return Math.min(
    divisionCount - 1,
    Math.floor((teamNumber - 1) * divisionCount / teamCount)
  );
}

function findPokemonFromInput(value) {
  const cleaned = String(value || "").trim().toLowerCase();

  if (!cleaned) {
    return null;
  }

  return championsPokemon.find(pokemon => {
    return pokemon.slug.toLowerCase() === cleaned ||
      pokemon.name.toLowerCase() === cleaned ||
      getPokemonLabel(pokemon).toLowerCase() === cleaned;
  });
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

function getPokemonPoints(pokemon) {
  return Number(pokemon?.points || 1);
}

function getMascotSaveErrorMessage(error) {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code
  ].filter(Boolean).join(" ").toLowerCase();

  if (text.includes("non-mascot roster")) {
    return "Mascots cannot be changed after roster activity has started.";
  }

  if (text.includes("draft")) {
    return "Mascots can only be saved before the draft begins.";
  }

  if (text.includes("unique_league_pokemon_owner") || text.includes("unique")) {
    return "One of those Pokemon is already rostered in this league.";
  }

  return "Could not save mascots. Check the console.";
}

async function saveDraftOrderIfUnlocked() {
  const orderLocked = Boolean(draftState?.is_started) || draftPicks.length > 0;

  if (orderLocked) {
    return true;
  }

  const selects = Array.from(document.querySelectorAll(".manage-draft-order-select"));

  if (selects.length === 0) {
    return true;
  }

  const selectedTeamIds = selects.map(select => select.value);
  const uniqueTeamIds = new Set(selectedTeamIds);

  if (selectedTeamIds.length !== leagueTeams.length || uniqueTeamIds.size !== leagueTeams.length) {
    manageLeagueStatus.textContent = "Each team must appear exactly once in the draft order.";
    return false;
  }

  const { error: deleteError } = await supabaseClient
    .from("league_draft_order")
    .delete()
    .eq("league_id", selectedLeagueId);

  if (deleteError) {
    console.error("Delete old draft order error:", deleteError);
    manageLeagueStatus.textContent = "Could not clear old draft order.";
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
    manageLeagueStatus.textContent = "Could not save draft order.";
    return false;
  }

  draftOrderTeamIds = selectedTeamIds;
  return true;
}

async function deleteLeague() {
  if (!currentMembership || currentMembership.role !== "admin") {
    deleteLeagueStatus.textContent = "Only league admins can delete leagues.";
    return;
  }

  const confirmText = deleteLeagueConfirmInput.value.trim();

  if (confirmText !== "DELETE") {
    deleteLeagueStatus.textContent = "Type DELETE exactly to confirm.";
    return;
  }

  const confirmed = window.confirm("This will permanently delete this league. Are you sure?");

  if (!confirmed) {
    deleteLeagueStatus.textContent = "League deletion cancelled.";
    return;
  }

  deleteLeagueButton.disabled = true;
  deleteLeagueStatus.textContent = "Deleting league...";

  const { error } = await supabaseClient
    .rpc("delete_league_as_admin", {
      p_league_id: selectedLeagueId
    });

  if (error) {
    console.error("Delete league error:", error);
    deleteLeagueStatus.textContent = "Error deleting league. Check the console.";
    deleteLeagueButton.disabled = false;
    return;
  }

  localStorage.removeItem("selected-league-id");
  localStorage.removeItem("selected-league-code");
  localStorage.removeItem("selected-league-team-id");
  localStorage.removeItem("selected-league-role");

  deleteLeagueStatus.textContent = "League deleted. Redirecting...";
  window.location.href = "my-leagues.html";
}

function makeId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
