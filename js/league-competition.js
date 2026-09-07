(() => {
  const SUPABASE_URL = "https://cgvxehwqoviihxndupoj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu";
  const LEAGUE_ID = "flash-family-season-1";
  const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };

  const responseError = async (response) => {
    try {
      const body = await response.json();
      return body.message || body.hint || `League request failed (${response.status}).`;
    } catch {
      return `League request failed (${response.status}).`;
    }
  };

  const request = async (path, options = {}) => {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
      cache: options.cache || "no-store",
    });
    if (!response.ok) throw new Error(await responseError(response));
    if (response.status === 204) return null;
    return response.json();
  };

  const read = async () => {
    const leagueQuery = new URLSearchParams({
      id: `eq.${LEAGUE_ID}`,
      select: "current_matchup_number,regular_season_matches,roster_point_cap,playoff_team_count",
      limit: "1",
    });
    const matchupQuery = new URLSearchParams({
      league_id: `eq.${LEAGUE_ID}`,
      select: "week,display_order,home_team_id,away_team_id,home_score,away_score",
      order: "week.asc,display_order.asc",
    });
    const [leagueRows, matchups] = await Promise.all([
      request(`/rest/v1/leagues?${leagueQuery}`),
      request(`/rest/v1/flash_family_matchups?${matchupQuery}`),
    ]);
    const league = leagueRows?.[0];
    if (!league) throw new Error("Flash Family League was not found.");
    return {
      currentWeek: Number(league.current_matchup_number) || 0,
      totalWeeks: Number(league.regular_season_matches) || 10,
      pointCap: Number(league.roster_point_cap) || 50,
      playoffTeamCount: Number(league.playoff_team_count) || 8,
      matchups: matchups || [],
    };
  };

  const readPicks = async () => {
    const query = new URLSearchParams({
      league_id: `eq.${LEAGUE_ID}`,
      select: "week,display_order,account_id,username,picked_team_id,updated_at",
      order: "updated_at.asc",
    });
    return request(`/rest/v1/flash_family_pickems?${query}`);
  };

  const rpc = (name, body) => request(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const submitPick = (accessCode, week, displayOrder, teamId) => rpc("submit_flash_family_pickem", {
    p_access_code: String(accessCode || "").trim().toUpperCase(),
    p_week: week,
    p_display_order: displayOrder,
    p_picked_team_id: teamId,
  });

  const saveSchedule = (accessCode, week, matchups) => rpc("save_flash_family_week_schedule", {
    p_access_code: String(accessCode || "").trim().toUpperCase(),
    p_week: week,
    p_home_team_ids: matchups.map((matchup) => matchup.home),
    p_away_team_ids: matchups.map((matchup) => matchup.away),
  });

  const saveScores = (accessCode, week, results) => rpc("save_flash_family_week_scores", {
    p_access_code: String(accessCode || "").trim().toUpperCase(),
    p_week: week,
    p_display_orders: results.map((result) => result.displayOrder),
    p_home_scores: results.map((result) => result.homeScore),
    p_away_scores: results.map((result) => result.awayScore),
  });

  const setCurrentWeek = (accessCode, week) => rpc("set_flash_family_current_week", {
    p_access_code: String(accessCode || "").trim().toUpperCase(),
    p_week: week,
  });

  window.PokeLeagueCompetition = { read, readPicks, submitPick, saveSchedule, saveScores, setCurrentWeek };
})();
