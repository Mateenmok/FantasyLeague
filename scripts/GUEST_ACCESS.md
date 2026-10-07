# Guest access

Entering `GUEST1` opens nickname registration. A unique, case-insensitive nickname (3–24 ASCII letters, numbers, spaces, underscores or hyphens) becomes the guest's returning access code. This is intentionally not private authentication: anyone knowing the public nickname can use that guest account. The signup screen explains this. Team-owner names, known access codes and administrator labels are reserved.

Guest identities live separately in `flash_family_guest_accounts`, not `league_teams` or the static owner configuration. Their prediction account IDs are `guest:<UUID>`. The existing Pick’ems ledger and leaderboard include those identities; existing predictions and score baselines are not changed. Guest picks observe the same active week, waiver deadline and completed-match lock as owner picks.

Only the dedicated guest signup, lookup, Pick’ems submission and main-draft spectator RPCs accept guest nicknames. Existing team/admin authorization helpers remain unchanged. There is no guest roster, waiver, trade, Survivor-submission, private-test-draft or admin access. Main-draft reads do not expose private-test picks.

Migration: `supabase/migrations/20261006190000_add_guest_accounts.sql`. Apply only this migration when unrelated migrations are pending. RLS and revoked table grants prevent direct access to guest account records.

Tests:

- `PGLITE_PATH=/path/to/@electric-sql/pglite node scripts/test-guest-accounts.cjs` — isolated PostgreSQL validation, persistence, scoring, locks, permissions and spectator scope.
- `PLAYWRIGHT_PATH=/path/to/playwright BROWSER_PATH=/path/to/chrome node scripts/test-guest-access-ui.cjs` — completely intercepted browser fixtures; never registers or votes in production.
- `scripts/test-pickems-vote-shares.cjs` — existing owner prediction and leaderboard regression tests.

Production permission verification was performed with a temporary guest inside a rollback-only transaction, including denial checks for roster replacement, waivers, trades, nicknames, draft actions, private test access, Survivor and administrative settings. No QA guest or picks were retained.
