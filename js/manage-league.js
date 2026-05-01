const manageLeagueSubtitle = document.getElementById("manageLeagueSubtitle");
const manageLeagueStatus = document.getElementById("manageLeagueStatus");
const teamManagerList = document.getElementById("teamManagerList");
const saveManagersButton = document.getElementById("saveManagersButton");
const deleteLeagueButton = document.getElementById("deleteLeagueButton");
const deleteLeagueConfirmInput = document.getElementById("deleteLeagueConfirmInput");
const deleteLeagueStatus = document.getElementById("deleteLeagueStatus");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let leagueTeams = [];

saveManagersButton.addEventListener("click", saveLeagueManagers);

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
    manageLeagueStatus.textContent = "Only league admins can manage team emails.";
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
  renderTeamManagerRows();
  manageLeagueStatus.textContent = "Edit team names, emails, and admin status.";
}

function renderTeamManagerRows() {
  teamManagerList.innerHTML = leagueTeams.map(team => {
    const checked = team.is_admin ? "checked" : "";

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

        <label class="team-admin-toggle">
          <input id="isAdmin-${team.id}" type="checkbox" ${checked}>
          Admin
        </label>
      </div>
    `;
  }).join("");
}

async function saveLeagueManagers() {
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
  manageLeagueStatus.textContent = "Saving league managers...";

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
      manageLeagueStatus.textContent = "Error saving team managers. Check the console.";
      saveManagersButton.disabled = false;
      return;
    }
  }

  manageLeagueStatus.textContent = "League managers saved.";

  const { data: teams } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  leagueTeams = teams || leagueTeams;
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
