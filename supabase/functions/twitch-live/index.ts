import { createLiveService } from "./twitch-source.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const live = createLiveService({ credentials: () => ({
  clientId: Deno.env.get("TWITCH_CLIENT_ID")?.trim(),
  clientSecret: Deno.env.get("TWITCH_CLIENT_SECRET")?.trim(),
}) });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return json({ error: "Read-only endpoint." }, 405);
  if ([...new URL(request.url).searchParams].length) return json({ error: "This endpoint only checks the league's configured channels." }, 400);
  try { return json(await live()); }
  catch { return json({ status: "unavailable", checkedAt: null, streams: [] }, 502); }
});
