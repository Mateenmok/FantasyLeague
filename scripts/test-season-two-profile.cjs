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
values.set(model.STORAGE_KEY, JSON.stringify({ version: 1, trainerId: 'nate', name: 'Pufferz' }));
assert.equal(model.read(storage).version, 3);
assert.equal(model.read(storage).name, 'Pufferz', 'Existing draft names survive the editor update');
assert.equal(Object.keys(model.read(storage).appearance).length, 0);
const custom = { hair: '#ABCDEF', skin: '#845339', cap: '#5b9cdc', top: '#4fbebc', bottoms: '#394154', capTrim:'#f3e9d2', sleeves:'#87bcd6', bag:'#db9982', shoes:'#fff8de', soles:'#354647' };
assert.equal(model.save(storage, { trainerId: 'rosa', name: 'Pufferz', appearance: custom }).ok, true);
for (const part of model.PARTS) assert.equal(model.read(storage).appearance[part], custom[part].toLowerCase());
const styled={...custom,hairstyle:'braid',patterns:{top:{kind:'check',color:'#AABBCC',scale:2},shoes:{kind:'stripes',color:'#123456',scale:4}}};
assert.equal(model.save(storage,{trainerId:'rosa',name:'Pufferz',appearance:styled}).ok,true);
assert.equal(model.read(storage).appearance.hairstyle,'braid');
assert.equal(model.read(storage).appearance.patterns.top.color,'#aabbcc');
assert.equal(model.read(storage).appearance.patterns.shoes.scale,4);
assert.equal(model.normalizeAppearance({hairstyle:'url(evil)',patterns:{hair:{kind:'dots',color:'#aabbcc'},top:{kind:'evil',color:'#aabbcc'}}}).hairstyle,undefined);
assert.equal(model.normalizeAppearance({patterns:{top:{kind:'dots',color:'evil'}}}).patterns,undefined);
const legacy=model.validate({version:2,trainerId:'leaf',name:'Old trainer',appearance:{top:'#aabbcc',cap:'#dd4422'}});
assert.equal(legacy.appearance.sleeves,'#aabbcc');
assert.equal(legacy.appearance.capTrim,'#dd4422');
assert.equal(model.validate({version:2,trainerId:'rosa',name:'Old trainer',appearance:{cap:'#dd4422'}}).appearance.capTrim,undefined,'Previously white headwear stays white');
const sanitized = model.normalizeAppearance({ hair: 'url(https://example.com)', skin: '#123', cap: '#ff00aa', unknown: '#000000' });
assert.deepEqual(Object.keys(sanitized), ['cap']);
assert.equal(model.read(storage).trainerId, 'rosa');
for (const [key, value] of original) assert.equal(values.get(key), value, 'Season 1 identity and data must not change');
assert.equal(values.size, original.length + 1, 'Only the Season 2 profile key is written');
for (const raw of ['oops', 'null', '[]', '{"trainerId":"bad","name":"Trainer"}', '{"trainerId":"red","name":""}']) {
  values.set(model.STORAGE_KEY, raw);
  assert.equal(model.read(storage), null, 'Corrupt profiles restart safely');
}
assert.equal(model.read(undefined), null);
assert.equal(model.save(undefined, { trainerId: 'red', name: 'Trainer' }).reason, 'storage');
assert.equal(model.read({ getItem() { throw new Error('Storage blocked'); } }), null);
console.log('PASS: Five icons, name and color persistence, old-profile migration, invalid color rejection, blocked storage, and Season 1 isolation.');
