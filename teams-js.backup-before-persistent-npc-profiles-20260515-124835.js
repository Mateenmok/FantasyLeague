const teamInfoSubtitle = document.getElementById("teamInfoSubtitle");
const teamInfoGrid = document.getElementById("teamInfoGrid");
const teamInfoStatus = document.getElementById("teamInfoStatus");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let currentUserId = null;
let currentUserEmail = "";
let leagueTeams = [];

const LEAGUEMATE_NPC_IMAGES = [
  "images/profile-npcs/npc1.png",
  "images/profile-npcs/npc2.webp",
  "images/profile-npcs/npc3.webp",
  "images/profile-npcs/npc4.jpeg",
  "images/profile-npcs/npc5.jpg",
  "images/profile-npcs/npc6.webp",
  "images/profile-npcs/npc7.webp",
  "images/profile-npcs/npc8.jpg",
  "images/profile-npcs/npc9.webp"
];

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
  currentUserEmail = (sessionData.session.user.email || "").toLowerCase();

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

  const isAdmin = currentMembership.role === "admin";
  teamInfoStatus.textContent = isAdmin
    ? `${leagueTeams.length} teams loaded. Admin record editing enabled.`
    : `${leagueTeams.length} teams loaded. Select View Profile to see a leaguemate profile.`;
}

function renderTeams() {
  const isAdmin = currentMembership && currentMembership.role === "admin";

  teamInfoGrid.innerHTML = leagueTeams.map(team => {
    const managerEmail = team.manager_email || "Unassigned";
    const ownerName = team.owner_name || "Unassigned";
    const logoUrl = team.logo_url || "";
    const roleLabel = team.is_admin ? "Admin" : "Manager";
    const adminBadge = team.is_admin
      ? `<span class="admin-badge">Admin</span>`
      : `<span class="team-role-badge">Manager</span>`;

    const logoHtml = logoUrl
      ? `<img class="team-info-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(team.team_name)} logo">`
      : `<div class="team-info-logo-placeholder">T${team.team_number}</div>`;

    const adminEditorHtml = isAdmin ? `
      <p class="small-note admin-only-editor-note">Admin editor.</p>

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
    ` : `
      <p class="small-note">Profile viewer.</p>
    `;

    const managerLine = isAdmin
      ? `<p><strong>Manager:</strong> ${escapeHtml(managerEmail)}</p>`
      : `<p><strong>Owner:</strong> ${escapeHtml(ownerName)}</p>`;

    return `
      <article class="team-info-card editable-team-card">
        <div class="team-info-top">
          <div class="team-number-badge">#${team.team_number}</div>
          ${logoHtml}
        </div>

        <div class="team-info-main">
          <h2>${escapeHtml(team.team_name)}</h2>
          ${managerLine}
          <p><strong>Record:</strong> ${escapeHtml(team.record || "0-0")}</p>
          <p><strong>Role:</strong> ${adminBadge}</p>

          <div class="team-card-actions">
            <button class="view-profile-button" data-team-id="${team.id}">
              View Profile
            </button>
          </div>

          ${adminEditorHtml}
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".view-profile-button").forEach(button => {
    button.addEventListener("click", function () {
      openLeaguemateProfile(this.dataset.teamId);
    });
  });

  document.querySelectorAll(".save-team-button").forEach(button => {
    button.addEventListener("click", function () {
      saveTeam(this.dataset.teamId);
    });
  });
}

function openLeaguemateProfile(teamId) {
  const team = leagueTeams.find(team => team.id === teamId);

  if (!team) {
    teamInfoStatus.textContent = "Could not find that team profile.";
    return;
  }

  const ownerName = team.owner_name || "Unassigned";
  const teamName = team.team_name || `Team ${team.team_number}`;
  const record = team.record || "0-0";
  const logoUrl = team.logo_url || "";
  const roleLabel = team.is_admin ? "Admin" : "Manager";
  const npcUrl = getStableNpcForTeam(team);

  const avatarHtml = npcUrl
    ? `<div class="league-profile-avatar-ring">
        <img class="league-profile-avatar" src="${escapeHtml(npcUrl)}" alt="${escapeHtml(ownerName)} profile picture">
      </div>`
    : `<div class="league-profile-avatar-ring">
        <div class="league-profile-avatar-placeholder">${escapeHtml(getInitial(ownerName || teamName))}</div>
      </div>`;

  const smallLogoHtml = logoUrl
    ? `<img class="league-profile-team-logo-small" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(teamName)} logo">`
    : "";

  const existing = document.getElementById("leagueProfileBackdrop");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "league-profile-backdrop open";
  backdrop.id = "leagueProfileBackdrop";

  backdrop.innerHTML = `
    <div class="league-profile-modal">
      <div class="league-profile-top">
        ${avatarHtml}

        <div>
          <p class="league-profile-label">Leaguemate Profile</p>
          <h2 class="league-profile-title">${escapeHtml(ownerName)}</h2>
          <p class="league-profile-owner">${escapeHtml(teamName)}</p>
          ${smallLogoHtml}
        </div>
      </div>

      <div class="league-profile-grid">
        <div class="league-profile-stat">
          <span class="league-profile-stat-value">#${escapeHtml(team.team_number || "-")}</span>
          <span class="league-profile-stat-name">Team Slot</span>
        </div>

        <div class="league-profile-stat">
          <span class="league-profile-stat-value">${escapeHtml(record)}</span>
          <span class="league-profile-stat-name">Record</span>
        </div>

        <div class="league-profile-stat">
          <span class="league-profile-stat-value">${escapeHtml(roleLabel)}</span>
          <span class="league-profile-stat-name">Role</span>
        </div>
      </div>

      <div class="league-profile-actions">
        <button class="league-profile-close" id="closeLeagueProfile">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", function (event) {
    if (event.target === backdrop) backdrop.remove();
  });

  document.getElementById("closeLeagueProfile").addEventListener("click", function () {
    backdrop.remove();
  });
}

function getStableNpcForTeam(team) {
  const seed = String(
    team.manager_email ||
    team.owner_name ||
    team.team_name ||
    team.id ||
    team.team_number ||
    "trainer"
  );

  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % LEAGUEMATE_NPC_IMAGES.length;
  return LEAGUEMATE_NPC_IMAGES[index];
}

function getInitial(value) {
  return String(value || "T").trim().charAt(0).toUpperCase() || "T";
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
