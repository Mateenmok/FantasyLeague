#!/usr/bin/env node
// Isolated UI fixture. This server never forwards requests or writes production data.
// Start: node scripts/preview-playoffs.cjs [port=8045] [initial-week=8]
// Read fixtures/assertions: GET /__fixture/state
// Reset/control only this in-memory fixture: POST /__fixture/control
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 8045;
const initialWeek = Number(process.argv[3]) || 8;
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const teams = read('data/league-teams.json').teams;
const catalog = read('data/pokemon-catalog.json');
const accounts = read('data/teams.json').accounts;
const account = accounts.NETO;
const points = Object.fromEntries(catalog.map(p => [p.name, Number(p.points)]));
const clone = value => JSON.parse(JSON.stringify(value));
const slug = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const rosterRows = teams.flatMap((t, i) => [t.mascot, ...catalog.slice(i * 4, i * 4 + 3).map(p => p.name)].map((name, slot) => ({team_id:t.id,pokemon_slug:slug(name),slot_number:slot+1})));
const match = (week, order, home, away) => ({league_id:'flash-family-season-1',week,display_order:order,home_team_id:home,away_team_id:away,home_score:null,away_score:null,home_kos:null,away_kos:null,game_lineups:[]});
let state;
function reset(week = initialWeek) {
  state = {
    week, startAt:new Date(Date.now()-86400000).toISOString(), endAt:new Date(Date.now()+86400000).toISOString(), pointCap:50,
    matchups:[7,8].flatMap(w => Array.from({length:7}, (_,i) => ({...match(w,i+1,teams[i*2].id,teams[i*2+1].id), home_score:i%2?0:2,away_score:i%2?2:1,home_kos:8,away_kos:4}))),
    picks:[{week:8,display_order:1,account_id:account.id,username:account.accountName,picked_team_id:teams[0].id,updated_at:new Date().toISOString()}],
    ownPicks:[{week:8,picked_team_id:teams[0].id}],
    contestants:[{account_id:account.id,username:account.accountName,eliminated_week:null},{account_id:'qa-pufferz',username:'Pufferz',eliminated_week:null},{account_id:'qa-out',username:'Eliminated example',eliminated_week:3}],
    history:[{week:8,account_id:account.id,username:account.accountName,picked_team_id:teams[0].id,outcome:'correct'},{week:8,account_id:'qa-pufferz',username:'Pufferz',picked_team_id:teams[2].id,outcome:'correct'}],
    writes:[], failures:{}, events:[], totalWeeks:8,
  };
}
reset();
const league = () => ({current_matchup_number:state.week,regular_season_matches:state.totalWeeks,playoff_team_count:8,roster_point_cap:state.pointCap,roster_pokemon_cap:10,waiver_window_start_at:state.startAt,waiver_window_end_at:state.endAt,pickems_deadline_override_week:null,pickems_deadline_override_at:null});
const normalizePairings = (p, week) => {
  const n=week===9?4:week===10?2:week===11?1:7;
  if(p.p_home_team_ids?.length!==n || p.p_away_team_ids?.length!==n) throw Error(`Expected ${n} matchups`);
  const rows=p.p_home_team_ids.map((home,i)=>match(week,i+1,home||null,p.p_away_team_ids[i]||null));
  const selected=rows.flatMap(m=>[m.home_team_id,m.away_team_id]).filter(Boolean);
  if(new Set(selected).size!==selected.length)throw Error('Each team can appear only once in a round.');
  if(selected.some(id=>!teams.some(t=>t.id===id)))throw Error('Unknown team');
  if(week<=8&&selected.length!==14)throw Error('Every regular-season team must appear exactly once.');
  return rows;
};
function saveRows(rows, week) {
  for(const row of rows){
    const old=state.matchups.find(m=>m.week===week&&m.display_order===row.display_order);
    if(old&&(old.home_score!=null||state.picks.some(p=>p.week===week&&p.display_order===row.display_order))&&(old.home_team_id!==row.home_team_id||old.away_team_id!==row.away_team_id))throw Error('Cannot change teams in a matchup with scores or picks.');
  }
  state.matchups=state.matchups.filter(m=>m.week!==week).concat(rows.map(row=>{
    const old=state.matchups.find(m=>m.week===week&&m.display_order===row.display_order);
    return old&&old.home_team_id===row.home_team_id&&old.away_team_id===row.away_team_id?old:row;
  })).sort((a,b)=>a.week-b.week||a.display_order-b.display_order);
}
function api(endpoint,p,method,url) {
  if(state.failures[endpoint]>0){state.failures[endpoint]--;throw Error('Simulated server failure. Retry without losing your selections.');}
  if(endpoint==='leagues')return [league()];
  if(endpoint==='flash_family_matchups')return state.matchups.filter(m=>!url.searchParams.get('week')||Number(url.searchParams.get('week').replace('eq.',''))===m.week);
  if(endpoint==='team_rosters')return rosterRows;
  if(endpoint==='flash_family_pickems')return state.picks;
  if(['flash_family_pokemon_nicknames','flash_family_weekly_waiver_usage','flash_family_weekly_waiver_allowances','flash_family_transaction_log'].includes(endpoint))return [];
  if(['read_flash_family_point_values','read_flash_family_draft_points'].includes(endpoint))return points;
  if(endpoint==='read_flash_family_guest_account')return null;
  if(endpoint==='read_flash_family_pickem_leaderboard')return [{username:account.accountName,correct:8,scored:10,picks:10}];
  if(endpoint==='read_flash_family_fnpl')return {currentWeek:state.week,totalWeeks:11,events:state.events,matchups:state.matchups,serverNow:new Date().toISOString()};
  if(endpoint==='read_flash_family_survivor')return {week:Math.min(state.week,8),current_week:state.week,account_id:account.id,username:account.accountName,server_now:new Date().toISOString(),deadline:state.endAt,locked:state.week>8,season_complete:state.week>=8,results_complete:true,completed:state.week>8,winners:state.contestants.filter(c=>!c.eliminated_week),own_picks:state.ownPicks,contestants:state.contestants,history:state.history,ended_weeks:[8,7,6,5,4,3,2,1],matchups:state.matchups.filter(m=>m.week===Math.min(state.week,8))};
  if(endpoint==='advance_flash_family_playoff_round'){
    if(p.p_expected_week!==state.week)throw Error('The league week changed on another device. Reload and try again.');
    if(state.week<8||state.week>=11)throw Error('No playoff round can be advanced from here.');
    const week=state.week+1, rows=normalizePairings(p,week);
    if(p.p_waiver_window_end_at&&Date.parse(p.p_waiver_window_end_at)<=Date.now())throw Error('Waiver closing time must be in the future.');
    saveRows(rows,week); state.week=week;
    if(p.p_waiver_window_end_at){state.startAt=new Date().toISOString();state.endAt=p.p_waiver_window_end_at;}
    state.writes.push({endpoint,...p,p_access_code:'[fixture]'}); return week;
  }
  if(endpoint==='save_flash_family_week_schedule'){
    saveRows(normalizePairings(p,p.p_week),p.p_week);state.writes.push({endpoint,...p,p_access_code:'[fixture]'});return null;
  }
  if(endpoint==='set_flash_family_current_week'){
    state.week=p.p_week;state.writes.push({endpoint,week:state.week});return null;
  }
  if(endpoint==='rewind_flash_family_current_week'){
    state.week=Math.max(0,state.week-1);state.writes.push({endpoint,week:state.week});return state.week;
  }
  if(endpoint==='set_flash_family_waiver_window'){
    state.startAt=p.p_start_at;state.endAt=p.p_end_at;state.writes.push({endpoint,startAt:state.startAt,endAt:state.endAt});return null;
  }
  if(endpoint==='save_flash_family_week_reports'){
    const writes=[];
    for(const r of p.p_results){const m=state.matchups.find(m=>m.week===p.p_week&&m.display_order===r.displayOrder);if(!m?.home_team_id||!m?.away_team_id)throw Error('Both teams must be assigned before reporting a score.');writes.push([m,r]);}
    for(const [m,r]of writes)Object.assign(m,{home_score:r.homeScore,away_score:r.awayScore,home_kos:r.homeKOs,away_kos:r.awayKOs,game_lineups:r.gameLineups||[]});
    state.writes.push({endpoint,...p,p_access_code:'[fixture]'});return null;
  }
  if(endpoint==='set_flash_family_season_rules'){state.totalWeeks=p.p_total_weeks;state.pointCap=p.p_point_cap;return null;}
  throw Error('Fixture endpoint not implemented: '+endpoint);
}
const prelude=`<script>
(() => {
  if(!['localhost','127.0.0.1'].includes(location.hostname))throw new Error('Local fixture only');
  const originalFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.hostname.endsWith('.supabase.co'))return originalFetch('/__fixture/api'+url.pathname+url.search,init);
    if(url.origin!==location.origin)return Promise.reject(new Error('External request blocked by isolated fixture'));
    return originalFetch(input,init);
  };
  localStorage.setItem('pokeleague.accessCode','NETO');
  document.addEventListener('DOMContentLoaded',()=>{
    const b=document.createElement('div');b.textContent='LOCAL QA · Simulated league · No live data changes';b.style='position:fixed;bottom:0;left:0;z-index:99999;background:#503a08;color:#fff6cd;padding:5px 12px;font:12px system-ui;pointer-events:none';document.body.appendChild(b);
  });
})();
</script>`;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-src 'none'");
  const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  try{
    if(url.pathname==='/__fixture/state')return send(state);
    if(url.pathname.startsWith('/__fixture/')){
      let text='';for await(const chunk of req){text+=chunk;if(text.length>1000000)throw Error('Fixture request too large');}
      const p=JSON.parse(text||'{}');
      if(url.pathname==='/__fixture/control'){
        if(req.method!=='POST')throw Error('POST required');
        if(p.reset)reset(p.week??initialWeek);
        else if(p.week!=null)state.week=p.week;
        if(p.matchups)state.matchups=p.matchups;
        if(p.failures)state.failures=p.failures;
        if(p.endAt)state.endAt=p.endAt;
        return send({week:state.week,writeCount:state.writes.length});
      }
      if(url.pathname.startsWith('/__fixture/api/'))return send(api(url.pathname.split('/').pop(),p,req.method,url));
      throw Error('Unknown fixture endpoint');
    }
    const pathname=decodeURIComponent(url.pathname==='/'?'/admin-controls.html':url.pathname);
    if(pathname.split('/').some(part=>part.startsWith('.')))throw Error('Not found');
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep))throw Error('Not found');
    let content=await fs.promises.readFile(file);
    if(file.endsWith('.html'))content=content.toString().replace('<head>','<head>'+prelude);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(content);
  }catch(error){send({message:error.message},400);}
});
server.listen(port,'127.0.0.1',()=>console.log(`Isolated playoff preview: http://127.0.0.1:${port}/admin-controls.html?preview=admin (fixture Week ${state.week}; no production access)`));
