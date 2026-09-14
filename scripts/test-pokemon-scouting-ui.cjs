// Browser QA using local files and mocked APIs only. No live roster writes.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const catalog = read('data/pokemon-catalog.json');
const index = read('data/pokemon-detail-index.json');
const details = read('data/pokemon-details.json').pokemon;
const normalize = name => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { if (!localStorage.getItem('pokeleague.accessCode')) localStorage.setItem('pokeleague.accessCode', 'NETO'); });
    let nicknames = [];
    let failSave = false;
    const rosters = [
      { team_id: 'miami-dragapults', pokemon_slug: 'delphox', slot_number: 1 },
      { team_id: 'boston-eeltics', pokemon_slug: 'incineroar', slot_number: 1 },
    ];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname.endsWith('supabase.co')) {
        if (url.pathname.endsWith('/read_flash_family_point_values')) return route.fulfill({ json: Object.fromEntries(catalog.map(p => [p.name, Number(p.points)])) });
        if (url.pathname.endsWith('/team_rosters')) return route.fulfill({ json: rosters });
        if (url.pathname.endsWith('/flash_family_pokemon_nicknames')) return route.fulfill({ json: nicknames });
        if (url.pathname.endsWith('/set_flash_family_pokemon_nickname')) {
          if (failSave) return route.fulfill({ status: 400, json: { message: 'Test save failure' } });
          const b = route.request().postDataJSON();
          const nickname = b.p_nickname.trim().replace(/\s+/g, ' ');
          nicknames = nicknames.filter(n => n.team_id !== b.p_team_id || n.pokemon_slug !== b.p_pokemon_slug);
          if (nickname) nicknames.push({ team_id: b.p_team_id, pokemon_slug: b.p_pokemon_slug, nickname });
          return route.fulfill({ json: nickname });
        }
        if (url.pathname.endsWith('/leagues')) return route.fulfill({ json: [{ current_matchup_number: 1, regular_season_matches: 10, roster_point_cap: 50, roster_pokemon_cap: 10, playoff_team_count: 8, waiver_window_start_at: new Date(Date.now()-86400000).toISOString(), waiver_window_end_at: new Date(Date.now()+86400000).toISOString() }] });
        if (url.pathname.endsWith('/flash_family_matchups')) return route.fulfill({ json: [{ week: 1, display_order: 1, home_team_id: 'boston-eeltics', away_team_id: 'miami-dragapults', home_score: null, away_score: null }] });
        if (url.pathname.endsWith('/flash_family_pickems') || url.pathname.endsWith('/flash_family_transaction_log')) return route.fulfill({ json: [] });
        throw new Error('Unexpected API: ' + url.pathname);
      }
      if (url.hostname === '127.0.0.1') {
        const file = path.join(root, decodeURIComponent(url.pathname));
        return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' }) : route.fulfill({ status: 404 });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8014/waivers.html');
    await page.waitForFunction(() => document.querySelectorAll('#pokemonGrid .pokemon-card').length > 100);
    for (const [query, field] of [['Fake Out', 'moves'], ['Intimidate', 'abilities']]) {
      await page.locator('#pokemonSearch').fill(query);
      const actual = (await page.locator('#pokemonGrid .pokemon-name').allTextContents()).sort();
      const expected = catalog.filter(p => !['delphox', 'incineroar'].includes(normalize(p.name)) && index[normalize(p.name)]?.[field]?.some(name => name.toLowerCase().includes(query.toLowerCase()))).map(p => p.name).sort();
      assert.deepEqual(actual, expected);
      assert(actual.length > 0);
    }
    await page.locator('#pokemonSearch').fill('xyz-no-such-move');
    assert.equal(await page.locator('#emptyState').isVisible(), true);
    await page.locator('#pokemonSearch').fill('Staraptor');
    await page.locator('#pokemonGrid .pokemon-card').click();
    await page.waitForSelector('#detailMoveList .detail-move');
    assert.equal(await page.locator('#detailMoveList .detail-move').count(), details.staraptor.moves.length);
    const move = page.locator('.detail-move').filter({ has: page.getByRole('heading', { name: 'Brave Bird', exact: true }) });
    assert.deepEqual(await move.locator('.detail-move-number strong').allTextContents(), ['120', '100%', '15']);
    assert.match(await move.locator('.detail-category').innerText(), /Physical/);
    await page.locator('#pokemonDetailDialog').screenshot({ path: '/tmp/pokeleague-dex-light.png' });
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await page.locator('#pokemonDetailDialog').screenshot({ path: '/tmp/pokeleague-dex-dark.png' });
    await page.locator('#detailMoveSearch').fill('Brave Bird');
    assert.equal(await page.locator('.detail-move').count(), 1);
    await page.locator('#detailMoveCategory').selectOption('Special');
    assert.equal(await page.locator('.detail-move').count(), 0);
    await page.locator('#detailMoveSearch').fill('');
    await page.locator('#detailMoveCategory').selectOption('all');
    await page.locator('#detailMoveType').selectOption('flying');
    assert((await page.locator('.detail-move').evaluateAll(rows => rows.every(r => r.dataset.type === 'flying'))));
    await page.locator('#detailMoveType').selectOption('all');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.locator('#pokemonDetailShell').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Detail sheet must not overflow on mobile');
      assert(await page.locator('#detailMoveList').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Move rows must not clip or scroll horizontally');
      await page.locator('#pokemonDetailDialog').screenshot({ path: `/tmp/pokeleague-dex-mobile-${width}.png` });
    }
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto('http://127.0.0.1:8014/my-team.html');
    const nickname = page.locator('#nickname-delphox');
    await nickname.waitFor();
    await nickname.fill('<b>Foxfire</b>');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.pokemon-nickname-form [role="status"]').textContent.startsWith('Saved!'));
    await page.reload();
    await nickname.waitFor();
    assert.equal(await nickname.inputValue(), '<b>Foxfire</b>');
    failSave = true;
    await nickname.fill('Unsaved');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.pokemon-nickname-form [role="status"]').textContent === 'Test save failure');
    assert.equal(nicknames[0].nickname, '<b>Foxfire</b>');
    failSave = false;
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await page.locator('[data-team-roster]').screenshot({ path: '/tmp/pokeleague-nickname-dark.png' });

    await page.evaluate(() => localStorage.setItem('pokeleague.accessCode', 'PUFF1'));
    await page.goto('http://127.0.0.1:8014/pickems.html');
    await page.locator('[data-open-matchup]').first().click();
    await page.locator('[data-matchup-dialog][open]').waitFor();
    const opponent = page.locator('[data-roster-pokemon="delphox"]');
    assert.equal(await opponent.locator('.compact-nickname').innerText(), '“<b>Foxfire</b>”');
    assert.equal(await opponent.locator('.compact-nickname b').count(), 0, 'Nickname must render as text, not HTML');
    await opponent.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#pokemonDetailTitle')?.textContent === 'Delphox');
    assert.equal(await page.locator('#detailMoveList .detail-move').count(), details.delphox.moves.length);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-matchup-dialog]').isVisible(), true, 'Details close must return to both rosters');
    assert(await opponent.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape');
    nicknames[0].nickname = 'Updated elsewhere';
    await page.locator('[data-open-matchup]').first().click();
    await page.waitForFunction(() => document.querySelector('.compact-nickname')?.textContent.includes('Updated elsewhere'));

    await page.goto('http://127.0.0.1:8014/rosters.html');
    await page.locator('[data-roster-pokemon="delphox"]').waitFor();
    assert.equal(await page.locator('.compact-nickname').count(), 0, 'Rosters must never display nicknames');
    await page.locator('[data-roster-pokemon="delphox"]').click();
    await page.waitForFunction(() => document.querySelector('#pokemonDetailTitle')?.textContent === 'Delphox');
    assert.equal(await page.locator('#detailMoveList .detail-move').count(), details.delphox.moves.length);
    await page.evaluate(() => localStorage.setItem('pokeleague.accessCode', 'NETO'));
    await page.goto('http://127.0.0.1:8014/my-team.html');
    await nickname.waitFor();
    await nickname.fill('');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.pokemon-nickname-form [role="status"]').textContent === 'Nickname cleared.');
    assert.equal(nicknames.length, 0);
    assert.deepEqual(errors, []);
    console.log('PASS: exact move/ability results, move rows/stats/filters, light/dark/mobile, nickname save/reload/edit/clear/errors, escaped names, Pick’ems-only nicknames, clickable roster cards and nested-dialog focus. No production writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
