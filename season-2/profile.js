(() => {
  const STORAGE_KEY = 'pokeleague.season2.profile.v1';
  const TRAINERS = Object.freeze([
    { id: 'red', name: 'Red', color: '#fb8b7f' },
    { id: 'leaf', name: 'Leaf', color: '#a7dfa1' },
    { id: 'ethan', name: 'Ethan', color: '#f4cb74' },
    { id: 'nate', name: 'Nate', color: '#84c7ff' },
    { id: 'rosa', name: 'Rosa', color: '#e6a7ed' },
  ].map(trainer => Object.freeze(trainer)));
  function normalizeName(value) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim() : '';
  }
  function validate(value) {
    if (!value || !TRAINERS.some(trainer => trainer.id === value.trainerId)) return null;
    const name = normalizeName(value.name);
    if (!name || name.length > 20) return null;
    return { version: 1, trainerId: value.trainerId, name };
  }
  function read(storage) {
    try { return validate(JSON.parse(storage.getItem(STORAGE_KEY))); }
    catch { return null; }
  }
  function save(storage, value) {
    const profile = validate(value);
    if (!profile) return { ok: false, reason: 'invalid' };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(profile));
      return { ok: true, profile };
    } catch { return { ok: false, reason: 'storage' }; }
  }
  window.PokeLeagueSeasonTwoProfile = Object.freeze({ TRAINERS, STORAGE_KEY, normalizeName, validate, read, save });
})();
