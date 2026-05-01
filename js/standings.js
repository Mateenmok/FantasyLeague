const standingsSubtitle = document.getElementById("standingsSubtitle");
const standingsContent = document.getElementById("standingsContent");
const standingsStatus = document.getElementById("standingsStatus");

const selectedLeagueId = localStorage.getItem("selected-league-id");

loadStandingsPage();

async function loadStandingsPage() {
  if (!selectedLeagueId) {
    standingsSubtitle.textContent = "No league selected.";
    standingsStatus.textContent = "Go to My Leagues and select a league first.";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    standingsSubtitle.textContent = "Not signed in.";
    standingsStatus.textContent = "Sign in before viewing standings.";
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
    standingsSubtitle.textContent = "No access.";
    standingsStatus.textContent = "You are not a member of this league.";
    return;
  }

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    standingsSubtitle.textContent = "Could not load league.";
    standingsStatus.textContent = "Try selecting the league again.";
    return;
  }

  standingsSubtitle.textContent = league.name;

  const { data: divisions, error: divisionsError } = await supabaseClient
    .from("league_divisions")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("division_number", { ascending: true });

  if (divisionsError) {
    console.error("Divisions error:", divisionsError);
    standingsStatus.textContent = "Could not load divisions.";
    return;
  }

  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
    standingsStatus.textContent = "Could not load teams.";
    return;
  }

  renderStandings(divisions || [], teams || []);
}

function renderStandings(divisions, teams) {
  if (!teams.length) {
    standingsContent.innerHTML = `
      <div class="empty-state">
        <p>No teams found for this league.</p>
      </div>
    `;
    standingsStatus.textContent = "No teams found.";
    return;
  }

  const divisionsToRender = divisions.length
    ? divisions
    : [{ id: "unassigned", name: "League Standings", division_number: 1 }];

  standingsContent.innerHTML = divisionsToRender.map(division => {
    const divisionTeams = teams
      .filter(team => {
        if (division.id === "unassigned") {
          return true;
        }

        return team.division_id === division.id;
      })
      .map(team => {
        const record = parseRecord(team.record);

        const wins = Number(team.wins ?? record.wins ?? 0);
        const losses = Number(team.losses ?? record.losses ?? 0);
        const ties = Number(team.ties ?? record.ties ?? 0);
        const gamesWon = Number(team.games_won ?? 0);

        return {
          ...team,
          wins,
          losses,
          ties,
          gamesWon,
          winningPercentage: getWinningPercentage(wins, losses, ties)
        };
      })
      .sort(sortTeams);

    if (divisionTeams.length === 0) {
      return `
        <section class="standings-board">
          <div class="standings-division-title">
            ${escapeHtml(division.name)}
          </div>

          <div class="empty-state">
            <p>No teams assigned to this division.</p>
          </div>
        </section>
      `;
    }

    const leader = divisionTeams[0];

    const rows = divisionTeams.map((team, index) => {
      const gamesBack = calculateGamesBack(leader, team);
      const gbText = formatGamesBack(gamesBack);
      const logoHtml = team.logo_url
        ? `<img class="standings-logo" src="${escapeHtml(team.logo_url)}" alt="${escapeHtml(team.team_name)} logo">`
        : `<div class="standings-logo-placeholder">T${team.team_number}</div>`;

      return `
        <div class="standings-row ${index === 0 ? "division-leader" : ""}">
          <div class="standings-rank">${index + 1}</div>

          <div class="standings-team-cell">
            ${logoHtml}
            <div>
              <div class="standings-team-name">${escapeHtml(team.team_name)}</div>
              <div class="standings-owner-name">${escapeHtml(team.owner_name || "Unassigned")}</div>
            </div>
          </div>

          <div class="standings-number">${team.wins}</div>
          <div class="standings-number">${team.losses}</div>
          <div class="standings-record">${team.wins}-${team.losses}</div>
          <div class="standings-gb">${gbText}</div>
        </div>
      `;
    }).join("");

    return `
      <section class="standings-board">
        <div class="standings-division-title">
          ${escapeHtml(division.name)}
        </div>

        <div class="standings-header-row">
          <div>#</div>
          <div>Team</div>
          <div>W</div>
          <div>L</div>
          <div>Record</div>
          <div>GB</div>
        </div>

        ${rows}
      </section>
    `;
  }).join("");

  standingsStatus.textContent = `${teams.length} teams loaded. Standings sorted by record.`;
}

function parseRecord(recordText) {
  const cleaned = String(recordText || "0-0-0").trim();
  const match = cleaned.match(/^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?$/);

  if (!match) {
    return {
      wins: 0,
      losses: 0,
      ties: 0
    };
  }

  return {
    wins: Number(match[1]),
    losses: Number(match[2]),
    ties: Number(match[3] || 0)
  };
}

function getWinningPercentage(wins, losses, ties = 0) {
  const games = wins + losses + ties;

  if (games === 0) {
    return 0;
  }

  return (wins + ties * 0.5) / games;
}

function sortTeams(a, b) {
  if (b.winningPercentage !== a.winningPercentage) {
    return b.winningPercentage - a.winningPercentage;
  }

  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }

  if ((b.gamesWon || 0) !== (a.gamesWon || 0)) {
    return (b.gamesWon || 0) - (a.gamesWon || 0);
  }

  if (a.losses !== b.losses) {
    return a.losses - b.losses;
  }

  return a.team_number - b.team_number;
}

function calculateGamesBack(leader, team) {
  return ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
}

function formatGamesBack(gamesBack) {
  if (gamesBack <= 0) {
    return "--";
  }

  if (Number.isInteger(gamesBack)) {
    return String(gamesBack);
  }

  return String(gamesBack);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
