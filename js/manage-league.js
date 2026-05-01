const manageLeagueSubtitle = document.getElementById("manageLeagueSubtitle");
const manageLeagueStatus = document.getElementById("manageLeagueStatus");
const teamManagerList = document.getElementById("teamManagerList");
const saveManagersButton = document.getElementById("saveManagersButton");
const divisionEditor = document.getElementById("divisionEditor");

const deleteLeagueButton = document.getElementById("deleteLeagueButton");
const deleteLeagueConfirmInput = document.getElementById("deleteLeagueConfirmInput");
const deleteLeagueStatus = document.getElementById("deleteLeagueStatus");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let leagueTeams = [];
let leagueDivisions = [];

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

  manageLeagueSubtitle.textContent = league.name;

  await loadTeamsAndDivisions();
  await ensureTwoDivisions();
  renderDivisionEditor();
  renderTeamManagerRows();

  manageLeagueStatus.textContent = "Edit divisions, team names, manager emails, and admin status.";
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
          type="text"
          value="${escapeHtml(division.name)}"
          placeholder="Division name">
      </div>
    `;
  }).join("");
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
        <span>Team ${team.team_number}</span>

        <input
          type="text"
          id="teamName-${team.id}"
          value="${escapeHtml(team.team_name)}"
          placeholder="Team Name">

        <input
          type="email"
          id="managerEmail-${team.id}"
          value="${escapeHtml(team.manager_email || "")}"
          placeholder="manager@email.com">

        <select id="division-${team.id}" class="team-division-select">
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

  manageLeagueStatus.textContent = "League settings saved.";

  await loadTeamsAndDivisions();
  renderDivisionEditor();
  renderTeamManagerRows();

  saveManagersButton.disabled = false;
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
