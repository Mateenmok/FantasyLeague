// Run with PGLITE_PATH pointing to an installed @electric-sql/pglite package.
// All database writes are to an isolated, in-memory PostgreSQL instance.
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const migration = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      grant usage on schema public to anon, authenticated;
      create table leagues (id text primary key, waiver_window_start_at timestamptz,
        waiver_window_end_at timestamptz, roster_point_cap int, roster_pokemon_cap int,
        current_matchup_number int default 1);
      insert into leagues values ('flash-family-season-1', now() - interval '1 day', now() + interval '1 day', 50, 10, 1);
      create table league_teams (id text primary key);
      create table team_rosters (league_id text, team_id text, pokemon_slug text, slot_number int,
        unique (league_id, pokemon_slug), unique (league_id, team_id, slot_number));
      create table league_waiver_acquisitions (id text primary key, league_id text, team_id text,
        pokemon_slug text, waiver_window_start_at timestamptz);
    `);
    await db.exec(migration('20260907130000_add_flash_family_trade_room.sql'));
    await db.exec(migration('20260914010000_add_transaction_log.sql'));
    const rows = async () => (await db.query('select * from flash_family_transaction_log order by id desc')).rows;
    const move = (add, drop, points = 10, code = 'NETO', team = 'miami-dragapults') => db.query(
      'select submit_flash_family_waiver($1, $2, $3, $4, $5)', [code, team, add, drop, points]);
    await db.exec('set role anon');
    await move('camerupt', null);
    assert.equal((await rows()).length, 1);
    await move('crabominable', 'camerupt');
    assert.deepEqual((await rows()).slice(0, 2).map(r => [r.action, r.pokemon_slug]),
      [['added', 'crabominable'], ['dropped', 'camerupt']]);
    await move(null, 'crabominable', 0);
    assert.equal((await rows())[0].action, 'dropped');
    await assert.rejects(move('gengar', null, 51), /point cap/);
    await assert.rejects(move('gengar', null, 10, 'INVALID'), /access code/);
    await assert.rejects(move(null, 'not-rostered'), /not on this roster/);
    assert.equal((await rows()).length, 4, 'Failed moves must not log');
    for (const statement of [
      "insert into flash_family_transaction_log (league_id, team_id, pokemon_slug, action, source) values ('flash-family-season-1','fake','fake','added','waiver')",
      'delete from flash_family_transaction_log',
      "update flash_family_transaction_log set action = 'dropped'",
    ]) await assert.rejects(db.exec(statement), /permission denied/);
    await db.exec('reset role');

    const accounts = JSON.parse(fs.readFileSync(path.join(root, 'data/teams.json'), 'utf8')).accounts;
    for (const [code, account] of Object.entries(accounts).filter(([code]) => !code.startsWith('DRAFTTEST'))) {
      await move('test-' + account.teamId, null, 1, code, account.teamId);
      await move(null, 'test-' + account.teamId, 0, code, account.teamId);
    }
    const baseline = (await rows()).length;
    await db.exec("update leagues set waiver_window_end_at = now() - interval '1 hour'");
    await assert.rejects(move('camerupt', null), /closed/);
    await db.exec("update leagues set waiver_window_end_at = now() + interval '1 day', roster_pokemon_cap = 1");
    await move('camerupt', null);
    await assert.rejects(move('gengar', null), /full/);
    await assert.rejects(move('camerupt', 'camerupt'), /different Pokemon/);
    assert.equal((await rows()).length, baseline + 1);
    await db.exec('update leagues set roster_pokemon_cap = 10');

    // Failure to persist the log must roll back the roster change too.
    await db.exec(`create function fail_log_test() returns trigger language plpgsql as $$
      begin raise exception 'test log failure'; end; $$;
      create trigger fail_log_test before insert on flash_family_transaction_log
      for each row execute function fail_log_test();`);
    await assert.rejects(move('crabominable', 'camerupt'), /test log failure/);
    assert.equal((await db.query("select pokemon_slug from team_rosters where team_id = 'miami-dragapults'")).rows[0].pokemon_slug, 'camerupt');
    assert.equal((await rows()).length, baseline + 1);
    await db.exec('drop trigger fail_log_test on flash_family_transaction_log');

    // A real accepted trade rebuilds both rosters but logs only exchanged Pokémon.
    await move('eelektross', null, 5, 'PUFF1', 'boston-eeltics');
    await move('malamar', null, 9, 'PUFF1', 'boston-eeltics');
    const beforeTrade = (await rows()).length;
    const tradeId = (await db.query(`select propose_flash_family_trade('PUFF1', 'miami-dragapults',
      array['malamar'], array['camerupt'], 8, 4) as id`)).rows[0].id;
    assert.equal((await rows()).length, beforeTrade, 'Pending trades are not transactions');
    await db.query("select respond_flash_family_trade('NETO', $1, 'accept')", [tradeId]);
    const traded = (await rows()).slice(0, 4);
    assert.equal((await rows()).length, beforeTrade + 4);
    assert(traded.every(r => r.source === 'trade' && r.pokemon_slug !== 'eelektross'));
    await db.query("update flash_family_trades set status = 'accepted' where id = $1", [tradeId]);
    assert.equal((await rows()).length, beforeTrade + 4, 'Repeated status updates must not duplicate entries');
    await assert.rejects(db.query("select respond_flash_family_trade('NETO', $1, 'accept')", [tradeId]), /pending/);

    // Six-row preview and cursor pagination retain all records without duplicates.
    const all = await rows();
    const first = (await db.query('select id from flash_family_transaction_log order by id desc limit 6')).rows;
    assert.equal(first.length, 6);
    const rest = (await db.query('select id from flash_family_transaction_log where id < $1 order by id desc', [first[5].id])).rows;
    assert.deepEqual([...first, ...rest].map(r => r.id), all.map(r => r.id));
    await db.exec("insert into leagues(id) values ('other-league'); insert into flash_family_transaction_log(league_id,team_id,pokemon_slug,action,source) values ('other-league','private','private','added','waiver')");
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      assert.equal((await rows()).length, all.length, 'Feed must not expose other leagues');
      await db.exec('reset role');
    }
    console.log('PASS: durable add/drop/swap logs, all owner codes, failed/closed/full/unauthorized moves, atomic rollback, completed trades, no duplicates, pagination, read-only RLS. No production writes.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
