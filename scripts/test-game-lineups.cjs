// In-memory database only. Never changes production scores or rosters.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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
  for(const file of ['20260907070000_add_flash_family_pickems.sql','20260907101000_correct_flash_family_week_rewind.sql','20260914190000_add_weekly_kos_and_shared_points.sql','20260915120000_add_game_lineups.sql'])await db.exec(sql(file));
  await db.exec(sql('20260919060000_add_reported_game_winners.sql'));
  const first=async()=>(await db.query('select * from flash_family_matchups where week=1 and display_order=1')).rows[0];
  const m=await first();
  for(const team of [m.home_team_id,m.away_team_id])for(const slug of ['one','two','three','four','five'])await db.query('insert into team_rosters values($1,$2,$3)',['flash-family-season-1',team,slug]);
  const result={displayOrder:1,home:m.home_team_id,away:m.away_team_id,homeScore:2,awayScore:0,homeKOs:8,awayKOs:2,gameLineups:[{game:1,home:['one','two','three','four'],away:['two','three']},{game:2,home:[],away:['five']}]};
  const save=(r=result,code='NETO')=>db.query('select save_flash_family_week_reports($1,1,$2)',[code,JSON.stringify([r])]);
  await db.exec('set role anon');
  await assert.rejects(save(result,'NC50'),/Admin/);
  await save();assert.deepEqual((await first()).game_lineups,result.gameLineups);assert.equal((await first()).home_kos,8);
  const winnerReport={...result,gameLineups:result.gameLineups.map(g=>({...g,winnerTeamId:m.home_team_id}))};
  await save(winnerReport);
  assert.deepEqual((await first()).game_lineups,winnerReport.gameLineups,'Explicit winners persist');
  for(const winnerTeamId of ['not-in-matchup',42,m.away_team_id]){
    await assert.rejects(save({...result,gameLineups:[{game:1,home:[],away:[],winnerTeamId}]}),/winner|score/);
    assert.deepEqual((await first()).game_lineups,winnerReport.gameLineups,'Invalid winners cannot change reports');
  }
  await save({...result,gameLineups:[{game:1,home:[],away:[],winnerTeamId:null}]});
  assert.equal((await first()).game_lineups[0].winnerTeamId,null,'Winner can be cleared without selecting Pokemon');
  await save();
  const snapshot=await first();
  const invalid=[{...result,home:'wrong'}, {...result,gameLineups:[{game:3,home:[],away:[]}]},
   {...result,gameLineups:[{game:1,home:['one','two','three','four','five'],away:[]}]},
   {...result,gameLineups:[{game:1,home:['one','one'],away:[]}]},
   {...result,gameLineups:[{game:1,home:['outsider'],away:[]}]},
   {...result,gameLineups:[{game:1,home:[null],away:[]}]},
   {...result,gameLineups:[{game:1,home:[],away:[]},{game:1,home:[],away:[]}]},
   {...result,awayKOs:null}, {...result,homeScore:-1}];
  for(const bad of invalid){await assert.rejects(save(bad));assert.deepEqual(await first(),snapshot,'Rejected reports must preserve scores, KOs and lineups atomically');}
  await db.exec("reset role;delete from team_rosters where pokemon_slug='one';set role anon");
  await save();assert.equal((await first()).game_lineups[0].home[0],'one','Historical selection survives a later drop');
  await db.query('select save_flash_family_week_results($1,1,$2,$3,$4,$5,$6)',['NETO',[1],[2],[0],[8],[4]]);
  assert.deepEqual((await first()).game_lineups,result.gameLineups,'Cached older admin score pages preserve details');
  await save({...result,homeScore:1,awayScore:0,gameLineups:[result.gameLineups[0]]});
  assert.equal((await first()).game_lineups.length,1,'Correction removes nonexistent games');
  await save({...result,gameLineups:[]});assert.deepEqual((await first()).game_lineups,[],'Details fully optional');
  await db.query("reset role");await db.query('insert into team_rosters values($1,$2,$3)',['flash-family-season-1',m.home_team_id,'one']);await db.query('set role anon');
  await save();await db.exec("reset role;update leagues set current_matchup_number=2;update leagues set current_matchup_number=1;set role anon");
  assert.deepEqual((await first()).game_lineups,[],'Rewind clears details for the reopened week');
  await save({...result,gameLineups:[{game:1,home:['two'],away:[]}]});
  await db.exec("reset role;update flash_family_matchups set home_team_id='new-team' where week=1 and display_order=1;set role anon");
  assert.deepEqual((await first()).game_lineups,[],'Changed matchup cannot inherit another team’s lineups');
  await assert.rejects(db.query("update flash_family_matchups set game_lineups='[]'"),/permission denied/);
  console.log('PASS: optional 0–4 selections, per-game/team validation, admin-only atomic reports, KO preservation, historical dropped species, old clients, corrections and rewind.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
