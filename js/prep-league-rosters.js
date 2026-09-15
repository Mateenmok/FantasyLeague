(() => {
  const readJSON = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("League data could not load.");
    return response.json();
  };
  const read = async () => {
    const [league, accountsData, catalog, rosters] = await Promise.all([
      readJSON("data/league-teams.json?v=prep-live1"),
      readJSON("data/teams.json?v=prep-live1"),
      readJSON("data/pokemon-catalog.json?v=prep-live1"),
      window.PokeLeagueRosters.read(),
    ]);
    const accounts = accountsData.accounts || {};
    const code = String(localStorage.getItem("pokeleague.accessCode") || sessionStorage.getItem("pokeleague.accessCode") || "").trim().toUpperCase();
    const names = new Map(catalog.map(p => [window.PokeLeagueRosters.slugify(p.name), p.name]));
    const sprites = Object.fromEntries(catalog.map(p => [p.name, p.sprite]));
    const teams = Object.fromEntries(league.teams.map(team => {
      const account = Object.values(accounts).find(a => a.teamId === team.id);
      return [team.id, {
        label: team.name,
        color: account?.theme?.accent || "#6fd7f4",
        soft: account?.theme?.surface || "#e8f3ff",
        sprites,
        preferred: (rosters[team.id] || []).map(slug => names.get(slug) || slug),
      }];
    }));
    return { teams, ownTeamId: accounts[code]?.teamId || "" };
  };
  window.PokeLeaguePrepRosters = { read };
})();
