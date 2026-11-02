const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });

async function enter(code) {
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '', events: {}, action: 'home.html', opened: false,
      addEventListener(event, fn) { this.events[event] = fn; },
      getAttribute() { return null; }, setAttribute() {}, removeAttribute() {}, select() {},
      showModal() { this.opened = true; }, close() {}, querySelector(child) { return get(selector + ' ' + child); },
    });
    return nodes.get(selector);
  };
  get('#accessCodeInput').value = code;
  const local = new Map([['pokeleague.accessCode', 'NETO'], ['pokeleague.accountId', 'neto'], ['pokeleague.adminState.v1', '{"season":1}']]);
  const session = new Map([['pokeleague.accessCode', 'NETO'], ['pokeleague.matchupPrep', 'PREP']]);
  const before = { local: [...local], session: [...session] };
  const requests = [];
  let destination;
  vm.runInNewContext(source('js/access.js'), {
    document: { querySelector: get }, localStorage: storage(local), sessionStorage: storage(session),
    window: { location: { assign: url => { destination = url; } }, PokeLeagueGuest: {
      normalize: value => value.trim().toUpperCase(),
      read: async code => { requests.push(code); return null; },
    } },
    fetch: async url => { requests.push(url); return { ok: true, json: async () => JSON.parse(source('data/teams.json')) }; },
  });
  await get('.access-form').events.submit({ preventDefault() {} });
  return { destination, local, session, before, requests, nodes };
}

(async () => {
  for (const code of ['Season1', ' season1 ', 'SEASON1']) {
    const result = await enter(code);
    assert.equal(result.destination, 'season-2/index.html');
    assert.deepEqual([...result.local], result.before.local, 'Season 1 identity and saved data remain unchanged');
    assert.equal(result.session.get('pokeleague.season2Workspace'), 'SEASON1');
    for (const [key, value] of result.before.session) assert.equal(result.session.get(key), value);
    assert.deepEqual(result.requests, [], 'Workspace access never calls the live league or guest APIs');
  }
  assert.equal((await enter('NETO')).destination, 'home.html');
  assert.equal((await enter('DRAFTTEST1')).destination, 'home.html');
  assert.equal((await enter('PREP')).destination, 'matchup-prep.html');
  const guest = await enter('GUEST1');
  assert.equal(guest.nodes.get('[data-guest-dialog]').opened, true);
  assert.equal(guest.destination, undefined);
  const invalid = await enter('not-an-account');
  assert.equal(invalid.destination, undefined);
  assert.deepEqual([...invalid.local], invalid.before.local);

  for (const admitted of [true, false]) {
    const session = new Map(admitted ? [['pokeleague.season2Workspace', 'SEASON1']] : []);
    const local = new Map([['pokeleague-theme', 'dark'], ['pokeleague.accessCode', 'NETO']]);
    const dataset = {}; let redirected;
    vm.runInNewContext(source('season-2/workspace.js'), {
      sessionStorage: storage(session), localStorage: storage(local), document: { documentElement: { dataset } },
      window: { location: { replace: url => { redirected = url; } } },
      fetch: () => { throw new Error('The workspace must not load live league data'); },
    });
    assert.equal(redirected, admitted ? undefined : '../index.html');
    if (admitted) assert.equal(dataset.theme, 'dark');
    assert.equal(local.get('pokeleague.accessCode'), 'NETO');
  }
  const page = source('season-2/index.html');
  assert.match(page, /<main[^>]*aria-label="Season 2 workspace"/);
  assert.deepEqual([...page.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]), ['workspace.js?v=1', 'profile.js?v=intro1', 'intro.js?v=intro1']);
  console.log('PASS: Season1 routes to the isolated Season 2 workspace; ongoing league identity/data and existing access routes remain intact.');

  const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create table league_teams(league_id text,team_access_code text,owner_name text);');
    await db.exec(source('supabase/migrations/20261006190000_add_guest_accounts.sql').split('-- Deliberately separate')[0] + 'commit;');
    await db.exec(source('supabase/migrations/20261019210000_reserve_prep_access_code.sql'));
    await db.exec(source('supabase/migrations/20261101170000_reserve_season_two_workspace_code.sql'));
    await assert.rejects(db.query('select register_flash_family_guest($1,$2)', ['GUEST1', 'Season1']), /reserved/);
    await assert.rejects(db.query("insert into flash_family_guest_accounts(nickname) values('Season1')"), /guest_season_two_workspace_code_reserved/);
    const account = (await db.query('select register_flash_family_guest($1,$2) as account', ['GUEST1', 'Viewer Test'])).rows[0].account;
    assert.equal(account.isAdmin, false);
    assert.equal(account.teamId, null);
    assert.equal((await db.query("select read_flash_family_guest_account('Season1') as account")).rows[0].account, null);
    console.log('PASS: workspace code cannot be claimed as a guest; regular guest registration still works.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
