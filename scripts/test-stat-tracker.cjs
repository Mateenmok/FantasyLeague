// Intercepted browser tests: no production mutations or Google credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
(async () => {
  const { SHEETS, parseSheet, sourceUrl } = await import(pathToFileURL(path.join(root, 'supabase/functions/stat-tracker/sheet-source.mjs')));
  const columns = ['Team', 'Pokemon', 'Status', 'GP', 'W', 'L', 'KO', 'OHKO', 'AST', 'BLK', 'SP', 'DKO', 'K+A', 'K/D', 'KPG', 'IMP'];
  const rawRows = [
    ['Miami Dragapults','Camerupt','Active',4,3,1,9,5,3,0,0,2,12,9,2.25,69.33],
    ['Massachusetts Midnight','Froslass','Active',5,4,1,8,2,5,1,1,0,13,8,1.6,54],
    ['Massachusetts Midnight','Tauros-Aqua','Active',5,4,1,6,3,2,4,4,0,8,2,1.2,53],
    ['Las Vegas Gatrs','Corviknight','Active',5,3,2,5,3,3,0,3,0,8,1.67,1,41.75],
    ['North Carolina Ceruledge','Milotic','Active',4,3,1,5,0,3,5,0,0,8,2.5,1.25,32.18],
    ['Dallas Disguises','Snorlax','Dropped',6,3,3,6,0,3,1,1,0,9,2,1,31.75],
    ['Boston Eeltics','Tinkaton','Active',0,0,0,0,0,0,0,0,0,0,0,null,null],
  ];
  const wrap = (cols, rows) => '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify({ status:'ok',table:{cols:cols.map(label=>({label})),rows:rows.map(row=>({c:row.map(v=>({v}))}))}}) + ');';
  const all = parseSheet(wrap(columns, [...rawRows, []]), SHEETS[0]);
  assert.equal(all.rows.length,7); assert.equal(all.rows[6][14].value,null);
  assert.throws(()=>parseSheet('<html>Sign in</html>',SHEETS[0]));
  assert.throws(()=>parseSheet(wrap(['Wrong header'],[['x']]),SHEETS[0]));
  assert.equal(new URL(sourceUrl(SHEETS[0])).searchParams.get('range'),'A2:P1000');
  assert.equal(SHEETS.length,16);
  const teamColumns = ['Pokemon','Status','GP','W','L','KO','OHKO','AST','BLK','SP','DKO','D*','K+A','K/D','KPG','IMP','MKB*','EG*'];
  const team = parseSheet(wrap(teamColumns,[['Camerupt','Active',4,3,1,9,5,3,0,0,2,1,12,9,2.25,69.33,4,5],['MIAMI DRAGAPULTS\nEND OF TEAM STATS']]),SHEETS[1]);
  assert.equal(team.rows.length,1,'Decorative sheet footers are not Pokémon');
  const guide = parseSheet(wrap(['Stat','Full Name','What It Tracks','What Earns Credit / Examples','Impact Score'],[
    ['IMP','Impact Score','Calculated by the sheet','Scoring rules','70–100%'],['Impact Scoring Details'],['Full Formula','Formula from the source sheet'],
  ]),SHEETS.at(-1));
  const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:1100}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let offline=false, updated=false, delayed=false;
    let requests=0;
    await page.clock.install({time:new Date('2026-10-06T18:00:00Z')});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/functions/v1/stat-tracker')){
        assert.equal(route.request().method(),'GET'); requests++;
        if(offline)return route.fulfill({status:502,json:{error:'unavailable'}});
        const id=url.searchParams.get('sheet');
        if(delayed && id==='miami-dragapults')await new Promise(resolve=>setTimeout(resolve,300));
        const data=structuredClone(id==='guide'?guide:id==='all'?all:team);
        if(updated && id==='all') data.rows[4][15]={value:99,display:'99.00'};
        return route.fulfill({json:data});
      }
      if(url.pathname.endsWith('/flash_family_pokemon_nicknames'))return route.fulfill({json:[{team_id:'miami-dragapults',pokemon_slug:'camerupt',nickname:'Hot Stuff <script>'}]});
      if(url.hostname!=='127.0.0.1')return route.abort();
      if(url.pathname.endsWith('.js')&&!['/js/theme.js','/js/stat-tracker.js','/js/league-rosters.js','/js/opening-night.js'].includes(url.pathname))return route.fulfill({body:'',contentType:'text/javascript'});
      const file=path.join(root,decodeURIComponent(url.pathname));
      return route.fulfill(fs.existsSync(file)?{body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'}:{status:404});
    });
    await page.goto('http://127.0.0.1:8014/home.html');
    await page.waitForSelector('.mvp-entry');
    assert.equal(await page.locator('.mvp-entry').count(),5);
    assert.match(await page.locator('.mvp-entry').first().innerText(),/Hot Stuff <script>/);
    assert.equal(await page.locator('.mvp-entry script').count(),0);
    assert.match(await page.locator('.mvp-entry').first().innerText(),/Miami Dragapults/);
    assert.match(await page.locator('.mvp-entry').first().getAttribute('style'),/#1e9ea5/);
    const panel=await page.locator('.mvp-watch').boundingBox(), menu=await page.locator('.league-menu').boundingBox();
    assert(panel.x+panel.width<menu.x,'MVP watch is left of menu');
    assert.equal(await page.locator('.league-menu>.league-button').count(),8);
    assert.equal(await page.locator('[data-opening-night]').isVisible(),false);
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await page.screenshot({path:`/tmp/mvp-home-${theme}.png`,fullPage:true});
    }
    for(const width of [1280,1024,390,320]){
      await page.setViewportSize({width,height:1050});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Home overflow at ${width}`);
    }
    await page.screenshot({path:'/tmp/mvp-home-mobile.png',fullPage:true});
    updated=true;const previousRequests=requests;
    await page.clock.fastForward(60001);
    await page.waitForFunction(()=>document.querySelector('.mvp-entry').innerText.includes('Milotic'));
    assert(requests>previousRequests,'Automatically refreshes from sheet');
    updated=false;
    await page.locator('.mvp-watch-link').click();
    await page.waitForSelector('.tracker-table tbody tr');
    assert.equal(await page.locator('[data-stat-view] option').count(),16);
    assert.equal(await page.locator('.tracker-table tbody tr').count(),7);
    assert.match(await page.locator('tbody tr').first().innerText(),/Hot Stuff/);
    await page.locator('[data-stat-search]').fill('hot stuff');assert.equal(await page.locator('tbody tr').count(),1);
    await page.locator('[data-stat-search]').fill('');
    await page.locator('[data-stat-roster-status]').selectOption('Dropped');assert.match(await page.locator('tbody').innerText(),/Snorlax/);
    await page.locator('[data-stat-roster-status]').selectOption('');
    await page.locator('[data-stat-sort="IMP"]').click();assert.match(await page.locator('tbody tr').first().innerText(),/Snorlax/);
    assert.match(await page.locator('tbody tr').last().innerText(),/Tinkaton/,'Null stats sort last');
    await page.locator('[data-stat-sort="IMP"]').click();assert.match(await page.locator('tbody tr').first().innerText(),/Camerupt/);
    for(const theme of ['light','dark']){
      await page.setViewportSize({width:1600,height:1050});
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await page.screenshot({path:`/tmp/mvp-tracker-${theme}.png`,fullPage:true});
    }
    for(const width of [1024,390,320]){
      await page.setViewportSize({width,height:1050});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Tracker overflow at ${width}`);
    }
    await page.screenshot({path:'/tmp/mvp-tracker-mobile.png',fullPage:true});
    await page.locator('[data-stat-view]').selectOption('miami-dragapults');
    await page.waitForSelector('[data-stat-sort="MKB*"]');
    assert.equal(await page.locator('tbody tr').count(),1);
    assert.equal(await page.locator('[data-stat-sort="D*"]').count(),1);
    await page.reload();await page.waitForSelector('[data-stat-sort="EG*"]');assert.equal(await page.locator('[data-stat-view]').inputValue(),'miami-dragapults');
    await page.locator('[data-stat-view]').selectOption('guide');await page.waitForSelector('.stat-guide-card');
    assert.match(await page.locator('.stat-guide').innerText(),/Formula from the source sheet/);
    assert(!await page.locator('[data-stat-table]').isVisible());
    delayed=true;
    await page.locator('[data-stat-view]').selectOption('miami-dragapults');
    await page.locator('[data-stat-view]').selectOption('all');
    await page.waitForSelector('[data-stat-sort="Team"]');
    await page.waitForTimeout(350);assert.equal(await page.locator('[data-stat-view]').inputValue(),'all','Old tab response cannot overwrite current selection');
    offline=true;await page.locator('[data-stat-refresh]').click();
    await page.waitForFunction(()=>document.querySelector('[data-stat-sync]').textContent.includes('Last synced'));
    assert.equal(await page.locator('tbody tr').count(),7,'Outage retains last successful rows');
    await page.reload();await page.waitForSelector('tbody tr');
    assert.match(await page.locator('[data-stat-sync]').innerText(),/Last synced/);
    await page.evaluate(()=>localStorage.clear());await page.reload();
    await page.waitForFunction(()=>document.querySelector('[data-stat-sync]').textContent.includes('unavailable'));
    assert.match(await page.locator('[data-stat-count]').innerText(),/could not be loaded/);
    assert.deepEqual(errors,[]);
    console.log('PASS: parsing/schema, top five IMP, exact team colors, static sprites/nicknames/escaping, native link, 16 tabs, team internal stats, guide, sorting/search/status, nulls, refresh, stale cache, outage, race protection, 320–1600px and both themes.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
