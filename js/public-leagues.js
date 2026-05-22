const publicLeaguesList = document.getElementById("publicLeaguesList");
const publicLeaguesStatus = document.getElementById("publicLeaguesStatus");
const publicLeagueSearch = document.getElementById("publicLeagueSearch");
const publicLeagueSort = document.getElementById("publicLeagueSort");

let activeUserId = "";
let activeUserEmail = "";
let activeDisplayName = "";
let activeMemberships = [];
let publicLeagueCards = [];

loadPublicLeagueDirectory();

publicLeagueSearch.addEventListener("input", renderPublicLeagueDirectory);
publicLeagueSort.addEventListener("change", renderPublicLeagueDirectory);

async function loadPublicLeagueDirectory() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
    publicLeaguesStatus.textContent = "Could not check your account.";
    return;
  }

  const session = sessionData.session;

  if (!session) {
    publicLeagueCards = [];
    publicLeaguesList.innerHTML = `
      <div class="public-empty-state">
        <p>Sign in to browse public leagues and claim an open team.</p>
        <a class="public-empty-link" href="sign-in.html">Sign In</a>
      </div>
    `;
    publicLeaguesStatus.textContent = "Sign in required.";
    return;
  }

  activeUserId = session.user.id;
  activeUserEmail = String(session.user.email || "").toLowerCase();
  activeDisplayName = session.user.user_metadata?.display_name || activeUserEmail.split("@")[0] || "Team Manager";

  const { data: memberships, error: membershipError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", activeUserId)
    .order("created_at", { ascending: true });

  if (membershipError) {
    console.error("Membership error:", membershipError);
    publicLeaguesStatus.textContent = "Could not load your league memberships.";
    return;
  }

  activeMemberships = memberships || [];

  const { data: leagues, error: leaguesError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(48);

  if (leaguesError) {
    console.error("Public leagues error:", leaguesError);
    publicLeaguesStatus.textContent = "Could not load public leagues.";
    return;
  }

  const joinedLeagueIds = new Set(activeMemberships.map(membership => membership.league_id));
  const visibleLeagues = (leagues || []).filter(league => !joinedLeagueIds.has(league.id));

  if (visibleLeagues.length === 0) {
    publicLeagueCards = [];
    renderPublicLeagueDirectory();
    return;
  }

  const leagueIds = visibleLeagues.map(league => league.id);
  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .in("league_id", leagueIds)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Public league teams error:", teamsError);
    publicLeaguesStatus.textContent = "Could not load public league team slots.";
    return;
  }

  const teamsByLeagueId = groupBy(teams || [], "league_id");

  publicLeagueCards = visibleLeagues.map(league => {
    const leagueTeams = teamsByLeagueId[league.id] || [];
    const openTeams = leagueTeams.filter(team => !hasManagerEmail(team));

    return {
      league,
      teams: leagueTeams,
      openTeamCount: openTeams.length,
      searchText: [
        league.name,
        league.public_description,
        league.discord_url,
        league.team_count,
        league.playoff_team_count
      ].join(" ").toLowerCase()
    };
  });

  renderPublicLeagueDirectory();
}

function renderPublicLeagueDirectory() {
  const searchText = publicLeagueSearch.value.trim().toLowerCase();
  const sortMode = publicLeagueSort.value;
  let cards = publicLeagueCards.filter(card => !searchText || card.searchText.includes(searchText));

  cards = cards.slice().sort((a, b) => {
    if (sortMode === "open") {
      return b.openTeamCount - a.openTeamCount || compareNewest(a.league, b.league);
    }

    if (sortMode === "name") {
      return String(a.league.name || "").localeCompare(String(b.league.name || ""));
    }

    return compareNewest(a.league, b.league);
  });

  if (cards.length === 0) {
    const emptyText = publicLeagueCards.length === 0
      ? "No public leagues are posted yet."
      : "No public leagues match that search.";

    publicLeaguesList.innerHTML = `
      <div class="public-empty-state">
        <p>${emptyText}</p>
        <a class="public-empty-link" href="create-league.html?v=create-league-public1">Create League</a>
      </div>
    `;
    publicLeaguesStatus.textContent = publicLeagueCards.length === 0
      ? "0 public leagues available."
      : "No matching public leagues.";
    return;
  }

  publicLeaguesList.innerHTML = cards.map(renderPublicLeagueCard).join("");

  document.querySelectorAll(".public-join-button").forEach(button => {
    button.addEventListener("click", function () {
      joinPublicLeague(this.dataset.leagueId);
    });
  });

  publicLeaguesStatus.textContent = `${cards.length} public ${pluralize("league", cards.length)} shown.`;
}

function renderPublicLeagueCard(card) {
  const { league, teams, openTeamCount } = card;
  const canJoin = activeMemberships.length < 3 && openTeamCount > 0;
  const disabledLabel = activeMemberships.length >= 3 ? "Max Leagues Reached" : "League Full";
  const teamCount = league.team_count || teams.length;
  const playoffCount = league.playoff_team_count || getDefaultPlayoffTeamCount(teamCount);
  const description = league.public_description || "No description posted yet.";

  return `
    <article class="public-league-card">
      <div class="public-card-top">
        <div>
          <h2 class="public-league-name">${escapeHtml(league.name)}</h2>
        </div>

        <div class="public-league-badges">
          <span class="public-pill open">${openTeamCount} Open</span>
          ${league.discord_url ? `<a class="public-discord-link" href="${escapeHtml(league.discord_url)}" target="_blank" rel="noopener">Discord</a>` : ""}
        </div>
      </div>

      <p class="public-description">${escapeHtml(description)}</p>

      <div class="public-meta-grid">
        <div class="public-meta-item">
          <span>Teams</span>
          <strong>${teamCount}</strong>
        </div>
        <div class="public-meta-item">
          <span>Playoffs</span>
          <strong>${playoffCount}</strong>
        </div>
        <div class="public-meta-item">
          <span>Matches</span>
          <strong>${league.regular_season_matches || 10}</strong>
        </div>
        <div class="public-meta-item">
          <span>Point Cap</span>
          <strong>${league.roster_point_cap || 50}</strong>
        </div>
      </div>

      <div class="public-card-actions">
        <p class="public-card-note">${openTeamCount > 0 ? "Joining claims the next open team." : "All teams are currently claimed."}</p>
        <button
          class="public-join-button"
          data-league-id="${league.id}"
          ${canJoin ? "" : "disabled"}>
          ${canJoin ? "Join League" : disabledLabel}
        </button>
      </div>
    </article>
  `;
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
    await loadPublicLeagueDirectory();
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
    await loadPublicLeagueDirectory();
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
    await loadPublicLeagueDirectory();
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

function compareNewest(a, b) {
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
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
