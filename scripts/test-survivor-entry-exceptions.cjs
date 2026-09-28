// Isolated database fixtures only. No live picks or scores are written.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
(async()=>{
 const db=new PGlite();
 const read=async(code='')=>(await db.query('select read_flash_family_survivor($1) data',[code])).rows[0].data;
 const pick=(code,week,team)=>db.query('select submit_flash_family_survivor($1,$2,$3)',[code,week,team]);
 const contestant=(state,id)=>state.contestants.find(c=>c.account_id===id);
 try{
  await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
   create table leagues(id text primary key,current_matchup_number int,waiver_window_end_at timestamptz);
   insert into leagues values('flash-family-season-1',1,now()+interval '1 day');
   create table flash_family_matchups(league_id text,week int,display_order int,home_team_id text,away_team_id text,home_score int,away_score int);
   insert into flash_family_matchups select 'flash-family-season-1',w,n,case n when 1 then 'a' else 'c' end,case n when 1 then 'b' else 'd' end,null,null from generate_series(1,3) w cross join generate_series(1,2) n;`);
  await db.exec(sql('20260915100000_add_survivor.sql'));
  await pick('NETO',1,'a');await pick('MOON4',1,'b');
  await db.exec('update flash_family_matchups set home_score=2,away_score=0 where week=1; update leagues set current_matchup_number=2');
  await pick('NC50',2,'c');await pick('FORMIDABLE',2,'c');
  const before=await read(),snapshot=(await db.query('select * from flash_family_survivor_picks order by account_id,week')).rows;
  assert.equal(contestant(before,'shdwemp').eliminated_week,1);
  await db.exec(sql('20260928145000_survivor_week_one_entry_exceptions.sql'));
  assert.deepEqual((await db.query('select * from flash_family_survivor_picks order by account_id,week')).rows,snapshot,'Migration must preserve every saved pick');
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from flash_family_survivor_missed_week_exemptions'),/permission denied/);
  const after=await read('NC50');
  assert.equal(contestant(after,'shdwemp').eliminated_week,null);
  assert.equal(contestant(after,'narcotics').eliminated_week,null,'Narcotics can enter without a fabricated past pick');
  assert.deepEqual(after.own_picks,[{week:2,picked_team_id:'c'}]);
  for(const id of ['neto','kirbbles','fear'])assert.deepEqual(contestant(after,id),contestant(before,id),'Other eligibility must remain unchanged');
  assert(!after.history.some(h=>h.account_id==='shdwemp'||h.account_id==='narcotics'),'No invented Week 1 result or public exception text');
  assert.equal(after.deadline,before.deadline);assert.equal(after.locked,before.locked);
  await pick('PANCHAM',2,'d');await pick('PANCHAM',2,'b');
  assert.equal((await read('PANCHAM')).own_picks.length,1,'Still one pick per week');
  await assert.rejects(pick('PANCHAM',1,'a'),/active week/);
  assert.deepEqual((await read()).own_picks,[]);assert(!(await read()).history.some(h=>h.week===2),'Unrevealed picks remain private');
  await db.exec('reset role;update leagues set waiver_window_end_at=now();set role anon');
  await assert.rejects(pick('PANCHAM',2,'d'),/locked/);await assert.rejects(pick('NC50',2,'a'),/locked/);
  await db.exec("reset role;update leagues set waiver_window_end_at=now()+interval '1 day';update flash_family_matchups set home_score=2,away_score=0 where week=2;update leagues set current_matchup_number=3;set role anon");
  assert.equal(contestant(await read(),'narcotics').eliminated_week,2,'An incorrect Week 2 pick still eliminates');
  assert.equal(contestant(await read(),'shdwemp').eliminated_week,null,'Correct Week 2 pick survives');
  await assert.rejects(pick('NC50',3,'c'),/already used/);
  await db.exec('reset role;update flash_family_matchups set home_score=2,away_score=0 where week=3;set role anon');
  assert.equal(contestant(await read(),'shdwemp').eliminated_week,3,'Missing later weeks still eliminates');
  await db.exec("reset role;insert into flash_family_survivor_picks(league_id,account_id,username,week,picked_team_id) values('flash-family-season-1','shdwemp','Shdwemp',1,'b');set role anon");
  assert.equal(contestant(await read(),'shdwemp').eliminated_week,1,'Exception covers a missed pick, never an incorrect one');
  console.log('PASS: only Narcotics/Shdwemp missed Week 1 is waived; saved picks, others, deadlines, privacy, future elimination and no-team-reuse preserved.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
