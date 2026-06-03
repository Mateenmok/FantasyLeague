(function () {
  const POKEMON_LIST_URL = "data/champions-pokemon.json?v=garchomp9";
  const CHAMPIONS_DETAILS_URL = "data/champions-details.json?v=champions-details2";
  const IMAGE_OVERRIDES = {
    "galarian-slowbro": "images/pokemon-fixes/galarian-slowbro.png",
    "slowbro-galarian": "images/pokemon-fixes/galarian-slowbro.png",
    "galarian-slowking": "images/pokemon-fixes/galarian-slowking.png",
    "slowking-galarian": "images/pokemon-fixes/galarian-slowking.png",
    "galarian-stunfisk": "images/pokemon-fixes/galarian-stunfisk.png",
    "stunfisk-galarian": "images/pokemon-fixes/galarian-stunfisk.png",
    "alolan-raichu": "images/pokemon-fixes/alolan-raichu.png",
    "raichu-alolan": "images/pokemon-fixes/alolan-raichu.png",
    "alolan-ninetales": "images/pokemon-fixes/alolan-ninetales.png",
    "ninetales-alolan": "images/pokemon-fixes/alolan-ninetales.png",
    "water-tauros": "images/pokemon-fixes/water-tauros.png",
    "tauros-water": "images/pokemon-fixes/water-tauros.png",
    "paldean-tauros-water": "images/pokemon-fixes/water-tauros.png",
    "tauros-paldea-aqua": "images/pokemon-fixes/water-tauros.png",
    "tauros-aqua": "images/pokemon-fixes/water-tauros.png",
    "fire-tauros": "images/pokemon-fixes/fire-tauros.png",
    "tauros-fire": "images/pokemon-fixes/fire-tauros.png",
    "paldean-tauros-fire": "images/pokemon-fixes/fire-tauros.png",
    "tauros-paldea-blaze": "images/pokemon-fixes/fire-tauros.png",
    "tauros-blaze": "images/pokemon-fixes/fire-tauros.png"
  };

  let pokemonListPromise = null;
  let championsDetailsPromise = null;

  function normalizeImageKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getFixedPokemonImage(pokemon) {
    if (!pokemon) {
      return "";
    }

    const keys = [
      pokemon.slug,
      pokemon.name,
      pokemon.ranked_name,
      pokemon.display_name,
      pokemon.species,
      pokemon.form
    ].map(normalizeImageKey).filter(Boolean);

    const combined = keys.join("-");

    for (const key of keys) {
      if (IMAGE_OVERRIDES[key]) {
        return IMAGE_OVERRIDES[key];
      }
    }

    if (combined.includes("galarian-slowbro") || combined.includes("slowbro-galarian")) {
      return IMAGE_OVERRIDES["galarian-slowbro"];
    }

    if (combined.includes("galarian-slowking") || combined.includes("slowking-galarian")) {
      return IMAGE_OVERRIDES["galarian-slowking"];
    }

    if (combined.includes("galarian-stunfisk") || combined.includes("stunfisk-galarian")) {
      return IMAGE_OVERRIDES["galarian-stunfisk"];
    }

    if (combined.includes("alolan-raichu") || combined.includes("raichu-alolan")) {
      return IMAGE_OVERRIDES["alolan-raichu"];
    }

    if (combined.includes("alolan-ninetales") || combined.includes("ninetales-alolan")) {
      return IMAGE_OVERRIDES["alolan-ninetales"];
    }

    if (combined.includes("tauros") && (combined.includes("water") || combined.includes("aqua"))) {
      return IMAGE_OVERRIDES["water-tauros"];
    }

    if (combined.includes("tauros") && (combined.includes("fire") || combined.includes("blaze"))) {
      return IMAGE_OVERRIDES["fire-tauros"];
    }

    return pokemon.image || pokemon.img || pokemon.icon || pokemon.sprite || pokemon.artwork || "";
  }

  function getTypeSlug(type) {
    return String(type || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown";
  }

  function ensureModal() {
    let modal = document.getElementById("pokemonDetailsModal");

    if (modal) {
      return modal;
    }

    modal = document.createElement("div");
    modal.id = "pokemonDetailsModal";
    modal.className = "pokemon-details-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="pokemon-details-dialog" role="dialog" aria-modal="true" aria-labelledby="pokemonDetailsTitle">
        <div id="pokemonDetailsShell"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        close();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("open")) {
        close();
      }
    });

    return modal;
  }

  function getShell() {
    return ensureModal().querySelector("#pokemonDetailsShell");
  }

  function openModal() {
    const modal = ensureModal();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function close() {
    const modal = document.getElementById("pokemonDetailsModal");

    if (!modal) {
      return;
    }

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  async function loadPokemonList() {
    if (!pokemonListPromise) {
      pokemonListPromise = fetch(POKEMON_LIST_URL).then(response => {
        if (!response.ok) {
          throw new Error(`Pokemon list returned ${response.status}`);
        }
        return response.json();
      });
    }

    return pokemonListPromise;
  }

  async function loadChampionsDetails() {
    if (!championsDetailsPromise) {
      championsDetailsPromise = fetch(CHAMPIONS_DETAILS_URL).then(response => {
        if (!response.ok) {
          throw new Error(`Champions details returned ${response.status}`);
        }
        return response.json();
      });
    }

    return championsDetailsPromise;
  }

  async function openBySlug(slug) {
    const safeSlug = String(slug || "").trim();

    if (!safeSlug) {
      return;
    }

    openModal();
    getShell().innerHTML = renderLoading({ name: "Pokemon", slug: safeSlug });

    try {
      const [pokemonList, detailsData] = await Promise.all([
        loadPokemonList(),
        loadChampionsDetails()
      ]);
      const pokemon = pokemonList.find(row => row.slug === safeSlug) || { name: safeSlug, slug: safeSlug };
      const detail = detailsData.pokemon?.[safeSlug];

      if (!detail) {
        throw new Error(`No Champions details found for ${safeSlug}`);
      }

      getShell().innerHTML = renderDetails(pokemon, detail);
      bindModalControls(detail);
    } catch (error) {
      console.error("Pokemon detail load error:", error);
      getShell().innerHTML = renderError({ name: safeSlug, slug: safeSlug });
      bindModalControls({ moves: [] });
    }
  }

  function renderLoading(pokemon) {
    return `
      ${renderHeader(pokemon)}
      <div class="pokemon-details-body">
        <section class="pokemon-details-section">
          <h3>Loading Champions data...</h3>
          <p class="pokemon-details-note">Opening the local Champions moves and abilities file.</p>
        </section>
      </div>
    `;
  }

  function renderError(pokemon) {
    return `
      ${renderHeader(pokemon)}
      <div class="pokemon-details-body">
        <section class="pokemon-details-section">
          <h3>Could not load details</h3>
          <p class="pokemon-details-note">Champions data was not found for this Pokemon.</p>
        </section>
      </div>
    `;
  }

  function renderDetails(pokemon, detail) {
    return `
      ${renderHeader(pokemon)}
      <div class="pokemon-details-body">
        <aside class="pokemon-details-side">
          <section class="pokemon-details-section">
            <h3>Abilities</h3>
            <div class="pokemon-details-list">
              ${renderAbilityPills(detail.abilities || [])}
            </div>
          </section>

          ${(detail.formes || []).length > 1 ? `
            <section class="pokemon-details-section">
              <h3>In-Battle Formes</h3>
              <div class="pokemon-details-list">
                ${detail.formes.map(forme => `
                  <div class="pokemon-details-pill">
                    ${escapeHtml(forme.name)}
                    <small>${escapeHtml(formatFormeMeta(forme))}</small>
                    ${forme.abilities?.length ? `<small>${escapeHtml(forme.abilities.map(ability => ability.name).join(", "))}</small>` : ""}
                  </div>
                `).join("")}
              </div>
            </section>
          ` : ""}
        </aside>

        <section class="pokemon-details-section pokemon-details-moves-panel">
          <div class="pokemon-details-title-row">
            <h3>Champions Moves</h3>
            <span class="pokemon-details-count">${(detail.moves || []).length} moves</span>
          </div>
          <div class="pokemon-move-tools">
            <input id="pokemonMoveSearchInput" type="search" placeholder="Search moves">
            <select id="pokemonMoveCategorySelect">
              <option value="all">All categories</option>
              ${getMoveCategories(detail.moves || []).map(category => `
                <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
              `).join("")}
            </select>
            <select id="pokemonMoveTypeSelect">
              <option value="all">All types</option>
              ${getMoveTypes(detail.moves || []).map(type => `
                <option value="${escapeHtml(type)}">${escapeHtml(type)}</option>
              `).join("")}
            </select>
          </div>
          <div id="pokemonMoveList" class="pokemon-move-list">
            ${renderMoveRows(detail.moves || [])}
          </div>
        </section>
      </div>
    `;
  }

  function renderHeader(pokemon) {
    const types = pokemon.types || [];
    const tierText = pokemon.tier_label || `${pokemon.tier || ""} ${pokemon.points || ""}`.trim();
    const metaParts = [types.join(" / "), tierText].filter(Boolean);

    return `
      <header class="pokemon-details-header">
        <img src="${escapeHtml(getFixedPokemonImage(pokemon))}" alt="${escapeHtml(pokemon.name || "Pokemon")}">
        <div>
          <h2 id="pokemonDetailsTitle">${escapeHtml(pokemon.name || pokemon.slug || "Pokemon")}</h2>
          <p>${escapeHtml(metaParts.join(" - "))}</p>
        </div>
        <button class="pokemon-details-close" type="button" aria-label="Close Pokemon details">&times;</button>
      </header>
    `;
  }

  function bindModalControls(detail) {
    const closeButton = document.querySelector(".pokemon-details-close");
    const searchInput = document.getElementById("pokemonMoveSearchInput");
    const categorySelect = document.getElementById("pokemonMoveCategorySelect");
    const typeSelect = document.getElementById("pokemonMoveTypeSelect");
    const moveList = document.getElementById("pokemonMoveList");
    const moves = detail.moves || [];

    if (closeButton) {
      closeButton.addEventListener("click", close);
    }

    if (!searchInput || !categorySelect || !typeSelect || !moveList) {
      return;
    }

    function renderFilteredMoves() {
      const searchTerm = searchInput.value.trim().toLowerCase();
      const category = categorySelect.value;
      const type = typeSelect.value;
      const filteredMoves = moves.filter(move => {
        const searchText = [move.name, move.type, move.category, move.description].join(" ").toLowerCase();
        const matchesSearch = !searchTerm || searchText.includes(searchTerm);
        const matchesCategory = category === "all" || move.category === category;
        const matchesType = type === "all" || move.type === type;
        return matchesSearch && matchesCategory && matchesType;
      });

      moveList.innerHTML = renderMoveRows(filteredMoves);
    }

    searchInput.addEventListener("input", renderFilteredMoves);
    categorySelect.addEventListener("change", renderFilteredMoves);
    typeSelect.addEventListener("change", renderFilteredMoves);
  }

  function renderAbilityPills(abilities) {
    if (!abilities.length) {
      return `<div class="pokemon-details-pill">No abilities listed.</div>`;
    }

    return abilities.map(ability => `
      <div class="pokemon-details-pill">
        ${escapeHtml(ability.name)}
        ${ability.description ? `<small>${escapeHtml(cleanText(ability.description))}</small>` : ""}
      </div>
    `).join("");
  }

  function renderMoveRows(moves) {
    if (!moves.length) {
      return `<div class="pokemon-move-row">No moves found.</div>`;
    }

    return moves.map(move => {
      const typeSlug = getTypeSlug(move.type);

      return `
        <div class="pokemon-move-row pokemon-move-type-${typeSlug}">
          <div class="pokemon-move-top">
            <strong>${escapeHtml(move.name)}</strong>
            ${move.type ? `<span class="pokemon-move-type-badge">${escapeHtml(move.type)}</span>` : ""}
          </div>
          <small>${escapeHtml(formatMoveMeta(move))}</small>
          ${move.description ? `<p>${escapeHtml(cleanText(move.description))}</p>` : ""}
        </div>
      `;
    }).join("");
  }

  function formatMoveMeta(move) {
    const parts = [];

    if (move.category) {
      parts.push(move.category);
    }

    parts.push(move.power ? `${move.power} BP` : "Status");
    parts.push(move.accuracy ? `${move.accuracy}% Acc` : "No accuracy check");

    if (move.pp) {
      parts.push(`${move.pp} PP`);
    }

    if (move.priority) {
      parts.push(`Priority ${move.priority}`);
    }

    return parts.join(" - ") || "Champions move";
  }

  function formatFormeMeta(forme) {
    const parts = [];

    if (forme.types?.length) {
      parts.push(forme.types.join(" / "));
    }

    if (forme.tier) {
      parts.push(forme.tier);
    }

    if (forme.bst) {
      parts.push(`BST ${forme.bst}`);
    }

    return parts.join(" - ");
  }

  function getMoveCategories(moves) {
    return Array.from(new Set(moves.map(move => move.category).filter(Boolean))).sort();
  }

  function getMoveTypes(moves) {
    return Array.from(new Set(moves.map(move => move.type).filter(Boolean))).sort();
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.PokemonDetailsModal = {
    openBySlug,
    close
  };
})();
