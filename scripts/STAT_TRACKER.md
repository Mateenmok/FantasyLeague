# MVP Watch / native stat tracker

- Home: `home.html`; full native view: `stat-tracker.html`.
- Read-only source: FFDL Season 1 Stat Tracker, spreadsheet ID `1nq9_Ff8-C6oSki0pC3PsNhWKRdNZMtXh1hKI4o4nrhA`.
- MVP Watch sorts the **All Pokemon** tab by numeric IMP descending, with source-row order for ties, and displays five entries. It does not calculate or replace the sheet's formulas.
- Team views retain all 18 team-stat columns (including D*, MKB*, EG*). Decorative footer rows are excluded. The Stat Guide is also read live.
- Pokémon names/aliases resolve to existing static Champions sprites. Team IDs resolve to existing team themes/logos; nicknames are fetched from the existing read-only roster nickname API. Species and team names remain visible.
- `supabase/functions/stat-tracker` is a public read-only proxy for this one already-public workbook. Callers can select only an allowlisted tab; they cannot supply a URL, arbitrary spreadsheet, or range. No Google credentials, service-role keys, database writes, or sheet edits are involved.
- Deploy: `supabase functions deploy stat-tracker --project-ref cgvxehwqoviihxndupoj --use-api --no-verify-jwt`. This must stay public because the website needs a public read endpoint. Never use `--prune` for this feature.
- Visible pages fetch once on load, every 60 seconds, and on returning to the tab. Refresh is also available on the tracker. Edge workers cache successful reads for 60 seconds; Google may additionally cache/recalculate its feed.
- On failure, preserve the last successful result and its original fetched-at time with an explicit stale status. A browser-local snapshot can survive reloads. No fake zero stats or fabricated leaderboard is used.
- The sheet must remain publicly readable for continued updates. New columns/tabs or moving the header row may require updating the fixed source mapping in `sheet-source.mjs`.
- `scripts/test-stat-tracker.cjs` uses isolated network fixtures, including refresh, stale cache, outages, schema validation, nicknames, sorting, filters, 16 tab choices, race protection, native navigation, light/dark and 320–1600px layouts. It makes no production data changes.
