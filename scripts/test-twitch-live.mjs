import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANNELS, createLiveService } from "../supabase/functions/twitch-live/twitch-source.mjs";

const expected = ["formidablefear", "flashterrr", "shdwemp", "kirbbles"];
const stream = (login, extra = {}) => ({ user_login: login, type: "live", title: "League night", game_name: "Pokémon", viewer_count: 12, started_at: "2026-10-06T20:00:00Z", ...extra });
function harness() {
  let clock = Date.parse("2026-10-06T21:00:00Z"), generation = 0;
  const state = { calls: [], streams: expected.map(login => stream(login)), status: 200, authStatus: 200,
    validationStatus: 200, expires: 7200, unauthorized: 0, creds: { clientId: "test-client", clientSecret: "test-secret" } };
  const read = createLiveService({ credentials: () => state.creds, now: () => clock, fetcher: async (input, options) => {
    const url = new URL(input); state.calls.push({ url, options });
    if (url.pathname === "/oauth2/token") {
      assert.equal(options.method, "POST");
      assert.equal(options.body.get("grant_type"), "client_credentials");
      assert.equal(options.body.get("client_secret"), state.creds.clientSecret);
      return Response.json({ access_token: `private-token-${++generation}`, expires_in: state.expires }, { status: state.authStatus });
    }
    if (url.pathname === "/oauth2/validate") return Response.json({ client_id: state.creds.clientId, expires_in: state.expires }, { status: state.validationStatus });
    assert.equal(url.origin, "https://api.twitch.tv"); assert.equal(url.pathname, "/helix/streams");
    assert.deepEqual(url.searchParams.getAll("user_login"), expected);
    assert.equal(options.headers["Client-Id"], state.creds.clientId);
    assert.match(options.headers.Authorization, /^Bearer private-token-/);
    if (state.unauthorized-- > 0) return Response.json({}, { status: 401 });
    return Response.json({ data: state.streams }, { status: state.status });
  } });
  return { state, read, advance: ms => { clock += ms; }, count: path => state.calls.filter(call => call.url.pathname === path).length };
}

test("only the four requested channels are queried and returned; app owner is excluded", async () => {
  assert.deepEqual(CHANNELS.map(row => row.login), expected);
  const h = harness();
  h.state.streams.push(stream("pufferz_"), stream("unknown"), stream("flashterrr"));
  const data = await h.read();
  assert.deepEqual(data.streams.map(row => row.login), expected);
  assert.equal(data.status, "ok");
  assert(!JSON.stringify(data).includes("private-token"));
  assert(!JSON.stringify(data).includes("test-secret"));
  assert(!JSON.stringify(data).includes("pufferz"));
});

test("unconfigured service makes no requests and never claims anyone is live", async () => {
  const h = harness(); h.state.creds = {};
  assert.deepEqual(await h.read(), { status: "not_configured", checkedAt: null, streams: [] });
  assert.equal(h.state.calls.length, 0);
});

test("concurrent calls coalesce and the one-minute stream cache reuses the token", async () => {
  const h = harness();
  const results = await Promise.all([h.read(), h.read(), h.read()]);
  assert.deepEqual(results[0], results[2]); assert.equal(h.count("/helix/streams"), 1);
  h.advance(59999); await h.read(); assert.equal(h.count("/helix/streams"), 1);
  h.advance(1); await h.read(); assert.equal(h.count("/helix/streams"), 2);
  assert.equal(h.count("/oauth2/token"), 1); assert.equal(h.count("/oauth2/validate"), 1);
});

test("offline and non-live entries disappear; malformed metadata is bounded", async () => {
  const h = harness(); h.state.streams = [stream("FORMIDABLEFEAR", { title: "x".repeat(400), game_name: "y".repeat(200), viewer_count: -10, started_at: "bad date" }), stream("flashterrr", { type: "" })];
  const data = await h.read(); assert.equal(data.streams.length, 1);
  assert.equal(data.streams[0].title.length, 300); assert.equal(data.streams[0].category.length, 100);
  assert.equal(data.streams[0].viewers, 0); assert.equal(data.streams[0].startedAt, null);
  h.advance(60000); h.state.streams = [];
  assert.deepEqual((await h.read()).streams, []);
});

test("failed refresh does not serve stale live status and has an upstream cooldown", async () => {
  const h = harness(); await h.read(); h.advance(60000); h.state.status = 429;
  await assert.rejects(h.read(), /^Error: Twitch temporarily unavailable$/);
  const calls = h.state.calls.length;
  await assert.rejects(h.read(), /temporarily unavailable/); assert.equal(h.state.calls.length, calls);
  h.advance(20000); h.state.status = 200; h.state.streams = [];
  assert.deepEqual((await h.read()).streams, []);
});

test("401 renews app token once; repeated authorization failures stop safely", async () => {
  const h = harness(); h.state.unauthorized = 1;
  assert.equal((await h.read()).status, "ok"); assert.equal(h.count("/oauth2/token"), 2);
  const denied = harness(); denied.state.unauthorized = 9;
  await assert.rejects(denied.read(), /temporarily unavailable/);
  assert.equal(denied.count("/helix/streams"), 2);
});

test("token is validated hourly and renewed before expiration", async () => {
  const h = harness(); await h.read(); h.advance(3600000); await h.read();
  assert.equal(h.count("/oauth2/validate"), 2); assert.equal(h.count("/oauth2/token"), 1);
  const short = harness(); short.state.expires = 120;
  await short.read(); short.advance(60000); await short.read();
  assert.equal(short.count("/oauth2/token"), 2);
});

test("authentication and validation errors disclose no credentials", async () => {
  for (const field of ["authStatus", "validationStatus"]) {
    const h = harness(); h.state[field] = 503;
    await assert.rejects(h.read(), /^Error: Twitch temporarily unavailable$/);
    assert.equal(h.count("/helix/streams"), 0);
  }
});
