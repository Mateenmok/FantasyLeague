const myLeaguesList = document.getElementById("myLeaguesList");
const myLeaguesStatus = document.getElementById("myLeaguesStatus");

loadMyLeagues();

async function loadMyLeagues() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
    myLeaguesStatus.textContent = "Could not check your account.";
    return;
  }

  const session = sessionData.session;

  if (!session) {
    myLeaguesStatus.textContent = "You need to sign in first.";
    myLeaguesList.innerHTML = `
      <div class="empty-state">
        <p>You are not signed in.</p>
        <div class="league-actions" style="justify-content:center;">
          <a class="pkmn-button-link small" href="sign-in.html">Sign In</a>
        </div>
      </div>
    `;
    return;
  }

  const userId = session.user.id;
  const userEmail = session.user.email.toLowerCase();

  await claimEmailAssignedLeagues(userId, userEmail);

  const { data: memberships, error: membershipError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (membershipError) {
    console.error("Membership error:", membershipError);
    myLeaguesStatus.textContent = "Could not load your leagues.";
    return;
  }

  if (!memberships || memberships.length === 0) {
    myLeaguesStatus.textContent = "0/3 leagues used.";
    myLeaguesList.innerHTML = `
      <div class="empty-state">
        <p>You are not in any leagues yet.</p>
        <div class="league-actions" style="justify-content:center;">
          <a class="pkmn-button-link small" href="create-league.html">Create Your First League</a>
        </div>
      </div>
    `;
    return;
  }

  const leagueIds = memberships.map(membership => membership.league_id);
  const teamIds = memberships
    .map(membership => membership.league_team_id)
    .filter(Boolean);

  const { data: leagues, error: leaguesError } = await supabaseClient
    .from("leagues")
    .select("*")
    .in("id", leagueIds);

  if (leaguesError) {
    console.error("Leagues error:", leaguesError);
    myLeaguesStatus.textContent = "Could not load league details.";
    return;
  }

  let teams = [];

  if (teamIds.length > 0) {
    const { data: teamData, error: teamError } = await supabaseClient
      .from("league_teams")
      .select("*")
      .in("id", teamIds);

    if (teamError) {
      console.error("Team details error:", teamError);
    } else {
      teams = teamData || [];
    }
  }

  const leaguesById = {};
  const teamsById = {};

  leagues.forEach(league => {
    leaguesById[league.id] = league;
  });

  teams.forEach(team => {
    teamsById[team.id] = team;
  });

  myLeaguesList.innerHTML = memberships.map(membership => {
    const league = leaguesById[membership.league_id];

    if (!league) {
      return "";
    }

    const team = membership.league_team_id ? teamsById[membership.league_team_id] : null;
    const roleLabel = membership.role === "admin" ? "League Admin" : "Team Manager";
    const teamLabel = team ? `${team.team_name} (#${team.team_number})` : "League Admin";

    return `
      <div class="pkmn-card">
        <h2>${escapeHtml(league.name)}</h2>
        <p><strong>League Code:</strong> ${escapeHtml(league.league_code)}</p>
        <p><strong>Teams:</strong> ${league.team_count}</p>
        <p><strong>Playoff Teams:</strong> ${league.team_count / 2}</p>
        <p><strong>Matches Before Playoffs:</strong> ${league.regular_season_matches || 10}</p>
        <p><strong>Roster Point Cap:</strong> ${league.roster_point_cap || 50}</p>
        <p><strong>Your Team:</strong> ${escapeHtml(teamLabel)}</p>
        <p><strong>Role:</strong> ${roleLabel}</p>

        <div class="league-actions">
          <button
            data-league-id="${league.id}"
            data-league-code="${league.league_code}"
            data-league-team-id="${membership.league_team_id || ""}"
            data-role="${membership.role}"
            class="pkmn-button small select-league-button">
            Select League
          </button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".select-league-button").forEach(button => {
    button.addEventListener("click", function () {
      localStorage.setItem("selected-league-id", this.dataset.leagueId);
      localStorage.setItem("selected-league-code", this.dataset.leagueCode);
      localStorage.setItem("selected-league-team-id", this.dataset.leagueTeamId || "");
      localStorage.setItem("selected-league-role", this.dataset.role || "");

      myLeaguesStatus.textContent = "League selected. Loading...";
      window.location.href = "league-home.html";
    });
  });

  myLeaguesStatus.textContent = `${memberships.length}/3 leagues used.`;
}

async function claimEmailAssignedLeagues(userId, userEmail) {
  const { data: existingMemberships, error: existingError } = await supabaseClient
    .from("league_memberships")
    .select("league_id")
    .eq("user_id", userId);

  if (existingError) {
    console.error("Existing membership check error:", existingError);
    return;
  }

  if (existingMemberships.length >= 3) {
    return;
  }

  const existingLeagueIds = new Set(existingMemberships.map(membership => membership.league_id));

  const { data: assignedTeams, error: assignedError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("manager_email", userEmail);

  if (assignedError) {
    console.error("Assigned teams check error:", assignedError);
    return;
  }

  const membershipsToCreate = [];

  for (const team of assignedTeams || []) {
    if (existingLeagueIds.has(team.league_id)) {
      continue;
    }

    if (existingMemberships.length + membershipsToCreate.length >= 3) {
      break;
    }

    membershipsToCreate.push({
      user_id: userId,
      league_id: team.league_id,
      league_team_id: team.id,
      role: team.is_admin ? "admin" : "team_manager"
    });
  }

  if (membershipsToCreate.length === 0) {
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("league_memberships")
    .insert(membershipsToCreate);

  if (insertError) {
    console.error("Claim assigned leagues error:", insertError);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
