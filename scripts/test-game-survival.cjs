// Local in-memory fixtures only; never changes live league data.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
   create table leagues(id text primary key,current_matchup_number int default 0,schedule_generated boolean default false);
   insert into leagues(id) values('flash-family-season-1');
   create table league_teams(id text,league_id text,owner_name text);
   create table flash_family_draft_pool(pokemon_name text,point_value int);
   create table team_rosters(league_id text,team_id text,pokemon_slug text);`);
  for(const file of ['20260907070000_add_flash_family_pickems.sql','20260907101000_correct_flash_family_week_rewind.sql','20260914190000_add_weekly_kos_and_shared_points.sql','20260915120000_add_game_lineups.sql','20260919060000_add_reported_game_winners.sql'])await db.exec(sql(file));
  const read=async()=>(await db.query('select * from flash_family_matchups where week=1 and display_order=1')).rows[0];
  const matchup=await read();
  for(const team of [matchup.home_team_id,matchup.away_team_id])for(const name of ['one','two','three'])await db.query('insert into team_rosters values($1,$2,$3)',['flash-family-season-1',team,name]);
  const legacy={game:1,home:['one','two'],away:['three'],winnerTeamId:matchup.home_team_id};
  const report={displayOrder:1,home:matchup.home_team_id,away:matchup.away_team_id,homeScore:1,awayScore:0,homeKOs:4,awayKOs:1};
  const save=(game=legacy,code='NETO')=>db.query('select save_flash_family_week_reports($1,1,$2)',[code,JSON.stringify([{...report,gameLineups:[game]}])]);
  await save();const baseline=await read();
  await db.exec(sql('20260919070000_add_game_survival_markers.sql'));
  await db.exec(sql('20260919071000_save_individual_game_details.sql'));
  assert.deepEqual(await read(),baseline,'Migration cannot rewrite existing reports');
  await db.exec('set role anon');
  await assert.rejects(save(legacy,'NC50'),/Admin/);
  const marked={...legacy,survival:{home:{one:true,two:false},away:{three:true}}};
  await save(marked);
  assert.deepEqual((await read()).game_lineups[0].survival,{home:{one:true,two:false},away:{three:false}},'Losers normalized to red even if a client submits green');
  const snapshot=await read();
  for(const survival of [null,[],{home:[]},{home:{one:'true'}},{home:{one:null}},{home:{three:true}},{away:{one:false}},{other:{}}]){
   await assert.rejects(save({...legacy,survival}),/survival|Survival/);
   assert.deepEqual(await read(),snapshot,'Invalid survival reports are atomic');
  }
  await save();
  assert.deepEqual((await read()).game_lineups[0].survival,snapshot.game_lineups[0].survival,'Old clients preserve existing markers');
  await save({...legacy,home:['two']});
  assert.deepEqual((await read()).game_lineups[0].survival.home,{two:false},'Removed Pokemon do not keep stray statuses');
  await save({...legacy,survival:{home:{},away:{}}});
  assert.deepEqual((await read()).game_lineups[0].survival,{home:{},away:{three:false}},'Unknown winning-side Pokemon remain unknown');
  report.homeScore=0;report.awayScore=1;
  await save({...legacy,winnerTeamId:matchup.away_team_id,survival:{home:{one:true},away:{three:true}}});
  assert.deepEqual((await read()).game_lineups[0].survival,{home:{one:false,two:false},away:{three:true}},'Away winner correctly makes home red');
  await save({...legacy,home:[],away:[],winnerTeamId:matchup.away_team_id,survival:{home:{},away:{}}});
  assert.deepEqual((await read()).game_lineups[0].survival,{home:{},away:{}},'No forced four-Pokemon selection');
  const beforeDirect=await read(),beforeOther=(await db.query('select * from flash_family_matchups where display_order<>1 order by week,display_order')).rows;
  const direct=(game,expected=beforeDirect.game_lineups[0],code='NETO')=>db.query('select save_flash_family_game_details($1,1,1,$2,$3,$4,$5,0,1) saved',[
    code,matchup.home_team_id,matchup.away_team_id,JSON.stringify(game),JSON.stringify(expected)]);
  const oneGame={...legacy,winnerTeamId:matchup.away_team_id,survival:{home:{one:true},away:{three:true}}};
  await assert.rejects(direct(oneGame,{},'NC50'),/Admin/);
  await assert.rejects(direct(oneGame,{}),/another admin/);
  const persisted=(await direct(oneGame)).rows[0].saved;
  assert.deepEqual(persisted.survival,{home:{one:false,two:false},away:{three:true}},'Direct save returns normalized, persisted markers');
  assert.deepEqual((await read()).game_lineups[0],persisted);
  for(const field of ['home_score','away_score','home_kos','away_kos'])assert.equal((await read())[field],beforeDirect[field],'Details cannot change scores or KOs');
  assert.deepEqual((await db.query('select * from flash_family_matchups where display_order<>1 order by week,display_order')).rows,beforeOther,'Other matchup reports are untouched');
  await assert.rejects(direct(oneGame),/another admin/,'Stale page cannot overwrite newer game details');
  await assert.rejects(direct({...oneGame,home:['outside']},persisted),/roster/);
  await assert.rejects(direct({...oneGame,winnerTeamId:matchup.home_team_id},persisted),/score/);
  assert.deepEqual((await read()).game_lineups[0],persisted,'Rejected direct saves do not alter saved game');
  console.log('PASS: surviving/fainted statuses, both losing sides auto-red, unknowns, validation, atomic saves, old-client preservation, zero-Pokemon reports, and no migration rewrites.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
