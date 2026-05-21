const teamInfoSubtitle = document.getElementById("teamInfoSubtitle");
const teamInfoGrid = document.getElementById("teamInfoGrid");
const teamInfoStatus = document.getElementById("teamInfoStatus");
const leagueInfoSummary = document.getElementById("leagueInfoSummary");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let currentUserId = null;
let currentUserEmail = "";
let leagueTeams = [];
let leagueDivisions = [];
let teamProfilesByEmail = new Map();

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

const PROFILE_ICON_SOURCES = {
  "achievement:pults": "images/achievement-icons/pults.webp",
  "achievement:smear-squad": "images/achievement-icons/SmearSquad.webp",
  "achievement:welcome": "images/achievement-icons/PikachuLibre.webp",
  "achievement:all-i-do-is-win": "images/achievement-icons/Champion.webp",
  "achievement:grinder": "images/achievement-icons/ZardArt.jpg",
  "achievement:meta-knight": "images/achievement-icons/MetaKnight.avif"
};

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

  await Promise.all([
    loadLeagueDivisions(),
    loadTeamProfiles()
  ]);

  renderLeagueSummary();
  renderTeams();

  const isAdmin = currentMembership.role === "admin";
  teamInfoStatus.textContent = isAdmin
    ? `${leagueTeams.length} teams loaded. Admin record editing enabled.`
    : `${leagueTeams.length} teams loaded. Select View Profile to see a leaguemate profile.`;
}

async function loadLeagueDivisions() {
  try {
    const { data, error } = await supabaseClient
      .from("league_divisions")
      .select("*")
      .eq("league_id", selectedLeagueId)
      .order("division_number", { ascending: true });

    if (error) {
      console.warn("Could not load league divisions:", error);
      leagueDivisions = [];
      return;
    }

    leagueDivisions = data || [];
  } catch (error) {
    console.warn("Could not load league divisions:", error);
    leagueDivisions = [];
  }
}

async function loadTeamProfiles() {
  const emails = [...new Set(leagueTeams
    .map(team => normalizeEmail(team.manager_email))
    .filter(Boolean))];

  teamProfilesByEmail = new Map();

  if (!emails.length) {
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("user_profiles")
      .select("email, username, avatar_data_url, default_npc_url, selected_icon_id")
      .in("email", emails);

    if (error) {
      console.warn("Could not load user profile pictures:", error);
      return;
    }

    (data || []).forEach(profile => {
      const email = normalizeEmail(profile.email);
      if (email) {
        teamProfilesByEmail.set(email, profile);
      }
    });
  } catch (error) {
    console.warn("Could not load user profile pictures:", error);
  }
}

function renderLeagueSummary() {
  if (!leagueInfoSummary) {
    return;
  }

  const assignedTeams = leagueTeams.filter(team => normalizeEmail(team.manager_email)).length;
  const profileCount = leagueTeams.filter(team => getTeamProfile(team)).length;
  const divisionCount = leagueDivisions.length || new Set(leagueTeams.map(team => team.division_id).filter(Boolean)).size;

  leagueInfoSummary.innerHTML = `
    <div class="league-info-stat">
      <span>Teams</span>
      <strong>${leagueTeams.length}</strong>
    </div>
    <div class="league-info-stat">
      <span>Managers</span>
      <strong>${assignedTeams}/${leagueTeams.length || 0}</strong>
    </div>
    <div class="league-info-stat">
      <span>Profiles</span>
      <strong>${profileCount}</strong>
    </div>
    <div class="league-info-stat">
      <span>Divisions</span>
      <strong>${divisionCount || "--"}</strong>
    </div>
  `;
}

function renderTeams() {
  const isAdmin = currentMembership && currentMembership.role === "admin";

  teamInfoGrid.innerHTML = leagueTeams.map(team => {
    const managerEmail = team.manager_email || "Unassigned";
    const profile = getTeamProfile(team);
    const ownerName = profile?.username || team.owner_name || "Unassigned";
    const logoUrl = team.logo_url || "";
    const divisionName = getDivisionName(team);
    const adminBadge = team.is_admin
      ? `<span class="admin-badge">Admin</span>`
      : `<span class="team-role-badge">Manager</span>`;

    const logoHtml = logoUrl
      ? `<img class="team-info-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(team.team_name)} logo">`
      : `<div class="team-info-logo-placeholder">T${team.team_number}</div>`;

    const avatarHtml = renderProfileAvatar(profile, team, ownerName);

    const adminEditorHtml = isAdmin ? `
      <details class="team-admin-editor">
        <summary>Team Editor</summary>
        <div class="team-edit-form">
          <div class="team-edit-field wide">
            <label>Team Name</label>
            <input id="teamName-${team.id}" type="text" value="${escapeHtml(team.team_name)}">
          </div>

          <div class="team-edit-field">
            <label>Owner Name</label>
            <input id="ownerName-${team.id}" type="text" value="${escapeHtml(ownerName)}">
          </div>

          <div class="team-edit-field">
            <label>Record</label>
            <input id="record-${team.id}" type="text" value="${escapeHtml(team.record || "0-0")}" placeholder="0-0">
          </div>

          <div class="team-edit-field wide">
            <label>Logo URL</label>
            <input id="logoUrl-${team.id}" type="text" value="${escapeHtml(logoUrl)}" placeholder="Paste image URL">
          </div>

          <button class="pkmn-button small save-team-button" data-team-id="${team.id}">
            Save Team
          </button>
        </div>
      </details>
    ` : "";

    const managerEmailHtml = isAdmin
      ? `<p class="team-manager-email">${escapeHtml(managerEmail)}</p>`
      : "";

    return `
      <article class="team-info-card editable-team-card">
        <div class="team-info-top">
          <div class="team-portrait-pair">
            ${avatarHtml}
            ${logoHtml}
          </div>

          <div class="team-info-main">
            <span class="team-card-kicker">${escapeHtml(ownerName)}</span>
            <h2>${escapeHtml(team.team_name)}</h2>
            <p class="team-owner-line">${escapeHtml(team.is_admin ? "League Admin" : "Team Manager")}</p>
            <div class="team-card-badges">
              ${adminBadge}
              <span class="division-badge">${escapeHtml(divisionName)}</span>
            </div>
          </div>
        </div>

        <div class="team-info-meta-grid">
          <div>
            <span>Record</span>
            <strong>${escapeHtml(team.record || "0-0")}</strong>
          </div>
          <div>
            <span>Division</span>
            <strong>${escapeHtml(divisionName)}</strong>
          </div>
          <div>
            <span>Profile</span>
            <strong>${profile ? "Linked" : "Default"}</strong>
          </div>
        </div>

        <div class="team-card-actions">
          <button class="view-profile-button" data-team-id="${team.id}">
            View Profile
          </button>
        </div>

        ${managerEmailHtml}
        ${adminEditorHtml}
      </article>
    `;
  }).join("");

  document.querySelectorAll(".view-profile-button").forEach(button => {
    button.addEventListener("click", function () {
      window.location.href = `leaguemate-profile.html?teamId=${encodeURIComponent(this.dataset.teamId)}`;
    });
  });

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
  await loadTeamProfiles();
  renderLeagueSummary();
  renderTeams();
}

function getTeamProfile(team) {
  return teamProfilesByEmail.get(normalizeEmail(team.manager_email)) || null;
}

function getDivisionName(team) {
  const division = leagueDivisions.find(item => item.id === team.division_id);

  if (division?.name) {
    return division.name;
  }

  return team.division_id ? "Division" : "Unassigned";
}

function renderProfileAvatar(profile, team, ownerName) {
  const src = getProfileAvatarSource(profile, team);
  const fallback = getInitial(ownerName || team.team_name);

  if (!src) {
    return `<div class="team-profile-avatar-placeholder">${escapeHtml(fallback)}</div>`;
  }

  return `
    <img
      class="team-profile-avatar"
      src="${escapeHtml(src)}"
      alt="${escapeHtml(ownerName || "Manager")} profile picture"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
    <div class="team-profile-avatar-placeholder" style="display:none;">${escapeHtml(fallback)}</div>
  `;
}

function getProfileAvatarSource(profile, team) {
  if (profile?.avatar_data_url) {
    return profile.avatar_data_url;
  }

  const selectedIconSource = getProfileIconSource(profile?.selected_icon_id);

  if (selectedIconSource) {
    return selectedIconSource;
  }

  if (profile?.default_npc_url) {
    return profile.default_npc_url;
  }

  return getStableNpcForTeam(team);
}

function getProfileIconSource(selectedIconId) {
  const normalized = normalizeProfileIconId(selectedIconId);

  if (!normalized) {
    return "";
  }

  if (PROFILE_ICON_SOURCES[normalized]) {
    return PROFILE_ICON_SOURCES[normalized];
  }

  return `images/profile-icons/${normalized}.avif`;
}

function normalizeProfileIconId(value) {
  const clean = String(value || "").trim();

  if (/^ProfilePicture([1-9]|1[0-8])$/.test(clean)) {
    return clean;
  }

  if (PROFILE_ICON_SOURCES[clean]) {
    return clean;
  }

  return "";
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

  return LEAGUEMATE_NPC_IMAGES[Math.abs(hash) % LEAGUEMATE_NPC_IMAGES.length];
}

function getInitial(value) {
  const clean = String(value || "").trim();
  return (clean.charAt(0) || "?").toUpperCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
