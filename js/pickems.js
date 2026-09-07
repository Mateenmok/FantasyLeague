(() => {
  const grid = document.querySelector("[data-matchup-grid]");
  const weekTarget = document.querySelector("[data-pickems-week]");
  const status = document.querySelector("[data-pickems-status]");
  const identity = document.querySelector("[data-picker-identity]");
  const leaderboard = document.querySelector("[data-pickems-leaderboard]");
  const dialog = document.querySelector("[data-matchup-dialog]");
  const dialogTitle = document.querySelector("[data-matchup-dialog-title]");
  const rosterColumns = document.querySelector("[data-matchup-roster-columns]");

  let teams = [];
  let catalog = [];
  let rosters = {};
  let matchups = [];
  let allMatchups = [];
  let picks = [];
  let account = null;
  let accessCode = "";
  let week = 1;
  let serverBacked = true;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
  const teamFor = (teamId) => teams.find((team) => team.id === teamId);

  const defaultSchedule = (number) => {
    const ids = teams.map((team) => team.id);
    if (!ids.length) return [];
    const rotating = ids.slice(1);
    const offset = Math.max(0, Number(number) - 1) % rotating.length;
    const order = [ids[0], ...rotating.slice(offset), ...rotating.slice(0, offset)];
    return Array.from({ length: order.length / 2 }, (_, index) => ({
      week: number,
      display_order: index + 1,
      home_team_id: order[index],
      away_team_id: order[order.length - 1 - index],
      home_score: null,
      away_score: null,
    }));
  };

  const localPicksKey = () => `pokeleague.pickems.${account?.id || "guest"}`;
  const readLocalPicks = () => {
    try { return JSON.parse(localStorage.getItem(localPicksKey())) || []; } catch { return []; }
  };

  const currentPick = (displayOrder) => picks.find((pick) => (
    Number(pick.week) === week
    && Number(pick.display_order) === Number(displayOrder)
    && pick.account_id === account?.id
  ));

  const matchupComplete = (matchup) => matchup.home_score != null && matchup.away_score != null;
  const matchupWinner = (matchup) => {
    if (!matchupComplete(matchup) || Number(matchup.home_score) === Number(matchup.away_score)) return null;
    return Number(matchup.home_score) > Number(matchup.away_score) ? matchup.home_team_id : matchup.away_team_id;
  };

  const renderMatchups = () => {
    if (!matchups.length) {
      grid.innerHTML = '<p class="pickems-empty">This week’s matchups have not been posted yet.</p>';
      return;
    }
    grid.innerHTML = matchups.map((matchup) => {
      const home = teamFor(matchup.home_team_id);
      const away = teamFor(matchup.away_team_id);
      const selected = currentPick(matchup.display_order)?.picked_team_id;
      const complete = matchupComplete(matchup);
      const result = complete ? `${matchup.home_score} – ${matchup.away_score}` : "VS";
      const teamButton = (team) => `
        <button class="matchup-team${selected === team.id ? " is-picked" : ""}" type="button"
          data-pick-team="${escapeHtml(team.id)}" data-display-order="${matchup.display_order}"
          aria-pressed="${selected === team.id}" ${!account || complete ? "disabled" : ""}>
          <img src="${escapeHtml(team.logo)}" alt="" loading="lazy">
          <strong>${escapeHtml(team.name)}</strong>
          <span>${selected === team.id ? "Your pick" : "Pick winner"}</span>
        </button>`;
      return `
        <article class="pickem-matchup" data-open-matchup="${matchup.display_order}" tabindex="0" role="button" aria-label="View ${escapeHtml(home.name)} versus ${escapeHtml(away.name)} rosters">
          <span class="matchup-number">Match ${matchup.display_order}</span>
          <div class="matchup-teams">
            ${teamButton(home)}
            <span class="matchup-versus">${result}</span>
            ${teamButton(away)}
          </div>
          <span class="view-rosters">View both rosters →</span>
        </article>`;
    }).join("");
  };

  const renderLeaderboard = () => {
    const entrants = new Map();
    picks.forEach((pick) => {
      const entry = entrants.get(pick.account_id) || { username: pick.username, correct: 0, scored: 0, picks: 0 };
      entry.picks += 1;
      const matchup = allMatchups.find((candidate) => Number(candidate.week) === Number(pick.week) && Number(candidate.display_order) === Number(pick.display_order));
      const winner = matchup && matchupWinner(matchup);
      if (winner) {
        entry.scored += 1;
        if (winner === pick.picked_team_id) entry.correct += 1;
      }
      entrants.set(pick.account_id, entry);
    });
    const rows = [...entrants.values()].sort((a, b) => b.correct - a.correct || b.scored - a.scored || a.username.localeCompare(b.username));
    leaderboard.innerHTML = rows.length ? rows.map((entry, index) => `
      <article class="leaderboard-row">
        <span class="leaderboard-place">${index + 1}</span>
        <span class="leaderboard-user"><strong>${escapeHtml(entry.username)}</strong><small>${entry.picks} prediction${entry.picks === 1 ? "" : "s"} submitted</small></span>
        <span class="leaderboard-score"><strong>${entry.correct}</strong><small>correct</small></span>
      </article>`).join("") : '<p class="pickems-empty">No predictions have been submitted yet. Make the first picks!</p>';
  };

  const announce = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };

  const submitPick = async (displayOrder, teamId) => {
    if (!account) return announce("Sign in with a league access code to make picks.", true);
    const button = grid.querySelector(`[data-display-order="${displayOrder}"][data-pick-team="${CSS.escape(teamId)}"]`);
    grid.setAttribute("aria-busy", "true");
    if (button) button.disabled = true;
    try {
      if (serverBacked) {
        await window.PokeLeagueCompetition.submitPick(accessCode, week, Number(displayOrder), teamId);
        picks = await window.PokeLeagueCompetition.readPicks();
      } else {
        picks = picks.filter((pick) => !(Number(pick.week) === week && Number(pick.display_order) === Number(displayOrder) && pick.account_id === account.id));
        picks.push({ week, display_order: Number(displayOrder), account_id: account.id, username: account.accountName, picked_team_id: teamId });
        localStorage.setItem(localPicksKey(), JSON.stringify(picks));
      }
      announce(`${teamFor(teamId).name} locked in for Match ${displayOrder}.`);
      renderMatchups();
      renderLeaderboard();
    } catch (error) {
      announce(error.message || "That pick could not be saved.", true);
    } finally {
      grid.removeAttribute("aria-busy");
    }
  };

  const rosterCard = (pokemon) => `
    <article class="pickems-pokemon">
      <img src="${escapeHtml(pokemon.sprite)}" alt="" loading="lazy">
      <strong>${escapeHtml(pokemon.name)}</strong>
      <small>${escapeHtml(pokemon.points)} pts</small>
    </article>`;

  const openMatchup = (displayOrder) => {
    const matchup = matchups.find((candidate) => Number(candidate.display_order) === Number(displayOrder));
    if (!matchup) return;
    const matchupTeams = [teamFor(matchup.home_team_id), teamFor(matchup.away_team_id)];
    dialogTitle.textContent = `${matchupTeams[0].name} vs ${matchupTeams[1].name}`;
    rosterColumns.innerHTML = matchupTeams.map((team) => {
      const pokemon = (rosters[team.id] || []).map((name) => catalog.find((candidate) => normalize(candidate.name) === normalize(name))).filter(Boolean);
      return `
        <section class="matchup-roster-team">
          <header><img src="${escapeHtml(team.logo)}" alt=""><h3>${escapeHtml(team.name)}</h3></header>
          <div class="matchup-roster-list">${pokemon.length ? pokemon.map(rosterCard).join("") : '<p class="pickems-empty">Roster not filled yet.</p>'}</div>
        </section>`;
    }).join('<span class="roster-vs" aria-hidden="true">VS</span>');
    dialog.showModal();
  };

  grid.addEventListener("click", (event) => {
    const pickButton = event.target.closest("[data-pick-team]");
    if (pickButton) {
      event.stopPropagation();
      if (!pickButton.disabled) submitPick(pickButton.dataset.displayOrder, pickButton.dataset.pickTeam);
      return;
    }
    const card = event.target.closest("[data-open-matchup]");
    if (card) openMatchup(card.dataset.openMatchup);
  });
  grid.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-open-matchup]");
    if (card && !event.target.closest("button") && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      openMatchup(card.dataset.openMatchup);
    }
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  const initialize = async () => {
    try {
      accessCode = (localStorage.getItem("pokeleague.accessCode") || sessionStorage.getItem("pokeleague.accessCode") || "").trim().toUpperCase();
      const [teamResponse, accountResponse, catalogResponse, savedRosters] = await Promise.all([
        fetch("data/league-teams.json?v=league-teams1", { cache: "no-store" }),
        fetch("data/teams.json?v=teams7", { cache: "no-store" }),
        fetch("data/pokemon-catalog.json?v=season-1-3"),
        window.PokeLeagueRosters.read().catch(() => null),
      ]);
      if (!teamResponse.ok || !accountResponse.ok || !catalogResponse.ok) throw new Error("Pick'ems data could not be loaded.");
      const teamData = await teamResponse.json();
      const accountData = await accountResponse.json();
      const baseCatalog = await catalogResponse.json();
      teams = teamData.teams || [];
      account = accountData.accounts?.[accessCode] || null;
      catalog = window.PokeLeagueState.applyCatalog(baseCatalog);
      rosters = savedRosters ? window.PokeLeagueRosters.namesFromSlugs(savedRosters, baseCatalog, teams.map((team) => team.id)) : {};

      let competition;
      try {
        competition = await window.PokeLeagueCompetition.read();
        picks = await window.PokeLeagueCompetition.readPicks();
      } catch {
        serverBacked = false;
        const state = window.PokeLeagueState.read();
        competition = { currentWeek: state.currentWeek, matchups: [] };
        picks = readLocalPicks();
      }
      week = Math.max(1, Number(competition.currentWeek) || 0);
      allMatchups = competition.matchups || [];
      matchups = allMatchups.filter((matchup) => Number(matchup.week) === week);
      if (!matchups.length) {
        matchups = defaultSchedule(week);
        allMatchups = [...allMatchups, ...matchups];
      }
      weekTarget.textContent = week;
      identity.textContent = account ? `Picking as ${account.accountName}` : "Sign in to make picks";
      announce(account ? "Select a team to lock in your prediction. Tap a matchup card to compare rosters." : "You can browse matchups, but must sign in to submit predictions.");
      renderMatchups();
      renderLeaderboard();
    } catch (error) {
      announce(error.message || "Pick'ems could not be loaded.", true);
      grid.innerHTML = '<p class="pickems-empty">The weekly card is unavailable.</p>';
    }
  };

  initialize();
})();
