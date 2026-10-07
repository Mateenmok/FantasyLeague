// Local-only visual fixture. Never contacts Twitch or writes league data.
// Run: node scripts/twitch-ui-fixture.mjs, then /home.html?fixture=all|one|offline|error|stale
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { CHANNELS } from "../supabase/functions/twitch-live/twitch-source.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8026");
  if (url.pathname === "/__twitch") {
    const state = url.searchParams.get("state");
    res.writeHead(state === "error" ? 502 : 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ status: "ok", checkedAt: new Date(Date.now() - (state === "stale" ? 180000 : 0)).toISOString(), streams: state === "offline" ? [] : CHANNELS.slice(0, state === "one" ? 1 : 4).map(channel => ({ ...channel, title: "Preview only · League battle night", category: "Pokémon", viewers: 12 })) })); return;
  }
  const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    let content = await readFile(path);
    if (url.pathname === "/home.html") content = content.toString().replace(/<script\b[^>]*src="(?!js\/(?:theme|twitch-live)\.js)[^"]*"[^>]*><\/script>/g, "");
    if (url.pathname === "/js/twitch-live.js") {
      const state = new URL(req.headers.referer || "http://127.0.0.1:8026").searchParams.get("fixture") || "all";
      content = content.toString().replace("https://cgvxehwqoviihxndupoj.supabase.co/functions/v1/twitch-live", `/__twitch?state=${encodeURIComponent(state)}`);
    }
    res.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(content);
  } catch { res.writeHead(404); res.end(); }
}).listen(8026, "127.0.0.1", () => console.log("Twitch visual fixture: http://127.0.0.1:8026/home.html?fixture=all"));
