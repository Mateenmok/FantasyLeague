// Real in-memory PostgreSQL only. Never connects to the league database.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const migration=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
const teams=['daytona-torterras','kansas-krooks','south-jersey-hounds','chicago-conkquerers','las-vegas-gatrs','north-carolina-ceruledge','uconn-arcanines','boston-eeltics','sunnyshore-city-shelter','massachusetts-midnight','miami-dragapults','san-francisco-soulfire','stockholm-spin-cycles','dallas-disguises'];
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
   create table leagues(id text primary key,current_matchup_number integer default 8,schedule_generated boolean default true,
    regular_season_matches integer default 10,playoff_team_count integer default 8,roster_point_cap integer default 50,
    waiver_window_start_at timestamptz,waiver_window_end_at timestamptz,waiver_open boolean default false);
   insert into leagues(id)values('flash-family-season-1');
   create table league_teams(id text,league_id text,owner_name text);
   create table flash_family_draft_pool(pokemon_name text,point_value integer);
   create table team_rosters(league_id text,team_id text,pokemon_slug text);`);
  await db.exec(migration('20260907030000_add_flash_family_waiver_api.sql').split('create or replace function public.submit_flash_family_waiver(')[0]);
  for(const name of ['20260907070000_add_flash_family_pickems.sql','20260907113000_lock_pickems_with_waivers.sql','20260907101000_correct_flash_family_week_rewind.sql','20260914190000_add_weekly_kos_and_shared_points.sql','20260915100000_add_survivor.sql','20260915120000_add_game_lineups.sql','20260918223000_preserve_predictions_on_week_changes.sql','20260928145000_survivor_week_one_entry_exceptions.sql','20261007190000_add_friday_night_pokeleague.sql'])await db.exec(migration(name));
  // Real guest writer, with only identity lookup stubbed for this isolated test.
  await db.exec(`create function public.read_flash_family_guest_account(text)returns jsonb language sql as $$select '{"id":"guest-qa","accountName":"Guest QA"}'::jsonb$$`);
  const guest=migration('20261006190000_add_guest_accounts.sql');
  await db.exec(guest.slice(guest.indexOf('create function public.submit_flash_family_guest_pickem('),guest.indexOf('-- A dedicated spectator read')));
  await db.exec('grant execute on function public.submit_flash_family_guest_pickem(text,integer,integer,text)to anon,authenticated');
  // Eight complete weeks, one unbeaten GM, one Week-8 elimination, and an exempt GM.
  await db.exec('delete from flash_family_matchups');
  for(let week=1;week<=8;week++){
   const rotated=teams.slice(week-1).concat(teams.slice(0,week-1));
   for(let i=0;i<7;i++)await db.query("insert into flash_family_matchups(league_id,week,display_order,home_team_id,away_team_id,home_score,away_score)values('flash-family-season-1',$1,$2,$3,$4,2,0)",[week,i+1,rotated[i],rotated[i+7]]);
   await db.query("insert into flash_family_survivor_picks(league_id,account_id,username,week,picked_team_id)values('flash-family-season-1','pufferz','Pufferz',$1,$2),('flash-family-season-1','fear','Fear',$1,$3)",[week,teams[week-1],week===8?teams[0]:teams[week+5]]);
   if(week>1)await db.query("insert into flash_family_survivor_picks(league_id,account_id,username,week,picked_team_id)values('flash-family-season-1','narcotics','Narcotics',$1,$2)",[week,teams[week-1]]);
  }
  await db.exec("insert into flash_family_pickems(league_id,week,display_order,account_id,username,picked_team_id)values('flash-family-season-1',8,1,'pufferz','Pufferz','boston-eeltics')");
  const rows=(table,order='week,display_order')=>db.query(`select * from ${table} order by ${order}`).then(r=>r.rows);
  const oldMatches=await rows('flash_family_matchups'),oldPicks=await rows('flash_family_pickems'),oldSurvivor=await rows('flash_family_survivor_picks','account_id,week');
  await db.exec(migration('20261115180000_add_playoff_rounds.sql'));
  assert.deepEqual(await rows('flash_family_matchups'),oldMatches);
  assert.deepEqual(await rows('flash_family_pickems'),oldPicks);
  assert.deepEqual(await rows('flash_family_survivor_picks','account_id,week'),oldSurvivor);
  const league=()=>db.query("select * from leagues where id='flash-family-season-1'").then(r=>r.rows[0]);
  assert.equal((await league()).current_matchup_number,8);
  assert.equal((await league()).regular_season_matches,8);
  const schedule=(week,homes,aways,code='NETO')=>db.query('select save_flash_family_week_schedule($1,$2,$3,$4)',[code,week,homes,aways]);
  const advance=(expected,homes,aways,end=null,code='NETO')=>db.query('select advance_flash_family_playoff_round($1,$2,$3,$4,$5) week',[code,expected,homes,aways,end]).then(r=>r.rows[0].week);
  const survivors=()=>db.query("select read_flash_family_survivor('PUFF1') value").then(r=>r.rows[0].value);
  const completedWeekEight=await survivors();
  assert.equal(completedWeekEight.current_week,8);assert.equal(completedWeekEight.season_complete,true,'Survivor finishes as soon as Week 8 results are complete');
  assert.deepEqual(completedWeekEight.winners.map(w=>w.account_id).sort(),['narcotics','pufferz']);
  await db.exec("update flash_family_matchups set home_score=null,away_score=null where week=8 and display_order=1");
  const ongoingWeekEight=await survivors();assert.equal(ongoingWeekEight.season_complete,false);assert.equal(ongoingWeekEight.results_complete,false);assert.deepEqual(ongoingWeekEight.winners,[]);
  await db.exec("update flash_family_matchups set home_score=2,away_score=0 where week=8 and display_order=1");
  const h=[teams[0],teams[2],null,null],a=[teams[1],null,null,null];
  const initial=await league();
  await db.exec('set role anon');
  await assert.rejects(advance(8,h,a,null,'NC50'),/Admin access/);
  await assert.rejects(advance(7,h,a),/period changed/);
  await assert.rejects(advance(8,[teams[0]],a),/matchup slots/);
  await assert.rejects(advance(8,h,[teams[0],null,null,null]),/only once/);
  await assert.rejects(advance(8,['fake',null,null,null],a),/this league/);
  await assert.rejects(advance(8,h,a,'2000-01-01T00:00:00Z'),/future waiver/);
  await assert.rejects(db.exec("select set_flash_family_current_week('NETO',9)"),/Choose the playoff bracket/);
  await db.exec('reset role');assert.deepEqual(await league(),initial);assert.equal((await rows('flash_family_matchups')).length,56);
  await db.exec('set role anon');
  const end=new Date(Date.now()+86400000).toISOString();
  assert.equal(await advance(8,h,a,end),9);
  await db.exec('reset role');
  assert.equal((await league()).current_matchup_number,9);assert.equal((await league()).waiver_open,true);assert((await league()).waiver_window_start_at);
  assert.deepEqual((await rows('flash_family_matchups')).filter(m=>m.week<=8),oldMatches);
  assert.equal((await rows('flash_family_matchups')).filter(m=>m.week===9).length,4);
  await db.exec('set role anon');
  await assert.rejects(advance(8,h,a,end),/period changed/);
  await assert.rejects(db.query("select submit_flash_family_pickem('PUFF1',9,2,$1)",[teams[2]]),/both matchup teams/);
  await assert.rejects(db.query("select submit_flash_family_guest_pickem('qa',9,2,$1)",[teams[2]]),/both matchup teams/);
  await db.query("select submit_flash_family_pickem('PUFF1',9,1,$1)",[teams[0]]);
  await db.query("select submit_flash_family_guest_pickem('qa',9,1,$1)",[teams[1]]);
  await assert.rejects(db.query("select save_flash_family_week_results('NETO',9,array[2],array[2],array[0],array[8],array[1])"),/pending_matchup_no_results/);
  await assert.rejects(schedule(9,[teams[4],teams[2],null,null],a),/already has predictions/);
  a[1]=teams[3];await schedule(9,h,a); // fill another unknown opponent even though match 1 has votes.
  await schedule(9,h,a); // no-op must preserve votes.
  await assert.rejects(schedule(8,teams.slice(0,7),[...teams.slice(7,13),null]),/Every league team/);
  await assert.rejects(schedule(8,teams.slice(0,7),teams.slice(7)),/already has results/);
  await assert.rejects(db.query("select submit_flash_family_survivor('PUFF1',9,$1)",[teams[0]]),/Survivor has ended/);
  const final=await survivors();
  assert.equal(final.week,8);assert.equal(final.current_week,9);assert.equal(final.season_complete,true);assert.equal(final.results_complete,true);assert.equal(final.locked,true);
  assert.deepEqual(final.winners.map(w=>w.account_id).sort(),['narcotics','pufferz']);
  assert.equal(final.contestants.find(c=>c.account_id==='fear').eliminated_week,8);
  assert(final.history.every(r=>r.week<=8));assert.equal(final.matchups.length,0);
  assert.equal((await db.query('select read_flash_family_fnpl() value')).rows[0].value.totalWeeks,11);
  await db.query("select save_flash_family_fnpl('NETO',9,'2026-11-20','[]'::jsonb,0)");
  // Later rounds can be entirely TBD, and do not implicitly change waiver dates.
  assert.equal(await advance(9,[null,null],['',null]),10);
  assert.equal(await advance(10,[null],[null]),11);
  await assert.rejects(advance(11,[null],[null]),/after Week 8 through Round 2/);
  await assert.rejects(db.exec("select set_flash_family_current_week('NETO',12)"),/Championship/);
  await assert.rejects(db.exec("select set_flash_family_season_rules('NETO',10,50)"),/eight regular weeks/);
  await db.exec("select set_flash_family_season_rules('NETO',8,55)");
  await db.exec('reset role');
  assert.equal((await league()).current_matchup_number,11,'Rule edits must not rewind active playoffs');
  assert.equal(new Date((await league()).waiver_window_end_at).toISOString(),end);
  assert.deepEqual(await rows('flash_family_survivor_picks','account_id,week'),oldSurvivor);
  assert.deepEqual((await rows('flash_family_pickems')).filter(p=>p.week<=8),oldPicks);
  // Unresolved Week-8 results cannot prematurely crown survivors.
  await db.exec("update flash_family_matchups set home_score=null,away_score=null where week=8 and display_order=1");
  const pending=await survivors();assert.equal(pending.results_complete,false);assert.deepEqual(pending.winners,[]);
  await db.exec("update flash_family_matchups set home_score=2,away_score=0 where week=8 and display_order=1");
  const afterPlayoffs=await survivors();assert.deepEqual(afterPlayoffs.winners,final.winners);
  // Rewinding a playoff period retains all predictions; the established rewind
  // behavior for results remains unchanged.
  await db.exec("set role anon;select rewind_flash_family_current_week('NETO');reset role");
  assert.deepEqual(await rows('flash_family_survivor_picks','account_id,week'),oldSurvivor);
  assert.equal((await rows('flash_family_pickems')).filter(p=>p.week===9).length,2);
  console.log('PASS: atomic partial playoff advancement, 4/2/1 slots, TBD completion, admin/stale/duplicate guards, waiver opening, protected predictions/results, strict regular schedules, partial-score/vote rejection, FNPL playoffs, Survivor Week-8 winners/exemptions/unresolved results, rewind preservation.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
