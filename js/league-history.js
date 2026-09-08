(() => {
  const tabs = [...document.querySelectorAll("[data-season-tab]")];
  const panels = [...document.querySelectorAll("[data-season-panel]")];
  const teamFilter = document.querySelector("[data-history-team-filter]");
  const weekBar = document.querySelector("[data-history-week-bar]");
  const weekTarget = document.querySelector("[data-history-week]");
  const weekMode = document.querySelector("[data-history-week-mode]");
  const previousButton = document.querySelector("[data-history-week-prev]");
  const nextButton = document.querySelector("[data-history-week-next]");
  const status = document.querySelector("[data-history-status]");
  const scoreGrid = document.querySelector("[data-history-scores]");
  const honorsGrid = document.querySelector("[data-season-zero-honors]");

  const SEASON_ZERO = [
    { place: 1, team: "Smear Squad", gm: "Pufferz", logo: "images/history/smear-squad.webp?v=history1", mvps: ["Milotic", "Incineroar", "Aegislash"] },
    { place: 2, team: "Fukushima Fear", gm: "Fear", logo: "images/history/fukushima-fear.webp?v=history1", mvps: ["Gengar", "Sableye", "Feraligatr"] },
    { place: 3, team: "Miami Dragapults", gm: "FLash", logo: "images/teams/draft/miami-dragapults.png", mvps: ["Greninja"] },
    { place: 4, team: "Massachusetts Midnight", gm: "Kirbbles", logo: "images/teams/draft/massachusetts-midnight.png", mvps: ["Umbreon"] },
  ];

  let teams = [];
  let catalog = [];
  let matchups = [];
  let currentWeek = 0;
  let selectedWeek = 0;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
  const teamFor = (teamId) => teams.find((team) => team.id === teamId) || { id: teamId, name: "Unknown team", logo: "images/favicon.webp" };

  const scoreLabel = (matchup) => {
    if (matchup.home_score == null || matchup.away_score == null) return '<span class="history-pending">Pending</span>';
    return `<strong>${escapeHtml(matchup.home_score)}<span aria-hidden="true">–</span>${escapeHtml(matchup.away_score)}</strong>`;
  };

  const matchupCard = (matchup, showWeek = false) => {
    const home = teamFor(matchup.home_team_id);
    const away = teamFor(matchup.away_team_id);
    return `
      <article class="history-score-card">
        ${showWeek ? `<span class="history-score-week">Week ${escapeHtml(matchup.week)}</span>` : ""}
        <div class="history-score-team">
          <img src="${escapeHtml(home.logo)}" alt="" loading="lazy">
          <strong>${escapeHtml(home.name)}</strong>
        </div>
        <div class="history-score-value">${scoreLabel(matchup)}</div>
        <div class="history-score-team history-score-team--away">
          <img src="${escapeHtml(away.logo)}" alt="" loading="lazy">
          <strong>${escapeHtml(away.name)}</strong>
        </div>
      </article>`;
  };

  const renderScores = () => {
    const selectedTeam = teamFilter.value;
    const team = selectedTeam ? teamFor(selectedTeam) : null;
    const visible = selectedTeam
      ? matchups.filter((matchup) => Number(matchup.week) <= currentWeek && (matchup.home_team_id === selectedTeam || matchup.away_team_id === selectedTeam))
      : matchups.filter((matchup) => Number(matchup.week) === selectedWeek);

    weekBar.classList.toggle("is-team-history", Boolean(selectedTeam));
    weekMode.textContent = selectedTeam ? "Complete team history" : "League week";
    weekTarget.textContent = selectedTeam ? "All weeks" : `Week ${selectedWeek}`;
    previousButton.disabled = Boolean(selectedTeam) || selectedWeek <= 0;
    nextButton.disabled = Boolean(selectedTeam) || selectedWeek >= currentWeek;

    if (!visible.length) {
      const copy = selectedTeam
        ? `${team.name} does not have any recorded Season 1 matchups yet.`
        : selectedWeek === 0
          ? "Week 0 is the preseason. Scores will appear here when league play begins."
          : `Week ${selectedWeek} does not have any scheduled matchups yet.`;
      status.textContent = copy;
      scoreGrid.innerHTML = `<div class="history-empty"><strong>${selectedWeek === 0 && !selectedTeam ? "Preseason" : "No games yet"}</strong><span>${escapeHtml(copy)}</span></div>`;
      return;
    }

    status.textContent = selectedTeam
      ? `Showing every Season 1 matchup for ${team.name}.`
      : `Showing ${visible.length} matchup${visible.length === 1 ? "" : "s"} from Week ${selectedWeek}.`;
    scoreGrid.innerHTML = visible.map((matchup) => matchupCard(matchup, Boolean(selectedTeam))).join("");
  };

  const renderHonors = () => {
    honorsGrid.innerHTML = SEASON_ZERO.map((entry) => {
      const mvps = entry.mvps.map((name) => catalog.find((pokemon) => normalize(pokemon.name) === normalize(name)) || { name, sprite: "images/favicon.webp" });
      return `
        <article class="history-honor-card history-honor-card--${entry.place}">
          <span class="history-rank" aria-label="${entry.place === 1 ? "First" : entry.place === 2 ? "Second" : entry.place === 3 ? "Third" : "Fourth"} place">
            ${entry.place === 1 ? '<span class="history-crown" aria-hidden="true">👑</span>' : ""}<strong>${entry.place}</strong><small>${entry.place === 1 ? "ST" : entry.place === 2 ? "ND" : entry.place === 3 ? "RD" : "TH"}</small>
          </span>
          <img class="history-honor-logo" src="${escapeHtml(entry.logo)}" alt="${escapeHtml(entry.team)} logo" loading="lazy">
          <div class="history-honor-copy">
            <p>Season 0 ${entry.place === 1 ? "Champion" : `Place ${entry.place}`}</p>
            <h3>${escapeHtml(entry.team)}</h3>
            <span>GM · ${escapeHtml(entry.gm)}</span>
          </div>
          <div class="history-mvps">
            <p>Team MVP${mvps.length === 1 ? "" : "s"}</p>
            <div>${mvps.map((pokemon) => `
              <span class="history-mvp">
                <img src="${escapeHtml(pokemon.sprite)}" alt="" loading="lazy">
                <strong>${escapeHtml(pokemon.name)}</strong>
              </span>`).join("")}</div>
          </div>
        </article>`;
    }).join("");
  };

  const activateTab = (season) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.seasonTab === season;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.seasonPanel !== season; });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.seasonTab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + offset + tabs.length) % tabs.length];
      activateTab(next.dataset.seasonTab);
      next.focus();
    });
  });

  previousButton.addEventListener("click", () => { selectedWeek = Math.max(0, selectedWeek - 1); renderScores(); });
  nextButton.addEventListener("click", () => { selectedWeek = Math.min(currentWeek, selectedWeek + 1); renderScores(); });
  teamFilter.addEventListener("change", renderScores);

  Promise.all([
    fetch("data/league-teams.json?v=league-teams2", { cache: "no-store" }),
    fetch("data/pokemon-catalog.json?v=season-1-3"),
    window.PokeLeagueCompetition.read().catch(() => null),
  ]).then(async ([teamResponse, catalogResponse, competition]) => {
    if (!teamResponse.ok || !catalogResponse.ok) throw new Error("League history could not be loaded.");
    const [teamData, baseCatalog] = await Promise.all([teamResponse.json(), catalogResponse.json()]);
    teams = teamData.teams || [];
    catalog = window.PokeLeagueState.applyCatalog(baseCatalog);
    const fallback = window.PokeLeagueState.read();
    currentWeek = Math.max(0, Number(competition?.currentWeek ?? fallback.currentWeek) || 0);
    matchups = competition?.matchups || Object.entries(fallback.schedules || {}).flatMap(([week, games]) => (games || []).map((game, index) => ({
      week: Number(week),
      display_order: index + 1,
      home_team_id: game.home,
      away_team_id: game.away,
      home_score: (fallback.scores?.[week] || [])[index]?.homeScore ?? null,
      away_score: (fallback.scores?.[week] || [])[index]?.awayScore ?? null,
    })));
    teamFilter.insertAdjacentHTML("beforeend", teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join(""));
    renderHonors();
    renderScores();
  }).catch((error) => {
    status.textContent = error.message || "League history is unavailable.";
    scoreGrid.innerHTML = '<div class="history-empty"><strong>Archives unavailable</strong><span>Please refresh and try again.</span></div>';
    catalog = [];
    renderHonors();
  });
})();
