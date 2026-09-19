(() => {
  const save = async (accessCode, week, displayOrder, home, away, game, expectedGame, homeScore, awayScore) => {
    const response = await fetch('https://cgvxehwqoviihxndupoj.supabase.co/rest/v1/rpc/save_flash_family_game_details', {
      method: 'POST',
      headers: { apikey: 'sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu', 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_access_code: accessCode, p_week: week, p_display_order: displayOrder,
        p_home_team_id: home, p_away_team_id: away, p_game: game, p_expected_game: expectedGame || null,
        p_home_score: homeScore, p_away_score: awayScore }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Game details could not be saved. Please try again.');
    }
    return response.json();
  };
  window.PokeLeagueGameReports = { save };
})();
