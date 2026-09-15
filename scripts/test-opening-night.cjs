// Frozen browser clock and intercepted network: no production data access.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const deadline=Date.parse('2026-09-18T21:30:00-04:00');
  await page.clock.install({time:deadline-((2*24+8)*60+30)*60000});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='127.0.0.1')return route.abort();
   if(u.pathname.endsWith('.js')&&!['/js/opening-night.js','/js/theme.js'].includes(u.pathname))return route.fulfill({body:'',contentType:'text/javascript'});
   const file=path.join(root,decodeURIComponent(u.pathname));
   return route.fulfill(fs.existsSync(file)?{body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'}:{status:404});
  });
  await page.goto('http://127.0.0.1:8014/home.html');
  const panel=page.locator('[data-opening-night]');await panel.waitFor();
  assert.equal(await page.locator('[data-opening-days]').innerText(),'02');
  assert.equal(await page.locator('[data-opening-hours]').innerText(),'08');
  assert.equal(await page.locator('[data-opening-minutes]').innerText(),'30');
  await page.clock.fastForward(60000);
  assert.equal(await page.locator('[data-opening-minutes]').innerText(),'29');
  const left=await panel.boundingBox(),right=await page.locator('.league-menu').boundingBox();
  assert(left.x+left.width<right.x,'Poster must be left of buttons on desktop');
  assert.equal(await page.locator('.league-menu>.league-button').count(),8);
  assert.equal(await panel.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
  for(const theme of ['light','dark']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   await page.screenshot({path:`/tmp/opening-night-${theme}.png`});
  }
  for(const width of [1280,1024,390,320]){
   await page.setViewportSize({width,height:1050});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Page overflow at ${width}`);
   await panel.screenshot({path:`/tmp/opening-night-${width}.png`});
   assert(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`Panel overflow at ${width}`);
   if(width<1280){const p=await panel.boundingBox(),nav=await page.locator('.league-menu').boundingBox();assert(p.y+p.height<nav.y);}
   await panel.screenshot({path:`/tmp/opening-night-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1050});
  await page.clock.fastForward(deadline-await page.evaluate(()=>Date.now())-1000);
  assert(await panel.isVisible(),'Still visible one second before opening');
  await page.clock.fastForward(1000);
  assert(!await panel.isVisible(),'Disappears at 9:30 p.m. Eastern');
  assert((await page.locator('.home-shell').boundingBox()).width<=1180,'Original layout restored');
  await page.reload();assert(!await panel.isVisible(),'No stale banner after reload');
  assert.equal(await page.locator('.league-menu>.league-button').count(),8);
  assert.deepEqual(errors,[]);
  console.log('PASS: EDT deadline, countdown/minute changes, exact expiry and reload, restored layout, both logos, eight buttons, left-side desktop, mobile and dark mode.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
