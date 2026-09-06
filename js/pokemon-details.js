(() => {
  const DETAILS_URL = "data/pokemon-details.json?v=pokemon-details-1";
  const DETAIL_TYPE_COLORS = {
    Bug: "#91a119", Dark: "#50413f", Dragon: "#5060e1", Electric: "#fac000",
    Fairy: "#ef70ef", Fighting: "#ff8000", Fire: "#e62829", Flying: "#81b9ef",
    Ghost: "#704170", Grass: "#3fa129", Ground: "#915121", Ice: "#3fd8ff",
    Normal: "#9fa19f", Poison: "#9141cb", Psychic: "#ef4179", Rock: "#afa981",
    Steel: "#60a1b8", Water: "#2980ef",
  };
  let detailsPromise;
  let returnFocusTo;

  const normalize = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const typeSlug = (value) => String(value || "normal").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const ensureDialog = () => {
    let dialog = document.querySelector("#pokemonDetailDialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "pokemonDetailDialog";
    dialog.className = "pokemon-detail-dialog";
    dialog.innerHTML = '<div id="pokemonDetailShell" class="pokemon-detail-shell"></div>';
    document.body.append(dialog);

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("detail-open");
      returnFocusTo?.focus();
    });

    return dialog;
  };

  const loadDetails = () => {
    if (!detailsPromise) {
      detailsPromise = fetch(DETAILS_URL).then((response) => {
        if (!response.ok) throw new Error(`Pokemon details returned ${response.status}`);
        return response.json();
      });
    }
    return detailsPromise;
  };

  const renderTypes = (types = []) => types.map((type) => `
    <span class="detail-type-pill">
      <img src="images/types/${typeSlug(type)}.png" alt="" width="22" height="22">
      ${escapeHtml(type)}
    </span>
  `).join("");

  const renderStats = (forme) => {
    if (!forme?.stats) return "";
    const stats = [
      ["HP", forme.stats.hp],
      ["ATK", forme.stats.attack],
      ["DEF", forme.stats.defense],
      ["SP.A", forme.stats.sp_atk],
      ["SP.D", forme.stats.sp_def],
      ["SPE", forme.stats.speed],
    ];
    return `
      <div class="detail-stat-grid">
        ${stats.map(([label, value]) => `
          <div class="detail-stat"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>
        `).join("")}
      </div>
    `;
  };

  const renderAbilities = (abilities = []) => abilities.map((ability) => `
    <article class="detail-ability">
      <h4>${escapeHtml(ability.name)}</h4>
      ${ability.description ? `<p>${escapeHtml(clean(ability.description))}</p>` : ""}
    </article>
  `).join("");

  const renderDraftRoles = (roles = []) => {
    if (!roles.length) return "";
    return `
      <section class="detail-panel detail-role-panel">
        <h3>Draft Roles</h3>
        <div class="detail-role-list">
          ${roles.map((role) => `<span class="detail-role-chip">${escapeHtml(role)}</span>`).join("")}
        </div>
      </section>
    `;
  };

  const moveMeta = (move) => {
    const pieces = [move.category];
    if (move.power) pieces.push(`${move.power} power`);
    if (move.accuracy) pieces.push(`${move.accuracy}% accuracy`);
    if (move.pp) pieces.push(`${move.pp} PP`);
    if (move.priority) pieces.push(`Priority ${move.priority}`);
    return pieces.filter(Boolean).join(" · ");
  };

  const renderMoves = (moves) => {
    if (!moves.length) return '<p class="detail-no-results">No moves match that search.</p>';
    return moves.map((move) => `
      <article class="detail-move" data-type="${escapeHtml(typeSlug(move.type))}">
        <div class="detail-move-heading">
          <h4>${escapeHtml(move.name)}</h4>
          ${move.type ? `<span class="detail-move-type">${escapeHtml(move.type)}</span>` : ""}
        </div>
        ${moveMeta(move) ? `<p class="detail-move-meta">${escapeHtml(moveMeta(move))}</p>` : ""}
        ${move.description ? `<p>${escapeHtml(clean(move.description))}</p>` : ""}
      </article>
    `).join("");
  };

  const findBaseForme = (pokemon, detail) => (
    detail.formes?.find((forme) => normalize(forme.name) === normalize(pokemon.name))
    || detail.formes?.find((forme) => !/-Mega(?:-|$)/i.test(forme.name))
    || detail.formes?.[0]
  );

  const renderMegaForms = (formes) => {
    if (!formes.length) return "";
    return `
      <section class="detail-panel detail-mega-panel">
        <div class="detail-section-title"><img class="detail-mega-sigil" src="images/icons/mega-evolution-v2.webp?v=mega2" alt="" width="34" height="34"><h3>Mega Evolutions</h3></div>
        <div class="detail-mega-list">
          ${formes.map((forme) => `
            <article class="detail-mega-card">
              <div>
                <h4>${escapeHtml(forme.name.replace(/-/g, " "))}</h4>
                <div class="detail-types">${renderTypes(forme.types)}</div>
              </div>
              ${forme.bst ? `<span class="detail-bst"><strong>${escapeHtml(forme.bst)}</strong> BST</span>` : ""}
              ${renderStats(forme)}
              ${forme.abilities?.length ? `<p class="detail-mega-ability"><strong>Ability:</strong> ${escapeHtml(forme.abilities.map((ability) => ability.name).join(", "))}</p>` : ""}
            </article>
          `).join("")}
        </div>
      </section>
    `;
  };

  const renderDetail = (pokemon, detail) => {
    const baseForme = findBaseForme(pokemon, detail);
    const megaForms = (detail.formes || []).filter((forme) => /-Mega(?:-|$)/i.test(forme.name));
    const moveTypes = [...new Set((detail.moves || []).map((move) => move.type).filter(Boolean))].sort();

    return `
      <div class="detail-top-stripe" aria-hidden="true"></div>
      <header class="detail-header">
        <div class="detail-portrait"><img src="${escapeHtml(pokemon.sprite)}" alt="${escapeHtml(pokemon.name)} menu sprite"></div>
        <div class="detail-heading-copy">
          <p class="detail-kicker">${escapeHtml(pokemon.tier)} · ${escapeHtml(pokemon.points)} PTS</p>
          <h2 id="pokemonDetailTitle">${escapeHtml(pokemon.name)}</h2>
          <div class="detail-types">${renderTypes(baseForme?.types || pokemon.types)}</div>
        </div>
        <button class="detail-close" type="button" aria-label="Close Pokemon details">×</button>
      </header>

      <div class="detail-content">
        <aside class="detail-sidebar">
          ${renderDraftRoles(pokemon.draftRoles)}
          <section class="detail-panel">
            <h3>Abilities</h3>
            <div class="detail-ability-list">${renderAbilities(baseForme?.abilities || detail.abilities)}</div>
          </section>
          <section class="detail-panel">
            <div class="detail-section-title"><h3>Base Stats</h3>${baseForme?.bst ? `<span class="detail-bst"><strong>${escapeHtml(baseForme.bst)}</strong> BST</span>` : ""}</div>
            ${renderStats(baseForme)}
          </section>
          ${renderMegaForms(megaForms)}
        </aside>

        <section class="detail-panel detail-moves-panel">
          <div class="detail-section-title">
            <h3>Move List</h3>
            <span id="detailMoveCount" class="detail-count">${detail.moves.length} moves</span>
          </div>
          <div class="detail-move-tools">
            <label class="visually-hidden" for="detailMoveSearch">Search moves</label>
            <input id="detailMoveSearch" type="search" placeholder="Search moves..." autocomplete="off">
            <label class="visually-hidden" for="detailMoveType">Filter moves by type</label>
            <select id="detailMoveType">
              <option value="all">All types</option>
              ${moveTypes.map((type) => `<option value="${escapeHtml(typeSlug(type))}">${escapeHtml(type)}</option>`).join("")}
            </select>
          </div>
          <div id="detailMoveList" class="detail-move-list">${renderMoves(detail.moves || [])}</div>
        </section>
      </div>
    `;
  };

  const bindControls = (detail, dialog) => {
    dialog.querySelector(".detail-close")?.addEventListener("click", () => dialog.close());
    const search = dialog.querySelector("#detailMoveSearch");
    const type = dialog.querySelector("#detailMoveType");
    const list = dialog.querySelector("#detailMoveList");
    const count = dialog.querySelector("#detailMoveCount");
    const moves = detail.moves || [];

    const filterMoves = () => {
      const term = search.value.trim().toLowerCase();
      const selectedType = type.value;
      const filtered = moves.filter((move) => {
        const searchText = [move.name, move.type, move.category, move.description].join(" ").toLowerCase();
        return (!term || searchText.includes(term))
          && (selectedType === "all" || typeSlug(move.type) === selectedType);
      });
      list.innerHTML = renderMoves(filtered);
      count.textContent = `${filtered.length} ${filtered.length === 1 ? "move" : "moves"}`;
    };

    search.addEventListener("input", filterMoves);
    type.addEventListener("change", filterMoves);
  };

  const renderLoading = (pokemon) => `
    <div class="detail-loading">
      <img src="${escapeHtml(pokemon.sprite)}" alt="" width="92" height="92">
      <p>Loading ${escapeHtml(pokemon.name)}...</p>
    </div>
  `;

  const open = async (pokemon, trigger) => {
    const dialog = ensureDialog();
    const shell = dialog.querySelector("#pokemonDetailShell");
    returnFocusTo = trigger;
    dialog.style.setProperty("--detail-type-one", DETAIL_TYPE_COLORS[pokemon.types[0]]);
    dialog.style.setProperty("--detail-type-two", DETAIL_TYPE_COLORS[pokemon.types[1] || pokemon.types[0]]);
    shell.innerHTML = renderLoading(pokemon);
    document.body.classList.add("detail-open");
    if (!dialog.open) dialog.showModal();

    try {
      const data = await loadDetails();
      const detail = data.pokemon?.[normalize(pokemon.name)];
      if (!detail) throw new Error(`No details found for ${pokemon.name}`);
      shell.innerHTML = renderDetail(pokemon, detail);
      bindControls(detail, dialog);
      dialog.querySelector(".detail-close")?.focus();
    } catch (error) {
      console.error(error);
      shell.innerHTML = `
        <div class="detail-error">
          <button class="detail-close" type="button" aria-label="Close Pokemon details">×</button>
          <h2>Details unavailable</h2>
          <p>Please refresh and try again.</p>
        </div>
      `;
      dialog.querySelector(".detail-close")?.addEventListener("click", () => dialog.close());
    }
  };

  window.PokemonDetails = { open };
})();
