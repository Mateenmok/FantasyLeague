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
    let week = 0, resultWrites = 0, scheduleWrites = 0, gameWrites = 0, failGameSave = false;
    let matchups = Array.from({ length: 7 }, (_, i) => ({ week: 1, display_order: i+1,
      home_team_id: teams[i].id, away_team_id: teams[i+7].id, home_score: null, away_score: null, home_kos: null, away_kos: null }));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname.endsWith('supabase.co')) {
        const endpoint = url.pathname.split('/').pop();
        if (['read_flash_family_point_values','read_flash_family_draft_points'].includes(endpoint)) return route.fulfill({ json: points });
        if (endpoint==='team_rosters') return route.fulfill({json:teams.flatMap(t=>catalog.slice(0,6).map((p,i)=>({team_id:t.id,pokemon_slug:p.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''),slot_number:i+1})))});
        if (['flash_family_transaction_log','flash_family_pickems'].includes(endpoint)) return route.fulfill({ json: [] });
        if (endpoint === 'leagues') return route.fulfill({ json: [{ current_matchup_number: week, regular_season_matches: 10, roster_point_cap: 50, roster_pokemon_cap: 10, playoff_team_count: 8, waiver_window_start_at: new Date(Date.now()-86400000).toISOString(), waiver_window_end_at: new Date(Date.now()+86400000).toISOString() }] });
        if (endpoint === 'flash_family_matchups') return route.fulfill({ json: matchups });
        if (endpoint === 'set_flash_family_current_week') { week = route.request().postDataJSON().p_week; return route.fulfill({ status: 204 }); }
        if (endpoint === 'save_flash_family_week_schedule') { scheduleWrites++; throw new Error('Advancing must not save/regenerate a schedule'); }
        if (endpoint === 'save_flash_family_game_details') {
          if(failGameSave)return route.fulfill({status:500,json:{message:'Temporary save failure. Please try again.'}});
          const b=route.request().postDataJSON(),match=matchups.find(m=>m.week===b.p_week&&m.display_order===b.p_display_order);
          assert.deepEqual(b.p_expected_game,(match.game_lineups||[]).find(g=>g.game===b.p_game.game)||null);
          match.game_lineups=(match.game_lineups||[]).filter(g=>g.game!==b.p_game.game).concat(b.p_game);gameWrites++;
          return route.fulfill({json:b.p_game});
        }
        if (endpoint === 'save_flash_family_week_reports') {
          resultWrites++;
          const b = route.request().postDataJSON();
          matchups = matchups.map(m => {
            if (m.week !== b.p_week) return m;
            const r = b.p_results.find(r=>r.displayOrder===m.display_order);
            return { ...m, home_score: r?.homeScore ?? null, away_score: r?.awayScore ?? null, home_kos: r?.homeKOs ?? null, away_kos: r?.awayKOs ?? null,game_lineups:r?.gameLineups||[] };
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
    assert.equal(await row.locator('[data-edit-game]').count(),2,'A 2–0 match has two game editors');
    await row.locator('[data-edit-game="1"]').click();
    const modal=page.locator('.game-lineup-dialog');
    assert.equal(await page.locator('[data-game-winner]').inputValue(),'','No inferred game winner');
    await page.locator('[data-game-winner]').selectOption(matchups[0].home_team_id);
    for(let i=0;i<4;i++)await page.locator('[data-game-side="home"]').nth(i).check();
    assert(await page.locator('[data-game-side="home"]').nth(4).isDisabled(),'Fifth Pokemon disabled');
    for(let i=0;i<2;i++)await page.locator('[data-game-side="away"]').nth(i).check();
    const homeSurvival=page.locator('[data-game-survival-side="home"]'),awaySurvival=page.locator('[data-game-survival-side="away"]');
    assert(await awaySurvival.first().isDisabled(),'Losing-side survival set automatically');
    assert.equal(await awaySurvival.first().inputValue(),'false');
    await homeSurvival.nth(0).selectOption('true');
    await homeSurvival.nth(1).selectOption('false');
    assert.equal(await modal.locator('.is-survived').count(),1);
    assert.equal(await modal.locator('.is-fainted').count(),3);
    // Winner correction makes the new losing side red and clears stale markers.
    await page.locator('[data-game-winner]').selectOption(matchups[0].away_team_id);
    assert.equal(await modal.locator('.is-fainted').count(),4);
    assert.equal(await awaySurvival.first().inputValue(),'');
    await page.locator('[data-game-winner]').selectOption(matchups[0].home_team_id);
    await homeSurvival.nth(0).selectOption('true');
    await homeSurvival.nth(1).selectOption('false');
    await modal.screenshot({path:'/tmp/game-lineups-editor-light.png'});
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    await modal.screenshot({path:'/tmp/game-lineups-editor-dark.png'});
    await page.setViewportSize({width:390,height:844});
    assert(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await modal.screenshot({path:'/tmp/game-lineups-editor-mobile.png'});
    failGameSave=true;
    await page.locator('.game-lineup-apply').click();
    await page.locator('.game-lineup-save-status.is-error').waitFor();
    assert(await modal.isVisible(),'Failed save keeps editor open');
    assert.equal(await homeSurvival.first().inputValue(),'true','Failed save retains inputs');
    failGameSave=false;
    await page.locator('.game-lineup-apply').click();
    await modal.waitFor({state:'hidden'});
    assert.equal(gameWrites,1,'Game details save immediately to the server');
    assert.equal(resultWrites,1,'Game saving must not rewrite weekly scores');
    await row.locator('[data-edit-game="2"]').click();
    await page.locator('[data-game-side="away"]').nth(2).check();
    await page.locator('.game-lineup-apply').click();
    await modal.waitFor({state:'hidden'});
    await page.setViewportSize({width:1440,height:1000});
    assert.equal(resultWrites,1,'No second Save Scores required');
    assert.equal(gameWrites,2);
    assert.equal(matchups[0].home_kos, 8);
    assert.equal(matchups[0].game_lineups[0].winnerTeamId,matchups[0].home_team_id);
    assert.deepEqual(Object.values(matchups[0].game_lineups[0].survival.home),[true,false]);
    assert.deepEqual(Object.values(matchups[0].game_lineups[0].survival.away),[false,false]);
    assert.equal(matchups[0].game_lineups[1].winnerTeamId,null,'Unreported winners stay unknown');
    assert.equal(matchups[0].game_lineups[0].home.length,4);
    assert.equal(matchups[0].game_lineups[0].away.length,2);
    assert.equal(matchups[0].game_lineups[1].home.length,0,'Zero revealed Pokemon allowed');
    await page.reload();
    await page.locator('[data-admin-tab="scores"]').click();
    assert.equal(await row.locator('[data-home-kos]').inputValue(), '8');
    assert.equal(await row.locator('[data-away-kos]').inputValue(), '2');
    await row.locator('[data-edit-game="1"]').click();
    assert.equal(await page.locator('[data-game-side="home"]:checked').count(),4,'Saved lineups reload');
    assert.equal(await page.locator('[data-game-winner]').inputValue(),matchups[0].home_team_id,'Saved winner reloads');
    assert.equal(await homeSurvival.first().inputValue(),'true','Survival reloads');
    assert.equal(await awaySurvival.first().inputValue(),'false','Automatic fainted state reloads');
    await page.keyboard.press('Escape');
    await row.screenshot({ path: '/tmp/pokeleague-ko-admin-light.png' });
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await row.screenshot({ path: '/tmp/pokeleague-ko-admin-dark.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await row.screenshot({ path: '/tmp/pokeleague-ko-admin-mobile.png' });
    assert(await row.evaluate(el => el.scrollWidth <= el.clientWidth+1));

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:8014/league-history.html');
    await page.waitForFunction(()=>document.querySelector('[data-history-status]').textContent.length>0);
    assert.deepEqual(errors,[]);
    await page.locator('[data-history-week-next]').click();
    await page.locator('[data-game-matchup="1:1"]').click();
    assert.equal(await page.locator('.game-lineup-history').count(),2);
    assert.equal(await page.locator('.game-winner-result.is-reported').count(),1);
    assert.match(await page.locator('.game-winner-result').first().innerText(),/Winner:/);
    assert.equal(await page.locator('.game-winner-result').nth(1).innerText(),'Winner not reported');
    assert.equal(await modal.locator('.is-survived').count(),1,'Green survivor ring in history');
    assert.equal(await modal.locator('.is-fainted').count(),3,'Red fainted rings in history');
    assert.equal(await modal.locator('.game-survival-label').filter({hasText:'Not reported'}).count(),3,'Unreported Pokemon stay neutral');
    assert.equal(await page.locator('.game-lineup-history').first().locator('.game-lineup-mon').count(),6);
    assert.match(await modal.innerText(),/Remaining Pokémon unrevealed or not recorded/);
    assert.match(await modal.innerText(),/No Pokémon reported/);
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    await modal.screenshot({path:'/tmp/game-lineups-history-dark.png'});
    await page.setViewportSize({width:390,height:844});assert(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await modal.screenshot({path:'/tmp/game-lineups-history-mobile.png'});
    await page.keyboard.press('Escape');
    await page.locator('[data-history-team-filter]').selectOption(matchups[0].home_team_id);
    await page.locator('[data-game-matchup="1:1"]').click();assert.equal(await page.locator('.game-lineup-history').count(),2);await page.keyboard.press('Escape');
    await page.setViewportSize({width:1440,height:1000});
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
    console.log('PASS: optional 0–4 per-game lineups, atomic report payload/reload/history/team filter, light/dark/mobile, plus FLash, points, schedules, KOs and standings regressions. No production writes.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
