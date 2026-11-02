const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'season-2/profile.js'), 'utf8'), context);
const model = context.window.PokeLeagueSeasonTwoProfile;
const values = new Map([
  ['pokeleague.accessCode', 'NETO'], ['pokeleague.accountId', 'neto'],
  ['pokeleague.adminState.v1', '{"week":7}'], ['pokeleague-theme', 'dark'],
]);
const original = [...values];
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
assert.equal(model.read(storage), null);
assert.equal(model.TRAINERS.length, 5);
for (const trainer of model.TRAINERS) {
  assert(fs.existsSync(path.join(root, 'season-2/images/trainers', trainer.id + '.png')));
  const result = model.save(storage, { trainerId: trainer.id, name: '  New   Trainer  ' });
  assert.equal(result.ok, true);
  assert.equal(model.read(storage).trainerId, trainer.id);
  assert.equal(model.read(storage).name, 'New Trainer');
}
for (const name of ['', '    ', 'a'.repeat(21), '\u0000\u202e', null, 123]) {
  assert.equal(model.save(storage, { trainerId: 'nate', name }).ok, false);
}
assert.equal(model.save(storage, { trainerId: 'unknown', name: 'Trainer' }).ok, false);
assert.equal(model.read(storage).name, 'New Trainer', 'Invalid edits do not replace a saved draft');
assert.equal(model.save(storage, { trainerId: 'rosa', name: 'Éloïse ★' }).ok, true);
assert.equal(model.read(storage).name, 'Éloïse ★');
for (const [key, value] of original) assert.equal(values.get(key), value, 'Season 1 identity and data must not change');
assert.equal(values.size, original.length + 1, 'Only the Season 2 profile key is written');
for (const raw of ['oops', 'null', '[]', '{"trainerId":"bad","name":"Trainer"}', '{"trainerId":"red","name":""}']) {
  values.set(model.STORAGE_KEY, raw);
  assert.equal(model.read(storage), null, 'Corrupt profiles restart safely');
}
assert.equal(model.read(undefined), null);
assert.equal(model.save(undefined, { trainerId: 'red', name: 'Trainer' }).reason, 'storage');
assert.equal(model.read({ getItem() { throw new Error('Storage blocked'); } }), null);
console.log('PASS: Five trainer choices, validated names, save/reload, corrupt/blocked storage, and Season 1 isolation.');
