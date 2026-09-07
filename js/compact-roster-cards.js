(() => {
  const TIER_SYMBOLS = { Diamond: "◆", Gold: "●", Silver: "●", Bronze: "●" };
  const TYPE_COLORS = {
    Bug: "#91a119", Dark: "#50413f", Dragon: "#5060e1", Electric: "#fac000",
    Fairy: "#ef70ef", Fighting: "#ff8000", Fire: "#e62829", Flying: "#81b9ef",
    Ghost: "#704170", Grass: "#3fa129", Ground: "#915121", Ice: "#3fd8ff",
    Normal: "#9fa19f", Poison: "#9141cb", Psychic: "#ef4179", Rock: "#afa981",
    Steel: "#60a1b8", Water: "#2980ef",
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const detailKey = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");

  const renderType = (type) => `
    <span class="compact-type-badge">
      <img src="images/types/${escapeHtml(String(type).toLowerCase())}.png" alt="" aria-hidden="true" loading="lazy">
      <span>${escapeHtml(type)}</span>
    </span>`;

  const render = (pokemon, detailIndex = {}) => {
    const types = Array.isArray(pokemon?.types) && pokemon.types.length ? pokemon.types : ["Normal"];
    const tier = pokemon?.tier || "Bronze";
    const typeOne = TYPE_COLORS[types[0]] || TYPE_COLORS.Normal;
    const typeTwo = TYPE_COLORS[types[1] || types[0]] || TYPE_COLORS.Normal;
    const hasMega = detailIndex?.[detailKey(pokemon?.name)]?.hasMega === true;
    return `
      <article class="compact-pokemon-card" data-tier="${escapeHtml(tier)}"
        style="--type-one:${typeOne};--type-two:${typeTwo}">
        <span class="compact-card-halftone" aria-hidden="true"></span>
        <span class="compact-tier-label"><span aria-hidden="true">${TIER_SYMBOLS[tier] || "●"}</span>${escapeHtml(tier)}</span>
        <span class="compact-point-badge"><strong>${escapeHtml(pokemon?.points)}</strong><span>PTS</span></span>
        ${hasMega ? '<span class="compact-mega-mark" title="Mega Evolution available"><img src="images/icons/mega-evolution-v2.webp?v=mega2" alt=""><span class="visually-hidden">Mega Evolution available</span></span>' : ""}
        <span class="compact-sprite-stage"><img src="${escapeHtml(pokemon?.sprite)}" alt="" loading="lazy" decoding="async"></span>
        <span class="compact-card-copy">
          <strong>${escapeHtml(pokemon?.name)}</strong>
          <span class="compact-type-list">${types.map(renderType).join("")}</span>
        </span>
      </article>`;
  };

  window.PokeLeagueRosterCards = { render, detailKey };
})();
