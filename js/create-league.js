const teamCountSelect = document.getElementById("teamCountSelect");
const adminTeamCheckboxes = document.getElementById("adminTeamCheckboxes");
const createLeagueButton = document.getElementById("createLeagueButton");
const createLeagueStatus = document.getElementById("createLeagueStatus");
const createdLeagueResult = document.getElementById("createdLeagueResult");

renderAdminCheckboxes();

teamCountSelect.addEventListener("change", renderAdminCheckboxes);
createLeagueButton.addEventListener("click", createLeague);

function renderAdminCheckboxes() {
  const teamCount = Number(teamCountSelect.value);

  adminTeamCheckboxes.innerHTML = "";

  for (let i = 1; i <= teamCount; i++) {
    const checked = i === 1 ? "checked" : "";

    const label = document.createElement("label");
    label.className = "admin-checkbox-item";
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

  if (!leagueName) {
    createLeagueStatus.textContent = "Enter a league name first.";
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

    teams.push({
      id: makeId(),
      league_id: leagueId,
      team_number: i,
      team_name: `Team ${i}`,
      owner_name: "Unassigned",
      record: "0-0",
      logo_url: "",
      team_passcode: passcode,
      is_admin: adminTeamNumbers.has(i)
    });
  }

  const { error: leagueError } = await supabaseClient
    .from("leagues")
    .insert({
      id: leagueId,
      league_code: leagueCode,
      name: leagueName,
      team_count: teamCount
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

  const { error: membershipError } = await supabaseClient
    .from("league_memberships")
    .insert({
      user_id: userId,
      league_id: leagueId,
      league_team_id: null,
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
    leagueId,
    leagueCode,
    leagueName,
    teamCount,
    teams
  });
}

function renderCreatedLeagueResult({ leagueCode, leagueName, teamCount, teams }) {
  createdLeagueResult.classList.remove("hidden");

  const teamRows = teams.map(team => {
    const adminBadge = team.is_admin ? `<span class="admin-badge">Admin</span>` : "";

    return `
      <tr>
        <td>${team.team_number}</td>
        <td>${escapeHtml(team.team_name)}</td>
        <td><strong>${team.team_passcode}</strong></td>
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

    <p class="small-note">
      Save these passcodes. Give each participant their team's 4-letter passcode.
      The join/login page will use the league code plus the team passcode.
    </p>

    <table class="created-teams-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>Passcode</th>
          <th>Role</th>
        </tr>
      </thead>
      <tbody>
        ${teamRows}
      </tbody>
    </table>

    <p class="small-note">${teamCount} teams created successfully.</p>

    <div style="margin-top: 18px;">
      <a href="my-leagues.html" style="color:#93c5fd; font-weight:800;">Go to My Leagues</a>
    </div>
  `;

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
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
