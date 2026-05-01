const manageLeagueSubtitle = document.getElementById("manageLeagueSubtitle");
const manageLeagueStatus = document.getElementById("manageLeagueStatus");
const teamManagerList = document.getElementById("teamManagerList");
const saveManagersButton = document.getElementById("saveManagersButton");
const divisionEditor = document.getElementById("divisionEditor");
const draftClockSecondsInput = document.getElementById("draftClockSecondsInput");
const draftOrderEditor = document.getElementById("draftOrderEditor");

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

saveManagersButton.addEventListener("click", saveLeagueSettings);

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

  await loadTeamsAndDivisions();
  await ensureTwoDivisions();
  await loadDraftSettings();

  renderDivisionEditor();
  renderDraftSettings();
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
    leagueDivisions = [];
    return;
  }

  leagueDivisions = divisions || [];
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

async function ensureTwoDivisions() {
  if (leagueDivisions.length === 2) {
    const missingDivisionTeams = leagueTeams.filter(team => !team.division_id);

    if (missingDivisionTeams.length > 0) {
      await splitTeamsIntoDivisions();
      await loadTeamsAndDivisions();
    }

    return;
  }

  const divisionOneId = makeId();
  const divisionTwoId = makeId();

  const divisions = [
    {
      id: divisionOneId,
      league_id: selectedLeagueId,
      division_number: 1,
      name: "Division A"
    },
    {
      id: divisionTwoId,
      league_id: selectedLeagueId,
      division_number: 2,
      name: "Division B"
    }
  ];

  const { error: insertError } = await supabaseClient
    .from("league_divisions")
    .insert(divisions);

  if (insertError) {
    console.error("Create default divisions error:", insertError);
    manageLeagueStatus.textContent = "Could not create default divisions.";
    return;
  }

  await loadTeamsAndDivisions();
  await splitTeamsIntoDivisions();
  await loadTeamsAndDivisions();
}

async function splitTeamsIntoDivisions() {
  if (leagueDivisions.length < 2) {
    return;
  }

  const divisionOne = leagueDivisions[0];
  const divisionTwo = leagueDivisions[1];
  const midpoint = leagueTeams.length / 2;

  for (const team of leagueTeams) {
    const divisionId = team.team_number <= midpoint ? divisionOne.id : divisionTwo.id;

    await supabaseClient
      .from("league_teams")
      .update({
        division_id: divisionId,
        updated_at: new Date().toISOString()
      })
      .eq("id", team.id);
  }
}

function renderDivisionEditor() {
  if (!divisionEditor) {
    return;
  }

  divisionEditor.innerHTML = leagueDivisions.map(division => {
    return `
      <div class="division-name-row">
        <span>Division ${division.division_number}</span>
        <input
          id="divisionName-${division.id}"
          class="pkmn-input"
          type="text"
          value="${escapeHtml(division.name)}"
          placeholder="Division name">
      </div>
    `;
  }).join("");
}

function renderDraftSettings() {
  if (!draftOrderEditor || !draftClockSecondsInput) {
    return;
  }

  draftClockSecondsInput.value = currentLeague.draft_pick_seconds || 120;

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

  if (clockSeconds < 15 || clockSeconds > 600) {
    manageLeagueStatus.textContent = "Draft clock must be between 15 and 600 seconds.";
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
      draft_pick_seconds: clockSeconds
    })
    .eq("id", selectedLeagueId);

  if (leagueUpdateError) {
    console.error("Save league draft clock error:", leagueUpdateError);
    manageLeagueStatus.textContent = "Error saving draft clock. Check the console.";
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

  saveManagersButton.disabled = false;
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
