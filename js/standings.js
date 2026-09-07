(() => {
  const body = document.querySelector("[data-standings-body]");
  const playoffGrid = document.querySelector("[data-playoff-grid]");
  const playoffCount = document.querySelector("[data-playoff-count]");
  const season = document.querySelector("[data-standings-season]");
  const dialog = document.querySelector("[data-roster-dialog]");
  const rosterLogo = document.querySelector("[data-roster-team-logo]");
  const rosterName = document.querySelector("[data-roster-team-name]");
  const rosterRecord = document.querySelector("[data-roster-team-record]");
  const rosterGrid = document.querySelector("[data-roster-grid]");

  let teams = [];
  let catalog = [];
  let rosters = {};
  let standings = [];

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const normalize = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");

  const winPct = (record) => {
    const decisions = record.wins + record.losses;
    return decisions ? record.wins / decisions : 0;
  };

  const winPctLabel = (record) => winPct(record).toFixed(3).replace(/^0/, "");

  const buildStandings = (state) => {
    const records = Object.fromEntries(teams.map((team, index) => [team.id, {
      team,
      originalIndex: index,
      wins: 0,
      losses: 0,
      gameWins: 0,
    }]));

    Object.values(state.scores || {}).flat().forEach((result) => {
      const home = records[result?.home];
      const away = records[result?.away];
      if (!home || !away || result.homeScore == null || result.awayScore == null) return;
      const homeScore = Number(result.homeScore);
      const awayScore = Number(result.awayScore);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return;
      home.gameWins += Math.max(0, homeScore);
      away.gameWins += Math.max(0, awayScore);
      if (homeScore > awayScore) {
        home.wins += 1;
        away.losses += 1;
      } else if (awayScore > homeScore) {
        away.wins += 1;
        home.losses += 1;
      }
    });

    return Object.values(records).sort((a, b) => (
      winPct(b) - winPct(a)
      || b.gameWins - a.gameWins
      || b.wins - a.wins
      || a.losses - b.losses
      || a.originalIndex - b.originalIndex
    ));
  };

  const teamButton = (entry) => `
    <button class="standing-team-button" type="button" data-open-team="${escapeHtml(entry.team.id)}">
      <img src="${escapeHtml(entry.team.logo)}" alt="" loading="lazy">
      <strong>${escapeHtml(entry.team.name)}</strong>
    </button>`;

  const renderTable = () => {
    body.innerHTML = standings.map((entry, index) => `
      <tr>
        <td class="standing-rank">${index + 1}</td>
        <td>${teamButton(entry)}</td>
        <td class="standing-stat">${entry.wins}</td>
        <td class="standing-stat">${entry.losses}</td>
        <td class="standing-stat">${entry.gameWins}</td>
        <td class="standing-stat">${winPctLabel(entry)}</td>
      </tr>`).join("");
  };

  const renderPlayoffs = (state) => {
    const count = Math.min(teams.length, Math.max(2, Number(state.playoffs?.teamCount) || 8));
    playoffCount.textContent = `Top ${count}`;
    playoffGrid.innerHTML = standings.slice(0, count).map((entry, index) => `
      <button class="playoff-team" type="button" data-open-team="${escapeHtml(entry.team.id)}">
        <span class="playoff-seed">${index + 1}</span>
        <img src="${escapeHtml(entry.team.logo)}" alt="" loading="lazy">
        <span><strong>${escapeHtml(entry.team.name)}</strong><span>${entry.wins}–${entry.losses} · ${entry.gameWins} GW</span></span>
      </button>`).join("");
  };

  const openRoster = (teamId) => {
    const entry = standings.find((candidate) => candidate.team.id === teamId);
    if (!entry) return;
    const names = rosters[teamId] || [];
    const pokemon = names
      .map((name) => catalog.find((candidate) => normalize(candidate.name) === normalize(name)))
      .filter(Boolean);

    rosterLogo.src = entry.team.logo;
    rosterLogo.alt = `${entry.team.name} logo`;
    rosterName.textContent = entry.team.name;
    rosterRecord.textContent = `${entry.wins}–${entry.losses} record · ${entry.gameWins} game wins`;
    rosterGrid.innerHTML = pokemon.length ? pokemon.map((pick) => `
      <article class="standings-pokemon-card">
        <img src="${escapeHtml(pick.sprite)}" alt="" loading="lazy">
        <strong>${escapeHtml(pick.name)}</strong>
        <small>${escapeHtml(pick.tier)} · ${escapeHtml(pick.points)} pts</small>
      </article>`).join("") : '<p class="standings-roster-empty">This roster has not been filled yet.</p>';
    dialog.showModal();
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-team]");
    if (button) openRoster(button.dataset.openTeam);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  const state = window.PokeLeagueState.read();
  season.textContent = state.season;

  Promise.all([
    fetch("data/league-teams.json?v=league-teams1", { cache: "no-store" }),
    fetch("data/pokemon-catalog.json?v=season-1-3"),
    window.PokeLeagueRosters.read().catch(() => null),
  ]).then(async ([teamResponse, catalogResponse, savedRosters]) => {
    if (!teamResponse.ok || !catalogResponse.ok) throw new Error("Standings data could not be loaded.");
    const [teamData, baseCatalog] = await Promise.all([teamResponse.json(), catalogResponse.json()]);
    teams = teamData.teams || [];
    catalog = window.PokeLeagueState.applyCatalog(baseCatalog, state);
    rosters = savedRosters
      ? window.PokeLeagueRosters.namesFromSlugs(savedRosters, baseCatalog, teams.map((team) => team.id))
      : state.rosters || {};
    standings = buildStandings(state);
    renderTable();
    renderPlayoffs(state);
  }).catch((error) => {
    body.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message || "Standings are unavailable.")}</td></tr>`;
    playoffGrid.innerHTML = '<p class="standings-roster-empty">Playoff picture unavailable.</p>';
  });
})();
