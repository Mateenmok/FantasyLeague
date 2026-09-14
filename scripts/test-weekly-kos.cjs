// In-memory PostgreSQL regression tests; no production database access.
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = name => fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; grant usage on schema public to anon, authenticated;
      create table leagues(id text primary key, current_matchup_number integer default 0, schedule_generated boolean default false);
      insert into leagues(id,current_matchup_number) values ('flash-family-season-1', 0);
      create table league_teams(id text, league_id text, owner_name text);
      insert into league_teams values ('miami-dragapults','flash-family-season-1','Neto');
      create table flash_family_draft_pool(pokemon_name text, point_value integer);
      insert into flash_family_draft_pool values ('Malamar',4);`);
    await db.exec(sql('20260907070000_add_flash_family_pickems.sql'));
    await db.exec(sql('20260907101000_correct_flash_family_week_rewind.sql'));
    await db.exec("select submit_flash_family_pickem('NETO',1,1,'daytona-torterras')");
    const before = (await db.query('select * from flash_family_matchups order by display_order')).rows;
    await db.exec(sql('20260914190000_add_weekly_kos_and_shared_points.sql'));
    assert.equal((await db.query('select owner_name from league_teams')).rows[0].owner_name, 'FLash');
    assert.equal((await db.query('select username from flash_family_pickems')).rows[0].username, 'FLash');
    await db.exec("select submit_flash_family_pickem('NETO',1,2,'kansas-krooks')");
    assert((await db.query('select username from flash_family_pickems')).rows.every(r => r.username === 'FLash'));
    await db.exec("set role anon; select set_flash_family_current_week('NETO',1)");
    assert.deepEqual((await db.query('select * from flash_family_matchups order by display_order')).rows.map(({ home_kos, away_kos, ...r }) => r), before, 'Advancing must preserve all saved pairings/scores');
    assert.equal((await db.query('select read_flash_family_point_values() as points')).rows[0].points.Malamar, 4);
    const save = (homeKOs, awayKOs, code='NETO', orders=[1], home=[2], away=[0]) => db.query('select save_flash_family_week_results($1,1,$2,$3,$4,$5,$6)', [code,orders,home,away,homeKOs,awayKOs]);
    const first = async () => (await db.query('select * from flash_family_matchups where display_order=1')).rows[0];
    await save([8],[2]);
    assert.equal((await first()).home_kos - (await first()).away_kos, 6);
    await save([8],[4]);
    assert.equal((await first()).home_kos - (await first()).away_kos, 4);
    const saved = await first();
    for (const args of [[[8],[null]], [[-1],[2]], [[8],[2],'NC50'], [[8],[2],'NETO',[99]], [[8],[2],'NETO',[1,1],[2,2],[0,0]]]) {
      await assert.rejects(save(...args));
      assert.deepEqual(await first(), saved, 'Invalid submissions must roll back the entire week');
    }
    await db.exec("select save_flash_family_week_scores('NETO',1,array[1],array[2],array[0])");
    assert.equal((await first()).home_kos, 8, 'Cached older admins must preserve KOs on unchanged game scores');
    await db.exec("select save_flash_family_week_scores('NETO',1,array[1],array[2],array[1])");
    assert.equal((await first()).home_kos, null, 'Changed old-client scores must not retain unrelated KOs');
    await save([null],[null]);
    assert.equal((await first()).home_score, 2);
    assert.equal((await first()).home_kos, null, 'KOs are optional');
    await save([0],[0]);
    assert.equal((await first()).home_kos, 0, 'Zero is a recorded KO value, not blank');
    await db.exec("select set_flash_family_current_week('NETO',2); select rewind_flash_family_current_week('NETO')");
    assert.equal((await first()).home_score, null);
    assert.equal((await first()).home_kos, null);
    assert.deepEqual((await db.query('select home_team_id,away_team_id from flash_family_matchups order by display_order')).rows, before.map(({home_team_id,away_team_id})=>({home_team_id,away_team_id})));
    await save([],[], 'NETO', [],[],[]);
    console.log('PASS: FLash identity/history, Week 0→1 saved matchups, shared Malamar=4, optional KO pairs, validation/rollback, legacy scores, zero KOs, rewind clears differential without changing matchups.');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
