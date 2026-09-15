// Isolated PostgreSQL tests: never connects to the live league.
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const db = new PGlite();
  const read = async (code='') => (await db.query('select read_flash_family_survivor($1) as data',[code])).rows[0].data;
  const pick = (code,week,team) => db.query('select submit_flash_family_survivor($1,$2,$3)',[code,week,team]);
  try {
    await db.exec(`create role anon; create role authenticated; grant usage on schema public to anon,authenticated;
      create table leagues(id text primary key,current_matchup_number int,waiver_window_end_at timestamptz);
      insert into leagues values('flash-family-season-1',0,null);
      create table flash_family_matchups(league_id text,week int,display_order int,home_team_id text,away_team_id text,home_score int,away_score int);
      insert into flash_family_matchups select 'flash-family-season-1',w,n,case n when 1 then 'a' else 'c' end,case n when 1 then 'b' else 'd' end,null,null from generate_series(1,3) w cross join generate_series(1,2) n;`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260915100000_add_survivor.sql'),'utf8'));
    const accounts=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/teams.json'))).accounts;
    for(const [code,a] of Object.entries(accounts)) {
      const identity=(await db.query('select * from flash_family_survivor_account($1)',[code])).rows[0];
      assert.deepEqual(identity,{account_id:a.id,username:a.accountName});
    }
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from flash_family_survivor_picks'),/permission denied/);
    await assert.rejects(db.query("select * from flash_family_survivor_account('NETO')"),/permission denied/);
    for(const args of [['bad',1,'a'],['DraftTest1',1,'a'],['NETO',2,'a'],['NETO',1,'unknown'],['NETO',1,null]]) await assert.rejects(pick(...args));
    await pick('NETO',1,'b'); await pick('NETO',1,'a'); await pick('MOON4',1,'b');
    assert.equal((await read('NETO')).own_picks.length,1,'Updating replaces the weekly entry');
    assert.deepEqual((await read()).own_picks,[]);
    assert.deepEqual((await read()).history,[],'Other current picks never leave the server');
    assert.deepEqual((await read('MOON4')).own_picks,[{week:1,picked_team_id:'b'}]);
    await db.exec("reset role; update flash_family_matchups set home_score=2,away_score=0 where week=1 and display_order=1; set role anon;");
    await assert.rejects(pick('NETO',1,'c'),/locked/);
    assert.deepEqual((await read()).history,[],'Partial scoring must not reveal picks');
    await db.exec("reset role; update flash_family_matchups set home_score=2,away_score=1 where week=1 and display_order=2; set role anon;");
    let state=await read();
    assert.equal(state.history.find(p=>p.account_id==='neto').outcome,'correct');
    assert.equal(state.contestants.find(p=>p.account_id==='kirbbles').eliminated_week,1);
    await db.exec("reset role; update leagues set current_matchup_number=2; set role anon");
    await assert.rejects(pick('NETO',2,'a'),/already used/);
    await pick('NETO',2,'c'); await pick('MOON4',2,'c');
    await assert.rejects(pick('MOON4',2,'b'),/already used/);
    await pick('FORMIDABLE',2,'d');
    state=await read('FORMIDABLE');
    assert.equal(state.contestants.find(p=>p.account_id==='fear').eliminated_week,1,'Late entrants missed week one and play for fun');
    assert(!state.history.some(p=>p.week===2));
    await db.exec("reset role; update leagues set waiver_window_end_at=now(); set role anon");
    await assert.rejects(pick('NETO',2,'d'),/locked/);
    await db.exec("reset role; update leagues set waiver_window_end_at=null; update flash_family_matchups set home_score=2,away_score=0 where week=2; set role anon");
    state=await read();
    assert.equal(state.history.find(p=>p.account_id==='kirbbles'&&p.week===2).outcome,'correct');
    assert.equal(state.contestants.find(p=>p.account_id==='kirbbles').eliminated_week,1,'Fun win cannot resurrect a contestant');
    await db.exec("reset role; update flash_family_matchups set home_score=0,away_score=2 where week=1 and display_order=1; set role anon");
    assert.equal((await read()).contestants.find(p=>p.account_id==='kirbbles').eliminated_week,null,'Score corrections recompute survival');
    await db.exec("reset role; update leagues set current_matchup_number=3; set role anon");
    await pick('NETO',3,'d');
    await db.exec("reset role; update leagues set current_matchup_number=2; update flash_family_matchups set home_score=null,away_score=null where week=2; set role anon");
    state=await read('NETO');
    assert(!state.own_picks.some(p=>p.week===3),'Rewind discards future entries');
    assert(!state.history.some(p=>p.week===2),'Reopened week private again');
    await pick('NETO',2,'d');
    await db.exec("reset role; update leagues set current_matchup_number=3; set role anon");
    state=await read();
    assert.equal(state.history.find(p=>p.account_id==='neto'&&p.week===2).outcome,'pending','Unscored advanced weeks do not invent losses');
    console.log('PASS: identities, permissions/privacy, one weekly pick, replacement, no reuse, deadlines, scores, elimination, fun picks, missed picks, corrections and rewind.');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
