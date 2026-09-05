const TYPE_STYLES = {
  Normal: { icon: "○", color: "#949494" },
  Fighting: { icon: "✊", color: "#e3982d" },
  Flying: { icon: "➶", color: "#80b4d1" },
  Poison: { icon: "●", color: "#8658c4" },
  Ground: { icon: "▰", color: "#a9793f" },
  Rock: { icon: "◆", color: "#b2aa8e" },
  Bug: { icon: "⌘", color: "#9b9818" },
  Ghost: { icon: "◕", color: "#6b416e" },
  Steel: { icon: "◇", color: "#7cb6cc" },
  Fire: { icon: "♨", color: "#dd6c45" },
  Water: { icon: "●", color: "#3796d8" },
  Grass: { icon: "///", color: "#4f9138" },
  Electric: { icon: "ϟ", color: "#e3ba2d" },
  Psychic: { icon: "✦", color: "#dd829a" },
  Ice: { icon: "❄", color: "#62c5c8" },
  Dragon: { icon: "♜", color: "#5575b8" },
  Dark: { icon: "◉", color: "#494342" },
  Fairy: { icon: "✤", color: "#cd90dd" },
};

const TIER_SYMBOLS = {
  Diamond: "◆",
  Gold: "●",
  Silver: "●",
  Bronze: "●",
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
  card.querySelector(".tier-symbol").textContent = TIER_SYMBOLS[pokemon.tier];
  card.querySelector(".tier-name").textContent = pokemon.tier;
  card.querySelector(".point-value").textContent = pokemon.points;
  card.querySelector(".pokemon-name").textContent = pokemon.name;

  const typeList = card.querySelector(".type-list");
  for (const type of pokemon.types) {
    const style = TYPE_STYLES[type] || TYPE_STYLES.Normal;
    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.style.setProperty("--type-color", style.color);
    badge.innerHTML = `<span class="type-icon" aria-hidden="true">${style.icon}</span><span>${type}</span>`;
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

fetch("data/pokemon-catalog.json?v=season-1")
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
