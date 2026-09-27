// Run the actual standings page script with isolated data; no network or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const teams = JSON.parse(fs.readFileSync(path.join(root, 'data/league-teams.json'))).teams;
const script = fs.readFileSync(path.join(root, 'js/standings.js'), 'utf8');
const [a, b, opponent] = teams.map(team => team.id);
const match = (team, homeScore, awayScore, homeKOs = null, awayKOs = null) => ({
  week: 1, home_team_id: team, away_team_id: opponent,
  home_score: homeScore, away_score: awayScore, home_kos: homeKOs, away_kos: awayKOs,
});
async function order(matchups) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', addEventListener() {} });
    return nodes.get(selector);
  };
  const context = {
    document: { querySelector: node, addEventListener() {} },
    window: {
      PokeLeagueState: { read: () => ({season: 1, playoffs: {}, scores: {}}), applyCatalog: catalog => catalog },
      PokeLeagueRosters: { read: async () => ({}), namesFromSlugs: () => ({}) },
      PokeLeagueCompetition: { read: async () => ({currentWeek: 1, playoffTeamCount: 8, matchups}) },
    },
    fetch: async url => ({ok: true, json: async () => url.includes('league-teams') ? {teams} : []}),
  };
  vm.runInNewContext(script, context);
  await new Promise(resolve => setImmediate(resolve));
  const ids = selector => [...node(selector).innerHTML.matchAll(/data-open-team="([^"]+)"/g)].map(match => match[1]);
  const result = ids('[data-standings-body]');
  assert.equal(result.length, 14, 'All teams are ranked');
  assert.deepEqual(ids('[data-playoff-grid]'), result.slice(0, 8), 'Playoff picture follows the same standings');
  return result;
}
(async () => {
  let result = await order([match(a, 2, 0, 8, 0), match(a, 2, 0, 8, 0), match(a, 0, 2, 0, 2), match(b, 1, 0, 2, 1)]);
  assert(result.indexOf(b) < result.indexOf(a), 'Win% beats total wins, KO differential and GW');
  result = await order([match(a, 3, 0, 6, 5), match(b, 2, 0, 8, 0)]);
  assert(result.indexOf(b) < result.indexOf(a), 'KO differential breaks equal Win% before GW');
  result = await order([match(a, 1, 0, 4, 2), match(b, 2, 0, 8, 6)]);
  assert(result.indexOf(b) < result.indexOf(a), 'GW breaks equal Win% and KO differential');
  result = await order([match(a, 2, 0, 6, 4), match(b, 1, 0, 2, 1), match(b, 1, 0, 2, 1)]);
  assert(result.indexOf(a) < result.indexOf(b), 'Full ties retain original order, with no extra wins/losses tiebreaker');
  result = await order([match(a, 0, 2, 1, 7), match(b, 0, 2, 2, 3)]);
  assert(result.indexOf(b) < result.indexOf(a), 'Higher negative KO differential ranks first');
  result = await order([match(a, 1, 0), match(b, 2, 0)]);
  assert(result.indexOf(b) < result.indexOf(a), 'Missing KO reports add no invented differential');
  assert.deepEqual(await order([]), teams.map(team => team.id), 'Preseason remains stable');
  console.log('PASS: Win% → KO Diff → GW; stable full ties, negative/missing KOs, all 14 teams, and matching playoff seeds.');
})().catch(error => {console.error(error); process.exitCode = 1;});
