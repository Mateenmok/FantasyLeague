// Isolated browser fixtures: no production reads or writes.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('pokeleague.accessCode', 'PUFF1'));
    let fail = false;
    let rows = [
      { team_id: 'boston-eeltics', pokemon_slug: 'eelektross', slot_number: 1 },
      { team_id: 'boston-eeltics', pokemon_slug: 'malamar', slot_number: 2 },
      { team_id: 'miami-dragapults', pokemon_slug: 'dragapult', slot_number: 1 },
      { team_id: 'miami-dragapults', pokemon_slug: 'infernape', slot_number: 2 },
      { team_id: 'uconn-arcanines', pokemon_slug: 'hisuian-arcanine', slot_number: 1 },
    ];
    const fixtureDex = Object.fromEntries(['Eelektross', 'Malamar', 'Dragapult', 'Infernape', 'Arcanine-Hisui', 'Floette-Eternal', 'Tauros-Paldea-Aqua', 'Tauros-Paldea-Combat', 'Lycanroc-Midday', 'Gourgeist-Average'].map(name => [name, { t1: 'Normal', bs: { hp: 80, at: 80, df: 80, sa: 80, sd: 80, sp: 80 } }]));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') writes.push(request.url());
      if (url.hostname.endsWith('supabase.co')) {
        assert(url.pathname.endsWith('/team_rosters'));
        return route.fulfill(fail ? { status: 503, json: { message: 'Fixture offline' } } : { json: rows });
      }
      if (url.pathname.endsWith('/script_res/pokedex.js')) return route.fulfill({ contentType: 'text/javascript', body: 'var POKEDEX_CHAMPIONS=' + JSON.stringify(fixtureDex) });
      if (url.hostname === '127.0.0.1') {
        const file = path.join(root, decodeURIComponent(url.pathname));
        if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
        return route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8014/prep-station.html');
    await page.waitForFunction(() => document.querySelector('#leftRoster').options.length === 15);
    assert.equal(await page.locator('#leftRoster').inputValue(), 'boston-eeltics');
    assert.equal(await page.locator('#leftRosterList .roster-mon').count(), 2, 'Never fill with demo Pokémon');
    assert.match(await page.locator('#leftRosterList').innerText(), /Eelektross/);
    assert.match(await page.locator('#leftRosterList').innerText(), /Malamar/);
    assert.equal(await page.locator('#rightRoster').inputValue(), '');
    // Use the visible custom picker, not just the hidden native select.
    await page.locator('#rightRosterPretty').click();
    await page.locator('#pickerSearch').fill('Miami');
    await page.locator('#pickerList .picker-option').click();
    assert.equal(await page.locator('#rightRoster').inputValue(), 'miami-dragapults');
    assert.equal(await page.locator('#rightRosterList .roster-mon').count(), 2);
    await page.locator('#rightRosterList .roster-mon').filter({ hasText: 'Dragapult' }).click();
    assert.match(await page.locator('#rightName').innerText(), /Dragapult/i);
    await page.locator('#leftRosterList .roster-mon').filter({ hasText: 'Eelektross' }).click();
    assert.match(await page.locator('#leftName').innerText(), /Eelektross/i);
    await page.locator('#leftRosterList').screenshot({ path: '/tmp/prep-live-light.png' });
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    const assertContrast = async (selector) => {
      const ratios = await page.locator(selector).evaluateAll(elements => elements.map(el => {
        const channels = color => {
          const values = (color.match(/[\d.]+/g) || []).map(Number).slice(0, 3);
          return color.startsWith('color(srgb') ? values : values.map(v => v / 255);
        };
        const luminance = color => channels(color).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        let parent = el, bg;
        while (parent) { bg = getComputedStyle(parent).backgroundColor; if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') break; parent = parent.parentElement; }
        const fg = luminance(getComputedStyle(el).color), back = luminance(bg);
        return (Math.max(fg, back) + .05) / (Math.min(fg, back) + .05);
      }));
      assert(ratios.length && ratios.every(r => r >= 4.5), selector + ' contrast ratios: ' + ratios.join(', '));
    };
    {
      await assertContrast('.stage-value, .budget-row strong, .result-label, .no-mega, .popular-nature, .popular-spread-text, .recommend-reason, .move-result, .move-auto-badge');
      await page.screenshot({ path: '/tmp/prep-contrast-calculator.png', fullPage: true });
      await page.locator('#copyToTeamBuilder').click();
      await page.locator('[data-workspace-page="teambuilder"]').click();
      await assertContrast('.tb-form-state, .tb-form-label, .tb-nature-up, .tb-nature-down');
      await page.screenshot({ path: '/tmp/prep-contrast-builder.png', fullPage: true });
      await page.locator('[data-workspace-page="calculator"]').click();
      await page.locator('#sendToNoteSheet').click();
      await page.locator('[data-workspace-page="notesheet"]').click();
      await assertContrast('.note-stat-cell strong, .note-stat-cell span, .note-pokemon-picker strong, .note-pokemon-picker span');
      await page.screenshot({ path: '/tmp/prep-contrast-notes.png', fullPage: true });
      await page.locator('[data-workspace-page="guide"]').click();
      await assertContrast('.guide-card-kicker');
      await page.screenshot({ path: '/tmp/prep-contrast-guide.png', fullPage: true });
      await page.locator('[data-workspace-page="calculator"]').click();
      await page.locator('#leftNaturePretty').click();
      await assertContrast('.nature-meta-raised, .nature-meta-lowered, .picker-tab, .picker-close');
      await page.screenshot({ path: '/tmp/prep-contrast-picker.png', fullPage: false });
      await page.locator('#pickerClose').click();
      await page.evaluate(() => document.documentElement.dataset.theme = 'light');
      assert.equal(await page.locator('.stage-value').first().evaluate(el => getComputedStyle(el).color), 'rgb(10, 13, 16)');
      await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    }
    await page.locator('#rightRosterDock').screenshot({ path: '/tmp/prep-live-dark.png' });

    // Live refresh retains the selected teams and calculator selections.
    rows = rows.filter(r => r.pokemon_slug !== 'malamar');
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => document.querySelectorAll('#leftRosterList .roster-mon').length === 1);
    assert.equal(await page.locator('#rightRoster').inputValue(), 'miami-dragapults');
    assert.match(await page.locator('#rightName').innerText(), /Dragapult/i);
    await page.locator('#leftRoster').selectOption('uconn-arcanines');
    assert.match(await page.locator('#leftRosterList').innerText(), /Arcanine-Hisui/);
    await page.locator('#leftRosterList .roster-mon').click();
    assert.match(await page.locator('#leftName').innerText(), /Arcanine-Hisui/i);
    rows.push(...['eternal-floette', 'tauros-aqua', 'tauros-combat', 'lycanroc', 'gourgeist'].map((pokemon_slug, index) => ({ team_id: 'uconn-arcanines', pokemon_slug, slot_number: index + 2 })));
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => document.querySelectorAll('#leftRosterList .roster-mon').length === 6);
    assert.equal(await page.locator('#leftRosterList').getByText(/calculator data unavailable/).count(), 0);
    await page.locator('#leftRoster').selectOption('daytona-torterras');
    assert.equal(await page.locator('#leftRosterList .roster-mon').count(), 0);
    assert.match(await page.locator('#leftRosterList').innerText(), /No Pokémon/);
    await page.locator('#leftRoster').selectOption('boston-eeltics');
    rows.push({ team_id: 'boston-eeltics', pokemon_slug: 'unknown-pokemon', slot_number: 3 });
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => document.querySelector('#leftRosterList').textContent.includes('unknown-pokemon'));
    assert.match(await page.locator('#leftRosterList').innerText(), /calculator data unavailable/);

    fail = true;
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => document.querySelector('#rightRosterList').textContent.includes('refresh failed'));
    assert.equal(await page.locator('#rightRosterList .roster-mon').count(), 2);
    fail = false;
    await page.locator('#rightRosterList').getByRole('button', { name: 'Retry league rosters' }).click();
    await page.waitForFunction(() => !document.querySelector('#rightRosterList').textContent.includes('refresh failed'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#rightRosterDock').screenshot({ path: '/tmp/prep-live-mobile.png' });
    assert.equal(await page.locator('#rightRosterDock').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);

    fail = true;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#leftRosterList').textContent.includes('could not load'));
    assert.equal(await page.locator('.roster-mon').count(), 0);
    fail = false;
    await page.locator('#leftRosterList').getByRole('button', { name: 'Retry league rosters' }).click();
    await page.waitForFunction(() => document.querySelector('#leftRoster').options.length === 15);
    assert.equal(await page.locator('#leftRoster').inputValue(), 'boston-eeltics');
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log('PASS: all 14 real teams, exact live rosters, calculator selection, regional names, refresh/retry, dark/mobile, repaired text contrast >= 4.5:1, and light-mode preservation. No production writes.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
