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
      return body.message || body.hint || `Roster request failed (${response.status}).`;
    } catch {
      return `Roster request failed (${response.status}).`;
    }
  };

  const read = async () => {
    const query = new URLSearchParams({
      league_id: `eq.${LEAGUE_ID}`,
      select: "team_id,pokemon_slug,slot_number",
      order: "slot_number.asc",
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/team_rosters?${query}`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await responseError(response));
    return (await response.json()).reduce((rosters, row) => {
      (rosters[row.team_id] ||= []).push(row.pokemon_slug);
      return rosters;
    }, {});
  };

  const namesFromSlugs = (rosters, catalog, teamIds = []) => {
    const names = new Map(catalog.map((pokemon) => [slugify(pokemon.name), pokemon.name]));
    const normalized = Object.fromEntries(teamIds.map((teamId) => [teamId, []]));
    Object.entries(rosters || {}).forEach(([teamId, slugs]) => {
      normalized[teamId] = (Array.isArray(slugs) ? slugs : [])
        .map((slug) => names.get(slug))
        .filter(Boolean);
    });
    return normalized;
  };

  const replace = async (teamId, pokemonNames, accessCode) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/replace_flash_family_roster`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_access_code: String(accessCode || "").trim().toUpperCase(),
        p_team_id: teamId,
        p_pokemon_slugs: pokemonNames.map(slugify),
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
  };

  const readNicknames = async () => {
    const query = new URLSearchParams({ league_id: `eq.${LEAGUE_ID}`, select: "team_id,pokemon_slug,nickname" });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/flash_family_pokemon_nicknames?${query}`, { headers, cache: "no-store" });
    if (!response.ok) throw new Error(await responseError(response));
    return (await response.json()).reduce((result, row) => {
      (result[row.team_id] ||= {})[row.pokemon_slug] = row.nickname;
      return result;
    }, {});
  };

  const setNickname = async (teamId, pokemonName, nickname, accessCode) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_flash_family_pokemon_nickname`, {
      method: "POST", headers,
      body: JSON.stringify({ p_access_code: String(accessCode || "").trim().toUpperCase(),
        p_team_id: teamId, p_pokemon_slug: slugify(pokemonName), p_nickname: nickname }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    return response.json();
  };
  window.PokeLeagueRosters = { read, replace, namesFromSlugs, slugify, readNicknames, setNickname };
})();
