const TIER_SYMBOLS = {
  Diamond: "◆",
  Gold: "●",
  Silver: "●",
  Bronze: "●",
};

const TYPE_COLORS = {
  Bug: "#91a119",
  Dark: "#50413f",
  Dragon: "#5060e1",
  Electric: "#fac000",
  Fairy: "#ef70ef",
  Fighting: "#ff8000",
  Fire: "#e62829",
  Flying: "#81b9ef",
  Ghost: "#704170",
  Grass: "#3fa129",
  Ground: "#915121",
  Ice: "#3fd8ff",
  Normal: "#9fa19f",
  Poison: "#9141cb",
  Psychic: "#ef4179",
  Rock: "#afa981",
  Steel: "#60a1b8",
  Water: "#2980ef",
};

const searchInput = document.querySelector("#pokemonSearch");
const clearButton = document.querySelector("#clearSearch");
const grid = document.querySelector("#pokemonGrid");
const resultCount = document.querySelector("#resultCount");
const emptyState = document.querySelector("#emptyState");
const template = document.querySelector("#pokemonCardTemplate");
const tierButtons = [...document.querySelectorAll(".tier-filter")];

let catalog = [];
let activeTier = "All";

const normalize = (value) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const cardFor = (pokemon) => {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.tier = pokemon.tier;
  card.style.setProperty("--type-one", TYPE_COLORS[pokemon.types[0]]);
  card.style.setProperty("--type-two", TYPE_COLORS[pokemon.types[1] || pokemon.types[0]]);
  card.querySelector(".tier-symbol").textContent = TIER_SYMBOLS[pokemon.tier];
  card.querySelector(".tier-name").textContent = pokemon.tier;
  card.querySelector(".point-value").textContent = pokemon.points;
  card.querySelector(".pokemon-name").textContent = pokemon.name;
  const sprite = card.querySelector(".pokemon-sprite");
  sprite.src = pokemon.sprite;
  sprite.alt = `${pokemon.name} menu sprite`;

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

  const note = card.querySelector(".condition-note");
  if (pokemon.note) {
    note.textContent = pokemon.note;
  } else {
    note.remove();
  }

  return card;
};

const matchesSearch = (pokemon, query) => {
  if (!query) return true;

  const searchable = normalize([
    pokemon.name,
    ...(pokemon.aliases || []),
    pokemon.tier,
    pokemon.points,
    `${pokemon.points} pts`,
    ...pokemon.types,
    pokemon.note,
  ].join(" "));

  return query.split(/\s+/).every((term) => searchable.includes(term));
};

const render = () => {
  const query = normalize(searchInput.value);
  const matches = catalog.filter((pokemon) => (
    (activeTier === "All" || pokemon.tier === activeTier)
    && matchesSearch(pokemon, query)
  ));

  const fragment = document.createDocumentFragment();
  for (const pokemon of matches) fragment.append(cardFor(pokemon));

  grid.replaceChildren(fragment);
  grid.setAttribute("aria-busy", "false");
  resultCount.textContent = matches.length;
  emptyState.hidden = matches.length > 0;
  clearButton.hidden = searchInput.value.length === 0;
};

searchInput.addEventListener("input", render);
clearButton.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  render();
});

for (const button of tierButtons) {
  button.addEventListener("click", () => {
    activeTier = button.dataset.tier;
    for (const candidate of tierButtons) {
      const isActive = candidate === button;
      candidate.classList.toggle("is-active", isActive);
      candidate.setAttribute("aria-pressed", String(isActive));
    }
    render();
  });
}

fetch("data/pokemon-catalog.json?v=season-1-2")
  .then((response) => {
    if (!response.ok) throw new Error("Could not load the Pokemon roster.");
    return response.json();
  })
  .then((data) => {
    catalog = data;
    render();
  })
  .catch(() => {
    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = '<p class="loading-state">The roster could not load. Please refresh and try again.</p>';
  });
