// Intercepted fixture data only; never submits real predictions.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const teams=JSON.parse(fs.readFileSync(path.join(root,'data/league-teams.json'))).teams;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('pokeleague.accessCode','NETO'));
  let votes=[0,0,0,1].map((side,i)=>({week:1,display_order:1,account_id:i===3?'neto':`user${i}`,username:`User ${i}`,picked_team_id:teams[side].id}));
  votes.push({week:2,display_order:1,account_id:'next-week',username:'Next',picked_team_id:teams[0].id},{week:1,display_order:1,account_id:'invalid',username:'Invalid',picked_team_id:'not-playing'});
  let failed=false,locked=false;
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname.endsWith('supabase.co')){
    const endpoint=url.pathname.split('/').pop();
    if(endpoint==='leagues')return route.fulfill({json:[{current_matchup_number:1,waiver_window_end_at:locked?'2020-01-01T00:00:00Z':null}]});
    if(endpoint==='flash_family_matchups')return route.fulfill({json:[1,2].map((n)=>({week:1,display_order:n,home_team_id:teams[(n-1)*2].id,away_team_id:teams[(n-1)*2+1].id,home_score:null,away_score:null}))});
    if(endpoint==='flash_family_pickems')return route.fulfill(failed?{status:500,json:{message:'Offline'}}:{json:votes});
    if(endpoint==='submit_flash_family_pickem'){
      const body=route.request().postDataJSON();votes=votes.map(p=>p.account_id==='neto'?{...p,picked_team_id:body.p_picked_team_id}:p);return route.fulfill({status:204});
    }
    if(['team_rosters','flash_family_pokemon_nicknames'].includes(endpoint))return route.fulfill({json:[]});
    throw Error('Unexpected API '+endpoint);
   }
   if(url.hostname==='127.0.0.1'){
    const file=path.join(root,decodeURIComponent(url.pathname));
    return route.fulfill(fs.existsSync(file)?{body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'}:{status:404});
   }
   return route.abort();
  });
  const first=page.locator('.pickem-matchup').first(), shares=first.locator('.matchup-vote-share b');
  await page.goto('http://127.0.0.1:8014/pickems.html');await shares.first().waitFor();
  assert.deepEqual(await shares.allTextContents(),['75%','25%']);
  assert.deepEqual(await page.locator('.pickem-matchup').nth(1).locator('.matchup-vote-share b').allTextContents(),['0%','0%']);
  assert.match(await page.locator('.pickem-matchup').nth(1).innerText(),/No votes yet/i);
  await first.screenshot({path:'/tmp/pickems-votes-light.png'});
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await first.screenshot({path:'/tmp/pickems-votes-dark.png'});
  await page.setViewportSize({width:390,height:844});
  assert(await first.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await first.screenshot({path:'/tmp/pickems-votes-mobile.png'});
  await first.locator('[data-pick-team]').first().click();
  await page.waitForFunction(()=>document.querySelector('.matchup-vote-share b')?.textContent==='100%');
  assert.deepEqual(await shares.allTextContents(),['100%','0%']);
  votes=votes.filter(p=>p.week===1&&p.account_id!=='invalid').slice(0,3);votes[0].picked_team_id=teams[1].id;
  locked=true;await page.reload();await shares.first().waitFor();
  assert.deepEqual(await shares.allTextContents(),['67%','33%']);
  assert(await first.locator('[data-pick-team]').first().isDisabled());
  failed=true;await page.reload();await first.waitFor();
  assert.equal(await first.locator('.matchup-vote-share b').count(),0,'Offline personal picks must not look like league vote totals');
  assert.match(await first.innerText(),/Votes unavailable/i);
  assert.deepEqual(errors,[]);
  console.log('PASS: 75/25, zero votes, correct week/matchup/team filters, 100/0 after changing pick, 67/33 rounding, locked display, offline honesty and light/dark/mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
