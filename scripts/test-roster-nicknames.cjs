// Isolated PostgreSQL test. Set PGLITE_PATH to an installed @electric-sql/pglite.
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      grant usage on schema public to anon, authenticated;
      create table leagues (id text primary key);
      insert into leagues values ('flash-family-season-1'), ('other-league');
      create table league_teams (id text primary key, league_id text, team_access_code text);
      create table team_rosters (league_id text, team_id text, pokemon_slug text);
      grant select on team_rosters to anon, authenticated;`);
    const accounts = JSON.parse(fs.readFileSync(path.join(root, 'data/teams.json'), 'utf8')).accounts;
    for (const [code, team] of Object.entries(accounts).filter(([code]) => !code.startsWith('DRAFTTEST'))) {
      await db.query("insert into league_teams values ($1, 'flash-family-season-1', $2)", [team.teamId, code]);
      await db.query("insert into team_rosters values ('flash-family-season-1', $1, $2)", [team.teamId, 'test-' + team.teamId]);
    }
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20260914160000_add_roster_nicknames.sql'), 'utf8'));
    const save = (code, team, slug, nickname) => db.query('select set_flash_family_pokemon_nickname($1, $2, $3, $4) as nickname', [code, team, slug, nickname]);
    await db.exec('set role anon');
    for (const [code, team] of Object.entries(accounts).filter(([code]) => !code.startsWith('DRAFTTEST'))) {
      assert.equal((await save(code.toLowerCase(), team.teamId, 'test-' + team.teamId, '  Captain   Claw  ')).rows[0].nickname, 'Captain Claw');
    }
    const team = 'miami-dragapults', slug = 'test-' + team;
    await assert.rejects(save('PUFF1', team, slug, 'Wrong owner'), /Only the team owner/);
    await assert.rejects(save('', team, slug, 'Wrong owner'), /Only the team owner/);
    await assert.rejects(save('NETO', team, 'missing', 'Missing'), /no longer on your roster/);
    await assert.rejects(save('NETO', team, slug, 'x'.repeat(25)), /24 characters/);
    await assert.rejects(save('NETO', team, slug, 'bad\x01name'), /control characters/);
    await assert.rejects(db.exec("update flash_family_pokemon_nicknames set nickname = 'Fake'"), /permission denied/);
    assert.equal((await save('NETO', team, slug, '✨ Ace ✨')).rows[0].nickname, '✨ Ace ✨');
    assert.equal((await db.query('select nickname from flash_family_pokemon_nicknames where team_id=$1', [team])).rows[0].nickname, '✨ Ace ✨');
    await db.exec('reset role');
    await db.query('delete from team_rosters where team_id=$1', [team]);
    await db.exec('set role anon');
    assert.equal((await db.query('select * from flash_family_pokemon_nicknames where team_id=$1', [team])).rows.length, 0, 'Dropped/traded Pokémon must not expose former team nicknames');
    await assert.rejects(save('NETO', team, slug, 'Gone'), /no longer on your roster/);
    await db.exec('reset role');
    await db.query("insert into team_rosters values ('flash-family-season-1', $1, $2)", [team, slug]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select nickname from flash_family_pokemon_nicknames where team_id=$1', [team])).rows[0].nickname, '✨ Ace ✨', 'Roster rebuilds must preserve nicknames');
    await save('NETO', team, slug, '');
    assert.equal((await db.query('select * from flash_family_pokemon_nicknames where team_id=$1', [team])).rows.length, 0);
    console.log('PASS: all 14 owners, permanent save/edit/clear, Unicode, length, ownership, current-roster checks, RLS, rebuild survival. No production writes.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
