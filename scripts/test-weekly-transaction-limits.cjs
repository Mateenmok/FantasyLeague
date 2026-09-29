// In-memory database only: no live roster, trade or waiver writes.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const migration=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
   create table leagues(id text primary key,waiver_window_start_at timestamptz,waiver_window_end_at timestamptz,roster_point_cap int,roster_pokemon_cap int,current_matchup_number int,waiver_acquisition_limit int);
   insert into leagues values('flash-family-season-1',now()-interval '1 hour',now()+interval '1 day',50,10,2,null);
   create table league_teams(id text primary key);
   create table team_rosters(league_id text,team_id text,pokemon_slug text,slot_number int,unique(league_id,pokemon_slug),unique(league_id,team_id,slot_number));
   grant select on team_rosters to anon,authenticated;
   create table league_waiver_acquisitions(id text primary key,league_id text,team_id text,pokemon_slug text,waiver_window_start_at timestamptz);`);
  for(const [team,names] of Object.entries({'boston-eeltics':['eelektross','abra','ditto'],'miami-dragapults':['dragapult','camerupt','torkoal'],'massachusetts-midnight':['umbreon','malamar','staraptor'],'sunnyshore-city-shelter':['goodra','florges','slowking']})){
   for(let i=0;i<names.length;i++)await db.query("insert into team_rosters values('flash-family-season-1',$1,$2,$3)",[team,names[i],i+1]);
  }
  await db.exec(migration('20260907130000_add_flash_family_trade_room.sql'));
  await db.exec(migration('20260914010000_add_transaction_log.sql'));
  await db.exec(migration('20260914200000_protect_waiver_mascots.sql'));
  await db.exec(`insert into flash_family_transaction_log(league_id,team_id,pokemon_slug,action,source,created_at) values
   ('flash-family-season-1','miami-dragapults','camerupt','added','waiver',now()),
   ('flash-family-season-1','boston-eeltics','abra','added','waiver',now()-interval '10 days'),
   ('flash-family-season-1','massachusetts-midnight','staraptor','added','trade',now());`);
  const rosters=()=>db.query('select * from team_rosters order by team_id,slot_number').then(r=>r.rows);
  const logs=()=>db.query('select * from flash_family_transaction_log order by id').then(r=>r.rows);
  const before=await rosters(),beforeLogs=await logs();
  await db.exec(migration('20260929001000_limit_weekly_waiver_pickups.sql'));
  assert.deepEqual(await rosters(),before);assert.deepEqual(await logs(),beforeLogs);
  const move=(code,team,add,drop=null,points=20)=>db.query('select submit_flash_family_waiver($1,$2,$3,$4,$5)',[code,team,add,drop,points]);
  const usage=()=>db.query('select * from flash_family_weekly_waiver_usage order by team_id,week').then(r=>r.rows);
  await db.exec('set role anon');
  assert.equal((await usage()).length,1,'Only the current-window waiver pickup consumes an allowance');
  assert.equal((await usage())[0].team_id,'miami-dragapults');
  await assert.rejects(move('NETO','miami-dragapults','gengar'),/one waiver pickup/);
  await assert.rejects(move('PUFF1','boston-eeltics','gengar','eelektross'),/mascot/);
  await assert.rejects(move('PUFF1','boston-eeltics','gengar',null,51),/point cap/);
  await assert.rejects(move('NETO','boston-eeltics','gengar'),/access code/);
  assert.equal((await usage()).length,1,'Rejected moves do not spend the allowance');
  await move('PUFF1','boston-eeltics','gengar','ditto');
  assert.equal((await usage()).length,2,'Add/drop is one pickup');
  const saved=await rosters(),savedLog=await logs();
  await assert.rejects(move('PUFF1','boston-eeltics','clefable'),/one waiver pickup/);
  assert.deepEqual(await rosters(),saved);assert.deepEqual(await logs(),savedLog);
  await move('PUFF1','boston-eeltics',null,'abra');
  await assert.rejects(move('PUFF1','boston-eeltics','clefable'),/one waiver pickup/);
  await db.exec("reset role;update leagues set waiver_window_start_at=now()-interval '10 minutes';set role anon");
  await assert.rejects(move('PUFF1','boston-eeltics','clefable'),/one waiver pickup/);
  await move('MOON4','massachusetts-midnight',null,'malamar');
  await move('MOON4','massachusetts-midnight','clodsire');
  await assert.rejects(move('MOON4','massachusetts-midnight','clefable'),/one waiver pickup/);
  await db.exec('reset role;update leagues set current_matchup_number=3;set role anon');
  await move('PUFF1','boston-eeltics','kingambit');
  await db.exec('reset role;update leagues set current_matchup_number=2;set role anon');
  await assert.rejects(move('PUFF1','boston-eeltics','clefable'),/one waiver pickup/,'Rewinding does not reset used allowances');
  // Waiver usage never consumes the separate trade allowance, for either side.
  const propose=(code,team,a,b)=>db.query('select propose_flash_family_trade($1,$2,$3,$4,40,40) id',[code,team,a,b]).then(r=>r.rows[0].id);
  const trade=await propose('PUFF1','massachusetts-midnight',['gengar','kingambit'],['staraptor','clodsire']);
  await db.query("select respond_flash_family_trade('MOON4',$1,'accept')",[trade]);
  await assert.rejects(propose('PUFF1','sunnyshore-city-shelter',['staraptor'],['florges']),/already completed its trade/);
  await assert.rejects(propose('MOON4','sunnyshore-city-shelter',['gengar'],['florges']),/already completed its trade/);
  await assert.rejects(propose('FORMIDABLE','massachusetts-midnight',['florges'],['gengar']),/already completed its trade/);
  await db.exec('reset role;update leagues set current_matchup_number=3;set role anon');
  const declined=await propose('PUFF1','sunnyshore-city-shelter',['staraptor'],['florges']);
  await db.query("select respond_flash_family_trade('FORMIDABLE',$1,'decline')",[declined]);
  const next=await propose('PUFF1','sunnyshore-city-shelter',['staraptor'],['florges']);
  await db.query("select respond_flash_family_trade('FORMIDABLE',$1,'accept')",[next]);
  await move('FORMIDABLE','sunnyshore-city-shelter','clefable',null,40);
  for(const statement of ['delete from flash_family_weekly_waiver_usage','update flash_family_weekly_waiver_usage set week=0',"insert into flash_family_weekly_waiver_usage values('flash-family-season-1','fake',3,now())"])
   await assert.rejects(db.exec(statement),/permission denied/);
  await db.exec("reset role;update leagues set current_matchup_number=4;create function fail_log_test() returns trigger language plpgsql as $$begin raise exception 'test log failure';end;$$;create trigger fail_log_test before insert on flash_family_transaction_log for each row execute function fail_log_test();set role anon");
  await assert.rejects(move('PUFF1','boston-eeltics','amoonguss'),/test log failure/);
  assert(!(await usage()).some(r=>r.week===4),'A later failure must roll back allowance consumption');
  console.log('PASS: weekly waiver backfill, one pickup/swap, separate drops, no window/rewind reset, failed-move rollback, permissions; trades limited for both sides, two Pokémon supported, separate weekly allowances.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
