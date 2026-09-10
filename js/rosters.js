(() => {
  const grid = document.querySelector("[data-rosters-grid]");
  const status = document.querySelector("[data-rosters-status]");
  const seasonTarget = document.querySelector("[data-rosters-season]");
  const teamCountTarget = document.querySelector("[data-rosters-team-count]");
  const pokemonCountTarget = document.querySelector("[data-rosters-pokemon-count]");
  const pointCapTarget = document.querySelector("[data-rosters-point-cap]");

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
  const pointsFor = (pokemon) => Number(pokemon?.points) || 0;

  const initialize = async () => {
    const state = window.PokeLeagueState.read();
    seasonTarget.textContent = state.season;
    try {
      const [teamResponse, accountResponse, catalogResponse, detailResponse, savedRosters, competition] = await Promise.all([
        fetch("data/league-teams.json?v=league-teams2", { cache: "no-store" }),
        fetch("data/teams.json?v=teams8", { cache: "no-store" }),
        fetch("data/pokemon-catalog.json?v=season-1-3"),
        fetch("data/pokemon-detail-index.json?v=draft-v113"),
        window.PokeLeagueRosters.read().catch(() => null),
        window.PokeLeagueCompetition.read().catch(() => null),
      ]);
      if (!teamResponse.ok || !accountResponse.ok || !catalogResponse.ok || !detailResponse.ok) {
        throw new Error("League rosters could not be loaded.");
      }
      const [teamData, accountData, baseCatalog, detailIndex] = await Promise.all([
        teamResponse.json(), accountResponse.json(), catalogResponse.json(), detailResponse.json(),
      ]);
      const teams = teamData.teams || [];
      const catalog = window.PokeLeagueState.applyCatalog(baseCatalog, state);
      const rosters = savedRosters
        ? window.PokeLeagueRosters.namesFromSlugs(savedRosters, catalog, teams.map((team) => team.id))
        : state.rosters || {};
      const owners = new Map(Object.values(accountData.accounts || {}).map((account) => [account.teamId, account]));
      const pointCap = Number(competition?.pointCap || state.pointCap) || 50;
      const cards = teams.map((team, index) => {
        const account = owners.get(team.id);
        const pokemon = (rosters[team.id] || [])
          .map((name) => catalog.find((candidate) => normalize(candidate.name) === normalize(name)))
          .filter(Boolean);
        const points = pokemon.reduce((total, pick) => total + pointsFor(pick), 0);
        const accent = account?.theme?.accent || ["#ef70ef", "#70e3ff", "#f49b21"][index % 3];
        const deep = account?.theme?.deep || "#301844";
        return `
          <article class="team-roster-board" style="--team-accent:${escapeHtml(accent)};--team-deep:${escapeHtml(deep)}">
            <header class="team-roster-heading">
              <img src="${escapeHtml(team.logo)}" alt="${escapeHtml(team.name)} logo" loading="lazy">
              <div>
                <p>${escapeHtml(account?.accountName || "League manager")}'s clubhouse</p>
                <h2>${escapeHtml(team.name)}</h2>
                <span>${pokemon.length} / 10 Pokémon · ${points} / ${pointCap} points</span>
              </div>
            </header>
            <div class="compact-roster-grid">
              ${pokemon.length ? pokemon.map((pick) => window.PokeLeagueRosterCards.render(pick, detailIndex)).join("")
                : '<p class="rosters-empty">This roster has not been filled yet.</p>'}
            </div>
          </article>`;
      });
      const totalPokemon = Object.values(rosters).reduce((total, roster) => total + (Array.isArray(roster) ? roster.length : 0), 0);
      grid.innerHTML = cards.join("");
      teamCountTarget.textContent = teams.length;
      pokemonCountTarget.textContent = totalPokemon;
      pointCapTarget.textContent = pointCap;
      status.textContent = `${teams.length} team rosters loaded.`;
    } catch (error) {
      status.textContent = error.message || "League rosters could not be loaded.";
      status.classList.add("is-error");
      grid.innerHTML = '<p class="rosters-page-empty">The roster room is unavailable. Please refresh and try again.</p>';
    }
  };

  initialize();
})();
