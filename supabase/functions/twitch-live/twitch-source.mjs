import channels from "../../../data/twitch-channels.json" with { type: "json" };

export const CHANNELS = channels;
const CACHE_MS = 60000;
const VALIDATE_MS = 60 * 60 * 1000;
const cleanText = (value, length) => typeof value === "string" ? value.slice(0, length) : "";

// Only app credentials are used. No streamer logins, stream keys or database writes.
export function createLiveService({ credentials, fetcher = fetch, now = Date.now }) {
  let token = null, tokenExpires = 0, validatedAt = 0, credentialKey = "";
  let cached = null, pending = null, retryAfter = 0;
  const request = (url, options = {}) => fetcher(url, { ...options, signal: AbortSignal.timeout(10000) });
  async function accessToken(clientId, clientSecret) {
    if (token && tokenExpires > now() + 60000 && now() - validatedAt < VALIDATE_MS) return token;
    if (token && tokenExpires > now() + 60000) {
      const response = await request("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
      if (response.ok) {
        const info = await response.json();
        if (info.client_id === clientId && Number(info.expires_in) > 60) {
          validatedAt = now(); tokenExpires = now() + Number(info.expires_in) * 1000; return token;
        }
      } else if (response.status !== 401) throw new Error("Twitch validation unavailable");
      token = null;
    }
    const response = await request("https://id.twitch.tv/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    });
    if (!response.ok) throw new Error("Twitch authentication unavailable");
    const body = await response.json();
    if (!body.access_token || !Number.isFinite(Number(body.expires_in)) || Number(body.expires_in) <= 60) throw new Error("Invalid Twitch authentication response");
    const validation = await request("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${body.access_token}` } });
    if (!validation.ok || (await validation.json()).client_id !== clientId) throw new Error("Twitch authentication could not be validated");
    token = body.access_token; tokenExpires = now() + Number(body.expires_in) * 1000; validatedAt = now();
    return token;
  }
  async function readStreams(clientId, clientSecret) {
    const url = new URL("https://api.twitch.tv/helix/streams");
    CHANNELS.forEach(channel => url.searchParams.append("user_login", channel.login));
    url.searchParams.set("first", "100");
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      const currentToken = await accessToken(clientId, clientSecret);
      response = await request(url, { headers: { "Client-Id": clientId, Authorization: `Bearer ${currentToken}` } });
      if (response.status !== 401) break;
      token = null;
    }
    if (!response.ok) throw new Error("Twitch streams unavailable");
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error("Invalid Twitch streams response");
    const streams = CHANNELS.flatMap(channel => {
      const live = body.data.find(stream => stream.user_login?.toLowerCase() === channel.login && stream.type === "live");
      if (!live) return [];
      return [{ ...channel, title: cleanText(live.title, 300), category: cleanText(live.game_name, 100),
        viewers: Number.isFinite(live.viewer_count) ? Math.max(0, Math.floor(live.viewer_count)) : 0,
        startedAt: Number.isFinite(Date.parse(live.started_at)) ? live.started_at : null }];
    });
    return { status: "ok", checkedAt: new Date(now()).toISOString(), streams };
  }
  return async () => {
    const { clientId, clientSecret } = credentials();
    const key = `${clientId || ""}:${clientSecret || ""}`;
    if (key !== credentialKey) { token = null; cached = null; retryAfter = 0; credentialKey = key; }
    if (!clientId || !clientSecret) return { status: "not_configured", checkedAt: null, streams: [] };
    if (cached && now() - Date.parse(cached.checkedAt) < CACHE_MS) return cached;
    if (now() < retryAfter) throw new Error("Twitch temporarily unavailable");
    if (pending) return pending;
    pending = readStreams(clientId, clientSecret).then(data => { cached = data; return data; })
      .catch(() => { cached = null; retryAfter = now() + 20000; throw new Error("Twitch temporarily unavailable"); })
      .finally(() => { pending = null; });
    return pending;
  };
}
