const myMatchupSubtitle = document.getElementById("myMatchupSubtitle");
const myMatchupContent = document.getElementById("myMatchupContent");
const myMatchupStatus = document.getElementById("myMatchupStatus");

const selectedLeagueId = localStorage.getItem("selected-league-id");

let currentLeague = null;
let currentMembership = null;
let myTeam = null;
let opponentTeam = null;
let currentMatchup = null;

loadMyMatchupPage();

async function loadMyMatchupPage() {
  if (!selectedLeagueId) {
    myMatchupSubtitle.textContent = "No league selected.";
    myMatchupStatus.textContent = "Go to My Leagues and select a league first.";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    myMatchupSubtitle.textContent = "Not signed in.";
    myMatchupStatus.textContent = "Sign in before viewing your matchup.";
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
    myMatchupSubtitle.textContent = "No access.";
    myMatchupStatus.textContent = "You are not a member of this league.";
    return;
  }

  currentMembership = membership;

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    myMatchupSubtitle.textContent = "Could not load league.";
    myMatchupStatus.textContent = "Try selecting the league again.";
    return;
  }

  currentLeague = league;
  myMatchupSubtitle.textContent = league.name;

  if (!currentMembership.league_team_id) {
    myMatchupContent.innerHTML = `
      <div class="empty-state">
        <p>Your account is not assigned to a specific team in this league.</p>
        <p>If you are an admin, assign yourself to a team from Manage League.</p>
      </div>
    `;
    myMatchupStatus.textContent = "No team assigned.";
    return;
  }

  await loadMatchupData();
  renderMyMatchup();
}

async function loadMatchupData() {
  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId);

  if (teamsError) {
    console.error("Teams error:", teamsError);
    myMatchupStatus.textContent = "Could not load teams.";
    return;
  }

  myTeam = teams.find(team => team.id === currentMembership.league_team_id);

  if (!myTeam) {
    myMatchupStatus.textContent = "Could not find your assigned team.";
    return;
  }

  const matchupNumber = currentLeague.current_matchup_number || 1;

  const { data: matchups, error: matchupsError } = await supabaseClient
    .from("league_matchups")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("phase", "regular")
    .eq("matchup_number", matchupNumber);

  if (matchupsError) {
    console.error("Matchups error:", matchupsError);
    myMatchupStatus.textContent = "Could not load matchups.";
    return;
  }

  currentMatchup = (matchups || []).find(matchup =>
    matchup.team1_id === myTeam.id || matchup.team2_id === myTeam.id
  );

  if (!currentMatchup) {
    return;
  }

  const opponentId = currentMatchup.team1_id === myTeam.id
    ? currentMatchup.team2_id
    : currentMatchup.team1_id;

  opponentTeam = teams.find(team => team.id === opponentId);
}

function renderMyMatchup() {
  if (!currentLeague.schedule_generated) {
    myMatchupContent.innerHTML = `
      <div class="empty-state">
        <p>No schedule has been generated yet.</p>
      </div>
    `;
    myMatchupStatus.textContent = "Waiting for schedule.";
    return;
  }

  if (!currentMatchup || !opponentTeam) {
    myMatchupContent.innerHTML = `
      <div class="empty-state">
        <p>No matchup found for your team this round.</p>
      </div>
    `;
    myMatchupStatus.textContent = "No current matchup.";
    return;
  }

  const matchupNumber = currentLeague.current_matchup_number || 1;
  const isTeam1 = currentMatchup.team1_id === myTeam.id;

  const myScore = isTeam1 ? currentMatchup.team1_score : currentMatchup.team2_score;
  const opponentScore = isTeam1 ? currentMatchup.team2_score : currentMatchup.team1_score;

  const scoreText = currentMatchup.completed
    ? `${myScore} - ${opponentScore}`
    : "Score not reported";

  myMatchupContent.innerHTML = `
    <section class="my-matchup-feature">
      <div class="my-matchup-round-label">
        Matchup ${matchupNumber}
      </div>

      <div class="my-matchup-teams">
        ${renderFeaturedTeam(myTeam, "Your Team")}

        <div class="my-matchup-score-box">
          <div class="my-matchup-score">${escapeHtml(scoreText)}</div>
          <div class="my-matchup-vs">VS</div>
          <div class="my-matchup-status">${currentMatchup.completed ? "Final" : "Pending"}</div>
        </div>

        ${renderFeaturedTeam(opponentTeam, "Opponent")}
      </div>
    </section>
  `;

  myMatchupStatus.textContent = currentMatchup.completed
    ? "This matchup has been reported."
    : "This matchup is waiting for scores.";
}

function renderFeaturedTeam(team, label) {
  const logoHtml = team.logo_url
    ? `<img class="my-matchup-logo" src="${escapeHtml(team.logo_url)}" alt="${escapeHtml(team.team_name)} logo">`
    : `<div class="my-matchup-logo-placeholder">T${team.team_number}</div>`;

  return `
    <div class="my-matchup-team-card">
      <div class="my-matchup-label">${label}</div>
      ${logoHtml}
      <h2>${escapeHtml(team.team_name)}</h2>
      <p>${formatTeamRecord(team)}</p>
      <p>${escapeHtml(team.owner_name || "Unassigned")}</p>
    </div>
  `;
}

function formatTeamRecord(team) {
  const wins = Number(team.wins ?? 0);
  const losses = Number(team.losses ?? 0);
  const ties = Number(team.ties ?? 0);

  return `${wins}-${losses}-${ties}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
