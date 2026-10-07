// Isolated browser fixtures: never creates accounts or predictions in production.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const teams = JSON.parse(fs.readFileSync(path.join(root, 'data/league-teams.json'))).teams;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const origin = 'http://127.0.0.1:8014';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
  const guests = new Map(), errors = [], mutations = [];
  let picks = [], failPicks = false, failSubmit = false, running = false;
  const normalize = value => String(value).trim().replace(/\s+/g, ' ').toUpperCase();
  const attach = async context => {
    context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname.endsWith('supabase.co')) {
        const endpoint = url.pathname.split('/').pop();
        const body = request.postData() ? request.postDataJSON() : {};
        const guest = guests.get(normalize(body.p_access_code || ''));
        if (endpoint === 'read_flash_family_guest_account') return route.fulfill({ json: guest || null });
        if (endpoint === 'register_flash_family_guest') {
          const nickname = body.p_nickname.trim().replace(/\s+/g, ' '), key = normalize(nickname);
          mutations.push(endpoint);
          if (key === 'FLASH') return route.fulfill({ status: 400, json: { message: 'That nickname is reserved. Please choose another' } });
          if (guests.has(key)) return route.fulfill({ status: 400, json: { message: 'That nickname is already taken. Choose another' } });
          const account = { id: `guest:${guests.size + 1}`, accountName: nickname, isGuest: true, isAdmin: false, teamId: null };
          guests.set(key, account);
          return route.fulfill({ json: account });
        }
        if (endpoint === 'submit_flash_family_guest_pickem') {
          mutations.push(endpoint);
          if (failSubmit) return route.fulfill({ status: 500, json: { message: 'Please retry: save failed.' } });
          assert(guest, 'Guest must authenticate before saving');
          picks = picks.filter(p => !(p.account_id === guest.id && p.week === body.p_week && p.display_order === body.p_display_order));
          picks.push({ account_id: guest.id, username: guest.accountName, week: body.p_week, display_order: body.p_display_order, picked_team_id: body.p_picked_team_id });
          return route.fulfill({ status: 204 });
        }
        if (endpoint === 'leagues') return route.fulfill({ json: [{ current_matchup_number: 1, waiver_window_end_at: null, point_cap: 50, total_weeks: 10 }] });
        if (endpoint === 'flash_family_matchups') return route.fulfill({ json: [{ week: 1, display_order: 1, home_team_id: teams[0].id, away_team_id: teams[1].id, home_score: null, away_score: null }] });
        if (endpoint === 'flash_family_pickems') return route.fulfill(failPicks ? { status: 500, json: { message: 'Offline' } } : { json: picks });
        if (endpoint === 'read_flash_family_pickem_leaderboard') return route.fulfill({ json: [...guests.values()].map(g => ({ account_id: g.id, username: g.accountName, correct: 0, scored: 0, picks: picks.filter(p => p.account_id === g.id).length })) });
        if (['team_rosters', 'flash_family_pokemon_nicknames', 'flash_family_transaction_log'].includes(endpoint)) return route.fulfill({ json: [] });
        if (endpoint === 'read_flash_family_point_values') return route.fulfill({ json: {} });
        if (endpoint === 'read_flash_family_guest_draft') {
          assert(guest);
          return route.fulfill({ json: {
            serverNow: new Date().toISOString(), viewer: guest,
            room: { key: 'main', label: 'Main Draft', pickSeconds: 90, isStarted: running, isPaused: false, currentPickStartedAt: new Date().toISOString(), revision: running ? 2 : 1 }, picks: [],
          } });
        }
        if (endpoint === 'stat-tracker') return route.fulfill({ status: 503, json: { error: 'Fixture offline' } });
        errors.push(`Unexpected API ${endpoint}`);
        return route.fulfill({ status: 403, json: { message: 'Fixture denied' } });
      }
      if (url.origin === origin) {
        const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
        // Optionally exercise exactly the Git index, excluding unrelated local edits.
        const body = process.env.GUEST_TEST_INDEX === '1'
          ? execFileSync('git', ['show', `:${path.relative(root, file)}`], { cwd: root, maxBuffer: 30 * 1024 * 1024 })
          : fs.readFileSync(file);
        return route.fulfill({ body, contentType: mime[path.extname(file)] || 'application/octet-stream' });
      }
      return route.abort();
    });
  };
  const enter = async (page, code) => {
    await page.locator('#accessCodeInput').fill(code);
    await page.locator('.access-form').evaluate(form => form.requestSubmit());
  };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await attach(context);
    const page = await context.newPage();
    await page.goto(`${origin}/index.html`);
    await enter(page, ' guest1 ');
    await page.locator('[data-guest-dialog]').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('pokeleague.accessCode')), null);
    await page.locator('[data-guest-cancel]').click();
    assert.equal(await page.locator('[data-guest-dialog]').isVisible(), false);
    await enter(page, 'GUEST1');
    await page.locator('#guestNickname').fill('FLash');
    await page.locator('[data-guest-form]').evaluate(form => form.requestSubmit());
    await page.getByText('That nickname is reserved. Please choose another', { exact: true }).waitFor();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await page.locator('[data-guest-dialog]').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width, 'Signup dialog fits viewport');
      assert(await page.locator('[data-guest-dialog]').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.locator('[data-guest-dialog]').screenshot({ path: `/tmp/guest-signup-${width}.png` });
    }
    await page.locator('#guestNickname').fill('Test Viewer');
    await page.locator('[data-guest-form]').evaluate(form => form.requestSubmit());
    await page.waitForURL('**/home.html');
    await page.locator('[data-guest-notice]').waitFor();
    assert.match(await page.locator('[data-guest-notice]').innerText(), /Test Viewer/);
    assert.equal(await page.locator('.league-button--my-team').getAttribute('href'), 'rosters.html');
    assert.equal(await page.evaluate(() => localStorage.getItem('pokeleague.accountId')), 'guest:1');
    assert.equal(await page.evaluate(() => localStorage.getItem('pokeleague.accessCode')), 'TEST VIEWER');

    await page.goto(`${origin}/pickems.html`);
    await page.getByText('Picking as Test Viewer', { exact: true }).waitFor();
    const pick = page.locator('[data-pick-team]').first();
    await pick.click();
    await page.waitForFunction(() => document.querySelector('[data-pick-team]')?.getAttribute('aria-pressed') === 'true');
    assert.equal(picks.length, 1);
    assert.equal(picks[0].account_id, 'guest:1');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-pick-team]')?.getAttribute('aria-pressed') === 'true');
    failSubmit = true;
    await page.locator('[data-pick-team]').nth(1).click();
    await page.getByText('Please retry: save failed.', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-pick-team]').nth(1).isDisabled(), false, 'Failed saves allow retry');
    assert.equal(picks[0].picked_team_id, teams[0].id);
    failSubmit = false;
    failPicks = true;
    await page.reload();
    await page.getByText('Picking as Test Viewer', { exact: true }).waitFor();
    await pick.click();
    await page.getByText('The league connection is unavailable. Your pick was not saved. Please retry.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('pokeleague.pickems.guest:1')), null);
    failPicks = false;

    await page.goto(`${origin}/my-team.html`);
    await page.getByText('Welcome, Test Viewer', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-team-dashboard]').isVisible(), false);
    await page.goto(`${origin}/trade-room.html`);
    await page.getByText("Follow the league's roster moves", { exact: true }).waitFor();
    assert.equal(await page.locator('[data-trade-workspace]').isVisible(), false);
    await page.goto(`${origin}/waivers.html`);
    await page.getByText('Test Viewer · Guest', { exact: true }).waitFor();
    assert(await page.locator('.waiver-add-button').count() > 0);
    assert.equal(await page.locator('.waiver-add-button:not(:disabled)').count(), 0);
    assert.equal(await page.locator('.waiver-add-button').first().textContent(), 'View only');
    await page.goto(`${origin}/draft-room.html`);
    await page.locator('[data-open-live-draft]').click();
    await page.locator('[data-live-draft]').waitFor();
    assert.equal(await page.locator('[data-live-admin-panel]').isVisible(), false);
    assert(await page.locator('[data-live-pokemon-grid] .draft-pick-button').count() > 0);
    assert.equal(await page.locator('[data-live-pokemon-grid] .draft-pick-button:not(:disabled)').count(), 0);
    running = true;
    await page.locator('[data-leave-live-draft]').click();
    await page.locator('[data-open-live-draft]').click();
    await page.locator('[data-live-draft]').waitFor();
    assert.equal(await page.locator('[data-live-admin-panel]').isVisible(), false);
    assert.equal(await page.locator('[data-live-pokemon-grid] .draft-pick-button:not(:disabled)').count(), 0);
    assert.equal(await page.locator('[data-live-recommendation-pick] button').count(), 0);

    // A fresh browser session signs back into the same saved identity, not a new guest.
    const returning = await browser.newContext();
    await attach(returning);
    const returned = await returning.newPage();
    await returned.goto(`${origin}/index.html`);
    await enter(returned, 'test   viewer');
    await returned.waitForURL('**/home.html');
    assert.equal(await returned.evaluate(() => localStorage.getItem('pokeleague.accountId')), 'guest:1');
    await returned.goto(`${origin}/pickems.html`);
    await returned.waitForFunction(() => document.querySelector('[data-pick-team]')?.getAttribute('aria-pressed') === 'true');
    await returned.goto(`${origin}/index.html`);
    await enter(returned, 'GUEST1');
    await returned.locator('#guestNickname').fill('test viewer');
    await returned.locator('[data-guest-form]').evaluate(form => form.requestSubmit());
    await returned.getByText('That nickname is already taken. Choose another', { exact: true }).waitFor();
    assert.equal(guests.size, 1);
    await returned.locator('[data-guest-cancel]').click();
    await enter(returned, 'NETO');
    await returned.waitForURL('**/home.html');
    assert.equal(await returned.evaluate(() => localStorage.getItem('pokeleague.accountId')), 'neto');
    assert.deepEqual(errors, []);
    assert(mutations.every(name => ['register_flash_family_guest', 'submit_flash_family_guest_pickem'].includes(name)));
    console.log('PASS: guest signup/cancel/reserved/duplicate, mobile layout, returning login, persisted Pick’ems, save errors/offline honesty, spectator draft, team-action gates, existing owner login.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
