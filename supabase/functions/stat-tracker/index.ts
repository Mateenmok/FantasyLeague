import { SHEETS, sourceUrl, parseSheet } from "./sheet-source.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
};
const cache = new Map();
const pending = new Map();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return json({ error: "Read-only endpoint." }, 405);
  const id = new URL(request.url).searchParams.get("sheet") || "all";
  const sheet = SHEETS.find(item => item.id === id);
  if (!sheet) return json({ error: "Unknown tracker tab." }, 400);
  const saved = cache.get(id);
  if (saved && Date.now() - Date.parse(saved.fetchedAt) < 60000) return json(saved);
  try {
    if (!pending.has(id)) {
      pending.set(id, (async () => {
        const response = await fetch(sourceUrl(sheet), { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error("Sheet unavailable");
        const data = parseSheet(await response.text(), sheet);
        cache.set(id, data);
        return data;
      })());
    }
    return json(await pending.get(id));
  } catch {
    // Keep the last successful result, with its ORIGINAL timestamp and an
    // explicit stale flag. An outage must never look like a new zeroed board.
    if (saved) return json({ ...saved, stale: true });
    return json({ error: "The stat tracker could not be reached. Please try again shortly." }, 502);
  } finally {
    pending.delete(id);
  }
});
