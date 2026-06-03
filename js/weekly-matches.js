const weeklySubtitle = document.getElementById("weeklySubtitle");
const weeklyRoundTitle = document.getElementById("weeklyRoundTitle");
const weeklyRoundStatus = document.getElementById("weeklyRoundStatus");
const weeklyMatchesList = document.getElementById("weeklyMatchesList");
const weeklyStatus = document.getElementById("weeklyStatus");
const weeklyAdminControls = document.getElementById("weeklyAdminControls");
const weeklyAdminStatus = document.getElementById("weeklyAdminStatus");
const leagueActivityFeed = document.getElementById("leagueActivityFeed");

const generateScheduleButton = document.getElementById("generateScheduleButton");
const editScheduleButton = document.getElementById("editScheduleButton");
const saveScoresButton = document.getElementById("saveScoresButton");
const advanceMatchupButton = document.getElementById("advanceMatchupButton");
const manualScheduleEditor = document.getElementById("manualScheduleEditor");
const manualScheduleWeeks = document.getElementById("manualScheduleWeeks");
const saveManualScheduleButton = document.getElementById("saveManualScheduleButton");
const cancelManualScheduleButton = document.getElementById("cancelManualScheduleButton");
const manualScheduleStatus = document.getElementById("manualScheduleStatus");
const weeklyPickemPanel = document.getElementById("weeklyPickemPanel");
const weeklyPickemAdmin = document.getElementById("weeklyPickemAdmin");
const weeklyPickemLockInput = document.getElementById("weeklyPickemLockInput");
const savePickemLockButton = document.getElementById("savePickemLockButton");
const weeklyPickemStatus = document.getElementById("weeklyPickemStatus");
const weeklyPickemList = document.getElementById("weeklyPickemList");

const selectedLeagueId = localStorage.getItem("selected-league-id");

let currentLeague = null;
let currentMembership = null;
let currentUserId = "";
let leagueTeams = [];
let leagueMatchups = [];
let matchupPicks = [];
let matchupPicksAvailable = false;
let isAdmin = false;
let leagueActivityEvents = [];
let manualScheduleOpen = false;

generateScheduleButton.addEventListener("click", generateSchedule);
editScheduleButton.addEventListener("click", toggleManualScheduleEditor);
saveScoresButton.addEventListener("click", saveCurrentScores);
advanceMatchupButton.addEventListener("click", advanceMatchup);
saveManualScheduleButton.addEventListener("click", saveManualSchedule);
cancelManualScheduleButton.addEventListener("click", closeManualScheduleEditor);
if (savePickemLockButton) {
  savePickemLockButton.addEventListener("click", savePickemLockTime);
}

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
  currentUserId = userId;

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
  renderLeagueActivity();
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

  await loadMatchupPicks();
  await loadLeagueActivityEvents();
}

async function loadMatchupPicks() {
  matchupPicks = [];
  matchupPicksAvailable = false;

  try {
    const { data, error } = await supabaseClient
      .from("league_matchup_picks")
      .select("*")
      .eq("league_id", selectedLeagueId);

    if (error) {
      console.warn("Matchup picks table not available yet:", error);
      return;
    }

    matchupPicks = data || [];
    matchupPicksAvailable = true;
  } catch (error) {
    console.warn("Matchup picks load skipped:", error);
  }
}

async function loadLeagueActivityEvents() {
  leagueActivityEvents = [];

  try {
    const { data, error } = await supabaseClient
      .from("league_activity_events")
      .select("*")
      .eq("league_id", selectedLeagueId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.warn("League activity table not available yet:", error);
      leagueActivityEvents = [];
      return;
    }

    leagueActivityEvents = data || [];
  } catch (error) {
    console.warn("League activity load skipped:", error);
    leagueActivityEvents = [];
  }
}

function renderLeagueActivity() {
  if (!leagueActivityFeed) {
    return;
  }

  const feedItems = [];

  // Real league activity should appear first, newest first.
  leagueActivityEvents.forEach(event => {
    const type = getActivityEventType(event);

    feedItems.push({
      type,
      icon: getActivityIcon(type),
      title: event.title || formatActivityType(type),
      description: event.description || buildActivityDescription(event)
    });
  });

  // Automatic league status alerts go underneath real activity.
  if (currentLeague) {
    if (typeof currentLeague.waiver_open === "boolean") {
      const waiverCurrentlyOpen = isLeagueWaiverWindowOpen(currentLeague);
      const waiverWindowText = getLeagueWaiverWindowText(currentLeague);

      feedItems.push({
        type: "alert",
        icon: "W",
        title: waiverCurrentlyOpen ? "Waivers are open" : "Waivers are closed",
        description: waiverCurrentlyOpen
          ? "Teams can currently add and drop Pokémon through Waiver Wire."
          : waiverWindowText || "Waiver Wire is currently closed."
      });
    }

    if (currentLeague.schedule_generated) {
      feedItems.push({
        type: "alert",
        icon: "M",
        title: "Weekly matchups are active",
        description: `Current matchup: ${currentLeague.current_matchup_number || 1}.`
      });
    }

    if (currentLeague.season_phase === "complete") {
      feedItems.push({
        type: "alert",
        icon: "✓",
        title: "Regular season complete",
        description: "The regular-season matchup schedule has finished."
      });
    }
  }

  if (!feedItems.length) {
    leagueActivityFeed.innerHTML = `
      <div class="league-activity-item alert">
        <div class="league-activity-icon">!</div>
        <div>
          <p class="league-activity-title">No activity yet</p>
          <p class="league-activity-desc">Adds, drops, trades, draft alerts, and waiver updates will show here once activity logging is connected.</p>
        </div>
      </div>
    `;
    return;
  }

  leagueActivityFeed.innerHTML = feedItems.slice(0, 10).map(item => `
    <div class="league-activity-item ${escapeHtml(item.type)}">
      <div class="league-activity-icon">${escapeHtml(item.icon)}</div>
      <div>
        <p class="league-activity-title">${escapeHtml(item.title)}</p>
        <p class="league-activity-desc">${escapeHtml(item.description)}</p>
      </div>
    </div>
  `).join("");
}

function getActivityEventType(event) {
  const rawType = String(event.event_type || event.type || "").toLowerCase();

  if (rawType.includes("trade")) return "trade";
  if (rawType.includes("drop")) return "drop";
  if (rawType.includes("add") || rawType.includes("claim")) return "add";

  return "alert";
}

function getActivityIcon(type) {
  if (type === "add") return "+";
  if (type === "drop") return "-";
  if (type === "trade") return "⇄";
  return "!";
}

function formatActivityType(type) {
  if (type === "add") return "Pokémon added";
  if (type === "drop") return "Pokémon dropped";
  if (type === "trade") return "Trade completed";
  return "League alert";
}

function buildActivityDescription(event) {
  const team = event.team_name || event.actor_team_name || "A team";
  const pokemon = event.pokemon_name || event.pokemon || "";
  const target = event.target_team_name || "";

  if (pokemon && target) {
    return `${team} moved ${pokemon} with ${target}.`;
  }

  if (pokemon) {
    return `${team}: ${pokemon}.`;
  }

  return event.message || "League activity was recorded.";
}

function isLeagueWaiverWindowOpen(league) {
  if (!league?.waiver_open) {
    return false;
  }

  const now = Date.now();
  const startsAt = league.waiver_window_start_at ? new Date(league.waiver_window_start_at).getTime() : null;
  const endsAt = league.waiver_window_end_at ? new Date(league.waiver_window_end_at).getTime() : null;

  if (startsAt && now < startsAt) {
    return false;
  }

  if (endsAt && now >= endsAt) {
    return false;
  }

  return true;
}

function getLeagueWaiverWindowText(league) {
  if (!league?.waiver_open) {
    return "Waiver Wire is currently closed.";
  }

  if (league.waiver_window_start_at && new Date(league.waiver_window_start_at).getTime() > Date.now()) {
    return `Waiver Wire opens ${formatLeagueActivityDateTime(league.waiver_window_start_at)}.`;
  }

  if (league.waiver_window_end_at && new Date(league.waiver_window_end_at).getTime() <= Date.now()) {
    return `Waiver Wire closed ${formatLeagueActivityDateTime(league.waiver_window_end_at)}.`;
  }

  return "Waiver Wire is currently closed.";
}

function formatLeagueActivityDateTime(isoValue) {
  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderWeeklyMatches() {
  if (!currentLeague) {
    return;
  }

  const scheduleGenerated = currentLeague.schedule_generated && leagueMatchups.length > 0;

  generateScheduleButton.style.display = scheduleGenerated ? "none" : "flex";
  editScheduleButton.style.display = isAdmin ? "flex" : "none";
  editScheduleButton.textContent = manualScheduleOpen ? "Hide Schedule Editor" : "Edit Schedule";
  saveScoresButton.style.display = scheduleGenerated ? "flex" : "none";
  advanceMatchupButton.style.display = scheduleGenerated ? "flex" : "none";
  renderManualScheduleEditor();

  if (!scheduleGenerated) {
    renderWeeklyPickem([]);
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
    renderWeeklyPickem([]);
    weeklyMatchesList.innerHTML = `
      <div class="empty-state">
        <p>No matchups found for this matchup number.</p>
      </div>
    `;
    weeklyStatus.textContent = "No current matchups found.";
    return;
  }

  renderWeeklyPickem(currentMatchups);

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

function renderWeeklyPickem(currentMatchups) {
  if (!weeklyPickemPanel || !weeklyPickemStatus || !weeklyPickemList) {
    return;
  }

  if (!currentLeague?.schedule_generated || !currentMatchups.length) {
    weeklyPickemPanel.hidden = true;
    weeklyPickemList.innerHTML = "";
    return;
  }

  weeklyPickemPanel.hidden = false;

  const lockAt = getCurrentPickemLockAt(currentMatchups);
  const locked = isPickemLocked(currentMatchups);
  const anyCompleted = currentMatchups.some(matchup => matchup.completed);
  const mySubmittedCount = currentMatchups.filter(matchup => getMyPickForMatchup(matchup.id)).length;
  const totalPickCount = currentMatchups.reduce((total, matchup) => total + getPicksForMatchup(matchup.id).length, 0);

  if (weeklyPickemAdmin) {
    weeklyPickemAdmin.style.display = isAdmin ? "grid" : "none";
  }

  if (weeklyPickemLockInput) {
    weeklyPickemLockInput.value = lockAt ? toDateTimeLocalValue(lockAt) : "";
  }

  if (!matchupPicksAvailable) {
    weeklyPickemStatus.textContent = "Pick'em database is not connected yet. Run the latest Supabase migration.";
  } else if (!lockAt) {
    weeklyPickemStatus.textContent = isAdmin
      ? "Set a lock time to open picks for this matchup."
      : "Picks are waiting for the league owner to set a lock time.";
  } else if (anyCompleted) {
    weeklyPickemStatus.textContent = `Results are live. ${formatPickemAccuracy(currentMatchups)}`;
  } else if (locked) {
    weeklyPickemStatus.textContent = `Picks locked ${formatDateTime(lockAt)}. ${totalPickCount} picks submitted.`;
  } else {
    weeklyPickemStatus.textContent = `Picks lock ${formatDateTime(lockAt)}. You picked ${mySubmittedCount}/${currentMatchups.length}.`;
  }

  weeklyPickemList.innerHTML = currentMatchups.map(matchup => renderPickemMatchup(matchup, locked, lockAt)).join("");
  bindPickemButtons();
}

function renderPickemMatchup(matchup, locked, lockAt) {
  const team1 = getTeamById(matchup.team1_id);
  const team2 = getTeamById(matchup.team2_id);

  if (!team1 || !team2) {
    return "";
  }

  const picks = getPicksForMatchup(matchup.id);
  const myPick = getMyPickForMatchup(matchup.id);
  const canPick = canSubmitPick(matchup, lockAt);
  const team1Picks = picks.filter(pick => pick.picked_team_id === team1.id).length;
  const team2Picks = picks.filter(pick => pick.picked_team_id === team2.id).length;
  const resultText = getPickemResultText(matchup, picks);

  return `
    <article class="weekly-pickem-card ${matchup.completed ? "completed" : locked ? "locked" : "open"}">
      <div class="weekly-pickem-matchup-meta">
        <span>Game ${matchup.display_order}</span>
        <strong>${escapeHtml(resultText)}</strong>
      </div>

      <div class="weekly-pickem-actions">
        ${renderPickemTeamButton(matchup, team1, myPick, team1Picks, canPick)}
        <div class="weekly-pickem-vs">vs</div>
        ${renderPickemTeamButton(matchup, team2, myPick, team2Picks, canPick)}
      </div>
    </article>
  `;
}

function renderPickemTeamButton(matchup, team, myPick, pickCount, canPick) {
  const selected = myPick?.picked_team_id === team.id;
  const winner = matchup.completed && matchup.winner_team_id === team.id;
  const showCount = matchup.completed || isPickemLocked([matchup]);

  return `
    <button
      class="weekly-pickem-team ${selected ? "selected" : ""} ${winner ? "winner" : ""}"
      type="button"
      data-matchup-id="${escapeHtml(matchup.id)}"
      data-team-id="${escapeHtml(team.id)}"
      ${canPick ? "" : "disabled"}>
      <span>${escapeHtml(team.team_name)}</span>
      <small>${selected ? "Your pick" : canPick ? "Pick winner" : "Locked"}${showCount ? ` - ${pickCount} picks` : ""}</small>
    </button>
  `;
}

function bindPickemButtons() {
  document.querySelectorAll(".weekly-pickem-team").forEach(button => {
    button.addEventListener("click", function () {
      submitPickemPick(this.dataset.matchupId, this.dataset.teamId);
    });
  });
}

async function savePickemLockTime() {
  if (!isAdmin) {
    weeklyAdminStatus.textContent = "Only admins can set the Pick'em lock time.";
    return;
  }

  const currentNumber = currentLeague.current_matchup_number || 1;
  const currentMatchups = leagueMatchups.filter(matchup => matchup.matchup_number === currentNumber);
  const lockValue = weeklyPickemLockInput?.value || "";

  if (!currentMatchups.length) {
    weeklyAdminStatus.textContent = "No current matchups found.";
    return;
  }

  if (!lockValue) {
    weeklyAdminStatus.textContent = "Choose a Pick'em lock time first.";
    return;
  }

  const lockDate = new Date(lockValue);

  if (Number.isNaN(lockDate.getTime())) {
    weeklyAdminStatus.textContent = "Choose a valid Pick'em lock time.";
    return;
  }

  savePickemLockButton.disabled = true;
  weeklyAdminStatus.textContent = "Saving Pick'em lock time...";

  const { error } = await supabaseClient
    .from("league_matchups")
    .update({ pick_lock_at: lockDate.toISOString() })
    .in("id", currentMatchups.map(matchup => matchup.id));

  if (error) {
    console.error("Save Pick'em lock error:", error);
    weeklyAdminStatus.textContent = "Could not save Pick'em lock time.";
    savePickemLockButton.disabled = false;
    return;
  }

  weeklyAdminStatus.textContent = "Pick'em lock time saved.";
  savePickemLockButton.disabled = false;

  await loadLeagueData();
  renderLeagueActivity();
  renderWeeklyMatches();
}

async function submitPickemPick(matchupId, teamId) {
  const matchup = leagueMatchups.find(row => String(row.id) === String(matchupId));
  const lockAt = getCurrentPickemLockAt([matchup]);

  if (!matchup || !teamId || !canSubmitPick(matchup, lockAt)) {
    weeklyPickemStatus.textContent = "Picks are locked for this matchup.";
    return;
  }

  const existingPick = getMyPickForMatchup(matchup.id);

  if (existingPick?.picked_team_id === teamId) {
    weeklyPickemStatus.textContent = "That pick is already saved.";
    return;
  }

  const payload = {
    league_id: selectedLeagueId,
    matchup_id: matchup.id,
    user_id: currentUserId,
    picked_team_id: teamId,
    updated_at: new Date().toISOString()
  };

  let error;

  if (existingPick) {
    ({ error } = await supabaseClient
      .from("league_matchup_picks")
      .update(payload)
      .eq("id", existingPick.id));
  } else {
    ({ error } = await supabaseClient
      .from("league_matchup_picks")
      .insert({
        id: makeId(),
        ...payload
      }));
  }

  if (error) {
    console.error("Save Pick'em pick error:", error);
    weeklyPickemStatus.textContent = "Could not save your pick. Check the lock time.";
    return;
  }

  weeklyPickemStatus.textContent = "Pick saved.";
  await loadMatchupPicks();
  renderWeeklyPickem(leagueMatchups.filter(row => row.matchup_number === (currentLeague.current_matchup_number || 1)));
}

function canSubmitPick(matchup, lockAt) {
  return Boolean(matchup) &&
    matchupPicksAvailable &&
    !matchup.completed &&
    Boolean(lockAt) &&
    Date.now() < new Date(lockAt).getTime();
}

function isPickemLocked(matchups) {
  if (!matchups.length) {
    return true;
  }

  return matchups.some(matchup => {
    if (matchup.completed) {
      return true;
    }

    if (!matchup.pick_lock_at) {
      return true;
    }

    return Date.now() >= new Date(matchup.pick_lock_at).getTime();
  });
}

function getCurrentPickemLockAt(matchups) {
  const lockTimes = matchups
    .map(matchup => matchup?.pick_lock_at)
    .filter(Boolean)
    .sort();

  return lockTimes[0] || "";
}

function getPicksForMatchup(matchupId) {
  return matchupPicks.filter(pick => String(pick.matchup_id) === String(matchupId));
}

function getMyPickForMatchup(matchupId) {
  return matchupPicks.find(pick =>
    String(pick.matchup_id) === String(matchupId) &&
    String(pick.user_id) === String(currentUserId)
  );
}

function getPickemResultText(matchup, picks) {
  if (!matchup.completed) {
    if (!isPickemLocked([matchup])) {
      return "Picks open";
    }

    return `${picks.length} picks`;
  }

  if (!matchup.winner_team_id) {
    return `Tie - ${picks.length} picks, no winning pick`;
  }

  const correctCount = picks.filter(pick => pick.picked_team_id === matchup.winner_team_id).length;
  return `${correctCount}/${picks.length} correct`;
}

function formatPickemAccuracy(matchups) {
  let totalPicks = 0;
  let correctPicks = 0;

  matchups.forEach(matchup => {
    if (!matchup.completed || !matchup.winner_team_id) {
      return;
    }

    const picks = getPicksForMatchup(matchup.id);
    totalPicks += picks.length;
    correctPicks += picks.filter(pick => pick.picked_team_id === matchup.winner_team_id).length;
  });

  if (!totalPicks) {
    return "No winning picks yet.";
  }

  return `${correctPicks}/${totalPicks} picks were correct.`;
}

function formatDateTime(isoValue) {
  if (!isoValue) {
    return "";
  }

  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function toDateTimeLocalValue(isoValue) {
  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toggleManualScheduleEditor() {
  manualScheduleOpen = !manualScheduleOpen;
  renderWeeklyMatches();
}

function closeManualScheduleEditor() {
  manualScheduleOpen = false;
  renderWeeklyMatches();
}

function renderManualScheduleEditor() {
  if (!manualScheduleEditor || !manualScheduleWeeks) {
    return;
  }

  manualScheduleEditor.style.display = isAdmin && manualScheduleOpen ? "block" : "none";

  if (!isAdmin || !manualScheduleOpen) {
    manualScheduleWeeks.innerHTML = "";
    return;
  }

  const matchupCount = getRegularSeasonMatchCount();
  const matchupsPerRound = getMatchupsPerRound();

  if (leagueTeams.length < 2 || matchupsPerRound < 1) {
    manualScheduleWeeks.innerHTML = `
      <div class="empty-state">
        <p>Need at least two teams before creating a schedule.</p>
      </div>
    `;
    return;
  }

  const fallbackRows = buildRegularSeasonSchedule(leagueTeams, matchupCount);
  const fallbackBySlot = new Map(fallbackRows.map(row => [getScheduleSlotKey(row.matchup_number, row.display_order), row]));

  manualScheduleWeeks.innerHTML = Array.from({ length: matchupCount }, (_, weekIndex) => {
    const matchupNumber = weekIndex + 1;

    const rows = Array.from({ length: matchupsPerRound }, (_, slotIndex) => {
      const displayOrder = slotIndex + 1;
      const existingMatchup = getExistingMatchup(matchupNumber, displayOrder);
      const fallbackMatchup = fallbackBySlot.get(getScheduleSlotKey(matchupNumber, displayOrder));
      return renderManualScheduleRow(matchupNumber, displayOrder, existingMatchup, fallbackMatchup);
    }).join("");

    return `
      <section class="manual-schedule-week">
        <h3>Matchup ${matchupNumber}</h3>
        ${rows}
      </section>
    `;
  }).join("");

  if (manualScheduleStatus) {
    manualScheduleStatus.textContent = "Each team must appear exactly once per matchup.";
  }
}

function renderManualScheduleRow(matchupNumber, displayOrder, existingMatchup, fallbackMatchup) {
  const locked = existingMatchup && isMatchupLocked(existingMatchup);
  const team1Value = existingMatchup?.team1_id || fallbackMatchup?.team1_id || "";
  const team2Value = existingMatchup?.team2_id || fallbackMatchup?.team2_id || "";
  const lockNote = locked ? `<p class="manual-schedule-lock-note">${escapeHtml(getMatchupLockReason(existingMatchup))}</p>` : "";

  return `
    <div
      class="manual-schedule-row ${locked ? "locked" : ""}"
      data-matchup-number="${matchupNumber}"
      data-display-order="${displayOrder}"
      data-matchup-id="${escapeHtml(existingMatchup?.id || "")}">
      <span class="manual-schedule-label">Game ${displayOrder}</span>
      <select
        id="manualTeam1-${matchupNumber}-${displayOrder}"
        class="manual-schedule-select"
        ${locked ? "disabled" : ""}>
        ${renderTeamOptions(team1Value)}
      </select>
      <span class="manual-schedule-vs">vs</span>
      <select
        id="manualTeam2-${matchupNumber}-${displayOrder}"
        class="manual-schedule-select"
        ${locked ? "disabled" : ""}>
        ${renderTeamOptions(team2Value)}
      </select>
      ${lockNote}
    </div>
  `;
}

function renderTeamOptions(selectedTeamId) {
  const options = [`<option value="">Select team</option>`];

  leagueTeams.forEach(team => {
    const selected = team.id === selectedTeamId ? "selected" : "";
    options.push(`<option value="${escapeHtml(team.id)}" ${selected}>${escapeHtml(team.team_name)}</option>`);
  });

  return options.join("");
}

async function saveManualSchedule() {
  if (!isAdmin) {
    weeklyAdminStatus.textContent = "Only admins can edit the schedule.";
    return;
  }

  const scheduleRows = collectManualScheduleRows();
  const validationError = validateManualScheduleRows(scheduleRows);

  if (validationError) {
    manualScheduleStatus.textContent = validationError;
    return;
  }

  saveManualScheduleButton.disabled = true;
  weeklyAdminStatus.textContent = "Saving manual schedule...";
  manualScheduleStatus.textContent = "Saving schedule...";

  const rowIdsToKeep = new Set(scheduleRows.map(row => row.existingMatchup?.id).filter(Boolean));

  for (const row of scheduleRows) {
    if (row.locked) {
      continue;
    }

    const teamsChanged = didManualScheduleTeamsChange(row);
    const payload = {
      league_id: selectedLeagueId,
      phase: "regular",
      matchup_number: row.matchupNumber,
      display_order: row.displayOrder,
      team1_id: row.team1Id,
      team2_id: row.team2Id,
      team1_score: null,
      team2_score: null,
      winner_team_id: null,
      completed: false
    };

    if (!row.existingMatchup || teamsChanged) {
      payload.pick_lock_at = null;
    }

    if (row.existingMatchup) {
      if (teamsChanged) {
        await clearPicksForMatchup(row.existingMatchup.id);
      }

      const { error } = await supabaseClient
        .from("league_matchups")
        .update(payload)
        .eq("id", row.existingMatchup.id);

      if (error) {
        console.error("Update manual schedule error:", error);
        manualScheduleStatus.textContent = "Could not update schedule. Check console.";
        weeklyAdminStatus.textContent = "Manual schedule save failed.";
        saveManualScheduleButton.disabled = false;
        return;
      }
    } else {
      const { error } = await supabaseClient
        .from("league_matchups")
        .insert({
          id: makeId(),
          ...payload
        });

      if (error) {
        console.error("Insert manual schedule error:", error);
        manualScheduleStatus.textContent = "Could not create schedule. Check console.";
        weeklyAdminStatus.textContent = "Manual schedule save failed.";
        saveManualScheduleButton.disabled = false;
        return;
      }
    }
  }

  const editableExtras = leagueMatchups.filter(matchup => {
    return matchup.phase === "regular" &&
      !rowIdsToKeep.has(matchup.id) &&
      !isMatchupLocked(matchup);
  });

  for (const matchup of editableExtras) {
    const { error } = await supabaseClient
      .from("league_matchups")
      .delete()
      .eq("id", matchup.id);

    if (error) {
      console.error("Delete extra manual schedule row error:", error);
      manualScheduleStatus.textContent = "Schedule saved, but an extra old matchup could not be removed.";
      weeklyAdminStatus.textContent = "Manual schedule partially saved.";
      saveManualScheduleButton.disabled = false;
      return;
    }
  }

  const leagueUpdate = {
    schedule_generated: true
  };

  if (!currentLeague.schedule_generated) {
    leagueUpdate.current_matchup_number = 1;
    leagueUpdate.season_phase = "regular";
  }

  const { error: leagueUpdateError } = await supabaseClient
    .from("leagues")
    .update(leagueUpdate)
    .eq("id", selectedLeagueId);

  if (leagueUpdateError) {
    console.error("Manual schedule league update error:", leagueUpdateError);
    manualScheduleStatus.textContent = "Schedule saved, but league status failed.";
    weeklyAdminStatus.textContent = "Manual schedule partially saved.";
    saveManualScheduleButton.disabled = false;
    return;
  }

  manualScheduleStatus.textContent = "Manual schedule saved.";
  weeklyAdminStatus.textContent = "Manual schedule saved.";
  saveManualScheduleButton.disabled = false;

  await loadLeagueData();
  renderLeagueActivity();
  renderWeeklyMatches();
}

function didManualScheduleTeamsChange(row) {
  return Boolean(row.existingMatchup) &&
    (
      row.existingMatchup.team1_id !== row.team1Id ||
      row.existingMatchup.team2_id !== row.team2Id
    );
}

async function clearPicksForMatchup(matchupId) {
  try {
    const { error } = await supabaseClient
      .from("league_matchup_picks")
      .delete()
      .eq("league_id", selectedLeagueId)
      .eq("matchup_id", matchupId);

    if (error) {
      console.warn("Could not clear old Pick'em picks:", error);
    }
  } catch (error) {
    console.warn("Pick'em pick cleanup skipped:", error);
  }
}

function collectManualScheduleRows() {
  const matchupCount = getRegularSeasonMatchCount();
  const matchupsPerRound = getMatchupsPerRound();
  const rows = [];

  for (let matchupNumber = 1; matchupNumber <= matchupCount; matchupNumber++) {
    for (let displayOrder = 1; displayOrder <= matchupsPerRound; displayOrder++) {
      const existingMatchup = getExistingMatchup(matchupNumber, displayOrder);
      const team1Input = document.getElementById(`manualTeam1-${matchupNumber}-${displayOrder}`);
      const team2Input = document.getElementById(`manualTeam2-${matchupNumber}-${displayOrder}`);

      rows.push({
        matchupNumber,
        displayOrder,
        existingMatchup,
        locked: existingMatchup ? isMatchupLocked(existingMatchup) : false,
        team1Id: team1Input?.value || existingMatchup?.team1_id || "",
        team2Id: team2Input?.value || existingMatchup?.team2_id || ""
      });
    }
  }

  return rows;
}

function validateManualScheduleRows(rows) {
  if (leagueTeams.length % 2 !== 0) {
    return "Manual schedules require an even number of teams.";
  }

  for (const row of rows) {
    if (!row.team1Id || !row.team2Id) {
      return `Choose both teams for Matchup ${row.matchupNumber}, Game ${row.displayOrder}.`;
    }

    if (row.team1Id === row.team2Id) {
      return `A team cannot play itself in Matchup ${row.matchupNumber}, Game ${row.displayOrder}.`;
    }
  }

  const rowsByMatchup = {};

  rows.forEach(row => {
    if (!rowsByMatchup[row.matchupNumber]) {
      rowsByMatchup[row.matchupNumber] = [];
    }

    rowsByMatchup[row.matchupNumber].push(row);
  });

  for (const [matchupNumber, matchupRows] of Object.entries(rowsByMatchup)) {
    const usedTeamIds = new Set();

    for (const row of matchupRows) {
      if (usedTeamIds.has(row.team1Id) || usedTeamIds.has(row.team2Id)) {
        return `Each team can appear only once in Matchup ${matchupNumber}.`;
      }

      usedTeamIds.add(row.team1Id);
      usedTeamIds.add(row.team2Id);
    }

    if (usedTeamIds.size !== leagueTeams.length) {
      return `Matchup ${matchupNumber} must include every team exactly once.`;
    }
  }

  return "";
}

function getExistingMatchup(matchupNumber, displayOrder) {
  return leagueMatchups.find(matchup => {
    return matchup.matchup_number === matchupNumber &&
      matchup.display_order === displayOrder;
  });
}

function getScheduleSlotKey(matchupNumber, displayOrder) {
  return `${matchupNumber}-${displayOrder}`;
}

function getRegularSeasonMatchCount() {
  return Number(currentLeague?.regular_season_matches || 10);
}

function getMatchupsPerRound() {
  return Math.floor(leagueTeams.length / 2);
}

function isMatchupLocked(matchup) {
  return Boolean(matchup?.completed) ||
    matchup?.team1_score !== null ||
    matchup?.team2_score !== null;
}

function getMatchupLockReason(matchup) {
  if (matchup?.completed) {
    return "Locked because scores were reported.";
  }

  if (matchup?.team1_score !== null || matchup?.team2_score !== null) {
    return "Locked because this matchup has saved score data.";
  }

  return "Locked.";
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
  renderLeagueActivity();
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
  renderLeagueActivity();
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
  renderLeagueActivity();
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
