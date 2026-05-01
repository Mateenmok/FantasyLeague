const teamCountSelect = document.getElementById("teamCountSelect");
const pointCapInput = document.getElementById("pointCapInput");
const regularSeasonMatchesSelect = document.getElementById("regularSeasonMatchesSelect");
const leagueSettingsPreview = document.getElementById("leagueSettingsPreview");
const teamEmailAssignments = document.getElementById("teamEmailAssignments");
const adminTeamCheckboxes = document.getElementById("adminTeamCheckboxes");
const createLeagueButton = document.getElementById("createLeagueButton");
const createLeagueStatus = document.getElementById("createLeagueStatus");
const createdLeagueResult = document.getElementById("createdLeagueResult");

renderAdminCheckboxes();
renderTeamEmailAssignments();
updateLeagueSettingsPreview();

teamCountSelect.addEventListener("change", function () {
  renderAdminCheckboxes();
  renderTeamEmailAssignments();
  updateLeagueSettingsPreview();
});

pointCapInput.addEventListener("input", updateLeagueSettingsPreview);
regularSeasonMatchesSelect.addEventListener("change", updateLeagueSettingsPreview);
createLeagueButton.addEventListener("click", createLeague);

function updateLeagueSettingsPreview() {
  const teamCount = Number(teamCountSelect.value);
  const playoffTeams = teamCount / 2;
  const pointCap = Number(pointCapInput.value || 50);
  const regularSeasonMatches = Number(regularSeasonMatchesSelect.value);

  leagueSettingsPreview.textContent =
    `${teamCount} teams • ${playoffTeams} playoff teams • ${regularSeasonMatches} regular season matches • ${pointCap} roster points`;
}

function renderTeamEmailAssignments() {
  const teamCount = Number(teamCountSelect.value);
  teamEmailAssignments.innerHTML = "";

  for (let i = 1; i <= teamCount; i++) {
    const row = document.createElement("div");
    row.className = "team-email-row";
    row.innerHTML = `
      <span>Team ${i}</span>
      <input id="teamEmail-${i}" type="email" placeholder="manager@email.com">
    `;

    teamEmailAssignments.appendChild(row);
  }
}

function renderAdminCheckboxes() {
  const teamCount = Number(teamCountSelect.value);
  adminTeamCheckboxes.innerHTML = "";

  for (let i = 1; i <= teamCount; i++) {
    const checked = i === 1 ? "checked" : "";

    const label = document.createElement("label");
    label.className = "pkmn-checkbox-item";
    label.innerHTML = `
      <input type="checkbox" value="${i}" ${checked}>
      Team ${i}
    `;

    adminTeamCheckboxes.appendChild(label);
  }
}

async function createLeague() {
  const leagueName = document.getElementById("leagueNameInput").value.trim();
  const teamCount = Number(teamCountSelect.value);
  const rosterPointCap = Number(pointCapInput.value);
  const regularSeasonMatches = Number(regularSeasonMatchesSelect.value);
  const teamEmails = getTeamEmailAssignments();

  if (!leagueName) {
    createLeagueStatus.textContent = "Enter a league name first.";
    return;
  }

  if (![8, 10, 12, 14, 16].includes(teamCount)) {
    createLeagueStatus.textContent = "League entrants must be 8, 10, 12, 14, or 16.";
    return;
  }

  if (!rosterPointCap || rosterPointCap < 1 || rosterPointCap > 999) {
    createLeagueStatus.textContent = "Roster point cap must be between 1 and 999.";
    return;
  }

  if (regularSeasonMatches < 6 || regularSeasonMatches > 12) {
    createLeagueStatus.textContent = "Matches before playoffs must be between 6 and 12.";
    return;
  }

  const duplicateEmail = findDuplicateEmail(teamEmails);

  if (duplicateEmail) {
    createLeagueStatus.textContent = `The email ${duplicateEmail} is assigned to more than one team.`;
    return;
  }

  createLeagueButton.disabled = true;
  createLeagueStatus.textContent = "Checking account...";

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
    createLeagueStatus.textContent = "Could not check account status.";
    createLeagueButton.disabled = false;
    return;
  }

  const session = sessionData.session;

  if (!session) {
    createLeagueStatus.textContent = "You need to sign in before creating a league.";
    createLeagueButton.disabled = false;
    return;
  }

  const userId = session.user.id;
  const userEmail = session.user.email.toLowerCase();
  const displayName = session.user.user_metadata?.display_name || session.user.email;

  const { data: existingMemberships, error: membershipCountError } = await supabaseClient
    .from("league_memberships")
    .select("id")
    .eq("user_id", userId);

  if (membershipCountError) {
    console.error("Membership count error:", membershipCountError);
    createLeagueStatus.textContent = "Could not check your current leagues.";
    createLeagueButton.disabled = false;
    return;
  }

  if (existingMemberships.length >= 3) {
    createLeagueStatus.textContent = "You are already in 3 leagues. That is the current maximum.";
    createLeagueButton.disabled = false;
    return;
  }

  createLeagueStatus.textContent = "Creating league...";

  const leagueId = makeId();
  const leagueCode = generateLeagueCode();
  const adminTeamNumbers = getAdminTeamNumbers();
  const usedPasscodes = new Set();
  const teams = [];

  for (let i = 1; i <= teamCount; i++) {
    const passcode = generateUniquePasscode(usedPasscodes);
    const managerEmail = teamEmails.get(i) || (i === 1 ? userEmail : null);
    const ownerName = managerEmail === userEmail ? displayName : "Unassigned";

    teams.push({
      id: makeId(),
      league_id: leagueId,
      team_number: i,
      team_name: `Team ${i}`,
      owner_name: ownerName,
      record: "0-0",
      logo_url: "",
      team_passcode: passcode,
      manager_email: managerEmail,
      is_admin: adminTeamNumbers.has(i)
    });
  }

  const { error: leagueError } = await supabaseClient
    .from("leagues")
    .insert({
      id: leagueId,
      league_code: leagueCode,
      name: leagueName,
      team_count: teamCount,
      roster_point_cap: rosterPointCap,
      regular_season_matches: regularSeasonMatches
    });

  if (leagueError) {
    console.error("Error creating league:", leagueError);
    createLeagueStatus.textContent = "Error creating league. Check the console.";
    createLeagueButton.disabled = false;
    return;
  }

  const { error: teamsError } = await supabaseClient
    .from("league_teams")
    .insert(teams);

  if (teamsError) {
    console.error("Error creating teams:", teamsError);
    createLeagueStatus.textContent = "League was created, but team creation failed. Check the console.";
    createLeagueButton.disabled = false;
    return;
  }

  const creatorAssignedTeam = teams.find(team => team.manager_email === userEmail);

  const { error: membershipError } = await supabaseClient
    .from("league_memberships")
    .insert({
      user_id: userId,
      league_id: leagueId,
      league_team_id: creatorAssignedTeam ? creatorAssignedTeam.id : null,
      role: "admin"
    });

  if (membershipError) {
    console.error("Error creating league membership:", membershipError);
    createLeagueStatus.textContent = "League was created, but account linking failed. Check the console.";
    createLeagueButton.disabled = false;
    return;
  }

  localStorage.setItem("selected-league-id", leagueId);
  localStorage.setItem("selected-league-code", leagueCode);

  createLeagueStatus.textContent = "League created.";
  createLeagueButton.disabled = false;

  renderCreatedLeagueResult({
    leagueCode,
    leagueName,
    teamCount,
    rosterPointCap,
    regularSeasonMatches,
    teams
  });
}

function renderCreatedLeagueResult({
  leagueCode,
  leagueName,
  teamCount,
  rosterPointCap,
  regularSeasonMatches,
  teams
}) {
  createdLeagueResult.classList.remove("hidden");

  const playoffTeams = teamCount / 2;

  const teamRows = teams.map(team => {
    const adminBadge = team.is_admin ? `<span class="admin-badge">Admin</span>` : "";
    const email = team.manager_email || "Unassigned";

    return `
      <tr>
        <td>${team.team_number}</td>
        <td>${escapeHtml(team.team_name)}</td>
        <td>${escapeHtml(email)}</td>
        <td>${adminBadge}</td>
      </tr>
    `;
  }).join("");

  createdLeagueResult.innerHTML = `
    <p class="create-league-eyebrow">League Created</p>
    <h2>${escapeHtml(leagueName)}</h2>

    <div class="league-code-box">
      <span>League Code</span>
      <strong>${leagueCode}</strong>
    </div>

    <div class="pkmn-panel">
      <p><strong>League Settings</strong></p>
      <p>${teamCount} teams</p>
      <p>${playoffTeams} playoff teams</p>
      <p>${regularSeasonMatches} matches before playoffs</p>
      <p>${rosterPointCap} roster points maximum</p>
    </div>

    <p class="small-note">
      Participants assigned by email will see this league in My Leagues after they sign in.
    </p>

    <table class="created-teams-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>Manager Email</th>
          <th>Role</th>
        </tr>
      </thead>
      <tbody>
        ${teamRows}
      </tbody>
    </table>

    <p class="small-note">${teamCount} teams created successfully.</p>

    <div style="margin-top: 18px;">
      <a href="my-leagues.html" style="color:#222; font-weight:800;">Go to My Leagues</a>
    </div>
  `;

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
}

function getTeamEmailAssignments() {
  const teamCount = Number(teamCountSelect.value);
  const assignments = new Map();

  for (let i = 1; i <= teamCount; i++) {
    const input = document.getElementById(`teamEmail-${i}`);
    const value = input.value.trim().toLowerCase();

    if (value) {
      assignments.set(i, value);
    }
  }

  return assignments;
}

function findDuplicateEmail(teamEmails) {
  const seen = new Set();

  for (const email of teamEmails.values()) {
    if (seen.has(email)) {
      return email;
    }

    seen.add(email);
  }

  return null;
}

function getAdminTeamNumbers() {
  const checkedInputs = adminTeamCheckboxes.querySelectorAll("input:checked");
  const adminNumbers = new Set();

  checkedInputs.forEach(input => {
    adminNumbers.add(Number(input.value));
  });

  return adminNumbers;
}

function makeId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generateLeagueCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function generateUniquePasscode(usedPasscodes) {
  let passcode = generatePasscode();

  while (usedPasscodes.has(passcode)) {
    passcode = generatePasscode();
  }

  usedPasscodes.add(passcode);
  return passcode;
}

function generatePasscode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";

  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  return code;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
