// All network requests intercepted; no real picks or league mutations.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'..');
const teams=JSON.parse(fs.readFileSync(path.join(root,'data/league-teams.json'))).teams;
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('pokeleague.accessCode','NETO'));
  let failRead=false,failWrite=false,writes=0;
  let state={week:1,deadline:null,server_now:new Date().toISOString(),account_id:'neto',username:'FLash',locked:false,ended_weeks:[],contestants:[],history:[],own_picks:[],matchups:Array.from({length:7},(_,i)=>({home_team_id:teams[i*2].id,away_team_id:teams[i*2+1].id}))};
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname.endsWith('supabase.co')){
    if(url.pathname.endsWith('/read_flash_family_survivor'))return route.fulfill(failRead?{status:500,json:{message:'Offline fixture'}}:{json:state});
    if(url.pathname.endsWith('/submit_flash_family_survivor')){
     if(failWrite)return route.fulfill({status:400,json:{message:'Pick rejected fixture'}});
     writes++;const body=route.request().postDataJSON();assert.equal(body.p_week,state.week);
     state.own_picks=state.own_picks.filter(p=>p.week!==state.week).concat({week:state.week,picked_team_id:body.p_team_id});
     if(!state.contestants.length)state.contestants=[{account_id:'neto',username:'FLash',eliminated_week:null}];
     return route.fulfill({status:204});
    }
    throw new Error('Unexpected API '+url.pathname);
   }
   if(url.hostname==='127.0.0.1'){
    if(url.pathname.endsWith('.js')&&!['/js/survivor.js','/js/theme.js'].includes(url.pathname))return route.fulfill({body:'',contentType:'text/javascript'});
    const file=path.join(root,decodeURIComponent(url.pathname));
    return route.fulfill(fs.existsSync(file)?{body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'}:{status:404});
   }
   return route.abort();
  });
  await page.goto('http://127.0.0.1:8014/home.html');
  const open=page.locator('[data-survivor-open]'), modal=page.locator('.survivor-dialog');
  await page.locator('.survivor-card').screenshot({path:'/tmp/survivor-home.png'});
  await open.click();await page.waitForSelector('[data-sv-team]');
  assert.equal(await page.locator('[data-sv-team]').count(),14);
  assert.match(page.url(),/home.html/);
  assert(await page.locator('.survivor-save').isDisabled());
  await page.locator('[data-sv-team]').first().click();
  assert.equal(writes,0);
  await page.locator('.survivor-save').click();
  await page.waitForFunction(()=>document.querySelector('[data-sv-status]').textContent.includes('is saved'));
  assert.equal(writes,1);assert(await page.locator('.survivor-save').isDisabled());
  await page.locator('[data-sv-team]').nth(1).click();await page.locator('.survivor-save').click();
  await page.waitForFunction(()=>document.querySelector('[data-sv-status]').textContent.includes('is saved'));
  assert.equal(state.own_picks.length,1);assert.equal(writes,2);
  failWrite=true;
  await page.locator('[data-sv-team]').nth(2).click();await page.locator('.survivor-save').click();
  await page.waitForFunction(()=>document.querySelector('[data-sv-status]').textContent.includes('rejected'));
  assert.equal(writes,2);failWrite=false;
  await page.keyboard.press('Escape');assert(!await modal.isVisible());assert(await open.evaluate(e=>e===document.activeElement));
  state={...state,week:2,ended_weeks:[1],own_picks:[{week:1,picked_team_id:teams[1].id}],contestants:[{account_id:'neto',username:'FLash',eliminated_week:1},{account_id:'pufferz',username:'Pufferz',eliminated_week:null}],history:[{account_id:'neto',username:'FLash',week:1,picked_team_id:teams[1].id,outcome:'incorrect'},{account_id:'pufferz',username:'Pufferz',week:1,picked_team_id:teams[0].id,outcome:'correct'}]};
  await open.click();await page.waitForFunction(()=>document.querySelector('[data-sv-week]').textContent.includes('Week 2'));
  assert(await page.locator('[data-sv-team]').nth(1).isDisabled());
  assert.match(await page.locator('[data-sv-summary]').innerText(),/playing for fun/);
  assert.equal(await page.locator('[data-sv-contestants]').innerText(),'Pufferz');
  assert.equal(await page.locator('.survivor-mark').count(),2);
  assert.match(await page.locator('[data-sv-history]').innerText(),/✓/);assert.match(await page.locator('[data-sv-history]').innerText(),/✕/);
  await modal.evaluate(e=>e.scrollTop=0);
  await modal.screenshot({path:'/tmp/survivor-light.png'});
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await modal.screenshot({path:'/tmp/survivor-dark.png'});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Modal must not overflow horizontally');
   await modal.screenshot({path:`/tmp/survivor-mobile-${width}.png`});
  }
  await page.keyboard.press('Escape');state.locked=true;await open.click();
  await page.waitForFunction(()=>document.querySelector('[data-sv-deadline]').textContent.includes('locked'));
  assert.equal(await page.locator('[data-sv-team]:enabled').count(),0);
  await page.keyboard.press('Escape');state={...state,account_id:null,username:null,locked:false,own_picks:[]};await open.click();
  await page.waitForFunction(()=>document.querySelector('[data-sv-identity]').textContent.includes('Sign in'));
  assert.equal(await page.locator('[data-sv-team]:enabled').count(),0);
  await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:8014/pickems.html');failRead=true;await page.locator('[data-survivor-open]').click();
  await page.waitForSelector('.survivor-retry:visible');assert.match(await page.locator('[data-sv-status]').innerText(),/Offline/);
  failRead=false;await page.locator('.survivor-retry').click();await page.waitForSelector('[data-sv-team]');
  await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:8014/home.html');await page.locator('.survivor-card-link').click({position:{x:10,y:10}});
  await page.waitForURL('**/pickems.html');
  assert.deepEqual(errors,[]);
  console.log('PASS: both launchers, separate Pick’ems navigation, save/update/error, no autosubmit, fun mode, used teams, history marks, guests, locks, retry, keyboard, light/dark/mobile.');
 } finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
