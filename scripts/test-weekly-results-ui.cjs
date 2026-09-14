// All HTTP requests use local fixtures. No live scores, schedules, or roster writes.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const catalog = read('data/pokemon-catalog.json');
const teams = read('data/league-teams.json').teams;
const points = Object.fromEntries(catalog.map(p => [p.name, Number(p.points)]));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('pokeleague.accessCode', 'NETO');
      if (!localStorage.getItem('pokeleague.leagueState.v1')) localStorage.setItem('pokeleague.leagueState.v1', JSON.stringify({ currentWeek: 0, pointOverrides: { Malamar: 3 } }));
    });
    let week = 0, resultWrites = 0, scheduleWrites = 0;
    let matchups = Array.from({ length: 7 }, (_, i) => ({ week: 1, display_order: i+1,
      home_team_id: teams[i].id, away_team_id: teams[i+7].id, home_score: null, away_score: null, home_kos: null, away_kos: null }));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname.endsWith('supabase.co')) {
        const endpoint = url.pathname.split('/').pop();
        if (['read_flash_family_point_values','read_flash_family_draft_points'].includes(endpoint)) return route.fulfill({ json: points });
        if (['team_rosters','flash_family_transaction_log','flash_family_pickems'].includes(endpoint)) return route.fulfill({ json: [] });
        if (endpoint === 'leagues') return route.fulfill({ json: [{ current_matchup_number: week, regular_season_matches: 10, roster_point_cap: 50, roster_pokemon_cap: 10, playoff_team_count: 8, waiver_window_start_at: new Date(Date.now()-86400000).toISOString(), waiver_window_end_at: new Date(Date.now()+86400000).toISOString() }] });
        if (endpoint === 'flash_family_matchups') return route.fulfill({ json: matchups });
        if (endpoint === 'set_flash_family_current_week') { week = route.request().postDataJSON().p_week; return route.fulfill({ status: 204 }); }
        if (endpoint === 'save_flash_family_week_schedule') { scheduleWrites++; throw new Error('Advancing must not save/regenerate a schedule'); }
        if (endpoint === 'save_flash_family_week_results') {
          resultWrites++;
          const b = route.request().postDataJSON();
          matchups = matchups.map(m => {
            if (m.week !== b.p_week) return m;
            const i = b.p_display_orders.indexOf(m.display_order);
            return { ...m, home_score: b.p_home_scores[i] ?? null, away_score: b.p_away_scores[i] ?? null, home_kos: b.p_home_kos[i] ?? null, away_kos: b.p_away_kos[i] ?? null };
          });
          return route.fulfill({ status: 204 });
        }
        throw new Error('Unexpected API: ' + endpoint);
      }
      if (url.hostname === '127.0.0.1') {
        const file = path.join(root, decodeURIComponent(url.pathname));
        return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' }) : route.fulfill({ status: 404 });
      }
      return route.abort();
    });
    assert.equal(read('data/teams.json').accounts.NETO.accountName, 'FLash');
    await page.goto('http://127.0.0.1:8014/waivers.html');
    await page.waitForFunction(() => document.querySelectorAll('#pokemonGrid .pokemon-card').length > 100);
    await page.locator('#pokemonSearch').fill('Malamar');
    assert.equal(await page.locator('#pokemonGrid .point-value').innerText(), '4', 'Shared value must beat stale local Malamar=3');
    points.Malamar = 5;
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => document.querySelector('#pokemonGrid .point-value').textContent === '5');
    assert.equal(await page.locator('#pokemonGrid .tier-name').textContent(), 'Gold');
    points.Malamar = 4;

    await page.goto('http://127.0.0.1:8014/admin-controls.html');
    await page.locator('[data-admin-workspace]:visible').waitFor();
    assert.equal(await page.locator('[data-admin-tab="scores"]').isDisabled(), true);
    // Another admin changes the saved pairings after this page was opened.
    [matchups[0].away_team_id, matchups[1].away_team_id] = [matchups[1].away_team_id, matchups[0].away_team_id];
    const scheduled = structuredClone(matchups);
    await page.locator('[data-advance-week]').click();
    await page.waitForFunction(() => document.querySelector('[data-current-week]').textContent === '1');
    assert.equal(week, 1);
    assert.equal(scheduleWrites, 0);
    assert.deepEqual(matchups, scheduled);
    assert.deepEqual(await page.locator('[data-schedule-row] [data-away-team]').evaluateAll(inputs => inputs.map(i => i.value)), scheduled.map(m => m.away_team_id));
    await page.locator('[data-admin-tab="scores"]').click();
    const row = page.locator('[data-score-row]').first();
    await row.locator('[data-home-score]').fill('2');
    await row.locator('[data-away-score]').fill('0');
    await row.locator('[data-home-kos]').fill('8');
    await page.getByRole('button', { name: 'Save Scores', exact: true }).click();
    assert.equal(resultWrites, 0, 'Partial KO pair must not save');
    await row.locator('[data-away-kos]').fill('2');
    await page.getByRole('button', { name: 'Save Scores', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-admin-status]').textContent.includes('scores saved'));
    assert.equal(matchups[0].home_kos, 8);
    await page.reload();
    await page.locator('[data-admin-tab="scores"]').click();
    assert.equal(await row.locator('[data-home-kos]').inputValue(), '8');
    assert.equal(await row.locator('[data-away-kos]').inputValue(), '2');
    await row.screenshot({ path: '/tmp/pokeleague-ko-admin-light.png' });
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await row.screenshot({ path: '/tmp/pokeleague-ko-admin-dark.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await row.screenshot({ path: '/tmp/pokeleague-ko-admin-mobile.png' });
    assert(await row.evaluate(el => el.scrollWidth <= el.clientWidth+1));

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:8014/standings.html');
    await page.locator('.standing-card').first().waitFor();
    const home = page.locator('.standing-card').filter({ has: page.locator(`[data-open-team="${matchups[0].home_team_id}"]`) });
    const away = page.locator('.standing-card').filter({ has: page.locator(`[data-open-team="${matchups[0].away_team_id}"]`) });
    const diff = card => card.locator('.standing-card-stats > div').filter({ has: page.getByText('KO Diff', { exact: true }) }).locator('dd');
    assert.equal(await diff(home).innerText(), '+6');
    assert.equal(await diff(away).innerText(), '-6');
    await home.screenshot({ path: '/tmp/pokeleague-ko-standings.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await home.screenshot({ path: '/tmp/pokeleague-ko-standings-mobile.png' });
    assert(await home.evaluate(el => el.scrollWidth <= el.clientWidth+1));
    matchups.push({ ...matchups[0], week: 2, home_score: 1, away_score: 2, home_kos: 4, away_kos: 8 });
    await page.reload();
    await home.waitFor();
    assert.equal(await diff(home).innerText(), '+2', 'Differential is cumulative across weeks');
    matchups[1].home_score = 2; matchups[1].away_score = 0; // Missing KO data adds no made-up differential.
    matchups[0].home_kos = null; matchups[0].away_kos = null;
    await page.reload();
    await home.waitFor();
    assert.equal(await diff(home).innerText(), '-4', 'Cleared KO values stop contributing');
    assert.deepEqual(errors, []);
    console.log('PASS: FLash, authoritative/live-refresh points, preserved Week 1 schedule including cross-admin edits, optional KO input validation/reload, signed cumulative differential, light/dark/mobile. No production writes.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
