// Run the production Survivor dialog and Omen calculator against a small DOM and
// explicit in-memory API responses. No browser, live requests, or pick writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'js', `${name}.js`), 'utf8');
const HOUNDS = 'south-jersey-hounds';
const hostileName = '<img src=x onerror="alert(1)"> & Winner';
const teams = [
  { id: HOUNDS, name: 'South Jersey Hounds', logo: 'hounds.png' },
  { id: 'shelter', name: 'Sunnyshore City Shelter', logo: 'shelter.png' },
  { id: 'uconn', name: 'UConn Arcanines', logo: 'uconn.png' },
];
const pick = (account_id, week, picked_team_id) => ({ account_id, username: account_id, week, picked_team_id, outcome: 'correct' });
const snapshot = {
  week: 8, current_week: 9, season_complete: true, results_complete: true, locked: true,
  account_id: 'middle', username: 'Middle', own_picks: [], ended_weeks: [1, 2, 3], matchups: [],
  winners: [{ account_id: 'low', username: hostileName }, { account_id: 'middle', username: 'Middle' }],
  contestants: [
    { account_id: 'high', username: 'High' },
    { account_id: 'middle', username: 'Middle' },
    { account_id: 'low', username: hostileName },
    { account_id: 'empty', username: 'No picks yet' },
  ],
  history: [pick('high', 1, 'shelter'), pick('high', 2, 'uconn'),
    pick('middle', 1, 'shelter'), pick('middle', 2, HOUNDS), pick('middle', 3, HOUNDS),
    pick('low', 1, HOUNDS), pick('low', 2, HOUNDS),
    // An accidentally included unrevealed entry must never affect UI totals.
    pick('low', 7, 'shelter')],
};
const matchups = [
  { week: 1, home_team_id: HOUNDS, away_team_id: 'shelter' },
  { week: 2, home_team_id: 'uconn', away_team_id: HOUNDS },
  { week: 3, home_team_id: HOUNDS, away_team_id: 'shelter' },
];
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
class Element {
  constructor() {
    this.nodes = new Map(); this.events = {}; this.attributes = {}; this.style = {};
    this.hidden = false; this.disabled = false; this.open = false; this.focused = false;
    this.textContent = ''; this.innerHTML = ''; this.dataset = {};
    this.classList = { toggle() {}, add() {}, remove() {} };
  }
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, fn) { this.events[name] = fn; }
  append(element) { this.appended = element; }
  showModal() { this.open = true; }
  close() { this.open = false; this.events.close?.(); }
  focus() { this.focused = true; }
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
function fixture() {
  const document = new Element(); document.body = new Element();
  const launcher = new Element();
  document.createElement = () => new Element();
  document.querySelectorAll = selector => selector === '[data-survivor-open]' ? [launcher] : [];
  const calls = [], helperCalls = [], intervalCallbacks = new Map();
  let nextInterval = 0;
  let matchupReply = async () => response(matchups);
  const context = {
    document, window: { dispatchEvent() {}, addEventListener() {} }, console,
    URLSearchParams, Date, Intl, Number, Math, JSON,
    localStorage: { getItem: () => 'FIXTURE-ONLY' }, sessionStorage: { getItem: () => null },
    CustomEvent: class {}, setTimeout: () => 1, clearTimeout() {},
    setInterval: callback => { intervalCallbacks.set(++nextInterval, callback); return nextInterval; },
    clearInterval: id => intervalCallbacks.delete(id),
    fetch: async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || 'GET', options });
      if (String(url).includes('/rpc/read_flash_family_survivor')) return response(snapshot);
      if (String(url).includes('/rest/v1/flash_family_matchups?')) return matchupReply();
      if (String(url).startsWith('data/league-teams.json')) return response({ teams });
      if (String(url).startsWith('data/teams.json')) return response({ accounts: {
        LOW: { id: 'low', accountName: hostileName, teamId: HOUNDS },
        MIDDLE: { id: 'middle', accountName: 'Middle', teamId: 'shelter' },
      } });
      throw new Error(`Unexpected network request: ${url}`);
    },
  };
  vm.createContext(context);
  vm.runInContext(source('league-state'), context);
  vm.runInContext(source('survivor-omen'), context);
  const calculateRows = context.window.PokeLeagueOmen.rows;
  context.window.PokeLeagueOmen.rows = (state, schedule) => {
    const rows = calculateRows(state, schedule);
    helperCalls.push({ state, schedule, rows: JSON.parse(JSON.stringify(rows)) });
    return rows;
  };
  vm.runInContext(source('survivor'), context);
  const dialog = document.body.appended;
  return {
    context, dialog, document, launcher, calls, helperCalls, intervalCallbacks,
    $: selector => dialog.querySelector(selector),
    open: async () => { launcher.events.click(); await flush(); },
    click: async selector => { dialog.querySelector(selector).events.click(); await flush(); },
    reply: fn => { matchupReply = fn; },
    matchupCalls: () => calls.filter(call => call.url.includes('/rest/v1/flash_family_matchups?')),
  };
}
function assertOnlyReads(f) {
  assert(f.calls.every(call => call.method === 'GET' || /\/rpc\/read_flash_family_survivor$/.test(call.url)),
    'Omen navigation must never submit, update, delete, or reset Survivor picks');
}
function assertPublicScheduleRequest(call) {
  const url = new URL(call.url);
  assert.equal(call.method, 'GET');
  assert.equal(url.pathname, '/rest/v1/flash_family_matchups');
  assert.equal(url.searchParams.get('league_id'), 'eq.flash-family-season-1');
  assert.equal(url.searchParams.get('select'), 'week,home_team_id,away_team_id');
  assert.equal(url.searchParams.get('week'), 'lte.8');
  assert.equal(url.searchParams.get('order'), 'week.asc,display_order.asc');
  assert.equal(call.options.cache, 'no-store');
  assert.equal(call.options.body, undefined, 'Public matchup request must not include an access code or private pick body');
  assert(!call.url.includes('FIXTURE-ONLY'));
}
(async () => {
  const original = JSON.stringify({ snapshot, matchups });
  const f = fixture();
  assert.equal(f.calls.length, 0, 'Creating the hidden dialog must not fetch');
  await f.open();
  assert.equal(f.matchupCalls().length, 0, 'Opening Survivor does not load Omen data until requested');
  assert.equal(f.helperCalls.length, 0);
  assert.equal(f.$('[data-sv-finale]').hidden, false);
  assert.equal(f.$('[data-sv-content]').hidden, true);
  assert.equal(f.$('[data-sv-main]').hidden, false);
  assert.equal(f.$('[data-omen-open]').disabled, false, 'Omen remains usable after the Survivor finale');
  assert.match(f.dialog.innerHTML, /<button[^>]*type="button"[^>]*data-omen-open[^>]*aria-controls="survivorOmen"/,
    'The entry point is a native, named button linked to its panel');
  assert.match(f.dialog.innerHTML, /id="survivorOmen"[^>]*aria-labelledby="omenTitle"/);
  const winnersBefore = f.$('[data-sv-finale]').innerHTML;
  assert(winnersBefore.includes('Survivor winners') && winnersBefore.includes('Middle'));

  let resolveSchedule;
  f.reply(() => new Promise(resolve => { resolveSchedule = resolve; }));
  await f.click('[data-omen-open]');
  assert.equal(f.$('[data-sv-main]').hidden, true);
  assert.equal(f.$('[data-sv-omen]').hidden, false);
  assert.equal(f.$('#omenTitle').focused, true);
  assert.equal(f.$('[data-omen-list]').innerHTML, '', 'Loading state cannot manufacture zero percentages');
  assert.match(f.$('[data-omen-status]').textContent, /Reading/);
  assertPublicScheduleRequest(f.matchupCalls()[0]);
  // Back remains usable while a request is in flight; response may update only
  // the hidden panel, without taking the user away from the winners.
  await f.click('[data-omen-back]');
  resolveSchedule(response(matchups)); await flush();
  assert.equal(f.$('[data-sv-main]').hidden, false);
  assert.equal(f.$('[data-sv-omen]').hidden, true);
  assert.equal(f.$('[data-sv-finale]').innerHTML, winnersBefore);
  assert.equal(f.$('[data-omen-open]').focused, true);

  f.reply(async () => response(matchups));
  await f.click('[data-omen-open]');
  const calculated = f.helperCalls.at(-1);
  assert.equal(calculated.state, snapshot, 'UI calculates from the public Survivor snapshot');
  assert.equal(calculated.schedule, matchups);
  assert.deepEqual(calculated.rows.map(row => [row.accountId, row.against, row.total, row.rank]),
    [['low', 0, 2, 1], ['middle', 1, 3, 2], ['high', 2, 2, 3], ['empty', 0, 0, null]]);
  const rendered = f.$('[data-omen-list]').innerHTML.match(/<li\b[\s\S]*?<\/li>/g);
  assert.equal(rendered.length, 4);
  assert.match(rendered[0], /class="omen-row is-lowest"/);
  assert.match(rendered[0], /0%<\/strong><small>0 of 2 picks/);
  assert.match(rendered[1], /33\.3%<\/strong><small>1 of 3 picks/);
  assert.match(rendered[2], /100%<\/strong><small>2 of 2 picks/);
  assert.match(rendered[3], /—<\/strong><small>No picks/);
  assert(!/>0%<\/strong>/.test(rendered[3]), 'A contestant with no picks has no fabricated percentage');
  assert(rendered[0].includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Winner'));
  assert(!rendered[0].includes('<img src=x'), 'Account names are escaped before insertion into markup');
  assert(rendered[0].includes('South Jersey Hounds'), 'Known account team context survives ranking');
  await f.click('[data-omen-back]');
  assert.equal(f.$('[data-sv-finale]').innerHTML, winnersBefore);
  await f.click('[data-omen-open]');
  await f.click('.survivor-close');
  assert.equal(f.dialog.open, false);
  assert.equal(f.intervalCallbacks.size, 0, 'Closing stops Survivor refresh polling');
  assert.equal(f.launcher.focused, true);
  await f.open();
  assert.equal(f.$('[data-sv-main]').hidden, false, 'Reopening starts at Survivor rather than its Omen subview');
  assert.equal(f.$('[data-sv-omen]').hidden, true);
  assert.equal(f.$('[data-sv-finale]').innerHTML, winnersBefore);
  await f.click('.survivor-save');
  assertOnlyReads(f);

  const failed = fixture();
  failed.reply(async () => response({ message: 'unavailable' }, 503));
  await failed.open(); await failed.click('[data-omen-open]');
  assert.equal(failed.$('[data-omen-retry]').hidden, false);
  assert.match(failed.$('[data-omen-status]').textContent, /could not load/);
  assert.equal(failed.$('[data-omen-list]').innerHTML, '');
  assert.equal(failed.helperCalls.length, 0, 'Failed loading must not calculate every user as 0%');
  failed.reply(async () => response(matchups));
  await failed.click('[data-omen-retry]');
  assert.equal(failed.$('[data-omen-retry]').hidden, true);
  assert.equal(failed.$('[data-omen-status]').textContent, '');
  assert.equal(failed.matchupCalls().length, 2, 'Retry performs a fresh public schedule read');
  assert(failed.$('[data-omen-list]').innerHTML.includes('1 of 3 picks'));
  failed.matchupCalls().forEach(assertPublicScheduleRequest);
  assertOnlyReads(failed);
  assert.equal(JSON.stringify({ snapshot, matchups }), original, 'View navigation and ranking preserve all source picks and winners');
  console.log('Survivor Omen UI passed: accessible finale entry, lazy public GET, pending/back race, helper rankings and counts, escaped names, no-pick dash, error/retry without fabricated rates, preserved winners/picks, and default view on reopen.');
})().catch(error => { console.error(error); process.exitCode = 1; });
