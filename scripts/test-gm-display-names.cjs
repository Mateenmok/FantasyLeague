// Isolated database fixtures only; never submits live picks or alters live scores.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),sql=name=>fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8');
const migration=sql('20261020203000_correct_gm_display_names.sql');
const accounts=JSON.parse(fs.readFileSync(path.join(root,'data/teams.json'),'utf8')).accounts;
for(const [code,id,name,team] of [['MIMIC','kilan','kilain','dallas-disguises'],['GIANT','norforil','norfiril','san-francisco-soulfire']]){
  assert.equal(accounts[code].id,id);assert.equal(accounts[code].accountName,name);
  assert.equal(accounts[code].teamId,team);assert.equal(accounts[code].isAdmin,false);
}
(async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;
      create table leagues(id text primary key,current_matchup_number int,waiver_window_end_at timestamptz);
      insert into leagues values('flash-family-season-1',5,now()+interval '1 day'),('other-league',5,null);
      create table league_teams(id text primary key,league_id text,owner_name text,team_access_code text,is_admin boolean,record text);
      insert into league_teams values
        ('dallas-disguises','flash-family-season-1','Kilan','MIMIC',false,'2-2'),
        ('san-francisco-soulfire','flash-family-season-1','Norforil','GIANT',false,'3-1'),
        ('unchanged','flash-family-season-1','Fear','FORMIDABLE',false,'3-1');
      create table flash_family_matchups(league_id text,week int,display_order int,home_team_id text,away_team_id text,home_score int,away_score int);
      insert into flash_family_matchups values('flash-family-season-1',1,1,'old-a','old-b',2,0),('flash-family-season-1',5,1,'new-a','new-b',null,null);
      create table flash_family_pickems(league_id text,week int,display_order int,account_id text,username text,picked_team_id text,updated_at timestamptz default now(),primary key(league_id,week,display_order,account_id));
      create table flash_family_pickem_score_baselines(league_id text,account_id text,username text,through_week int,correct int);
      insert into flash_family_pickems values
        ('flash-family-season-1',1,1,'kilan','Kilan','old-a','2026-09-21'),
        ('flash-family-season-1',5,1,'norforil','Norforil','new-b','2026-10-19'),
        ('other-league',5,1,'kilan','Kilan','other-team','2026-10-19');
      insert into flash_family_pickem_score_baselines values
        ('flash-family-season-1','kilan','Kilan',1,3),('flash-family-season-1','norforil','Norforil',1,2),('other-league','kilan','Kilan',1,99);`);
    await db.exec(sql('20260915100000_add_survivor.sql'));
    await db.exec(sql('20260928145000_survivor_week_one_entry_exceptions.sql'));
    await db.exec(sql('20260907113000_lock_pickems_with_waivers.sql').replace(
      "('NC50', 'shdwemp', 'Shdwemp')",
      "('NC50', 'shdwemp', 'Shdwemp'), ('MIMIC', 'kilan', 'Kilan'), ('GIANT', 'norforil', 'Norforil')"));
    await db.exec(`insert into flash_family_survivor_picks(league_id,account_id,username,week,picked_team_id) values
      ('flash-family-season-1','kilan','Kilan',1,'old-a'),('flash-family-season-1','norforil','Norforil',1,'old-b');
      insert into flash_family_survivor_missed_week_exemptions values('flash-family-season-1','norforil','Norforil',2);`);
    const tables=['league_teams','flash_family_pickems','flash_family_pickem_score_baselines','flash_family_survivor_picks','flash_family_survivor_missed_week_exemptions'];
    const snapshot=async()=>Promise.all(tables.map(async table=>(await db.query(`select * from ${table} order by to_jsonb(${table})::text`)).rows));
    const before=await snapshot();
    await db.exec(migration);
    const expected=before.map((rows,i)=>rows.map(row=>{
      if(row.league_id!=='flash-family-season-1')return row;
      if(i===0){const name={'dallas-disguises':'kilain','san-francisco-soulfire':'norfiril'}[row.id];return name?{...row,owner_name:name}:row;}
      const name={kilan:'kilain',norforil:'norfiril'}[row.account_id];return name?{...row,username:name}:row;
    }));
    assert.deepEqual(await snapshot(),expected,'Only display names change; all choices, scores, timestamps, IDs, codes and unrelated accounts stay intact');
    await db.exec(migration);assert.deepEqual(await snapshot(),expected,'Safe to reapply');
    for(const [code,id,name,pick] of [['MIMIC','kilan','kilain','new-a'],['GIANT','norforil','norfiril','new-b']]){
      assert.deepEqual((await db.query('select * from flash_family_survivor_account($1)',[code])).rows,[{account_id:id,username:name}]);
      await db.query('select submit_flash_family_pickem($1,5,1,$2)',[code,pick]);
      await db.query('select submit_flash_family_survivor($1,5,$2)',[code,pick]);
      for(const table of ['flash_family_pickems','flash_family_survivor_picks'])assert.equal((await db.query(`select username from ${table} where league_id='flash-family-season-1' and week=5 and account_id=$1`,[id])).rows[0].username,name);
      const state=(await db.query('select read_flash_family_survivor($1) as state',[code])).rows[0].state;
      assert.equal(state.username,name);assert.equal(state.contestants.find(c=>c.account_id===id).username,name);
    }
    await db.exec('set role anon');
    await assert.rejects(db.query("select * from flash_family_survivor_account('MIMIC')"),/permission denied/);
    await assert.rejects(db.query('select * from flash_family_survivor_picks'),/permission denied/);
    await assert.rejects(db.query("select submit_flash_family_pickem('BAD',5,1,'new-a')"),/Sign in/);
    console.log('PASS: exact GM spellings, unchanged identities/codes/picks/scores/timestamps, future Pick’ems and Survivor names, idempotency and access restrictions.');
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
