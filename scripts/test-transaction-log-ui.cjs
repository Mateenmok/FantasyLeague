// Run with PLAYWRIGHT_PATH and optionally BROWSER_PATH set. All HTTP requests
// are intercepted: test fixtures only, with no production reads or writes.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('pokeleague.accessCode', 'NETO'));
    let entries = Array.from({ length: 65 }, (_, i) => ({
      id: 65 - i, team_id: 'miami-dragapults', pokemon_slug: i % 2 ? 'camerupt' : 'crabominable',
      action: i % 2 ? 'dropped' : 'added', source: i % 3 ? 'waiver' : 'trade',
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }));
    let nextId = 66;
    let failRead = false;
    let failWrite = false;
    let rosters = [{ team_id: 'miami-dragapults', pokemon_slug: 'camerupt', slot_number: 1 }];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname.endsWith('supabase.co')) {
        if (url.pathname.endsWith('/read_flash_family_point_values')) return route.fulfill({ json: Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, 'data/pokemon-catalog.json'))).map(p => [p.name, Number(p.points)])) });
        if (url.pathname.endsWith('/flash_family_transaction_log')) {
          if (failRead) return route.fulfill({ status: 500, json: { message: 'Test offline' } });
          const before = Number((url.searchParams.get('id') || 'lt.Infinity').slice(3));
          return route.fulfill({ json: entries.filter(row => row.id < before).slice(0, Number(url.searchParams.get('limit'))) });
        }
        if (url.pathname.endsWith('/leagues')) return route.fulfill({ json: [{
          waiver_window_start_at: new Date(Date.now() - 86400000).toISOString(),
          waiver_window_end_at: new Date(Date.now() + 86400000).toISOString(),
          roster_point_cap: 50, roster_pokemon_cap: 10, regular_season_matches: 10,
        }] });
        if (url.pathname.endsWith('/team_rosters')) return route.fulfill({ json: rosters });
        if (url.pathname.endsWith('/submit_flash_family_waiver')) {
          if (failWrite) return route.fulfill({ status: 400, json: { message: 'Test rejected move' } });
          const body = route.request().postDataJSON();
          for (const [slug, action] of [[body.p_drop_slug, 'dropped'], [body.p_add_slug, 'added']]) {
            if (!slug) continue;
            entries.unshift({ id: nextId++, team_id: body.p_team_id, pokemon_slug: slug, action, source: 'waiver', created_at: new Date().toISOString() });
            if (action === 'dropped') rosters = rosters.filter(row => row.pokemon_slug !== slug);
            else rosters.push({ team_id: body.p_team_id, pokemon_slug: slug, slot_number: 2 });
          }
          return route.fulfill({ status: 204 });
        }
        throw new Error('Unexpected API request: ' + url.pathname);
      }
      if (url.hostname === '127.0.0.1') {
        const file = path.join(root, decodeURIComponent(url.pathname));
        if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
        return route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8014/waivers.html');
    const preview = page.locator('[data-transaction-preview] li');
    const history = page.locator('[data-transaction-history] li');
    const open = page.locator('[data-transaction-open]');
    await page.waitForFunction(() => document.querySelectorAll('[data-transaction-preview] li').length === 6);
    assert.match(await preview.first().innerText(), /Miami Dragapults added Crabominable/);
    assert.match(await preview.nth(1).innerText(), /Miami Dragapults dropped Camerupt/);
    assert((await page.locator('.transaction-panel').boundingBox()).height < 320);
    await page.locator('.transaction-panel').screenshot({ path: '/tmp/pokeleague-log-light.png' });
    await open.click();
    await page.waitForFunction(() => document.querySelectorAll('[data-transaction-history] li').length === 30);
    await page.locator('[data-transaction-more]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-transaction-history] li').length === 60);
    await page.locator('[data-transaction-more]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-transaction-history] li').length === 65);
    assert.equal(await page.locator('[data-transaction-more]').isVisible(), false);
    assert.equal(await history.count(), 65);
    assert(await page.locator('.transaction-scroll').evaluate(el => el.scrollHeight > el.clientHeight));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-transaction-dialog]').isVisible(), false);
    assert(await open.evaluate(el => el === document.activeElement));

    // Use the actual waiver controls and success event to refresh the preview.
    const crab = page.locator('.pokemon-card').filter({ has: page.getByRole('heading', { name: 'Crabominable', exact: true }) });
    await crab.locator('.waiver-add-button').click();
    await page.waitForFunction(() => document.querySelector('[data-waiver-toast]').textContent.includes('Crabominable added'));
    assert.equal(entries[0].id, 66);
    page.once('dialog', prompt => prompt.accept());
    await page.locator('[data-drop-pokemon="Camerupt"]').click();
    await page.waitForFunction(() => document.querySelector('[data-transaction-preview] li').textContent.includes('dropped Camerupt'));
    assert.equal(entries[0].id, 67);
    assert.equal(await preview.count(), 6);
    failWrite = true;
    const rejected = await page.evaluate(async () => {
      try { await window.PokeLeagueWaivers.transact({ accessCode: 'NETO', teamId: 'miami-dragapults', addName: 'Gengar', resultingPoints: 10 }); return false; }
      catch { return true; }
    });
    assert(rejected);
    assert.equal(entries[0].id, 67);
    failWrite = false;

    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    assert.equal(await page.locator('.transaction-panel').evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
    await page.locator('.transaction-panel').screenshot({ path: '/tmp/pokeleague-log-dark.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert((await page.locator('.transaction-panel').boundingBox()).height < 480);
    await page.screenshot({ path: '/tmp/pokeleague-log-mobile.png' });
    await open.click();
    await page.waitForFunction(() => document.querySelectorAll('[data-transaction-history] li').length === 30);
    await page.locator('[data-transaction-dialog]').screenshot({ path: '/tmp/pokeleague-log-history.png' });
    await page.locator('[data-transaction-close]').click();

    failRead = true;
    await page.evaluate(() => dispatchEvent(new Event('pokeleague:transaction')));
    await page.waitForFunction(() => !document.querySelector('[data-transaction-retry]').hidden);
    assert.equal(await preview.count(), 6, 'Keep cached preview on transient failure');
    await open.click();
    await page.waitForFunction(() => document.querySelector('[data-transaction-more]').textContent === 'Retry');
    failRead = false;
    await page.locator('[data-transaction-more]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-transaction-history] li').length === 30);
    await page.locator('[data-transaction-close]').click();
    entries = [];
    await page.locator('[data-transaction-retry]').click();
    await page.waitForFunction(() => document.querySelector('[data-transaction-status]').textContent.startsWith('No transactions'));
    assert.equal(await preview.count(), 0);
    await open.click();
    await page.waitForFunction(() => document.querySelector('[data-transaction-history-status]').textContent.startsWith('No transactions'));
    assert.equal(await page.locator('[data-transaction-more]').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS: six latest moves, complete paginated history, live add/drop updates, rejected moves, light/dark/mobile, scrollable dialog, focus/ESC, empty/error/retry states. No production writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
