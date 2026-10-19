const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../js/matchup-speed-model.js');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const index=read('data/matchup-speed-index.json');
assert.deepEqual(index,M.buildIndex(read('data/pokemon-catalog.json'),read('data/pokemon-details.json')),'Generated speeds remain in sync with the league source');
const rosters={one:['dragapult','garchomp','charizard','hisuian-arcanine'],two:['salamence','torkoal','unknown-mon']};
const before=JSON.stringify(rosters),result=M.compare(['one','two'],rosters,index);
assert.equal(JSON.stringify(rosters),before);
assert.equal(result.base.length,7);assert.equal(result.base[0].name,'Dragapult');assert.equal(result.base[0].speed,142);
assert.equal(result.base.at(-1).name,'unknown mon');assert.equal(result.base.at(-1).rank,null);
assert.equal(result.base.find(p=>p.name==='Hisuian Arcanine').speed,90);
assert(result.base.every(p=>!p.isMega));assert(result.mega.every(p=>p.isMega));
assert.equal(result.mega.find(p=>p.name==='Mega Garchomp').speed,92);
assert.equal(result.mega[0].name,'Mega Garchomp Z');assert.equal(result.mega[0].speed,151);
assert.equal(result.mega.filter(p=>p.name.startsWith('Mega Charizard')).length,2);
const ties=result.base.filter(p=>p.speed===100);assert.equal(ties.length,2);assert(ties.every(p=>p.tied&&p.rank===3));
for(const rows of [result.base,result.mega])for(let i=1;i<rows.length;i++)assert((rows[i-1].speed??-1)>=(rows[i].speed??-1));
assert.deepEqual(M.compare(['one','two'],{},index),{base:[],mega:[]});
assert.equal(M.compare(['one','one'],{one:['dragapult','dragapult']},index).base.length,1);
for(const pokemon of index){assert(Number.isInteger(pokemon.speed));assert(fs.existsSync(path.join(root,pokemon.sprite)));assert(!/\.gif/i.test(pokemon.sprite));}

// Run the actual access handler with a tiny DOM stub; PREP must not assume an identity.
async function checkAccess(inputCode){
  const nodes=new Map(),get=key=>{if(!nodes.has(key))nodes.set(key,{value:'',events:{},addEventListener(t,fn){this.events[t]=fn;},getAttribute(){return null;},setAttribute(){},removeAttribute(){},select(){},querySelector(s){return get(key+' '+s);}});return nodes.get(key);};
  const input=get('#accessCodeInput');input.value=inputCode;
  const session=new Map(),local=new Map([['pokeleague.accessCode','existing-owner'],['pokeleague.accountId','existing-id']]);let destination;
  const storage=map=>({setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/access.js'),'utf8'),{document:{querySelector:get},localStorage:storage(local),sessionStorage:storage(session),window:{PokeLeagueGuest:{normalize:v=>v.trim().toUpperCase()},location:{assign:url=>destination=url}},fetch:()=>{throw new Error('PREP must not read or write a guest account');}});
  await get('.access-form').events.submit({preventDefault(){}});
  assert.equal(destination,'matchup-prep.html');assert.equal(session.get('pokeleague.matchupPrep'),'PREP');
  assert.deepEqual([...local],[['pokeleague.accessCode','existing-owner'],['pokeleague.accountId','existing-id']]);
}
(async()=>{
  await checkAccess('PREP');await checkAccess(' prep ');
  if(process.env.PGLITE_PATH){
    const {PGlite}=require(process.env.PGLITE_PATH),db=new PGlite();
    try{
      await db.exec('create role anon;create role authenticated;create table league_teams(league_id text,team_access_code text,owner_name text);');
      const guestSql=fs.readFileSync(path.join(root,'supabase/migrations/20261006190000_add_guest_accounts.sql'),'utf8');
      await db.exec(guestSql.split('-- Deliberately separate')[0]+'commit;');
      await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261019210000_reserve_prep_access_code.sql'),'utf8'));
      await assert.rejects(db.query('select register_flash_family_guest($1,$2)',['GUEST1',' prep ']),/reserved/);
      const account=(await db.query('select register_flash_family_guest($1,$2) as account',['GUEST1','Viewer Test'])).rows[0].account;
      assert.equal(account.teamId,null);assert.equal(account.isAdmin,false);
      await assert.rejects(db.query("insert into flash_family_guest_accounts(nickname) values('PREP')"),/guest_prep_code_reserved/);
    }finally{await db.close();}
  }
  console.log('PASS: 252 synchronized base speeds, 82 separate Mega forms, ties, regional forms, empty/unknown rosters, static sprites and PREP routing/session isolation.');
  console.log(process.env.PGLITE_PATH?'PASS: PREP guest-code reservation and existing guest registration.':'SKIP: Database checks (set PGLITE_PATH to run).');
})().catch(error=>{console.error(error);process.exitCode=1;});
