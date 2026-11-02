const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'season-2/trainer-colors.js'), 'utf8'), context);
const { recolor } = context.window.PokeLeagueTrainerColors;

// Decode our actual indexed PNG fixtures to check region isolation and transparency.
function sprite(id) {
  const file = fs.readFileSync(path.join(root, 'season-2/images/trainers', id + '.png'));
  let width, height, palette, alpha = [], offset = 8;
  const compressed = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8); assert.equal(data[9], 3); assert.equal(data[12], 0);
    }
    if (type === 'PLTE') palette = Array.from({ length: length / 3 }, (_, i) => [...data.subarray(i * 3, i * 3 + 3)]);
    if (type === 'tRNS') alpha = [...data];
    if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(compressed));
  const indices = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)];
    for (let x = 0; x < width; x++) {
      const a = x ? indices[y * width + x - 1] : 0;
      const b = y ? indices[(y - 1) * width + x] : 0;
      const c = x && y ? indices[(y - 1) * width + x - 1] : 0;
      const estimate = a + b - c;
      const pa = Math.abs(estimate - a), pb = Math.abs(estimate - b), pc = Math.abs(estimate - c);
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      indices[y * width + x] = (raw[y * (width + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, pixels: Uint8ClampedArray.from([...indices].flatMap(i => [...palette[i], alpha[i] ?? 255])) };
}

for (const id of ['red', 'leaf', 'ethan', 'nate', 'rosa']) {
  const { width, pixels } = sprite(id);
  const original = [...pixels];
  assert.deepEqual([...recolor(pixels, width, id, {})], original, 'Original appearance is pixel-identical');
  const sets = [];
  for (const part of ['hair', 'skin', 'cap', 'top', 'bottoms', 'capTrim', 'sleeves', 'bag', 'shoes', 'soles']) {
    const output = recolor(pixels, width, id, { [part]: '#58c8a0' });
    const changed = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
      assert.equal(output[i + 3], pixels[i + 3], 'Alpha must be preserved');
      const differs = output[i] !== pixels[i] || output[i + 1] !== pixels[i + 1] || output[i + 2] !== pixels[i + 2];
      if (differs) changed.add(i);
      if (!pixels[i + 3] || pixels[i] + pixels[i + 1] + pixels[i + 2] === 0) assert.equal(differs, false, 'Transparency and black outlines stay intact');
    }
    assert(changed.size >= 4, `${id}: ${part} must visibly change (${changed.size} pixels)`);
    for (const other of sets) assert(![...changed].some(i => other.has(i)), `${id}: body-part masks must not overlap`);
    sets.push(changed);
  }
  assert.deepEqual([...pixels], original, 'Edits never mutate the source pixel buffer');
  assert.deepEqual([...recolor(pixels, width, id, { hair: 'invalid', other: '#ffffff' })], original);
  const combined = recolor(pixels, width, id, { skin: '#845339', hair: '#e5c475' });
  const skinOnly = recolor(pixels, width, id, { skin: '#845339' });
  for (const index of sets[1]) assert.deepEqual([...combined.subarray(index, index + 4)], [...skinOnly.subarray(index, index + 4)], 'Hair editing must not alter the selected skin tone');
}
for(const id of ['red','leaf','ethan','nate','rosa']) {
  const {width,pixels}=sprite(id);
  const variants=new Set();
  for(const hairstyle of ['original','swept','choppy','braid']) {
    const output=recolor(pixels,width,id,{hairstyle}); variants.add(Buffer.from(output).toString('base64'));
    assert.equal(output.length,pixels.length);
  }
  assert.equal(variants.size,4,id+': each hairstyle must produce a distinct silhouette');
  for(const part of ['cap','top','sleeves','bottoms','bag','shoes']) {
    const region=recolor(pixels,width,id,{[part]:'#fa33c5'});
    for(const kind of ['stripes','check','dots','diagonal']) {
      const output=recolor(pixels,width,id,{patterns:{[part]:{kind,color:'#fa33c5',scale:2}}});
      let changed=0;
      for(let i=0;i<pixels.length;i+=4) {
        assert.equal(output[i+3],pixels[i+3],'Patterns preserve alpha');
        if(output[i]!==pixels[i] || output[i+1]!==pixels[i+1] || output[i+2]!==pixels[i+2]) {
          changed++;
          assert(region[i]!==pixels[i] || region[i+1]!==pixels[i+1] || region[i+2]!==pixels[i+2],id+': patterns must stay on selected fabric');
        }
      }
      assert(changed>0,id+': '+part+' '+kind+' must be visible');
    }
  }
}
console.log('PASS: Ten isolated color regions, four distinct hairstyles, and clipped fabric patterns on all five trainers. Source pixels and original outlines are preserved.');
