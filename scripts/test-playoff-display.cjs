// Exercises the production display scripts with a small DOM fixture and no network/browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8');
const teams = Array.from({length:14},(_,i)=>({id:'team-'+i,name:'Team '+i,logo:'team-'+i+'.png'}));
const account = {id:'test-account',accountName:'Test GM',teamId:'team-0'};
const response = json => ({ok:true,status:200,json:async()=>json,text:async()=>JSON.stringify(json)});
class Element {
  constructor(){this.nodes=new Map();this.events={};this.textContent='';this.innerHTML='';this.hidden=false;this.classList={toggle(){},add(){},remove(){}};this.dataset={};this.style={};this.attributes={};}
  querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Element());return this.nodes.get(key);}
  querySelectorAll(){return [];}
  addEventListener(key,fn){this.events[key]=fn;}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){delete this.attributes[key];}
  append(el){this.appended=el;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){}
}
function scope(){
  const document=new Element();document.body=new Element();document.createElement=()=>new Element();
  const launcher=new Element();document.querySelectorAll=selector=>selector==='[data-survivor-open]'?[launcher]:[];
  const storage=new Map([['pokeleague.accessCode','TEST']]);
  const context={window:{dispatchEvent(){},addEventListener(){}},document,launcher,URLSearchParams,Date,Intl,Number,Math,JSON,console,CustomEvent:class{},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},sessionStorage:{getItem:()=>null},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},CSS:{escape:value=>value}};
  vm.createContext(context);vm.runInContext(source('league-state'),context);return context;
}
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
async function pickems(week,matchups){
  const c=scope();let submissions=0;
  c.fetch=async url=>response(url.includes('league-teams')?{teams}:url.includes('teams.json')?{accounts:{TEST:account}}:url.includes('catalog')?[]:{});
  c.window.PokeLeagueRosters={read:async()=>({}),readNicknames:async()=>({}),namesFromSlugs:()=>({}),orderForDisplay:names=>names||[],slugify:x=>x};
  c.window.PokeLeagueCompetition={read:async()=>({currentWeek:week,matchups,pickemsLockAt:null}),readPicks:async()=>[],readLeaderboard:async()=>[],submitPick:async()=>submissions++};
  vm.runInContext(source('pickems'),c);await flush();return {c,submissions:()=>submissions};
}
async function survivor(snapshot){
  const c=scope();let submissions=0;
  c.fetch=async url=>{
    if(url.includes('submit_flash_family_survivor')){submissions++;return response(null);}
    return response(url.includes('read_flash_family_survivor')?snapshot:url.includes('league-teams')?{teams}:{accounts:{TEST:account}});
  };
  vm.runInContext(source('survivor'),c);c.launcher.events.click();await flush();return {c,dialog:c.document.body.appended,submissions:()=>submissions};
}
(async()=>{
  const c=scope(),S=c.window.PokeLeagueState;
  assert.deepEqual([0,8,9,10,11].map(S.weekLabel),['Week 0','Week 8','Round 1','Round 2','Championship']);
  assert.deepEqual([8,9,10,11].map(S.matchupCount),[7,4,2,1]);
  assert.equal(S.write({totalWeeks:10,currentWeek:9}).totalWeeks,11,'Legacy cached season length cannot truncate the championship');
  assert(!S.matchupReady({home_team_id:'a',away_team_id:null}));assert(!S.matchupReady({home_team_id:'a',away_team_id:'a'}));assert(S.matchupReady({home_team_id:'a',away_team_id:'b'}));
  for(const week of [9,10,11]){
    const {c}=await pickems(week,[]);
    assert.equal(c.document.querySelector('[data-pickems-week]').textContent,S.weekLabel(week));
    assert(c.document.querySelector('[data-matchup-grid]').innerHTML.includes('have not been posted'),'No invented regular-season pairings in playoffs');
  }
  const partial={week:9,display_order:1,home_team_id:'team-0',away_team_id:null,home_score:null,away_score:null};
  const partialView=await pickems(9,[partial]);
  const markup=partialView.c.document.querySelector('[data-matchup-grid]').innerHTML;
  assert(markup.includes('Team 0')&&markup.includes('TBD'));
  assert.equal((markup.match(/aria-pressed="false" disabled/g)||[]).length,2,'Both prediction buttons disabled for incomplete matchup');
  assert(markup.includes('Waiting for opponent'));
  const fullView=await pickems(9,[{...partial,away_team_id:'team-1'}]);
  assert(!fullView.c.document.querySelector('[data-matchup-grid]').innerHTML.includes('aria-pressed="false" disabled'));
  const baseline={week:8,current_week:9,season_complete:true,results_complete:true,winners:[{account_id:account.id,username:'Test GM'},{account_id:'guest',username:'Guest Winner'}],locked:true,account_id:account.id,own_picks:[],history:[],ended_weeks:[8],contestants:[],matchups:[]};
  const finished=await survivor(baseline),finale=finished.dialog.querySelector('[data-sv-finale]');
  assert.equal(finale.hidden,false);assert.equal(finished.dialog.querySelector('[data-sv-content]').hidden,true);
  assert(finale.innerHTML.includes('Survivor winners')&&finale.innerHTML.includes('Test GM')&&finale.innerHTML.includes('Guest Winner'));
  assert(finale.innerHTML.includes('Team 0 logo'),'Known winner team logo shown');
  await finished.dialog.querySelector('.survivor-save').events.click();assert.equal(finished.submissions(),0,'Completed season cannot submit picks');
  const pending=await survivor({...baseline,results_complete:false,winners:baseline.winners});
  assert(pending.dialog.querySelector('[data-sv-finale]').innerHTML.includes('Final results pending'));
  assert(!pending.dialog.querySelector('[data-sv-finale]').innerHTML.includes('Test GM'),'Unsettled results must not declare winners');
  const noWinner=await survivor({...baseline,winners:[]});assert(noWinner.dialog.querySelector('[data-sv-finale]').innerHTML.includes('No survivors this season'));
  const regular=await survivor({...baseline,week:8,current_week:8,season_complete:false,results_complete:false,winners:[],locked:false,matchups:[partial]});
  assert.equal(regular.dialog.querySelector('[data-sv-finale]').hidden,true);assert.equal(regular.dialog.querySelector('[data-sv-content]').hidden,false);
  assert.equal((regular.dialog.querySelector('[data-sv-matches]').innerHTML.match(/disabled/g)||[]).length,2);
  console.log('Playoff display passed: phase names, 4/2/1 counts, stale season length, no invented bracket, partial matchup safety, Survivor joint/none/pending winners and post-season submission guard.');
})().catch(error=>{console.error(error);process.exitCode=1;});
