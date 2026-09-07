const TIER_SYMBOLS = { Diamond: "◆", Gold: "●", Silver: "●", Bronze: "●" };
const TYPE_COLORS = {
  Bug: "#91a119", Dark: "#50413f", Dragon: "#5060e1", Electric: "#fac000",
  Fairy: "#ef70ef", Fighting: "#ff8000", Fire: "#e62829", Flying: "#81b9ef",
  Ghost: "#704170", Grass: "#3fa129", Ground: "#915121", Ice: "#3fd8ff",
  Normal: "#9fa19f", Poison: "#9141cb", Psychic: "#ef4179", Rock: "#afa981",
  Steel: "#60a1b8", Water: "#2980ef",
};

const searchInput = document.querySelector("#pokemonSearch");
const clearButton = document.querySelector("#clearSearch");
const grid = document.querySelector("#pokemonGrid");
const resultCount = document.querySelector("#resultCount");
const emptyState = document.querySelector("#emptyState");
const template = document.querySelector("#pokemonCardTemplate");
const tierButtons = [...document.querySelectorAll(".tier-filter")];
const rosterTarget = document.querySelector("[data-waiver-roster]");
const teamNameTarget = document.querySelector("[data-waiver-team-name]");
const rosterCountTarget = document.querySelector("[data-waiver-roster-count]");
const budgetTarget = document.querySelector("[data-waiver-budget]");
const windowBanner = document.querySelector("[data-waiver-window-banner]");
const windowStatusTarget = document.querySelector("[data-waiver-window-status]");
const windowCopyTarget = document.querySelector("[data-waiver-window-copy]");
const swapDialog = document.querySelector("[data-waiver-swap-dialog]");
const swapCopyTarget = document.querySelector("[data-waiver-swap-copy]");
const swapOptionsTarget = document.querySelector("[data-waiver-swap-options]");
const toast = document.querySelector("[data-waiver-toast]");

let catalog = [];
let baseCatalog = [];
let detailIndex = {};
let activeTier = "All";
let account = null;
let teams = [];
let rosterMap = {};
let waiverSettings = { startAt: null, endAt: null, pointCap: 50, rosterCap: 10, totalWeeks: 10 };
let actionPending = false;
let pendingAdd = null;
let toastTimer = null;

const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD")
  .replace(/[^a-z0-9]+/g, " ").trim();
const pokemonFor = (name) => catalog.find((pokemon) => normalize(pokemon.name) === normalize(name));
const currentRoster = () => account ? (rosterMap[account.teamId] || []) : [];
const pointsFor = (name) => Number(pokemonFor(name)?.points) || 0;
const rosterPoints = (names = currentRoster()) => names.reduce((total, name) => total + pointsFor(name), 0);

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "an unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date);
};

const waiverWindow = () => {
  const start = waiverSettings.startAt ? new Date(waiverSettings.startAt) : null;
  const end = waiverSettings.endAt ? new Date(waiverSettings.endAt) : null;
  const now = new Date();
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { open: false, status: "Waivers closed", copy: "An admin has not scheduled the next waiver period yet." };
  }
  if (now < start) {
    return { open: false, status: `Opens ${formatDateTime(start)}`, copy: `Waivers close ${formatDateTime(end)}.` };
  }
  if (now > end) {
    return { open: false, status: "Waivers closed", copy: `The waiver period ended ${formatDateTime(end)}.` };
  }
  return { open: true, status: "Waivers are open", copy: `Submit roster moves until ${formatDateTime(end)}.` };
};

const announce = (message, isError = false) => {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toastTimer = window.setTimeout(() => {
    toast.textContent = "";
    toast.classList.remove("is-error");
  }, 5000);
};

const orbFor = (pokemon, className) => {
  const orb = document.createElement("div");
  orb.className = className;
  orb.style.setProperty("--type-one", TYPE_COLORS[pokemon.types[0]] || TYPE_COLORS.Normal);
  orb.style.setProperty("--type-two", TYPE_COLORS[pokemon.types[1] || pokemon.types[0]] || TYPE_COLORS.Normal);
  const sprite = document.createElement("img");
  sprite.src = pokemon.sprite;
  sprite.alt = "";
  sprite.width = 112;
  sprite.height = 112;
  orb.append(sprite);
  return orb;
};

const renderWindow = () => {
  const state = waiverWindow();
  windowStatusTarget.textContent = state.status;
  windowCopyTarget.textContent = state.copy;
  windowBanner.classList.toggle("is-open", state.open);
  windowBanner.classList.toggle("is-closed", !state.open);
  budgetTarget.textContent = `${rosterPoints()} / ${waiverSettings.pointCap} points`;
};

const renderRoster = () => {
  renderWindow();
  const names = currentRoster();
  teamNameTarget.textContent = account?.teamName || "Sign in required";
  rosterCountTarget.textContent = `${names.length} / ${waiverSettings.rosterCap} Pokemon`;
  const fragment = document.createDocumentFragment();

  if (!account) {
    const empty = document.createElement("p");
    empty.className = "waiver-roster-empty";
    empty.textContent = "Sign in from the title screen to manage your team's roster.";
    rosterTarget.replaceChildren(empty);
    return;
  }

  for (const name of names) {
    const pokemon = pokemonFor(name);
    if (!pokemon) continue;
    const card = document.createElement("article");
    card.className = "waiver-roster-card";
    card.append(orbFor(pokemon, "waiver-roster-orb"));
    const heading = document.createElement("h3");
    heading.textContent = pokemon.name;
    const meta = document.createElement("p");
    meta.textContent = `${pokemon.types.join(" / ")} · ${pokemon.points} pts`;
    const button = document.createElement("button");
    button.className = "waiver-drop-button";
    button.type = "button";
    button.dataset.dropPokemon = pokemon.name;
    button.textContent = actionPending ? "Working..." : "Drop";
    button.disabled = actionPending || !waiverWindow().open;
    card.append(heading, meta, button);
    fragment.append(card);
  }

  if (!fragment.childNodes.length) {
    const empty = document.createElement("p");
    empty.className = "waiver-roster-empty";
    empty.textContent = "Your roster is empty. Add an available Pokemon below.";
    fragment.append(empty);
  }
  rosterTarget.replaceChildren(fragment);
};

const ownerMap = () => {
  const owners = new Map();
  Object.entries(rosterMap).forEach(([teamId, names]) => {
    (names || []).forEach((name) => owners.set(normalize(name), teamId));
  });
  return owners;
};

const eligibleDrops = (addPokemon) => currentRoster().map((name) => pokemonFor(name)).filter(Boolean)
  .filter((dropPokemon) => rosterPoints() - Number(dropPokemon.points) + Number(addPokemon.points) <= waiverSettings.pointCap);

const proposedRoster = ({ addName = null, dropName = null }) => {
  const names = [...currentRoster()];
  if (dropName && addName) return names.map((name) => normalize(name) === normalize(dropName) ? addName : name);
  if (dropName) return names.filter((name) => normalize(name) !== normalize(dropName));
  if (addName) return [...names, addName];
  return names;
};

const refreshRosters = async () => {
  const saved = await window.PokeLeagueRosters.read();
  rosterMap = window.PokeLeagueRosters.namesFromSlugs(saved, catalog, teams.map((team) => team.id));
  const state = window.PokeLeagueState.read();
  window.PokeLeagueState.write({ ...state, rosters: rosterMap });
};

const submitTransaction = async ({ addName = null, dropName = null }) => {
  if (!account) return announce("Sign in before making a waiver move.", true);
  if (!waiverWindow().open) return announce("Waivers are currently closed.", true);
  if (actionPending) return;
  const nextRoster = proposedRoster({ addName, dropName });
  const resultingPoints = rosterPoints(nextRoster);
  if (nextRoster.length > waiverSettings.rosterCap) return announce("Your roster is full. Choose a Pokemon to drop.", true);
  if (resultingPoints > waiverSettings.pointCap) return announce(`That move would exceed the ${waiverSettings.pointCap}-point cap.`, true);

  actionPending = true;
  renderRoster();
  render();
  try {
    await window.PokeLeagueWaivers.transact({
      accessCode: localStorage.getItem("pokeleague.accessCode") || sessionStorage.getItem("pokeleague.accessCode"),
      teamId: account.teamId,
      addName, dropName, resultingPoints,
    });
    await refreshRosters();
    if (swapDialog.open) swapDialog.close();
    announce(addName && dropName ? `${addName} added and ${dropName} dropped.`
      : addName ? `${addName} added to ${account.teamName}.` : `${dropName} dropped from ${account.teamName}.`);
  } catch (error) {
    announce(error.message || "The waiver move could not be completed.", true);
  } finally {
    actionPending = false;
    renderRoster();
    render();
  }
};

const openSwap = (pokemon) => {
  const drops = eligibleDrops(pokemon);
  if (!drops.length) return announce(`No one-for-one swap keeps your roster under ${waiverSettings.pointCap} points.`, true);
  pendingAdd = pokemon.name;
  swapCopyTarget.textContent = `Add ${pokemon.name} (${pokemon.points} pts). Choose who leaves; only legal swaps are shown.`;
  const fragment = document.createDocumentFragment();
  drops.forEach((dropPokemon) => {
    const button = document.createElement("button");
    button.className = "waiver-swap-option";
    button.type = "button";
    button.dataset.swapDrop = dropPokemon.name;
    button.append(orbFor(dropPokemon, "waiver-swap-orb"));
    const name = document.createElement("strong");
    name.textContent = dropPokemon.name;
    const result = document.createElement("small");
    result.textContent = `${rosterPoints() - Number(dropPokemon.points) + Number(pokemon.points)} / ${waiverSettings.pointCap} pts after swap`;
    button.append(name, result);
    fragment.append(button);
  });
  swapOptionsTarget.replaceChildren(fragment);
  swapDialog.showModal();
};

const cardFor = (pokemon) => {
  const card = template.content.firstElementChild.cloneNode(true);
  const detailKey = normalize(pokemon.name).replace(/\s+/g, "");
  const hasMega = detailIndex[detailKey]?.hasMega === true;
  card.dataset.tier = pokemon.tier;
  card.dataset.detailKey = detailKey;
  card.tabIndex = 0;
  card.setAttribute("aria-label", `View ${pokemon.name} moves and abilities${hasMega ? ", and Mega Evolutions" : ""}`);
  card.style.setProperty("--type-one", TYPE_COLORS[pokemon.types[0]] || TYPE_COLORS.Normal);
  card.style.setProperty("--type-two", TYPE_COLORS[pokemon.types[1] || pokemon.types[0]] || TYPE_COLORS.Normal);
  card.querySelector(".tier-symbol").textContent = TIER_SYMBOLS[pokemon.tier];
  card.querySelector(".tier-name").textContent = pokemon.tier;
  card.querySelector(".point-value").textContent = pokemon.points;
  card.querySelector(".pokemon-name").textContent = pokemon.name;
  const sprite = card.querySelector(".pokemon-sprite");
  sprite.src = pokemon.sprite;
  sprite.alt = `${pokemon.name} menu sprite`;
  if (hasMega) card.querySelector(".mega-mark").hidden = false;

  const typeList = card.querySelector(".type-list");
  for (const type of pokemon.types) {
    const badge = document.createElement("span");
    badge.className = "type-badge";
    const icon = document.createElement("img");
    icon.src = `images/types/${type.toLowerCase()}.png`;
    icon.alt = "";
    icon.width = 28;
    icon.height = 28;
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = type;
    badge.append(icon, label);
    typeList.append(badge);
  }

  const addButton = card.querySelector(".waiver-add-button");
  const roster = currentRoster();
  const canAddDirectly = roster.length < waiverSettings.rosterCap
    && rosterPoints() + Number(pokemon.points) <= waiverSettings.pointCap;
  const canSwap = eligibleDrops(pokemon).length > 0;
  const actionsAvailable = Boolean(account) && waiverWindow().open && !actionPending;
  addButton.disabled = !actionsAvailable || (!canAddDirectly && !canSwap);
  addButton.textContent = actionPending ? "Working..." : !account ? "Sign in" : !waiverWindow().open ? "Closed"
    : canAddDirectly ? "Add" : canSwap ? "Add + drop" : roster.length >= waiverSettings.rosterCap ? "Roster full" : "Over cap";
  addButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (addButton.disabled) return;
    if (canAddDirectly) submitTransaction({ addName: pokemon.name });
    else openSwap(pokemon);
  });

  const openDetails = () => window.PokemonDetails?.open(pokemon, card);
  card.addEventListener("click", openDetails);
  card.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === card) {
      event.preventDefault();
      openDetails();
    }
  });
  return card;
};

const matchesSearch = (pokemon, query) => {
  if (!query) return true;
  const searchable = normalize([pokemon.name, ...(pokemon.aliases || []), pokemon.tier,
    pokemon.points, `${pokemon.points} pts`, ...pokemon.types].join(" "));
  return query.split(/\s+/).every((term) => searchable.includes(term));
};

const render = () => {
  const query = normalize(searchInput.value);
  const owners = ownerMap();
  const matches = catalog.filter((pokemon) => !owners.has(normalize(pokemon.name))
    && (activeTier === "All" || pokemon.tier === activeTier) && matchesSearch(pokemon, query));
  const fragment = document.createDocumentFragment();
  for (const pokemon of matches) fragment.append(cardFor(pokemon));
  grid.replaceChildren(fragment);
  grid.setAttribute("aria-busy", "false");
  resultCount.textContent = matches.length;
  emptyState.hidden = matches.length > 0;
  clearButton.hidden = searchInput.value.length === 0;
};

searchInput.addEventListener("input", render);
clearButton.addEventListener("click", () => { searchInput.value = ""; searchInput.focus(); render(); });
for (const button of tierButtons) {
  button.addEventListener("click", () => {
    activeTier = button.dataset.tier;
    tierButtons.forEach((candidate) => {
      const isActive = candidate === button;
      candidate.classList.toggle("is-active", isActive);
      candidate.setAttribute("aria-pressed", String(isActive));
    });
    render();
  });
}

rosterTarget.addEventListener("click", (event) => {
  const button = event.target.closest("[data-drop-pokemon]");
  if (!button || button.disabled) return;
  const name = button.dataset.dropPokemon;
  if (window.confirm(`Drop ${name} from ${account.teamName}?`)) submitTransaction({ dropName: name });
});
swapOptionsTarget.addEventListener("click", (event) => {
  const button = event.target.closest("[data-swap-drop]");
  if (button && pendingAdd && !actionPending) submitTransaction({ addName: pendingAdd, dropName: button.dataset.swapDrop });
});
swapDialog.addEventListener("close", () => { pendingAdd = null; swapOptionsTarget.replaceChildren(); });

Promise.all([
  fetch("data/pokemon-catalog.json?v=season-1-3"),
  fetch("data/pokemon-detail-index.json?v=pokemon-details-1"),
  fetch("data/teams.json?v=teams-2"),
  window.PokeLeagueRosters.read(),
  window.PokeLeagueWaivers.readSettings(),
]).then(async ([catalogResponse, indexResponse, teamsResponse, savedRosters, settings]) => {
  if (!catalogResponse.ok || !indexResponse.ok || !teamsResponse.ok) throw new Error("Could not load the Pokemon roster.");
  const [catalogData, indexData, teamData] = await Promise.all([
    catalogResponse.json(), indexResponse.json(), teamsResponse.json(),
  ]);
  baseCatalog = catalogData;
  catalog = window.PokeLeagueState?.applyCatalog(baseCatalog) || baseCatalog;
  detailIndex = indexData;
  const accounts = teamData.accounts || {};
  teams = Object.values(accounts).map((entry) => ({ id: entry.teamId, name: entry.teamName }));
  const accessCode = String(
    localStorage.getItem("pokeleague.accessCode") || sessionStorage.getItem("pokeleague.accessCode") || "",
  ).trim().toUpperCase();
  account = accounts[accessCode] || null;
  waiverSettings = settings;
  rosterMap = window.PokeLeagueRosters.namesFromSlugs(savedRosters, catalog, teams.map((team) => team.id));
  const state = window.PokeLeagueState.read();
  window.PokeLeagueState.write({ ...state, pointCap: settings.pointCap, totalWeeks: settings.totalWeeks, rosters: rosterMap });
  renderRoster();
  render();
}).catch((error) => {
  grid.setAttribute("aria-busy", "false");
  grid.innerHTML = '<p class="loading-state">The waiver board could not load. Please refresh and try again.</p>';
  rosterTarget.innerHTML = '<p class="waiver-roster-empty">Your roster could not load. Please refresh and try again.</p>';
  announce(error.message || "The waiver board could not load.", true);
});

window.addEventListener("pokeleague:statechange", (event) => {
  if (!baseCatalog.length) return;
  catalog = window.PokeLeagueState?.applyCatalog(baseCatalog, event.detail) || baseCatalog;
  renderRoster();
  render();
});
window.addEventListener("storage", (event) => {
  if (event.key !== window.PokeLeagueState?.storageKey || !baseCatalog.length) return;
  catalog = window.PokeLeagueState.applyCatalog(baseCatalog);
  renderRoster();
  render();
});
