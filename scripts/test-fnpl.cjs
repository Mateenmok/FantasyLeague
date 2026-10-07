// Isolated PostgreSQL + date/reordering tests. Never writes production data.
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../js/fnpl.js');
(async()=>{
  assert.deepEqual(F.defaultSlots().map(s=>s.time),['19:00','20:00','21:00']);
  assert.equal(F.dateForWeek(3,3,new Date('2026-10-07T12:00:00Z')),'2026-10-09');
  assert.equal(F.dateForWeek(4,3,new Date('2026-10-07T12:00:00Z')),'2026-10-16');
  assert.equal(F.dateForWeek(1,0,new Date('2026-10-10T02:00:00Z')),'2026-10-09','Friday in Eastern, even when UTC is Saturday');
  assert.deepEqual(F.countdown('2026-10-09T23:00:00Z',Date.parse('2026-10-07T21:30:00Z')).values,[2,1,30,0]);
  assert.equal(F.countdown('bad date'),null);assert(F.countdown('2020-01-01').ended);
  const order=F.defaultSlots().map((s,i)=>({...s,displayOrder:i+1}));
  const moved=F.moveAssignment(order,0,2);assert.deepEqual(moved.map(s=>s.displayOrder),[2,3,1]);assert.deepEqual(moved.map(s=>s.time),order.map(s=>s.time));assert.equal(order[0].displayOrder,1);
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
      create table leagues(id text primary key,current_matchup_number int,regular_season_matches int);
      insert into leagues values('flash-family-season-1',3,10);
      create table flash_family_matchups(league_id text,week int,display_order int,home_team_id text,away_team_id text,home_score int,away_score int);
      insert into flash_family_matchups values('flash-family-season-1',3,1,'a','b',2,1),('flash-family-season-1',3,2,'c','d',null,null),('flash-family-season-1',4,1,'a','c',null,null);
      create table picks(id int);insert into picks values(1);`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261007190000_add_friday_night_pokeleague.sql'),'utf8'));
    const read=async()=> (await db.query('select read_flash_family_fnpl() as data')).rows[0].data;
    const slots=[{time:'19:00',displayOrder:1,homeTeamId:'a',awayTeamId:'b'},{time:'20:00',displayOrder:2,homeTeamId:'c',awayTeamId:'d'},{time:'21:00',displayOrder:null}];
    const save=(s=slots,rev=0,code='PUFF1',week=3,date='2026-10-09')=>db.query('select save_flash_family_fnpl($1,$2,$3,$4,$5)',[code,week,date,JSON.stringify(s),rev]);
    await db.exec('set role anon');assert.deepEqual((await read()).events,[]);
    for(const code of ['',null,'NC50','DRAFTTEST1','GUEST1','random'])await assert.rejects(save(slots,0,code),/Admin access/);
    await assert.rejects(db.exec("insert into flash_family_fnpl values('flash-family-season-1',3,'2026-10-09','[]',1,now())"),/permission denied/);
    await save();let event=(await read()).events[0];assert.equal(event.revision,1);assert.equal(event.slots.length,3);assert(event.slots[0].valid);assert(!event.slots[2].valid);
    assert.equal(Date.parse(event.slots[0].startsAt),Date.parse('2026-10-09T23:00:00Z'),'7pm Eastern is 23:00 UTC during DST');
    await assert.rejects(save(),/Another admin/);
    for(const invalid of [[{...slots[0],homeTeamId:'changed'}],[slots[0],{...slots[0],time:'20:00'}],[slots[1],slots[0]],[{...slots[0],time:'25:00'}],[{...slots[0],time:'7:00'}],[{...slots[0],displayOrder:99}],[{time:'19:00'}, {time:'19:00'}]]){
      await assert.rejects(save(invalid,1));assert.equal((await read()).events[0].revision,1,'Rejected save is atomic');
    }
    await assert.rejects(save([],1,'PUFF1',11),/season/);await assert.rejects(save([],1,'PUFF1',3,null),/date/);
    await save(F.moveAssignment(slots,0,1),1,' neto ',3,'2026-11-06');event=(await read()).events[0];
    assert.equal(event.slots[0].homeTeamId,'c');assert.equal(Date.parse(event.slots[0].startsAt),Date.parse('2026-11-07T00:00:00Z'),'7pm Eastern adjusts to EST in November');
    await save([{time:'19:00',displayOrder:1,homeTeamId:'a',awayTeamId:'c'}],0,'PUFF1',4,'2026-10-16');
    await db.exec("reset role;update leagues set current_matchup_number=4;update leagues set current_matchup_number=3;set role anon");assert.equal((await read()).events.length,2,'Advance/rewind keeps FNPL events');
    await db.exec("reset role;update flash_family_matchups set home_team_id='changed' where week=3 and display_order=2;set role anon");
    assert.equal((await read()).events[0].slots[0].valid,false,'Changed weekly pairing is not advertised as the original');
    await save([],2);assert.deepEqual((await read()).events[0].slots,[],'All slots can be removed');
    await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from picks')).rows[0].n,1);
    assert.equal((await db.query('select home_score from flash_family_matchups where week=3 and display_order=1')).rows[0].home_score,2);
    console.log('PASS: admin-only atomic saves, revisions, week isolation, reordering, add/remove, real matchup validation, stale-matchup filtering, unchanged scores/picks, EDT/EST and countdown.');
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
