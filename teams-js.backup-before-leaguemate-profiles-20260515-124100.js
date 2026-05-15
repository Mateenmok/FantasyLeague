const teamInfoSubtitle = document.getElementById("teamInfoSubtitle");
const teamInfoGrid = document.getElementById("teamInfoGrid");
const teamInfoStatus = document.getElementById("teamInfoStatus");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let currentUserId = null;
let leagueTeams = [];

loadTeamInfoPage();

async function loadTeamInfoPage() {
  if (!selectedLeagueId) {
    teamInfoSubtitle.textContent = "No league selected.";
    teamInfoStatus.textContent = "Go to My Leagues and select a league first.";
    teamInfoGrid.innerHTML = "";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    teamInfoSubtitle.textContent = "Not signed in.";
    teamInfoStatus.textContent = "Sign in before viewing team info.";
    return;
  }

  currentUserId = sessionData.session.user.id;

  const { data: membership, error: membershipError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", currentUserId)
    .eq("league_id", selectedLeagueId)
    .single();

  if (membershipError || !membership) {
    console.error("Membership error:", membershipError);
    teamInfoSubtitle.textContent = "No access.";
    teamInfoStatus.textContent = "You are not a member of this league.";
    return;
  }

  currentMembership = membership;

  if (currentMembership.role !== "admin") {
    teamInfoSubtitle.textContent = "Admin only.";
    teamInfoStatus.textContent = "Redirecting to My Team...";
    window.location.href = "my-team.html";
    return;
  }

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League load error:", leagueError);
    teamInfoSubtitle.textContent = "Could not load league.";
    teamInfoStatus.textContent = "Try selecting the league again.";
    return;
  }

  teamInfoSubtitle.textContent = league.name;

  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams load error:", teamsError);
    teamInfoStatus.textContent = "Could not load teams.";
    return;
  }

  leagueTeams = teams || [];

  renderTeams();
  teamInfoStatus.textContent = `${leagueTeams.length} teams loaded. Admin record editing enabled.`;
}

function renderTeams() {
  teamInfoGrid.innerHTML = leagueTeams.map(team => {
    const managerEmail = team.manager_email || "Unassigned";
    const ownerName = team.owner_name || "Unassigned";
    const logoUrl = team.logo_url || "";
    const adminBadge = team.is_admin
      ? `<span class="admin-badge">Admin</span>`
      : `<span class="team-role-badge">Manager</span>`;

    const logoHtml = logoUrl
      ? `<img class="team-info-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(team.team_name)} logo">`
      : `<div class="team-info-logo-placeholder">T${team.team_number}</div>`;

    return `
      <article class="team-info-card editable-team-card">
        <div class="team-info-top">
          <div class="team-number-badge">#${team.team_number}</div>
          ${logoHtml}
        </div>

        <div class="team-info-main">
          <h2>${escapeHtml(team.team_name)}</h2>
          <p><strong>Manager:</strong> ${escapeHtml(managerEmail)}</p>
          <p><strong>Role:</strong> ${adminBadge}</p>
          <p class="small-note">Admin editor.</p>

          <div class="team-edit-form">
            <label>Team Name</label>
            <input id="teamName-${team.id}" type="text" value="${escapeHtml(team.team_name)}">

            <label>Owner Name</label>
            <input id="ownerName-${team.id}" type="text" value="${escapeHtml(ownerName)}">

            <label>Logo URL</label>
            <input id="logoUrl-${team.id}" type="text" value="${escapeHtml(logoUrl)}" placeholder="Paste image URL">

            <label>Record</label>
            <input id="record-${team.id}" type="text" value="${escapeHtml(team.record || "0-0")}" placeholder="0-0">

            <button class="pkmn-button small save-team-button" data-team-id="${team.id}">
              Save Team
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".save-team-button").forEach(button => {
    button.addEventListener("click", function () {
      saveTeam(this.dataset.teamId);
    });
  });
}

async function saveTeam(teamId) {
  if (!currentMembership || currentMembership.role !== "admin") {
    teamInfoStatus.textContent = "Only admins can edit Team Info.";
    return;
  }

  const team = leagueTeams.find(team => team.id === teamId);

  if (!team) {
    teamInfoStatus.textContent = "Could not find that team.";
    return;
  }

  const teamName = document.getElementById(`teamName-${teamId}`).value.trim() || `Team ${team.team_number}`;
  const ownerName = document.getElementById(`ownerName-${teamId}`).value.trim() || "Unassigned";
  const logoUrl = document.getElementById(`logoUrl-${teamId}`).value.trim();
  const record = document.getElementById(`record-${teamId}`).value.trim() || "0-0";

  teamInfoStatus.textContent = "Saving team...";

  const { error } = await supabaseClient
    .from("league_teams")
    .update({
      team_name: teamName,
      owner_name: ownerName,
      logo_url: logoUrl,
      record: record,
      updated_at: new Date().toISOString()
    })
    .eq("id", teamId)
    .eq("league_id", selectedLeagueId);

  if (error) {
    console.error("Save team error:", error);
    teamInfoStatus.textContent = "Error saving team. Check the console.";
    return;
  }

  teamInfoStatus.textContent = "Team saved.";

  const { data: teams, error: reloadError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (reloadError) {
    console.error("Reload teams error:", reloadError);
    return;
  }

  leagueTeams = teams || leagueTeams;
  renderTeams();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
