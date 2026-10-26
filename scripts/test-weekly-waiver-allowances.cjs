// In-memory database and mocked API only; never writes to production.
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const migration = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; grant usage on schema public to anon,authenticated;
      create table leagues(id text primary key, waiver_window_start_at timestamptz, waiver_window_end_at timestamptz, roster_point_cap int, roster_pokemon_cap int, current_matchup_number int, waiver_acquisition_limit int);
      insert into leagues values('flash-family-season-1',now()-interval '1 hour',now()+interval '1 day',50,10,6,1);
      create table league_teams(id text primary key);
      create table team_rosters(league_id text,team_id text,pokemon_slug text,slot_number int,unique(league_id,pokemon_slug),unique(league_id,team_id,slot_number));
      grant select on team_rosters to anon,authenticated;
      create table league_waiver_acquisitions(id text primary key,league_id text,team_id text,pokemon_slug text,waiver_window_start_at timestamptz);`);
    const teams = { 'sunnyshore-city-shelter': ['FORMIDABLE', 'hisuian-goodra'], 'uconn-arcanines': ['LAVOLON', 'hisuian-arcanine'], 'south-jersey-hounds': ['REGAL', 'houndoom'], 'boston-eeltics': ['PUFF1', 'eelektross'] };
    for (const [team, [, mascot]] of Object.entries(teams)) {
      await db.query('insert into league_teams values($1)', [team]);
      await db.query("insert into team_rosters values('flash-family-season-1',$1,$2,1)", [team, mascot]);
    }
    for (const file of ['20260907130000_add_flash_family_trade_room.sql', '20260914010000_add_transaction_log.sql', '20260914200000_protect_waiver_mascots.sql', '20260929001000_limit_weekly_waiver_pickups.sql']) await db.exec(migration(file));
    const move = (team, add, drop = null, points = 20) => db.query('select submit_flash_family_waiver($1,$2,$3,$4,$5)', [teams[team][0], team, add, drop, points]);
    const count = (team, week = 6) => db.query("select pickup_count from flash_family_weekly_waiver_usage where team_id=$1 and week=$2", [team, week]).then(r => r.rows[0]?.pickup_count || 0);
    const snapshot = () => db.query('select * from team_rosters order by team_id,slot_number').then(r => r.rows);
    const shelter = 'sunnyshore-city-shelter', uconn = 'uconn-arcanines', hounds = 'south-jersey-hounds', boston = 'boston-eeltics';
    await move(shelter, 'shelter-pick-1');
    const before = await snapshot();
    await db.exec(migration('20261026180000_week_six_waiver_allowances.sql'));
    assert.deepEqual(await snapshot(), before, 'Migration does not change rosters');
    assert.equal(await count(shelter), 1, 'Existing pickups still count');
    await db.exec('set role anon');
    assert.equal((await db.query('select * from flash_family_weekly_waiver_allowances')).rows.length, 3);
    await assert.rejects(move(shelter, 'blocked-mascot', teams[shelter][1]), /mascot/);
    await assert.rejects(move(shelter, 'blocked-budget', null, 51), /point cap/);
    await assert.rejects(db.query("select submit_flash_family_waiver('PUFF1',$1,'blocked-owner',null,20)", [shelter]), /access code/);
    assert.equal(await count(shelter), 1);
    for (let i = 2; i <= 4; i++) await move(shelter, `shelter-pick-${i}`);
    for (let i = 1; i <= 4; i++) await move(hounds, `hounds-pick-${i}`);
    for (let i = 1; i <= 3; i++) await move(uconn, `uconn-pick-${i}`);
    const concurrent = await Promise.allSettled([move(uconn, 'uconn-pick-4'), move(uconn, 'uconn-pick-5')]);
    assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1, 'Only one request can consume the final allowance');
    for (const team of [shelter, uconn, hounds]) {
      assert.equal(await count(team), 4);
      await assert.rejects(move(team, `${team}-fifth`), /all waiver pickups/);
    }
    await move(boston, 'boston-pick-1');
    await assert.rejects(move(boston, 'boston-pick-2'), /all waiver pickups/, 'Other teams retain one pickup');
    await move(shelter, null, 'shelter-pick-1');
    assert.equal(await count(shelter), 4, 'Drop-only does not consume or refund a pickup');
    await db.exec("reset role; update leagues set waiver_window_start_at=now()-interval '10 minutes'; set role anon;");
    await assert.rejects(move(shelter, 'window-reopen'), /all waiver pickups/);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role};`);
      for (const table of ['flash_family_weekly_waiver_allowances', 'flash_family_weekly_waiver_usage']) {
        await assert.rejects(db.exec(`delete from ${table}`), /permission denied/);
      }
      await assert.rejects(db.exec('update flash_family_weekly_waiver_allowances set pickup_limit=10'), /permission denied/);
      await assert.rejects(db.exec('update flash_family_weekly_waiver_usage set pickup_count=1'), /permission denied/);
    }
    await db.exec('reset role; update leagues set current_matchup_number=7; set role anon;');
    for (const team of [shelter, uconn, hounds]) {
      await move(team, `${team}-next-week`, `${team === shelter ? 'shelter' : team === uconn ? 'uconn' : 'hounds'}-pick-2`);
      assert.equal(await count(team, 7), 1, 'Add/drop counts as one pickup');
      await assert.rejects(move(team, `${team}-next-week-second`), /all waiver pickups/, 'Week 7 returns to one');
    }
    await db.exec("reset role; update leagues set current_matchup_number=8; create function fail_test_log() returns trigger language plpgsql as $$begin raise exception 'test log failure';end;$$;create trigger fail_test_log before insert on flash_family_transaction_log for each row execute function fail_test_log();set role anon;");
    const beforeFailure = await snapshot();
    await assert.rejects(move(shelter, 'rollback-pick'), /test log failure/);
    assert.equal(await count(shelter, 8), 0);
    assert.deepEqual(await snapshot(), beforeFailure);
    await db.exec('reset role; update leagues set current_matchup_number=6; set role anon;');
    await assert.rejects(move(shelter, 'rewind-pick'), /all waiver pickups/);
    console.log('PASS: four pickups only for the three Week 6 teams, existing usage preserved, fifth rejected, others/next week limited to one, permissions, mascot/budget checks, double requests, rollback and rewind.');
  } finally { await db.close(); }

  let usageRows = [], allowanceRows = [], fail = false;
  const context = { window: {}, URLSearchParams, fetch: async url => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('week'), 'eq.6');
    assert.equal(parsed.searchParams.get('team_id'), 'eq.uconn-arcanines');
    return { ok: !fail, status: 503, json: async () => fail ? { message: 'Unavailable' } : parsed.pathname.endsWith('waiver_usage') ? usageRows : allowanceRows };
  } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/league-waivers.js'), 'utf8'), context);
  const read = () => context.window.PokeLeagueWaivers.readWeeklyAllowance('uconn-arcanines', 6).then(value => JSON.parse(JSON.stringify(value)));
  assert.deepEqual(await read(), { used: 0, limit: 1 });
  allowanceRows = [{ pickup_limit: 4 }]; usageRows = [{ pickup_count: 3 }];
  assert.deepEqual(await read(), { used: 3, limit: 4 });
  usageRows = [{ pickup_count: 4 }];
  assert.deepEqual(await read(), { used: 4, limit: 4 });
  fail = true; await assert.rejects(read(), /Unavailable/);
  console.log('PASS: frontend reads actual counts, per-week limits, default one, and fails closed on API errors.');
})().catch(error => { console.error(error); process.exitCode = 1; });
