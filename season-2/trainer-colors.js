(() => {
  // Palette and position masks keep shared sprite colors independent (e.g. cap vs shirt).
  // Coordinates refer to the original 80 × 80 sprites; source assets stay unchanged.
  const definitions = {
    red: {
      palette: ['010000','000000','3b849f','b22c2c','622c2c','1f626a','1f1f1f','254252','c5c5cf','cf8d62','b2a93b','f6c5a9','a9624a','ffffff','7c8484','f64a42'],
      bases: { hair: '#1f1f1f', skin: '#f6c5a9', cap: '#f64a42', top: '#b22c2c', bottoms: '#3b849f' },
      part(x, y, c) {
        if (y <= 18 && [3,4,15].includes(c)) return 'cap';
        if (y >= 17 && y <= 23 && x >= 43 && c === 6) return 'hair';
        if (y >= 17 && y <= 40 && [9,11,12].includes(c)) return 'skin';
        if (y >= 29 && y <= 44 && x >= 32 && x <= 54 && [3,4,6,15].includes(c)) return 'top';
        if (y >= 46 && y <= 71 && [2,5,7].includes(c)) return 'bottoms';
      },
    },
    leaf: {
      palette: ['010000','785850','000000','c89070','f8e0b0','e0b898','d0d0d8','f8f8f8','c04040','5088b0','f86058','182850','306888','78b8d8','f8c058'],
      bases: { hair: '#785850', skin: '#f8e0b0', cap: '#f8f8f8', top: '#78b8d8', bottoms: '#f86058' },
      part(x, y, c) {
        if (y <= 22 && [6,7,8,9,12,13].includes(c)) return 'cap';
        if (y >= 22 && y <= 37 && x >= 47 && [1,3].includes(c)) return 'hair';
        if (y >= 22 && y <= 24 && x >= 32 && c === 1) return 'hair';
        if (y >= 24 && y <= 58 && [4,5].includes(c)) return 'skin';
        if (y >= 24 && y <= 58 && c === 3 && !(x >= 46 && y >= 40 && y <= 50)) return 'skin';
        if (y >= 30 && y <= 40 && x <= 49 && [9,12,13].includes(c)) return 'top';
        if (y >= 41 && y <= 47 && x <= 49 && [8,10].includes(c)) return 'bottoms';
      },
    },
    ethan: {
      palette: ['010000','000000','2c333b','191f25','961f1f','f6c5a9','622c2c','cf8d62','e2e2f6','52131f','968da9','3b4a4a','8d5a13','cfa925','bb4242'],
      bases: { hair: '#622c2c', skin: '#f6c5a9', cap: '#cfa925', top: '#961f1f', bottoms: '#2c333b' },
      part(x, y, c) {
        if (y <= 20 && [12,13].includes(c)) return 'cap';
        if (y >= 21 && y <= 27 && (x >= 46 || x <= 33) && [2,3,6].includes(c)) return 'hair';
        if (y > 20 && [5,7].includes(c)) return 'skin';
        if (y >= 31 && y <= 44 && [4,9,14].includes(c)) return 'top';
        if (y >= 47 && y <= 62 && [2,3,11].includes(c)) return 'bottoms';
      },
    },
    nate: {
      palette: ['010000','000000','282828','604840','909098','c8c8d8','585868','3078a0','285070','e8e8f8','c85050','f8d0b8','a88070','202840','d8a078','208888'],
      bases: { hair: '#604840', skin: '#f8d0b8', cap: '#c85050', top: '#3078a0', bottoms: '#c8c8d8' },
      part(x, y, c) {
        if (y <= 18 && c === 10) return 'cap';
        if (y <= 24 && [2,3].includes(c)) return 'hair';
        if (y >= 19 && [11,12,14].includes(c)) return 'skin';
        if (y >= 25 && y <= 42 && x <= 53 && [7,8,13].includes(c)) return 'top';
        if (y >= 25 && y <= 35 && c === 2) return 'top';
        if (y >= 43 && y <= 58 && x <= 53 && [4,5,6,13].includes(c)) return 'bottoms';
      },
    },
    rosa: {
      palette: ['010000','000000','303038','e8e8f8','705840','403828','80b0d0','c85070','d8d878','405860','b08058','784040','803048','f8d0b8','d8a078'],
      bases: { hair: '#705840', skin: '#f8d0b8', cap: '#c85070', top: '#e8e8f8', bottoms: '#d8d878' },
      part(x, y, c) {
        if (y <= 22 && [7,12].includes(c)) return 'cap';
        if (y <= 43 && [4,5].includes(c)) return 'hair';
        if ([13,14].includes(c) || (y >= 22 && y <= 37 && c === 10)) return 'skin';
        if (y >= 28 && y <= 43 && [3,6,9].includes(c)) return 'top';
        if (y >= 42 && y <= 49 && x <= 51 && [8,10,11].includes(c)) return 'bottoms';
        if (y >= 49 && y <= 64 && [2,9].includes(c)) return 'bottoms';
      },
    },
  };
  const rgb = hex => hex.replace('#','').match(/../g).map(value => parseInt(value, 16));
  const luma = color => color[0] * .2126 + color[1] * .7152 + color[2] * .0722;
  function recolor(pixels, width, id, appearance = {}) {
    const def = definitions[id];
    if (!def) throw new Error('Unknown trainer icon');
    const output = new Uint8ClampedArray(pixels);
    const lookup = new Map(def.palette.map((color, index) => [parseInt(color, 16), index]));
    const targets = Object.fromEntries(Object.entries(appearance).filter(([key, hex]) => def.bases[key] && /^#[0-9a-f]{6}$/i.test(hex)).map(([key, hex]) => [key, rgb(hex)]));
    for (let i = 0; i < pixels.length; i += 4) {
      if (!pixels[i + 3]) continue;
      const color = [pixels[i], pixels[i + 1], pixels[i + 2]];
      const index = lookup.get((color[0] << 16) | (color[1] << 8) | color[2]);
      const part = def.part((i / 4) % width, Math.floor(i / 4 / width), index);
      if (!part || !targets[part]) continue;
      const base = luma(rgb(def.bases[part]));
      const light = luma(color);
      const amount = light <= base ? light / Math.max(1, base) : (light - base) / Math.max(1, 255 - base);
      for (let c = 0; c < 3; c++) output[i + c] = light <= base ? targets[part][c] * amount : targets[part][c] + (255 - targets[part][c]) * amount;
    }
    return output;
  }
  const sources = new Map();
  function source(id) {
    if (!definitions[id]) return Promise.reject(new Error('Unknown trainer icon'));
    if (!sources.has(id)) {
      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => { sources.delete(id); reject(new Error('Trainer image could not load')); };
        image.src = `images/trainers/${id}.png`;
      });
      sources.set(id, promise);
    }
    return sources.get(id);
  }
  async function render(id, appearance) {
    const image = await source(id);
    if (!Object.keys(appearance || {}).length) return image.src;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    frame.data.set(recolor(frame.data, canvas.width, id, appearance));
    context.putImageData(frame, 0, 0);
    return canvas.toDataURL('image/png');
  }
  window.PokeLeagueTrainerColors = Object.freeze({ recolor, render, bases: id => ({ ...definitions[id]?.bases }) });
})();
