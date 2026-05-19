const manageLeagueSubtitle = document.getElementById("manageLeagueSubtitle");
const manageLeagueStatus = document.getElementById("manageLeagueStatus");
const teamManagerList = document.getElementById("teamManagerList");
const saveManagersButton = document.getElementById("saveManagersButton");
const draftClockSecondsInput = document.getElementById("draftClockSecondsInput");
const playoffTeamCountSelect = document.getElementById("playoffTeamCountSelect");
const draftOrderEditor = document.getElementById("draftOrderEditor");

const deleteLeagueButton = document.getElementById("deleteLeagueButton");
const deleteLeagueConfirmInput = document.getElementById("deleteLeagueConfirmInput");
const deleteLeagueStatus = document.getElementById("deleteLeagueStatus");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let currentLeague = null;
let leagueTeams = [];
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

  await loadTeams();
  await loadDraftSettings();

  renderDraftSettings();
  renderTeamManagerRows();

  manageLeagueStatus.textContent = "Edit draft settings, teams, manager emails, and admin status.";
}

async function loadTeams() {
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

  for (const team of leagueTeams) {
    const teamName = document.getElementById(`teamName-${team.id}`).value.trim() || `Team ${team.team_number}`;
    const managerEmailRaw = document.getElementById(`managerEmail-${team.id}`).value.trim().toLowerCase();
    const isAdmin = document.getElementById(`isAdmin-${team.id}`).checked;

    const managerEmail = managerEmailRaw ? managerEmailRaw : null;

    const { error } = await supabaseClient
      .from("league_teams")
      .update({
        team_name: teamName,
        manager_email: managerEmail,
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

  await loadTeams();
  await loadDraftSettings();
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
