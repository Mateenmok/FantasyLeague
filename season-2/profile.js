(() => {
  const STORAGE_KEY = 'pokeleague.season2.profile.v1';
  const TRAINERS = Object.freeze([
    { id: 'red', label: 'Trainer icon 1', color: '#fb8b7f' },
    { id: 'leaf', label: 'Trainer icon 2', color: '#a7dfa1' },
    { id: 'ethan', label: 'Trainer icon 3', color: '#f4cb74' },
    { id: 'nate', label: 'Trainer icon 4', color: '#84c7ff' },
    { id: 'rosa', label: 'Trainer icon 5', color: '#e6a7ed' },
  ].map(trainer => Object.freeze(trainer)));
  const PARTS = Object.freeze(['hair', 'skin', 'cap', 'capTrim', 'top', 'sleeves', 'bottoms', 'bag', 'shoes', 'soles']);
  const HAIRSTYLES = Object.freeze(['original', 'swept', 'choppy', 'braid']);
  const PATTERNS = Object.freeze(['stripes', 'check', 'dots', 'diagonal']);
  const FABRICS = Object.freeze(['cap', 'top', 'sleeves', 'bottoms', 'bag', 'shoes']);
  const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  function normalizeAppearance(value) {
    const appearance = {};
    if (!value || typeof value !== 'object') return appearance;
    for (const part of PARTS) {
      if (validColor(value[part])) appearance[part] = value[part].toLowerCase();
    }
    if (HAIRSTYLES.includes(value.hairstyle) && value.hairstyle !== 'original') appearance.hairstyle = value.hairstyle;
    if (value.patterns && typeof value.patterns === 'object') {
      const patterns = {};
      for (const part of FABRICS) {
        const pattern = value.patterns[part];
        if (!pattern || !PATTERNS.includes(pattern.kind) || !validColor(pattern.color)) continue;
        patterns[part] = { kind: pattern.kind, color: pattern.color.toLowerCase(), scale: [2,3,4].includes(pattern.scale) ? pattern.scale : 3 };
      }
      if (Object.keys(patterns).length) appearance.patterns = patterns;
    }
    return appearance;
  }
  function normalizeName(value) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim() : '';
  }
  function validate(value) {
    if (!value || !TRAINERS.some(trainer => trainer.id === value.trainerId)) return null;
    const name = normalizeName(value.name);
    if (!name || name.length > 20) return null;
    const appearance = normalizeAppearance(value.appearance);
    // Older palettes colored sleeves and headwear together. Preserve that saved look.
    if (Number(value.version || 3) < 3) {
      if (appearance.top) appearance.sleeves = appearance.top;
      if (appearance.cap && value.trainerId === 'leaf') appearance.capTrim = appearance.cap;
    }
    return { version: 3, trainerId: value.trainerId, name, appearance };
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
  window.PokeLeagueSeasonTwoProfile = Object.freeze({ TRAINERS, PARTS, HAIRSTYLES, PATTERNS, FABRICS, STORAGE_KEY, normalizeName, normalizeAppearance, validate, read, save });
})();
