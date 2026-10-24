const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const context = { window: {}, localStorage: { getItem: () => null } };
vm.createContext(context);
for (const file of ["league-rosters.js", "league-state.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", file), "utf8"), context);
}
const { orderForDisplay, slugify, namesFromSlugs } = context.window.PokeLeagueRosters;
const { applyCatalog, applyPointMap } = context.window.PokeLeagueState;
const baseCatalog = JSON.parse(fs.readFileSync(path.join(root, "data/pokemon-catalog.json"), "utf8"));
// A low-cost mascot stays first even when later picks have higher values.
const names = Object.freeze(["Eelektross", "Malamar", "Charizard", "Falinks", "Metagross"]);
const catalog = applyPointMap(applyCatalog(baseCatalog, { pointOverrides: { Malamar: 8 } }), { Malamar: 9 });
const byName = new Map(catalog.map(p => [p.name, p]));
const bySlug = new Map(catalog.map(p => [slugify(p.name), p]));
const expected = ["Eelektross", "Charizard", "Metagross", "Malamar", "Falinks"];
const displayed = orderForDisplay(names, name => byName.get(name)?.points);
assert.deepEqual(Array.from(displayed), expected);
assert.notEqual(displayed, names);
assert.deepEqual([...names], ["Eelektross", "Malamar", "Charizard", "Falinks", "Metagross"]);
const slugs = Object.freeze(names.map(slugify));
assert.deepEqual(Array.from(orderForDisplay(slugs, slug => bySlug.get(slug)?.points)), expected.map(slugify));
const pokemon = Object.freeze(names.map(name => Object.freeze({ ...byName.get(name) })));
assert.deepEqual(Array.from(orderForDisplay(pokemon), p => p.name), expected);
assert.equal(orderForDisplay(pokemon)[0], pokemon[0], "Keep the original Pokémon object and nickname identity");
// Conversion and persistence inputs must retain slot order, not presentation order.
assert.deepEqual(Array.from(namesFromSlugs({ boston: slugs }, catalog).boston), [...names]);
assert.deepEqual(Array.from(orderForDisplay([])), []);
assert.deepEqual(Array.from(orderForDisplay(null)), []);
assert.deepEqual(Array.from(orderForDisplay(["Mascot"])), ["Mascot"]);
assert.deepEqual(Array.from(orderForDisplay(["Mascot", "Unknown", "Known"], name => name === "Known" ? 5 : undefined)), ["Mascot", "Known", "Unknown"]);
console.log("PASS: mascot first, descending current points, stable ties, names/slugs/objects, empty rosters, and unchanged saved slot order.");
