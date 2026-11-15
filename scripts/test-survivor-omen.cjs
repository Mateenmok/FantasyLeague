const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'survivor-omen.js'), 'utf8'), context);
const rows = (snapshot, matchups) => JSON.parse(JSON.stringify(context.window.PokeLeagueOmen.rows(snapshot, matchups)));
const HOUNDS = 'south-jersey-hounds';
const pick = (account, week, team, extra = {}) => ({ account_id: account, username: account, week, picked_team_id: team, outcome: 'correct', ...extra });
const matchup = (week, home, away) => ({ week, home_team_id: home, away_team_id: away });
const schedule = [matchup(1, HOUNDS, 'shelter'), matchup(2, 'uconn', HOUNDS), matchup(3, HOUNDS, null), matchup(4, 'shelter', 'uconn')];

// Opponents are week-specific, in either position. Picking Hounds itself is not a fade.
const history = [pick('Dynamic', 1, 'shelter'), pick('Dynamic', 2, 'shelter'), pick('Dynamic', 3, 'uconn'), pick('Dynamic', 4, HOUNDS),
  pick('Both sides', 1, 'shelter'), pick('Both sides', 2, 'uconn'), pick('Hounds fan', 1, HOUNDS), pick('Hounds fan', 2, HOUNDS)];
const snapshot = { ended_weeks: [1, '2', 3, 4], history, contestants: [{ account_id: 'Empty', username: 'Empty' }] };
const original = JSON.stringify({ snapshot, schedule });
const calculated = rows(snapshot, schedule);
assert.deepEqual(calculated.map(r => [r.username, r.against, r.total, r.percentage, r.rank]), [
  ['Hounds fan', 0, 2, 0, 1], ['Dynamic', 1, 4, 25, 2], ['Both sides', 2, 2, 100, 3], ['Empty', 0, 0, null, null],
]);
assert.equal(JSON.stringify({ snapshot, schedule }), original, 'Helper never mutates source data');

// A missed week is not a pick; for-fun choices after elimination remain real picks.
const submissions = rows({ ended_weeks: [1, 2, 3, 4], contestants: [
  { account_id: 'Fun', username: 'Fun', eliminated_week: 1 }, { account_id: 'Missed', username: 'Missed', eliminated_week: 1 },
], history: [pick('Fun', 1, 'shelter', { outcome: 'incorrect' }), pick('Fun', 2, 'uconn', { outcome: 'incorrect' }),
  pick('Fun', 3, null, { outcome: 'missed' }), pick('Fun', 4, null), pick('Missed', 1, 'shelter', { outcome: 'missed' }),
  pick('Missed', 2, null, { outcome: 'missed' }), pick('Missed', 3, ''), pick('Missed', 4, undefined)] }, schedule);
assert.deepEqual(submissions.map(r => [r.username, r.against, r.total, r.percentage]), [['Fun', 2, 2, 100], ['Missed', 0, 0, null]]);

// Duplicate history cannot inflate numerator or denominator, including repeated missing rows.
const repeated = pick('Duplicate', 1, 'shelter');
const deduped = rows({ ended_weeks: [1, 2], history: [repeated, { ...repeated }, pick('Duplicate', '1', null, { outcome: 'missed' }),
  pick('Duplicate', 2, 'shelter', { updated_at: '2026-09-01T00:00:00Z' }), pick('Duplicate', 2, 'uconn', { updated_at: '2026-09-02T00:00:00Z' }),
  pick('Duplicate', 2, 'shelter', { updated_at: '2026-09-01T00:00:00Z' })] }, schedule);
assert.deepEqual(deduped[0], { accountId: 'Duplicate', username: 'Duplicate', against: 2, total: 2, percentage: 100, rank: 1 });

// Even accidental inclusion in history cannot reveal current or postseason picks.
const hidden = rows({ ended_weeks: [1, 8, 9, 10, 11, 0, -1, 1.5], contestants: [{ account_id: 'Private', username: 'Private' }],
  history: [pick('Visible', 1, 'shelter'), pick('Visible', 8, 'uconn'), pick('Private', 2, 'uconn'), pick('Private', 9, 'uconn'),
    pick('Private', 10, 'uconn'), pick('Private', 11, 'uconn'), pick('Private', 0, 'uconn'), pick('Private', 1.5, 'uconn'), pick('Unknown hidden user', 2, 'uconn')],
  own_picks: [pick('Private', 2, 'uconn')] }, [...schedule, matchup(8, 'uconn', HOUNDS), matchup(9, 'uconn', HOUNDS)]);
assert.deepEqual(hidden.map(r => [r.username, r.total, r.against]), [['Visible', 2, 2], ['Private', 0, 0]]);
assert.deepEqual(rows({ history: [repeated], ended_weeks: [] }, schedule), [], 'No public rows are inferred from unrevealed history');

// Compare exact ratios before formatting. Ties share competition rank, then use
// larger sample sizes and stable alphabetical/account ordering for presentation.
const tiedHistory = [pick('Zero', 1, HOUNDS),
  pick('Half two', 1, 'shelter'), pick('Half two', 2, 'shelter'),
  pick('Z Half four', 1, 'shelter'), pick('Z Half four', 2, 'uconn'), pick('Z Half four', 3, 'other'), pick('Z Half four', 4, 'other'),
  pick('A Half four', 1, 'shelter'), pick('A Half four', 2, 'uconn'), pick('A Half four', 3, 'other'), pick('A Half four', 4, 'other'),
  pick('Full', 1, 'shelter')];
const ties = rows({ ended_weeks: [1, 2, 3, 4], history: tiedHistory }, schedule);
assert.deepEqual(ties.map(r => [r.username, r.rank]), [['Zero', 1], ['A Half four', 2], ['Z Half four', 2], ['Half two', 2], ['Full', 5]]);
assert.deepEqual(rows({ ended_weeks: [1], history: [pick('b', 1, HOUNDS, { username: 'Same' }), pick('a', 1, HOUNDS, { username: 'Same' })] }, schedule).map(r => r.accountId), ['a', 'b']);

// Missing and malformed Hounds matchups never manufacture an opponent.
assert.equal(rows({ ended_weeks: [1], history: [repeated] }, [matchup(1, HOUNDS, HOUNDS), matchup(1, HOUNDS, ''), matchup(1, null, HOUNDS)])[0].against, 0);
assert.equal(rows({ ended_weeks: [1], history: [repeated] }, [matchup(1, HOUNDS, 'shelter'), matchup(1, HOUNDS, 'shelter')])[0].against, 1);
assert.deepEqual(rows(), []);
console.log('Survivor Omen passed: same-week opponents, submitted-pick denominator, for-fun picks, missed/null exclusion, deduplication, exact tied ranking, privacy boundaries, empty contestants, and pure inputs.');
