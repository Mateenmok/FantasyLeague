(() => {
  const HOUNDS = 'south-jersey-hounds';
  const regularWeek = value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 8;
  const hasId = value => typeof value === 'string' && value.trim().length > 0;
  const compareName = (left, right) => left.username.localeCompare(right.username, 'en', { sensitivity: 'base' })
    || left.username.localeCompare(right.username, 'en')
    || left.accountId.localeCompare(right.accountId, 'en');

  // This summary uses public history only. Own picks can contain an unrevealed
  // current-week choice and must never be used to calculate the meter.
  const rows = (snapshot = {}, matchups = []) => {
    const revealedWeeks = new Set((snapshot.ended_weeks || []).filter(regularWeek).map(Number));
    const opponents = new Map();
    for (const matchup of matchups || []) {
      const week = Number(matchup.week);
      if (!revealedWeeks.has(week)) continue;
      const opponent = matchup.home_team_id === HOUNDS ? matchup.away_team_id
        : matchup.away_team_id === HOUNDS ? matchup.home_team_id : null;
      if (!hasId(opponent) || opponent === HOUNDS) continue;
      if (!opponents.has(week)) opponents.set(week, new Set());
      opponents.get(week).add(opponent);
    }

    const people = new Map();
    const person = record => {
      if (!hasId(record.account_id)) return null;
      if (!people.has(record.account_id)) people.set(record.account_id, {
        accountId: record.account_id,
        username: String(record.username || record.account_id),
        total: 0,
        against: 0,
        percentage: null,
        rank: null,
      });
      return people.get(record.account_id);
    };
    for (const contestant of snapshot.contestants || []) person(contestant);

    const picks = new Map();
    for (const record of snapshot.history || []) {
      const week = Number(record.week);
      if (!revealedWeeks.has(week) || record.outcome === 'missed' || !hasId(record.picked_team_id) || !hasId(record.account_id)) continue;
      person(record);
      // One submitted pick per account/week. If a duplicated snapshot contains
      // revisions, prefer the newest timestamp; otherwise keep the first row.
      const key = JSON.stringify([record.account_id, week]);
      const existing = picks.get(key);
      const timestamp = Date.parse(record.updated_at || '') || 0;
      if (!existing || timestamp > existing.timestamp) picks.set(key, { record, week, timestamp });
    }
    for (const { record, week } of picks.values()) {
      const entry = people.get(record.account_id);
      entry.total += 1;
      if (record.picked_team_id !== HOUNDS && opponents.get(week)?.has(record.picked_team_id)) entry.against += 1;
    }

    const result = [...people.values()];
    result.forEach(entry => { if (entry.total) entry.percentage = entry.against * 100 / entry.total; });
    result.sort((left, right) => {
      if (!left.total || !right.total) return Number(!left.total) - Number(!right.total) || compareName(left, right);
      return left.against * right.total - right.against * left.total || right.total - left.total || compareName(left, right);
    });
    result.forEach((entry, index) => {
      if (!entry.total) return;
      const previous = result[index - 1];
      entry.rank = previous && previous.total && entry.against * previous.total === previous.against * entry.total
        ? previous.rank : index + 1;
    });
    return result;
  };

  window.PokeLeagueOmen = { rows };
})();
