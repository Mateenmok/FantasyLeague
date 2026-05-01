const weeklySubtitle = document.getElementById("weeklySubtitle");
const weeklyRoundTitle = document.getElementById("weeklyRoundTitle");
const weeklyRoundStatus = document.getElementById("weeklyRoundStatus");
const weeklyMatchesList = document.getElementById("weeklyMatchesList");
const weeklyStatus = document.getElementById("weeklyStatus");
const weeklyAdminControls = document.getElementById("weeklyAdminControls");
const weeklyAdminStatus = document.getElementById("weeklyAdminStatus");

const generateScheduleButton = document.getElementById("generateScheduleButton");
const saveScoresButton = document.getElementById("saveScoresButton");
const advanceMatchupButton = document.getElementById("advanceMatchupButton");

const selectedLeagueId = localStorage.getItem("selected-league-id");

let currentLeague = null;
let currentMembership = null;
let leagueTeams = [];
let leagueMatchups = [];
let isAdmin = false;

generateScheduleButton.addEventListener("click", generateSchedule);
saveScoresButton.addEventListener("click", saveCurrentScores);
advanceMatchupButton.addEventListener("click", advanceMatchup);

loadWeeklyMatchesPage();

async function loadWeeklyMatchesPage() {
  if (!selectedLeagueId) {
    weeklySubtitle.textContent = "No league selected.";
    weeklyStatus.textContent = "Go to My Leagues and select a league first.";
    weeklyAdminControls.style.display = "none";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    weeklySubtitle.textContent = "Not signed in.";
    weeklyStatus.textContent = "Sign in before viewing weekly matches.";
    weeklyAdminControls.style.display = "none";
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
    weeklySubtitle.textContent = "No access.";
    weeklyStatus.textContent = "You are not a member of this league.";
    weeklyAdminControls.style.display = "none";
    return;
  }

  currentMembership = membership;
  isAdmin = membership.role === "admin";

  if (!isAdmin) {
    weeklyAdminControls.style.display = "none";
  }

  await loadLeagueData();
  renderWeeklyMatches();
}

async function loadLeagueData() {
  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    weeklySubtitle.textContent = "Could not load league.";
    weeklyStatus.textContent = "Try selecting the league again.";
    return;
  }

  currentLeague = league;
  weeklySubtitle.textContent = league.name;

  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
    weeklyStatus.textContent = "Could not load teams.";
    return;
  }

  leagueTeams = teams || [];

  const { data: matchups, error: matchupsError } = await supabaseClient
    .from("league_matchups")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("phase", "regular")
    .order("matchup_number", { ascending: true })
    .order("display_order", { ascending: true });

  if (matchupsError) {
    console.error("Matchups error:", matchupsError);
    weeklyStatus.textContent = "Could not load matchups.";
    return;
  }

  leagueMatchups = matchups || [];
}

function renderWeeklyMatches() {
  if (!currentLeague) {
    return;
  }

  const scheduleGenerated = currentLeague.schedule_generated && leagueMatchups.length > 0;

  generateScheduleButton.style.display = scheduleGenerated ? "none" : "flex";
  saveScoresButton.style.display = scheduleGenerated ? "flex" : "none";
  advanceMatchupButton.style.display = scheduleGenerated ? "flex" : "none";

  if (!scheduleGenerated) {
    weeklyRoundTitle.textContent = "No Schedule Yet";
    weeklyRoundStatus.textContent = isAdmin
      ? "Click Generate Schedule to create regular-season weekly matchups."
      : "The league admin has not generated the schedule yet.";

    weeklyMatchesList.innerHTML = `
      <div class="empty-state">
        <p>No weekly matchups have been generated yet.</p>
      </div>
    `;

    weeklyStatus.textContent = "Waiting for schedule.";
    return;
  }

  const currentNumber = currentLeague.current_matchup_number || 1;
  const regularSeasonMatches = currentLeague.regular_season_matches || 10;
  const currentMatchups = leagueMatchups.filter(matchup => matchup.matchup_number === currentNumber);

  if (currentLeague.season_phase === "complete") {
    weeklyRoundTitle.textContent = "Regular Season Complete";
    weeklyRoundStatus.textContent = "Playoffs can be generated next.";
  } else {
    weeklyRoundTitle.textContent = `Weekly Matches — Matchup ${currentNumber}`;
    weeklyRoundStatus.textContent = `${currentMatchups.filter(m => m.completed).length}/${currentMatchups.length} scores reported. Regular season: ${currentNumber}/${regularSeasonMatches}.`;
  }

  if (!currentMatchups.length) {
    weeklyMatchesList.innerHTML = `
      <div class="empty-state">
        <p>No matchups found for this matchup number.</p>
      </div>
    `;
    weeklyStatus.textContent = "No current matchups found.";
    return;
  }

  weeklyMatchesList.innerHTML = currentMatchups.map(matchup => {
    const team1 = getTeamById(matchup.team1_id);
    const team2 = getTeamById(matchup.team2_id);

    if (!team1 || !team2) {
      return "";
    }

    const team1ScoreValue = matchup.team1_score ?? "";
    const team2ScoreValue = matchup.team2_score ?? "";
    const completedBadge = matchup.completed ? `<span class="weekly-complete-badge">Reported</span>` : `<span class="weekly-open-badge">Open</span>`;

    return `
      <article class="weekly-match-card">
        <div class="weekly-match-status">${completedBadge}</div>

        ${renderTeamSide(team1, "left")}

        <div class="weekly-score-center">
          ${
            isAdmin
              ? `
                <input id="team1Score-${matchup.id}" class="weekly-score-input" type="number" min="0" value="${team1ScoreValue}">
                <span>vs</span>
                <input id="team2Score-${matchup.id}" class="weekly-score-input" type="number" min="0" value="${team2ScoreValue}">
              `
              : `
                <div class="weekly-score-display">${team1ScoreValue === "" ? "-" : team1ScoreValue}</div>
                <span>vs</span>
                <div class="weekly-score-display">${team2ScoreValue === "" ? "-" : team2ScoreValue}</div>
              `
          }
        </div>

        ${renderTeamSide(team2, "right")}
      </article>
    `;
  }).join("");

  weeklyStatus.textContent = isAdmin
    ? "Enter scores for every matchup, then Save Scores. Advance when all scores are reported."
    : "Viewing current weekly matchups.";
}

function renderTeamSide(team, side) {
  const logoHtml = team.logo_url
    ? `<img class="weekly-team-logo" src="${escapeHtml(team.logo_url)}" alt="${escapeHtml(team.team_name)} logo">`
    : `<div class="weekly-team-logo-placeholder">T${team.team_number}</div>`;

  return `
    <div class="weekly-team-side ${side}">
      ${logoHtml}
      <div class="weekly-team-text">
        <h2>${escapeHtml(team.team_name)}</h2>
        <p>${formatTeamRecord(team)}</p>
        <p>${escapeHtml(team.owner_name || "Unassigned")}</p>
      </div>
    </div>
  `;
}

async function generateSchedule() {
  if (!isAdmin) {
    weeklyAdminStatus.textContent = "Only admins can generate the schedule.";
    return;
  }

  if (leagueTeams.length < 2) {
    weeklyAdminStatus.textContent = "Need at least 2 teams to generate a schedule.";
    return;
  }

  const completedMatchups = leagueMatchups.filter(matchup => matchup.completed);

  if (completedMatchups.length > 0) {
    weeklyAdminStatus.textContent = "Cannot regenerate schedule after scores have been reported.";
    return;
  }

  generateScheduleButton.disabled = true;
  weeklyAdminStatus.textContent = "Generating schedule...";

  const { error: deleteError } = await supabaseClient
    .from("league_matchups")
    .delete()
    .eq("league_id", selectedLeagueId)
    .eq("phase", "regular");

  if (deleteError) {
    console.error("Delete old schedule error:", deleteError);
    weeklyAdminStatus.textContent = "Could not clear old schedule.";
    generateScheduleButton.disabled = false;
    return;
  }

  const matchupRows = buildRegularSeasonSchedule(leagueTeams, currentLeague.regular_season_matches || 10);

  const { error: insertError } = await supabaseClient
    .from("league_matchups")
    .insert(matchupRows);

  if (insertError) {
    console.error("Insert schedule error:", insertError);
    weeklyAdminStatus.textContent = "Could not create schedule. Check console.";
    generateScheduleButton.disabled = false;
    return;
  }

  const { error: leagueUpdateError } = await supabaseClient
    .from("leagues")
    .update({
      schedule_generated: true,
      current_matchup_number: 1,
      season_phase: "regular"
    })
    .eq("id", selectedLeagueId);

  if (leagueUpdateError) {
    console.error("League schedule update error:", leagueUpdateError);
    weeklyAdminStatus.textContent = "Schedule created, but league status failed.";
    generateScheduleButton.disabled = false;
    return;
  }

  weeklyAdminStatus.textContent = "Schedule generated.";
  generateScheduleButton.disabled = false;

  await loadLeagueData();
  renderWeeklyMatches();
}

function buildRegularSeasonSchedule(teams, matchupCount) {
  const sortedTeams = [...teams].sort((a, b) => a.team_number - b.team_number);
  const divisionGroups = getDivisionGroups(sortedTeams);

  const divisionPairs = buildDivisionPairs(divisionGroups);
  const outOfDivisionPairs = buildOutOfDivisionPairs(divisionGroups);

  const priorityPools = [
    [...divisionPairs],
    [...outOfDivisionPairs],
    [...divisionPairs],
    [...outOfDivisionPairs],
    [...divisionPairs]
  ];

  const rounds = [];
  let poolIndex = 0;

  while (rounds.length < matchupCount) {
    const roundPairs = [];
    const usedTeamIds = new Set();

    while (roundPairs.length < sortedTeams.length / 2) {
      if (poolIndex >= priorityPools.length) {
        priorityPools.push([...divisionPairs]);
        priorityPools.push([...outOfDivisionPairs]);
      }

      const pool = priorityPools[poolIndex];

      if (pool.length === 0) {
        poolIndex++;
        continue;
      }

      const pairIndex = pool.findIndex(pair => {
        return !usedTeamIds.has(pair[0].id) && !usedTeamIds.has(pair[1].id);
      });

      if (pairIndex === -1) {
        break;
      }

      const [pair] = pool.splice(pairIndex, 1);
      roundPairs.push(pair);
      usedTeamIds.add(pair[0].id);
      usedTeamIds.add(pair[1].id);
    }

    if (roundPairs.length < sortedTeams.length / 2) {
      const fillerPairs = buildFillerPairs(sortedTeams, usedTeamIds, roundPairs);

      fillerPairs.forEach(pair => {
        if (roundPairs.length < sortedTeams.length / 2) {
          roundPairs.push(pair);
        }
      });
    }

    if (roundPairs.length === 0) {
      break;
    }

    rounds.push(roundPairs);
  }

  const rows = [];

  rounds.slice(0, matchupCount).forEach((roundPairs, roundIndex) => {
    roundPairs.forEach((pair, pairIndex) => {
      rows.push({
        id: makeId(),
        league_id: selectedLeagueId,
        phase: "regular",
        matchup_number: roundIndex + 1,
        display_order: pairIndex + 1,
        team1_id: pair[0].id,
        team2_id: pair[1].id,
        completed: false
      });
    });
  });

  return rows;
}

function getDivisionGroups(teams) {
  const groupsByDivision = {};

  teams.forEach(team => {
    const divisionKey = team.division_id || "unassigned";

    if (!groupsByDivision[divisionKey]) {
      groupsByDivision[divisionKey] = [];
    }

    groupsByDivision[divisionKey].push(team);
  });

  const groups = Object.values(groupsByDivision)
    .map(group => group.sort((a, b) => a.team_number - b.team_number))
    .filter(group => group.length > 0);

  if (groups.length < 2) {
    return [teams];
  }

  return groups;
}

function buildDivisionPairs(divisionGroups) {
  const pairs = [];

  divisionGroups.forEach(group => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push([group[i], group[j]]);
      }
    }
  });

  return balancePairOrder(pairs);
}

function buildOutOfDivisionPairs(divisionGroups) {
  const pairs = [];

  for (let i = 0; i < divisionGroups.length; i++) {
    for (let j = i + 1; j < divisionGroups.length; j++) {
      divisionGroups[i].forEach(teamA => {
        divisionGroups[j].forEach(teamB => {
          pairs.push([teamA, teamB]);
        });
      });
    }
  }

  return balancePairOrder(pairs);
}

function buildFillerPairs(teams, usedTeamIds, existingPairs) {
  const remainingTeams = teams.filter(team => !usedTeamIds.has(team.id));
  const existingPairKeys = new Set(existingPairs.map(pair => getPairKey(pair[0], pair[1])));
  const fillerPairs = [];

  while (remainingTeams.length >= 2) {
    const teamA = remainingTeams.shift();

    let opponentIndex = remainingTeams.findIndex(team => {
      return !existingPairKeys.has(getPairKey(teamA, team));
    });

    if (opponentIndex === -1) {
      opponentIndex = 0;
    }

    const [teamB] = remainingTeams.splice(opponentIndex, 1);
    fillerPairs.push([teamA, teamB]);
    existingPairKeys.add(getPairKey(teamA, teamB));
  }

  return fillerPairs;
}

function getPairKey(teamA, teamB) {
  return [teamA.id, teamB.id].sort().join("__");
}

function balancePairOrder(pairs) {
  const teamUseCount = {};

  pairs.forEach(pair => {
    teamUseCount[pair[0].id] = 0;
    teamUseCount[pair[1].id] = 0;
  });

  const remainingPairs = [...pairs];
  const balancedPairs = [];

  while (remainingPairs.length > 0) {
    remainingPairs.sort((a, b) => {
      const aUse = teamUseCount[a[0].id] + teamUseCount[a[1].id];
      const bUse = teamUseCount[b[0].id] + teamUseCount[b[1].id];

      if (aUse !== bUse) {
        return aUse - bUse;
      }

      return (a[0].team_number + a[1].team_number) - (b[0].team_number + b[1].team_number);
    });

    const pair = remainingPairs.shift();
    balancedPairs.push(pair);
    teamUseCount[pair[0].id] += 1;
    teamUseCount[pair[1].id] += 1;
  }

  return balancedPairs;
}

async function saveCurrentScores() {
  if (!isAdmin) {
    weeklyAdminStatus.textContent = "Only admins can save scores.";
    return;
  }

  const currentNumber = currentLeague.current_matchup_number || 1;
  const currentMatchups = leagueMatchups.filter(matchup => matchup.matchup_number === currentNumber);

  if (!currentMatchups.length) {
    weeklyAdminStatus.textContent = "No current matchups to score.";
    return;
  }

  const updates = [];

  for (const matchup of currentMatchups) {
    const team1Input = document.getElementById(`team1Score-${matchup.id}`);
    const team2Input = document.getElementById(`team2Score-${matchup.id}`);

    const team1Score = Number(team1Input.value);
    const team2Score = Number(team2Input.value);

    if (team1Input.value === "" || team2Input.value === "" || team1Score < 0 || team2Score < 0) {
      weeklyAdminStatus.textContent = "Enter valid scores for every matchup before saving.";
      return;
    }

    let winnerTeamId = null;

    if (team1Score > team2Score) {
      winnerTeamId = matchup.team1_id;
    } else if (team2Score > team1Score) {
      winnerTeamId = matchup.team2_id;
    }

    updates.push({
      matchup,
      team1Score,
      team2Score,
      winnerTeamId
    });
  }

  saveScoresButton.disabled = true;
  weeklyAdminStatus.textContent = "Saving scores...";

  for (const update of updates) {
    const { error } = await supabaseClient
      .from("league_matchups")
      .update({
        team1_score: update.team1Score,
        team2_score: update.team2Score,
        winner_team_id: update.winnerTeamId,
        completed: true
      })
      .eq("id", update.matchup.id);

    if (error) {
      console.error("Save matchup score error:", error);
      weeklyAdminStatus.textContent = "Error saving scores. Check console.";
      saveScoresButton.disabled = false;
      return;
    }
  }

  await recalculateLeagueRecords();

  weeklyAdminStatus.textContent = "Scores saved and records updated.";
  saveScoresButton.disabled = false;

  await loadLeagueData();
  renderWeeklyMatches();
}

async function recalculateLeagueRecords() {
  const stats = {};

  leagueTeams.forEach(team => {
    stats[team.id] = {
      wins: 0,
      losses: 0,
      ties: 0,
      games_won: 0,
      games_lost: 0
    };
  });

  const { data: completedMatchups, error } = await supabaseClient
    .from("league_matchups")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("phase", "regular")
    .eq("completed", true);

  if (error) {
    console.error("Load completed matchups error:", error);
    return;
  }

  for (const matchup of completedMatchups || []) {
    const team1Score = Number(matchup.team1_score);
    const team2Score = Number(matchup.team2_score);

    if (!stats[matchup.team1_id] || !stats[matchup.team2_id]) {
      continue;
    }

    stats[matchup.team1_id].games_won += team1Score;
    stats[matchup.team1_id].games_lost += team2Score;

    stats[matchup.team2_id].games_won += team2Score;
    stats[matchup.team2_id].games_lost += team1Score;

    if (team1Score > team2Score) {
      stats[matchup.team1_id].wins += 1;
      stats[matchup.team2_id].losses += 1;
    } else if (team2Score > team1Score) {
      stats[matchup.team2_id].wins += 1;
      stats[matchup.team1_id].losses += 1;
    } else {
      stats[matchup.team1_id].ties += 1;
      stats[matchup.team2_id].ties += 1;
    }
  }

  for (const team of leagueTeams) {
    const teamStats = stats[team.id];
    const recordText = `${teamStats.wins}-${teamStats.losses}-${teamStats.ties}`;

    const { error: updateError } = await supabaseClient
      .from("league_teams")
      .update({
        wins: teamStats.wins,
        losses: teamStats.losses,
        ties: teamStats.ties,
        games_won: teamStats.games_won,
        games_lost: teamStats.games_lost,
        record: recordText,
        updated_at: new Date().toISOString()
      })
      .eq("id", team.id);

    if (updateError) {
      console.error("Team record update error:", updateError);
    }
  }
}

async function advanceMatchup() {
  if (!isAdmin) {
    weeklyAdminStatus.textContent = "Only admins can advance matchups.";
    return;
  }

  const currentNumber = currentLeague.current_matchup_number || 1;
  const regularSeasonMatches = currentLeague.regular_season_matches || 10;
  const currentMatchups = leagueMatchups.filter(matchup => matchup.matchup_number === currentNumber);

  if (!currentMatchups.length) {
    weeklyAdminStatus.textContent = "No current matchups to advance.";
    return;
  }

  const allCompleted = currentMatchups.every(matchup => matchup.completed);

  if (!allCompleted) {
    weeklyAdminStatus.textContent = "Report all scores before advancing.";
    return;
  }

  advanceMatchupButton.disabled = true;

  const updateData = {};

  if (currentNumber >= regularSeasonMatches) {
    updateData.season_phase = "complete";
    updateData.current_matchup_number = currentNumber;
    weeklyAdminStatus.textContent = "Regular season complete.";
  } else {
    updateData.current_matchup_number = currentNumber + 1;
    weeklyAdminStatus.textContent = `Advanced to Matchup ${currentNumber + 1}.`;
  }

  const { error } = await supabaseClient
    .from("leagues")
    .update(updateData)
    .eq("id", selectedLeagueId);

  if (error) {
    console.error("Advance matchup error:", error);
    weeklyAdminStatus.textContent = "Could not advance matchup.";
    advanceMatchupButton.disabled = false;
    return;
  }

  advanceMatchupButton.disabled = false;

  await loadLeagueData();
  renderWeeklyMatches();
}

function getTeamById(teamId) {
  return leagueTeams.find(team => team.id === teamId);
}

function formatTeamRecord(team) {
  const wins = Number(team.wins ?? 0);
  const losses = Number(team.losses ?? 0);
  const ties = Number(team.ties ?? 0);

  return `${wins}-${losses}-${ties}`;
}

function makeId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
