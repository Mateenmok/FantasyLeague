(() => {
  const STORAGE_KEY = "pokeleague.leagueState.v1";
  const DEFAULT_STATE = {
    season: 1,
    currentWeek: 0,
    totalWeeks: 10,
    pointCap: 50,
    rosters: {},
    schedules: {},
    scores: {},
    pointOverrides: {},
    playoffs: { teamCount: 8, seeds: [] },
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const normalize = (saved = {}) => ({
    ...clone(DEFAULT_STATE),
    ...saved,
    season: Number.isInteger(Number(saved.season)) ? Number(saved.season) : DEFAULT_STATE.season,
    currentWeek: Number.isInteger(Number(saved.currentWeek)) ? Math.max(0, Number(saved.currentWeek)) : DEFAULT_STATE.currentWeek,
    totalWeeks: Number.isInteger(Number(saved.totalWeeks)) ? Math.max(1, Number(saved.totalWeeks)) : DEFAULT_STATE.totalWeeks,
    pointCap: Number.isFinite(Number(saved.pointCap)) ? Math.max(1, Number(saved.pointCap)) : DEFAULT_STATE.pointCap,
    rosters: saved.rosters && typeof saved.rosters === "object" ? saved.rosters : {},
    schedules: saved.schedules && typeof saved.schedules === "object" ? saved.schedules : {},
    scores: saved.scores && typeof saved.scores === "object" ? saved.scores : {},
    pointOverrides: saved.pointOverrides && typeof saved.pointOverrides === "object" ? saved.pointOverrides : {},
    playoffs: {
      ...clone(DEFAULT_STATE.playoffs),
      ...(saved.playoffs && typeof saved.playoffs === "object" ? saved.playoffs : {}),
    },
  });

  const read = () => {
    try {
      return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
    } catch {
      return clone(DEFAULT_STATE);
    }
  };

  const write = (nextState) => {
    const state = normalize(nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("pokeleague:statechange", { detail: clone(state) }));
    return state;
  };

  const tierForPoints = (points) => {
    const value = Number(points) || 0;
    if (value >= 8) return "Diamond";
    if (value >= 5) return "Gold";
    if (value >= 3) return "Silver";
    return "Bronze";
  };

  const applyCatalog = (catalog, state = read()) => catalog.map((pokemon) => {
    const override = Number(state.pointOverrides?.[pokemon.name]);
    if (!Number.isFinite(override) || override < 1) return { ...pokemon };
    return {
      ...pokemon,
      points: String(override),
      sortPoints: override,
      tier: tierForPoints(override),
    };
  });

  const recordsFor = (teams, state = read()) => {
    const records = Object.fromEntries(teams.map((team) => [team.id, { wins: 0, losses: 0, ties: 0 }]));
    Object.values(state.scores || {}).flat().forEach((matchup) => {
      const homeScore = Number(matchup?.homeScore);
      const awayScore = Number(matchup?.awayScore);
      if (!records[matchup?.home] || !records[matchup?.away] || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return;
      if (homeScore === awayScore) {
        records[matchup.home].ties += 1;
        records[matchup.away].ties += 1;
      } else if (homeScore > awayScore) {
        records[matchup.home].wins += 1;
        records[matchup.away].losses += 1;
      } else {
        records[matchup.away].wins += 1;
        records[matchup.home].losses += 1;
      }
    });
    return records;
  };

  window.PokeLeagueState = {
    storageKey: STORAGE_KEY,
    defaults: clone(DEFAULT_STATE),
    read,
    write,
    tierForPoints,
    applyCatalog,
    recordsFor,
  };
})();
