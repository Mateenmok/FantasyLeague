(() => {
  const SUPABASE_URL = "https://cgvxehwqoviihxndupoj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu";
  const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };

  const responseError = async (response) => {
    try {
      const body = await response.json();
      return body.message || body.hint || `Trade request failed (${response.status}).`;
    } catch {
      return `Trade request failed (${response.status}).`;
    }
  };

  const rpc = async (name, body) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await responseError(response));
    if (response.status === 204) return null;
    return response.json();
  };

  const normalizeCode = (value) => String(value || "").trim().toUpperCase();
  const read = (accessCode) => rpc("read_flash_family_trades", { p_access_code: normalizeCode(accessCode) });
  const propose = (accessCode, receiverTeamId, senderSlugs, receiverSlugs, senderPoints, receiverPoints) => (
    rpc("propose_flash_family_trade", {
      p_access_code: normalizeCode(accessCode),
      p_receiver_team_id: receiverTeamId,
      p_sender_pokemon_slugs: senderSlugs,
      p_receiver_pokemon_slugs: receiverSlugs,
      p_sender_resulting_points: Number(senderPoints),
      p_receiver_resulting_points: Number(receiverPoints),
    })
  );
  const respond = (accessCode, tradeId, action) => rpc("respond_flash_family_trade", {
    p_access_code: normalizeCode(accessCode),
    p_trade_id: Number(tradeId),
    p_action: action,
  });

  window.PokeLeagueTrades = { read, propose, respond };
})();
