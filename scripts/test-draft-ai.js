#!/usr/bin/env node
const assert = require("node:assert/strict");
const catalog = require("../data/pokemon-catalog.json");
const DraftAI = require("../js/draft-ai.js");

const byName = new Map(catalog.map((pokemon) => [pokemon.name, pokemon]));
const ai = DraftAI.create({ catalog, rolesFor: () => [], pointCap: 50, teamCount: 14, rosterSize: 10, rng: () => 0.01 });
const team = (id, picks = [], extra = {}) => ({ id, picks, draftStrategy: "balanced", primaryProfile: "balanced", aggression: 1, chaos: 0, ...extra });
const context = (pickIndex, available, teams = {}) => ({ pickIndex, available: new Set(available), teams, log: [], humanTeamId: null });
const pick = (name) => ({ ...byName.get(name), mascot: false });
const allNames = catalog.map((pokemon) => pokemon.name);
let passed = 0;
const test = (name, run) => {
  run();
  passed += 1;
  console.log(`✓ ${name}`);
};

test("human Pick 1 is Charizard", () => {
  const result = ai.choose(team(1), context(0, allNames), { isCpu: false });
  assert.equal(result.pokemon.name, "Charizard");
});

test("Pick 4 is restricted to Basculegion or Garchomp when both deadlines are live", () => {
  const result = ai.choose(team(4), context(3, allNames), { isCpu: true });
  assert.ok(["Basculegion", "Garchomp"].includes(result.pokemon.name));
  assert.deepEqual(new Set(result.candidates.map((entry) => entry.pokemon.name)), new Set(["Basculegion", "Garchomp"]));
});

test("Basculegion is mandatory at Pick 5 when it is the remaining deadline", () => {
  const available = allNames.filter((name) => name !== "Garchomp");
  assert.equal(ai.choose(team(5), context(4, available), { isCpu: true }).pokemon.name, "Basculegion");
  assert.equal(ai.choose(team(5), context(4, available), { isCpu: false }).pokemon.name, "Basculegion");
});

test("Farigiraf cannot enter the Pick 2 opening gate", () => {
  const result = ai.choose(team(2), context(1, allNames), { isCpu: true });
  assert.notEqual(result.pokemon.name, "Farigiraf");
  assert.ok(result.candidates.every((entry) => DraftAI.constants.OPENING_ELITE.includes(entry.pokemon.name)));
});

test("Charizard is forced at its Pick 7 deadline", () => {
  const available = allNames.filter((name) => !["Basculegion", "Garchomp", "Salamence"].includes(name));
  assert.equal(ai.choose(team(7), context(6, available), { isCpu: true }).pokemon.name, "Charizard");
});

test("Archaludon forces the Pelipper rain hierarchy", () => {
  const roster = team(14, [pick("Archaludon")]);
  const available = allNames.filter((name) => !["Archaludon", ...DraftAI.constants.OPENING_ELITE].includes(name));
  assert.equal(ai.choose(roster, context(13, available), { isCpu: true }).pokemon.name, "Pelipper");
});

test("Tyranitar forces Excadrill before fallback sand partners", () => {
  const roster = team(14, [pick("Tyranitar")]);
  const available = allNames.filter((name) => !["Tyranitar", ...DraftAI.constants.OPENING_ELITE].includes(name));
  assert.equal(ai.choose(roster, context(13, available), { isCpu: true }).pokemon.name, "Excadrill");
});

test("exclusive forms cannot coexist", () => {
  const roster = team(8, [pick("Hisuian Goodra")]);
  assert.equal(ai.isLegal(roster, byName.get("Goodra"), context(7, ["Goodra"]), false), false);
});

test("the budget floor preserves one point per open slot", () => {
  const cheap = catalog.find((pokemon) => Number(pokemon.points) === 2);
  const roster = team(8, Array.from({ length: 7 }, (_, index) => ({ name: `Locked ${index}`, sortPoints: index === 0 ? 35 : 2, types: [] })));
  assert.equal(ai.isLegal(roster, cheap, context(7, [cheap.name]), false), false);
});

test("Charizard, Talonflame and Dragonite cannot form the forbidden trio", () => {
  const roster = team(8, [pick("Charizard"), pick("Talonflame")]);
  assert.equal(ai.isLegal(roster, byName.get("Dragonite"), context(7, ["Dragonite"]), false), false);
});

test("Excadrill and Houndstone are mutually exclusive", () => {
  const roster = team(8, [pick("Excadrill")]);
  assert.equal(ai.isLegal(roster, byName.get("Houndstone"), context(7, ["Houndstone"]), false), false);
});

test("strategy room mix is exactly 5/6/2/1 with distinct cores", () => {
  const plans = ai.assignTeamPlans(Array.from({ length: 14 }, (_, index) => index + 1));
  const counts = Object.values(plans).reduce((result, plan) => ({ ...result, [plan.draftStrategy]: (result[plan.draftStrategy] || 0) + 1 }), {});
  assert.deepEqual(counts, { "specific-core": 2, "top-heavy": 5, balanced: 6, "all-around": 1 });
  const corePlans = Object.values(plans).filter((plan) => plan.draftStrategy === "specific-core").map((plan) => plan.specificCore);
  assert.equal(new Set(corePlans).size, 2);
  assert.ok(Number(Object.keys(plans).find((id) => plans[id].draftStrategy === "all-around")) >= 7);
});

console.log(`${passed} deterministic Draft AI acceptance tests passed.`);
