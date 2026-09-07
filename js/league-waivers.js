(() => {
  const SUPABASE_URL = "https://cgvxehwqoviihxndupoj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu";
  const LEAGUE_ID = "flash-family-season-1";
  const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
  };

  const slugify = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const responseError = async (response) => {
    try {
      const body = await response.json();
      return body.message || body.hint || `Waiver request failed (${response.status}).`;
    } catch {
      return `Waiver request failed (${response.status}).`;
    }
  };

  const rpc = async (name, body) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await responseError(response));
  };

  const readSettings = async () => {
    const query = new URLSearchParams({
      id: `eq.${LEAGUE_ID}`,
      select: "waiver_window_start_at,waiver_window_end_at,roster_point_cap,roster_pokemon_cap,regular_season_matches",
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leagues?${query}`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await responseError(response));
    const [settings] = await response.json();
    if (!settings) throw new Error("Waiver settings are unavailable.");
    return {
      startAt: settings.waiver_window_start_at,
      endAt: settings.waiver_window_end_at,
      pointCap: Number(settings.roster_point_cap) || 50,
      rosterCap: Number(settings.roster_pokemon_cap) || 10,
      totalWeeks: Number(settings.regular_season_matches) || 10,
    };
  };

  const setWindow = (accessCode, startAt, endAt) => rpc("set_flash_family_waiver_window", {
    p_access_code: String(accessCode || "").trim().toUpperCase(),
    p_start_at: startAt,
    p_end_at: endAt,
  });

  const setSeasonRules = (accessCode, totalWeeks, pointCap) => rpc("set_flash_family_season_rules", {
    p_access_code: String(accessCode || "").trim().toUpperCase(),
    p_total_weeks: Number(totalWeeks),
    p_point_cap: Number(pointCap),
  });

  const transact = ({ accessCode, teamId, addName = null, dropName = null, resultingPoints }) => (
    rpc("submit_flash_family_waiver", {
      p_access_code: String(accessCode || "").trim().toUpperCase(),
      p_team_id: teamId,
      p_add_slug: addName ? slugify(addName) : null,
      p_drop_slug: dropName ? slugify(dropName) : null,
      p_resulting_points: Number(resultingPoints),
    })
  );

  window.PokeLeagueWaivers = { readSettings, setWindow, setSeasonRules, transact, slugify };
})();
