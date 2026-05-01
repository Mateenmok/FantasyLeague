const standingsSubtitle = document.getElementById("standingsSubtitle");
const standingsContent = document.getElementById("standingsContent");
const standingsStatus = document.getElementById("standingsStatus");
const playoffBracket = document.getElementById("playoffBracket");

const selectedLeagueId = localStorage.getItem("selected-league-id");

let currentLeague = null;
let leagueTeams = [];
let leagueDivisions = [];

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

  currentLeague = league;
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

  leagueDivisions = divisions || [];
  leagueTeams = normalizeTeams(teams || []);

  renderStandings();
  renderPlayoffBracket();
}

function normalizeTeams(teams) {
  return teams.map(team => {
    const parsedRecord = parseRecord(team.record);

    const wins = Number(team.wins ?? parsedRecord.wins ?? 0);
    const losses = Number(team.losses ?? parsedRecord.losses ?? 0);
    const ties = Number(team.ties ?? parsedRecord.ties ?? 0);
    const gamesWon = Number(team.games_won ?? 0);
    const gamesLost = Number(team.games_lost ?? 0);

    return {
      ...team,
      wins,
      losses,
      ties,
      gamesWon,
      gamesLost,
      winningPercentage: getWinningPercentage(wins, losses, ties)
    };
  });
}

function renderStandings() {
  if (!leagueTeams.length) {
    standingsContent.innerHTML = `
      <div class="empty-state">
        <p>No teams found for this league.</p>
      </div>
    `;
    standingsStatus.textContent = "No teams found.";
    return;
  }

  const divisionsToRender = leagueDivisions.length
    ? leagueDivisions
    : [{ id: "all", name: "League Standings", division_number: 1 }];

  standingsContent.innerHTML = divisionsToRender.map(division => {
    const divisionTeams = leagueTeams
      .filter(team => {
        if (division.id === "all") return true;
        return team.division_id === division.id;
      })
      .sort(sortTeamsForStandings);

    if (!divisionTeams.length) {
      return `
        <section class="standings-board">
          <div class="standings-division-title">${escapeHtml(division.name)}</div>
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
          <div class="standings-record">${getRecordString(team)}</div>
          <div class="standings-gb">${gbText}</div>
        </div>
      `;
    }).join("");

    return `
      <section class="standings-board">
        <div class="standings-division-title">${escapeHtml(division.name)}</div>

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

  standingsStatus.textContent = `${leagueTeams.length} teams loaded. Tiebreaker: games won.`;
}

function renderPlayoffBracket() {
  if (!playoffBracket || !currentLeague || !leagueTeams.length) {
    return;
  }

  const playoffCount = Math.floor(Number(currentLeague.team_count || leagueTeams.length) / 2);

  const seededTeams = [...leagueTeams]
    .sort(compareTeamsForPlayoffs)
    .slice(0, playoffCount)
    .map((team, index) => ({
      ...team,
      playoffSeed: index + 1
    }));

  const rounds = buildPlayoffRounds(seededTeams);

  playoffBracket.innerHTML = rounds.map((round, roundIndex) => {
    return `
      <div class="bracket-round">
        <div class="bracket-round-title">${getRoundLabel(roundIndex, rounds.length)}</div>

        ${round.map(matchup => renderBracketMatchup(matchup)).join("")}
      </div>
    `;
  }).join("");
}

function renderBracketMatchup(matchup) {
  if (matchup.bye) {
    return `
      <div class="bracket-matchup">
        ${renderBracketTeam(matchup.team1)}
        <div class="bracket-bye">BYE</div>
      </div>
    `;
  }

  if (matchup.team1 && matchup.team2) {
    return `
      <div class="bracket-matchup">
        ${renderBracketTeam(matchup.team1)}
        <div class="bracket-vs">vs</div>
        ${renderBracketTeam(matchup.team2)}
      </div>
    `;
  }

  return `
    <div class="bracket-matchup">
      <div class="bracket-bye">TBD</div>
    </div>
  `;
}

function renderBracketTeam(team) {
  const logoHtml = team.logo_url
    ? `<img class="bracket-team-logo" src="${escapeHtml(team.logo_url)}" alt="${escapeHtml(team.team_name)} logo">`
    : `<div class="bracket-team-logo-placeholder">T${team.team_number}</div>`;

  return `
    <div class="bracket-team-row">
      <div class="bracket-seed">#${team.playoffSeed}</div>

      ${logoHtml}

      <div class="bracket-team-info">
        <div class="bracket-team-name">${escapeHtml(team.team_name)}</div>
        <div class="bracket-team-meta">
          ${getRecordString(team)} • GW: ${team.gamesWon}
        </div>
      </div>
    </div>
  `;
}

function buildPlayoffRounds(seededTeams) {
  const playoffCount = seededTeams.length;

  let bracketSize = 1;

  while (bracketSize < playoffCount) {
    bracketSize *= 2;
  }

  const byeCount = bracketSize - playoffCount;
  const rounds = [];

  const firstRound = [];
  const byeTeams = seededTeams.slice(0, byeCount);
  const playInTeams = seededTeams.slice(byeCount);

  byeTeams.forEach(team => {
    firstRound.push({
      team1: team,
      team2: null,
      bye: true
    });
  });

  for (let i = 0; i < Math.floor(playInTeams.length / 2); i++) {
    firstRound.push({
      team1: playInTeams[i],
      team2: playInTeams[playInTeams.length - 1 - i],
      bye: false
    });
  }

  rounds.push(firstRound);

  let teamsRemaining = firstRound.length;

  while (teamsRemaining > 1) {
    const nextRoundGames = Math.floor(teamsRemaining / 2);
    const nextRound = [];

    for (let i = 0; i < nextRoundGames; i++) {
      nextRound.push({
        team1: null,
        team2: null,
        bye: false
      });
    }

    rounds.push(nextRound);
    teamsRemaining = nextRoundGames;
  }

  return rounds;
}

function compareTeamsForPlayoffs(a, b) {
  if (b.winningPercentage !== a.winningPercentage) {
    return b.winningPercentage - a.winningPercentage;
  }

  if (b.gamesWon !== a.gamesWon) {
    return b.gamesWon - a.gamesWon;
  }

  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }

  if (a.losses !== b.losses) {
    return a.losses - b.losses;
  }

  return a.team_number - b.team_number;
}

function sortTeamsForStandings(a, b) {
  if (b.winningPercentage !== a.winningPercentage) {
    return b.winningPercentage - a.winningPercentage;
  }

  if (b.gamesWon !== a.gamesWon) {
    return b.gamesWon - a.gamesWon;
  }

  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }

  if (a.losses !== b.losses) {
    return a.losses - b.losses;
  }

  return a.team_number - b.team_number;
}

function getRoundLabel(roundIndex, totalRounds) {
  if (totalRounds === 1) return "Final";
  if (roundIndex === totalRounds - 1) return "Final";
  if (roundIndex === totalRounds - 2) return "Semifinals";
  if (roundIndex === totalRounds - 3) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
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

function getRecordString(team) {
  return `${team.wins}-${team.losses}-${team.ties}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
