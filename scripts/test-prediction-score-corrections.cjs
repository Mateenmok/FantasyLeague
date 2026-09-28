// Isolated fixtures only: never submits production predictions or scores.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
const migration=sql('20260928160000_prediction_score_corrections.sql');
const expected={pufferz:1,neto:2,shdwemp:2,kilan:3,kirbbles:3,letsnot:2,lio:0,norforil:2,fear:1,chorizo:2,flan:1,pin:1,narcotics:0,omen:0};
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
  create table leagues(id text primary key,current_matchup_number int,waiver_window_end_at timestamptz);
  insert into leagues values('flash-family-season-1',2,now()+interval '1 day');
  create table flash_family_matchups(league_id text,week int,display_order int,home_team_id text,away_team_id text,home_score int,away_score int);
  insert into flash_family_matchups values
   ('flash-family-season-1',1,1,'a','chicago-conkquerers',0,2),
   ('flash-family-season-1',1,2,'b','stockholm-spin-cycles',0,2),
   ('flash-family-season-1',2,1,'chicago-conkquerers','stockholm-spin-cycles',null,null),
   ('flash-family-season-1',2,2,'a','b',null,null);
  create table flash_family_pickems(league_id text,week int,display_order int,account_id text,username text,picked_team_id text,updated_at timestamptz default now());
  insert into flash_family_pickems(league_id,week,display_order,account_id,username,picked_team_id) values
   ('flash-family-season-1',1,1,'neto','FLash','chicago-conkquerers'),
   ('flash-family-season-1',1,2,'neto','FLash','stockholm-spin-cycles'),
   ('flash-family-season-1',1,1,'unknown','Unknown','chicago-conkquerers'),
   ('flash-family-season-1',2,1,'neto','FLash','chicago-conkquerers'),
   ('flash-family-season-1',2,2,'neto','FLash','a'),
   ('flash-family-season-1',2,1,'unknown','Unknown','stockholm-spin-cycles');`);
 await db.exec(sql('20260915100000_add_survivor.sql'));
 await db.exec(sql('20260928145000_survivor_week_one_entry_exceptions.sql'));
 await db.exec(`insert into flash_family_survivor_picks(league_id,account_id,username,week,picked_team_id) values
  ('flash-family-season-1','shdwemp','Shdwemp',2,'a'),
  ('flash-family-season-1','neto','FLash',1,'chicago-conkquerers');`);
 return db;
}
(async()=>{
 const db=await fixture();
 try{
  const read=async()=>Object.fromEntries((await db.query('select * from read_flash_family_pickem_leaderboard()')).rows.map(r=>[r.account_id,Number(r.correct)]));
  const picks=(await db.query('select * from flash_family_pickems order by account_id,week,display_order')).rows;
  const survivors=(await db.query('select * from flash_family_survivor_picks order by account_id,week')).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query('select * from flash_family_pickems order by account_id,week,display_order')).rows,picks,'Every existing Pick’em must remain byte-for-byte intact');
  assert.deepEqual((await db.query("select * from flash_family_survivor_picks where not(week=1 and account_id in ('shdwemp','narcotics')) order by account_id,week")).rows,survivors,'All other Survivor choices, including current-week picks, stay intact');
  await db.exec('set role anon');
  assert.deepEqual(await read(),{...expected,unknown:0},'Exact totals; unlisted entrants start at zero; Week 1 not counted twice');
  await assert.rejects(db.query('select * from flash_family_pickem_score_baselines'),/permission denied/);
  await assert.rejects(db.query('update flash_family_pickem_score_baselines set correct=999'),/permission denied/);
  for(const [code,id,team] of [['PANCHAM','narcotics','chicago-conkquerers'],['NC50','shdwemp','stockholm-spin-cycles']]){
   const state=(await db.query('select read_flash_family_survivor($1) data',[code])).rows[0].data;
   assert.equal(state.contestants.find(c=>c.account_id===id).eliminated_week,null);
   assert(state.own_picks.some(p=>p.week===1&&p.picked_team_id===team));
   assert(state.history.some(p=>p.account_id===id&&p.week===1&&p.outcome==='correct'));
   await assert.rejects(db.query('select submit_flash_family_survivor($1,2,$2)',[code,team]),/already used/);
  }
  await db.exec('reset role;update flash_family_matchups set home_score=2,away_score=0 where week=2 and display_order=1;set role anon');
  assert.equal((await read()).neto,3,'Week 2 adds to restored totals');
  assert.equal((await read()).unknown,0,'Incorrect future picks add nothing');
  await db.exec('reset role;update flash_family_matchups set home_score=0,away_score=2 where week=2 and display_order=1;set role anon');
  assert.equal((await read()).neto,2,'Correcting a result recalculates, rather than accumulating twice');
  assert.equal((await read()).unknown,1,'Unlisted users earn future points normally');
  await db.exec('reset role;update flash_family_matchups set home_score=2,away_score=2 where week=2;set role anon');
  assert.equal((await read()).neto,2,'Tied games award no prediction point');
  await db.exec('reset role;update leagues set current_matchup_number=3;set role anon');
  assert.equal((await read()).neto,2,'Week advancement preserves restored scores');
 }finally{await db.close();}
 for(const conflict of ['existing-week-one','reused-team']){
  const db=await fixture();
  try{
   await db.exec(conflict==='existing-week-one'
    ? "insert into flash_family_survivor_picks(league_id,account_id,username,week,picked_team_id) values('flash-family-season-1','shdwemp','Shdwemp',1,'b')"
    : "update flash_family_survivor_picks set picked_team_id='stockholm-spin-cycles' where account_id='shdwemp' and week=2");
   await assert.rejects(db.exec(migration),/conflicts/);
   await db.exec('rollback');
   assert.equal((await db.query("select count(*) from flash_family_survivor_picks where account_id='narcotics'")).rows[0].count,0,'Conflicting historical choice rolls back the whole correction');
  }finally{await db.close();}
 }
 console.log('PASS: exact restored totals, all existing picks preserved, two correct Survivor entries/no reuse, unknown users zero, future scoring/result corrections, permissions and conflict rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
