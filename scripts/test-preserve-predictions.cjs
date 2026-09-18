// Isolated database fixtures only: no real league transitions.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
 create table leagues(id text primary key,current_matchup_number int default 0,schedule_generated boolean default false,waiver_window_end_at timestamptz);
 insert into leagues(id) values('flash-family-season-1');
 create table league_teams(id text,league_id text,owner_name text);
 create table flash_family_draft_pool(pokemon_name text,point_value int);
 create table team_rosters(league_id text,team_id text,pokemon_slug text);`);
 for(const file of ['20260907070000_add_flash_family_pickems.sql','20260907101000_correct_flash_family_week_rewind.sql','20260914190000_add_weekly_kos_and_shared_points.sql','20260915100000_add_survivor.sql','20260915120000_add_game_lineups.sql'])await db.exec(sql(file));
 const schedule=(await db.query('select * from flash_family_matchups where week=1 order by display_order')).rows;
 const home=schedule.map(m=>m.home_team_id),away=schedule.map(m=>m.away_team_id);
 const save=(week=1,h=home,a=away)=>db.query('select save_flash_family_week_schedule($1,$2,$3,$4)',['NETO',week,h,a]);
 for(const code of ['NETO','PUFF1','MOON4']){
  for(const m of schedule)await db.query('select submit_flash_family_pickem($1,1,$2,$3)',[code,m.display_order,m.home_team_id]);
  await db.query('select submit_flash_family_survivor($1,1,$2)',[code,home[0]]);
 }
 const picks=async()=>(await db.query('select * from flash_family_pickems order by week,display_order,account_id')).rows;
 const survivor=async()=>(await db.query('select * from flash_family_survivor_picks order by week,account_id')).rows;
 const initialPicks=await picks(),initialSurvivor=await survivor();
 await db.exec(sql('20260918223000_preserve_predictions_on_week_changes.sql'));
 assert.equal((await db.query('select count(*)::int as n from flash_family_prediction_history')).rows[0].n,24);
 await db.exec('set role anon');
 await assert.rejects(db.query('select * from flash_family_prediction_history'),/permission denied/);
 for(let i=0;i<3;i++){
  await save();await db.exec("select set_flash_family_current_week('NETO',1)");await save();
  await db.exec("select rewind_flash_family_current_week('NETO')");await save();
  assert.deepEqual(await picks(),initialPicks);
  await db.exec('reset role');assert.deepEqual(await survivor(),initialSurvivor);await db.exec('set role anon');
 }
 await assert.rejects(save(1,[home[1],home[0],...home.slice(2)]),/predictions/);
 assert.deepEqual(await picks(),initialPicks);
 await save(2);await db.exec("select set_flash_family_current_week('NETO',2)");
 await db.query('select submit_flash_family_survivor($1,2,$2)',['NETO',home[1]]);
 await db.exec("select rewind_flash_family_current_week('NETO');reset role");
 assert.equal((await survivor()).length,4,'Week 2 Survivor entry preserved after rewind');
 await assert.rejects(db.query("delete from flash_family_matchups where week=1"),/foreign key/);
 await db.query('select submit_flash_family_pickem($1,1,1,$2)',['NETO',away[0]]);
 const history=(await db.query("select * from flash_family_prediction_history where operation like 'UPDATE%' order by id")).rows;
 assert.equal(history.length,2);assert.equal(history[0].row_data.picked_team_id,home[0]);assert.equal(history[1].row_data.picked_team_id,away[0]);
 await save(3,[home[1],home[0],...home.slice(2)]);
 console.log('PASS: seeded votes survive repeated Week 0→1→0 and schedule saves; changed voted schedules rejected; Survivor rewind preserves future entries; FK blocks cascades; recovery archive private and records old/new picks.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
