const myLeaguesList = document.getElementById("myLeaguesList");
const myLeaguesStatus = document.getElementById("myLeaguesStatus");
const publicLeaguesList = document.getElementById("publicLeaguesList");
const publicLeaguesStatus = document.getElementById("publicLeaguesStatus");

let activeUserId = "";
let activeUserEmail = "";
let activeDisplayName = "";
let activeMemberships = [];

loadMyLeagues();

async function loadMyLeagues() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
    myLeaguesStatus.textContent = "Could not check your account.";
    publicLeaguesStatus.textContent = "Public leagues could not be loaded.";
    return;
  }

  const session = sessionData.session;

  if (!session) {
    myLeaguesStatus.textContent = "You need to sign in first.";
    publicLeaguesStatus.textContent = "Sign in to browse public leagues.";
    myLeaguesList.innerHTML = `
      <div class="empty-state">
        <p>You are not signed in.</p>
        <div class="league-actions" style="justify-content:center;">
          <a class="pkmn-button-link small" href="sign-in.html">Sign In</a>
        </div>
      </div>
    `;
    publicLeaguesList.innerHTML = "";
    return;
  }

  activeUserId = session.user.id;
  activeUserEmail = String(session.user.email || "").toLowerCase();
  activeDisplayName = session.user.user_metadata?.display_name || activeUserEmail.split("@")[0] || "Team Manager";

  await claimEmailAssignedLeagues(activeUserId, activeUserEmail);

  const { data: memberships, error: membershipError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", activeUserId)
    .order("created_at", { ascending: true });

  if (membershipError) {
    console.error("Membership error:", membershipError);
    myLeaguesStatus.textContent = "Could not load your leagues.";
    publicLeaguesStatus.textContent = "Public leagues could not be loaded.";
    return;
  }

  activeMemberships = memberships || [];

  await renderJoinedLeagues();
  await loadPublicLeagues();
}

async function renderJoinedLeagues() {
  if (activeMemberships.length === 0) {
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

  const leagueIds = activeMemberships.map(membership => membership.league_id);
  const teamIds = activeMemberships
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

  (leagues || []).forEach(league => {
    leaguesById[league.id] = league;
  });

  teams.forEach(team => {
    teamsById[team.id] = team;
  });

  myLeaguesList.innerHTML = activeMemberships.map(membership => {
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
        ${league.is_public ? `<span class="public-league-badge">Public</span>` : ""}
        <p><strong>League Code:</strong> ${escapeHtml(league.league_code)}</p>
        <p><strong>Teams:</strong> ${league.team_count}</p>
        <p><strong>Playoff Teams:</strong> ${league.playoff_team_count || getDefaultPlayoffTeamCount(league.team_count)}</p>
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

  bindSelectLeagueButtons();
  myLeaguesStatus.textContent = `${activeMemberships.length}/3 leagues used.`;
}

async function loadPublicLeagues() {
  publicLeaguesStatus.textContent = "Loading public leagues...";

  const joinedLeagueIds = new Set(activeMemberships.map(membership => membership.league_id));
  const { data: leagues, error: publicError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(24);

  if (publicError) {
    console.error("Public leagues error:", publicError);
    publicLeaguesStatus.textContent = "Could not load public leagues.";
    return;
  }

  const visibleLeagues = (leagues || []).filter(league => !joinedLeagueIds.has(league.id));

  if (visibleLeagues.length === 0) {
    publicLeaguesList.innerHTML = `
      <div class="empty-state">
        <p>No public leagues with open invites yet.</p>
      </div>
    `;
    publicLeaguesStatus.textContent = "0 public leagues available.";
    return;
  }

  const leagueIds = visibleLeagues.map(league => league.id);
  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .in("league_id", leagueIds)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Public league team error:", teamsError);
    publicLeaguesStatus.textContent = "Could not load public league team slots.";
    return;
  }

  const teamsByLeagueId = groupBy(teams || [], "league_id");

  publicLeaguesList.innerHTML = visibleLeagues.map(league => {
    const leagueTeams = teamsByLeagueId[league.id] || [];
    const openTeamCount = leagueTeams.filter(team => !hasManagerEmail(team)).length;
    const canJoin = activeMemberships.length < 3 && openTeamCount > 0;
    const disabledLabel = activeMemberships.length >= 3
      ? "Max Leagues Reached"
      : "League Full";

    return `
      <div class="pkmn-card public-league-card">
        <h2>${escapeHtml(league.name)}</h2>
        <span class="public-league-badge">Public</span>
        ${league.discord_url ? `<a class="discord-link" href="${escapeHtml(league.discord_url)}" target="_blank" rel="noopener">Discord</a>` : ""}

        <p class="public-league-description">
          ${escapeHtml(league.public_description || "No description posted yet.")}
        </p>

        <div class="public-league-meta">
          <div class="public-league-stat">
            <span>Open Teams</span>
            <strong>${openTeamCount}/${league.team_count || leagueTeams.length}</strong>
          </div>
          <div class="public-league-stat">
            <span>Playoffs</span>
            <strong>${league.playoff_team_count || getDefaultPlayoffTeamCount(league.team_count)}</strong>
          </div>
          <div class="public-league-stat">
            <span>Matches</span>
            <strong>${league.regular_season_matches || 10}</strong>
          </div>
          <div class="public-league-stat">
            <span>Point Cap</span>
            <strong>${league.roster_point_cap || 50}</strong>
          </div>
        </div>

        <div class="league-actions">
          <button
            data-league-id="${league.id}"
            class="join-public-league-button"
            ${canJoin ? "" : "disabled"}>
            ${canJoin ? "Join League" : disabledLabel}
          </button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".join-public-league-button").forEach(button => {
    button.addEventListener("click", function () {
      joinPublicLeague(this.dataset.leagueId);
    });
  });

  publicLeaguesStatus.textContent = `${visibleLeagues.length} public ${pluralize("league", visibleLeagues.length)} available.`;
}

async function joinPublicLeague(leagueId) {
  if (activeMemberships.length >= 3) {
    publicLeaguesStatus.textContent = "You are already in 3 leagues. That is the current maximum.";
    return;
  }

  publicLeaguesStatus.textContent = "Joining public league...";

  const { data: existingMemberships, error: membershipCheckError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", activeUserId);

  if (membershipCheckError) {
    console.error("Membership check error:", membershipCheckError);
    publicLeaguesStatus.textContent = "Could not check your current leagues.";
    return;
  }

  if ((existingMemberships || []).some(membership => membership.league_id === leagueId)) {
    publicLeaguesStatus.textContent = "You already joined this league.";
    await loadMyLeagues();
    return;
  }

  if ((existingMemberships || []).length >= 3) {
    publicLeaguesStatus.textContent = "You are already in 3 leagues. That is the current maximum.";
    return;
  }

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .eq("is_public", true)
    .maybeSingle();

  if (leagueError || !league) {
    console.error("Public league lookup error:", leagueError);
    publicLeaguesStatus.textContent = "This public league is no longer available.";
    return;
  }

  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", leagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Open team lookup error:", teamsError);
    publicLeaguesStatus.textContent = "Could not find an open team for this league.";
    return;
  }

  const openTeam = (teams || []).find(team => !hasManagerEmail(team));

  if (!openTeam) {
    publicLeaguesStatus.textContent = "This league is full.";
    await loadPublicLeagues();
    return;
  }

  const { data: claimedTeam, error: claimError } = await supabaseClient
    .from("league_teams")
    .update({
      owner_name: activeDisplayName,
      manager_email: activeUserEmail
    })
    .eq("id", openTeam.id)
    .eq("league_id", leagueId)
    .or("manager_email.is.null,manager_email.eq.")
    .select("*")
    .maybeSingle();

  if (claimError || !claimedTeam) {
    console.error("Public team claim error:", claimError);
    publicLeaguesStatus.textContent = "That team was just claimed. Try another league slot.";
    await loadPublicLeagues();
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("league_memberships")
    .insert({
      user_id: activeUserId,
      league_id: leagueId,
      league_team_id: claimedTeam.id,
      role: claimedTeam.is_admin ? "admin" : "team_manager"
    });

  if (insertError) {
    console.error("Public league membership error:", insertError);
    await supabaseClient
      .from("league_teams")
      .update({
        owner_name: "Unassigned",
        manager_email: null
      })
      .eq("id", claimedTeam.id)
      .eq("manager_email", activeUserEmail);

    publicLeaguesStatus.textContent = "Could not join this league. Please try again.";
    return;
  }

  localStorage.setItem("selected-league-id", league.id);
  localStorage.setItem("selected-league-code", league.league_code);
  localStorage.setItem("selected-league-team-id", claimedTeam.id);
  localStorage.setItem("selected-league-role", claimedTeam.is_admin ? "admin" : "team_manager");

  publicLeaguesStatus.textContent = "League joined. Loading...";
  window.location.href = "league-home.html";
}

function bindSelectLeagueButtons() {
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

function hasManagerEmail(team) {
  return Boolean(String(team.manager_email || "").trim());
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const groupKey = item[key];
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(item);
    return groups;
  }, {});
}

function getDefaultPlayoffTeamCount(teamCount) {
  if (teamCount >= 10) return 6;
  if (teamCount >= 4) return 4;
  return 2;
}

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
