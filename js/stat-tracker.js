(() => {
  const ENDPOINT = "https://cgvxehwqoviihxndupoj.supabase.co/functions/v1/stat-tracker";
  const panel = document.querySelector("[data-mvp-watch]");
  const page = document.querySelector("[data-stat-tracker]");
  if (!panel && !page) return;
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const normalize = value => String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  const slug = value => window.PokeLeagueRosters.slugify(value);
  const numeric = value => typeof value === "number" && Number.isFinite(value);
  const cacheKey = id => `pokeleague.statTracker.v1.${id}`;
  const timeout = (promise, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
  let teams = [], catalog = [], owners = [], nicknames = {}, sheetData = null;
  let selected = new URLSearchParams(location.search).get("team") || "all";
  let sortColumn = "IMP", sortDirection = -1, generation = 0, activeRequest = false;
  let nicknameUnavailable = false;

  async function json(url) {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Could not load the tracker.");
    return response.json();
  }
  function stored(id) {
    try {
      const saved = JSON.parse(localStorage.getItem(cacheKey(id)));
      return saved?.sheet === id && Array.isArray(saved.rows) && Array.isArray(saved.columns) && saved.fetchedAt ? saved : null;
    } catch { return null; }
  }
  async function loadSheet(id) {
    try {
      const data = await json(`${ENDPOINT}?sheet=${encodeURIComponent(id)}`);
      if (data.sheet !== id || !Array.isArray(data.rows) || !Array.isArray(data.columns)) throw new Error("Invalid tracker data.");
      try { localStorage.setItem(cacheKey(id), JSON.stringify(data)); } catch { /* Private browsing may disable storage. */ }
      return data;
    } catch (error) {
      const saved = stored(id);
      if (saved) return { ...saved, stale: true };
      throw error;
    }
  }
  const value = (row, key, data = sheetData) => row[data.columns.indexOf(key)]?.value;
  const display = (row, key, data = sheetData) => row[data.columns.indexOf(key)]?.display || "—";
  function identity(row, data = sheetData) {
    const teamName = value(row, "Team", data) || data.title;
    const team = teams.find(item => normalize(item.name) === normalize(teamName));
    const pokemonName = value(row, "Pokemon", data) || "Unknown Pokémon";
    const pokemon = catalog.find(item => [item.name, ...(item.aliases || [])].some(name => normalize(name) === normalize(pokemonName)));
    const owner = owners.find(item => item.teamId === team?.id);
    return { teamName, team, pokemonName, pokemon, nickname: nicknames[team?.id]?.[slug(pokemon?.name || pokemonName)] || "",
      accent: owner?.theme?.accent || "#70e3ff", deep: owner?.theme?.deep || "#183844",
      highlight: owner?.theme?.highlight || owner?.theme?.accent || "#70e3ff" };
  }
  const colors = item => `--mvp-accent:${escape(item.accent)};--mvp-deep:${escape(item.deep)};--mvp-highlight:${escape(item.highlight)}`;
  function portrait(item) {
    return `<img class="stat-sprite" src="${escape(item.pokemon?.sprite || "images/favicon.webp")}" alt="" width="64" height="64" loading="lazy">`;
  }
  function nameMarkup(item) {
    return `<strong>${escape(item.nickname || item.pokemonName)}</strong>${item.nickname ? `<small>${escape(item.pokemonName)}</small>` : ""}`;
  }
  function syncStatus(data) {
    const time = new Date(data.fetchedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `${data.stale ? "Sync unavailable · Last synced" : "Synced"} ${time}${nicknameUnavailable ? " · Nicknames unavailable" : ""}`;
  }
  function renderWatch(data) {
    const ranked = data.rows.map((row, index) => ({ row, index }))
      .filter(({ row }) => numeric(value(row, "IMP", data)))
      .sort((a, b) => value(b.row, "IMP", data) - value(a.row, "IMP", data) || a.index - b.index).slice(0, 5);
    panel.querySelector("[data-mvp-rows]").innerHTML = ranked.map(({ row }, index) => {
      const item = identity(row, data);
      return `<li class="mvp-entry" style="${colors(item)}"><span class="mvp-place">${index + 1}</span>
        ${portrait(item)}<span class="mvp-player">${nameMarkup(item)}<span class="mvp-team">${escape(item.teamName)}</span></span>
        <span class="mvp-score"><strong>${Number(value(row, "IMP", data)).toFixed(2)}</strong><small>IMP</small></span></li>`;
    }).join("") || '<li class="tracker-empty">No scored Pokémon yet.</li>';
    panel.querySelector("[data-mvp-sync]").textContent = syncStatus(data);
  }
  function renderGuide() {
    page.querySelector("[data-stat-table]").hidden = true;
    page.querySelector("[data-stat-filters]").hidden = true;
    const guide = page.querySelector("[data-stat-guide]");
    guide.hidden = false;
    guide.innerHTML = sheetData.rows.map(row => {
      const cells = row.map(cell => cell.display);
      if (!cells.slice(1).some(Boolean)) return `<h2 class="stat-guide-section">${escape(cells[0])}</h2>`;
      return `<article class="stat-guide-card"><h3>${escape(cells[0])}</h3>${cells[1] ? `<p class="stat-guide-name">${escape(cells[1])}</p>` : ""}
        ${cells[2] ? `<p>${escape(cells[2])}</p>` : ""}${cells[3] ? `<p>${escape(cells[3])}</p>` : ""}
        ${cells[4] ? `<span class="stat-guide-score">${escape(cells[4])}</span>` : ""}</article>`;
    }).join("");
    page.querySelector("[data-stat-count]").textContent = "How the league tracks every contribution.";
  }
  function renderTable() {
    if (!sheetData) return;
    if (sheetData.sheet === "guide") return renderGuide();
    page.querySelector("[data-stat-guide]").hidden = true;
    page.querySelector("[data-stat-table]").hidden = false;
    page.querySelector("[data-stat-filters]").hidden = false;
    const query = normalize(page.querySelector("[data-stat-search]").value);
    const status = page.querySelector("[data-stat-roster-status]").value;
    const rows = sheetData.rows.map((row, index) => ({ row, index, item: identity(row) }))
      .filter(({ row, item }) => (!status || value(row, "Status") === status) && (!query || normalize(`${item.pokemonName} ${item.nickname} ${item.teamName}`).includes(query)))
      .sort((a, b) => {
        const av = value(a.row, sortColumn), bv = value(b.row, sortColumn);
        if (av == null || bv == null) return av == null ? (bv == null ? a.index - b.index : 1) : -1;
        return (numeric(av) && numeric(bv) ? av - bv : String(av).localeCompare(String(bv))) * sortDirection || a.index - b.index;
      });
    // Pokémon stays visible while the full sheet's stat columns scroll on small screens.
    const columns = ["Pokemon", ...sheetData.columns.filter(name => name !== "Pokemon")];
    page.querySelector("thead").innerHTML = `<tr>${columns.map(key => `<th scope="col" ${sortColumn === key ? `aria-sort="${sortDirection === -1 ? "descending" : "ascending"}"` : ""}><button type="button" data-stat-sort="${escape(key)}">${escape(key)}${sortColumn === key ? (sortDirection === -1 ? " ↓" : " ↑") : ""}</button></th>`).join("")}</tr>`;
    page.querySelector("tbody").innerHTML = rows.map(({ row, item }) => `<tr style="${colors(item)}">${columns.map(key => {
      if (key === "Pokemon") return `<th scope="row"><span class="stat-pokemon">${portrait(item)}<span>${nameMarkup(item)}</span></span></th>`;
      if (key === "Team") return `<td class="stat-team-cell">${item.team ? `<a href="stat-tracker.html?team=${encodeURIComponent(item.team.id)}"><img src="${escape(item.team.logo)}" alt="" width="26" height="26">${escape(item.teamName)}</a>` : escape(item.teamName)}</td>`;
      if (key === "Status") return `<td><span class="stat-roster-status ${value(row, key) === "Dropped" ? "is-dropped" : ""}">${escape(display(row, key))}</span></td>`;
      return `<td class="${key === "IMP" ? "stat-impact" : ""}">${escape(display(row, key))}</td>`;
    }).join("")}</tr>`).join("") || `<tr><td colspan="${columns.length}" class="tracker-empty">No Pokémon match these filters.</td></tr>`;
    page.querySelector("[data-stat-count]").textContent = `${rows.length} Pokémon · ${sheetData.title} · Select a column to sort`;
  }
  function renderPage(data) {
    sheetData = data;
    const select = page.querySelector("[data-stat-view]");
    if (!select.options.length) {
      select.innerHTML = data.sheets.map(sheet => `<option value="${escape(sheet.id)}">${escape(sheet.name)}</option>`).join("");
    }
    select.value = data.sheet;
    page.querySelector("[data-stat-sync]").textContent = syncStatus(data);
    page.querySelector("[data-stat-view-title]").textContent = data.title;
    renderTable();
  }
  async function refresh(force = false) {
    if (activeRequest && !force) return;
    const request = ++generation;
    activeRequest = true;
    const button = page?.querySelector("[data-stat-refresh]");
    if (button) button.disabled = true;
    try {
      const [data] = await Promise.all([loadSheet(page ? selected : "all"),
        timeout(window.PokeLeagueRosters.readNicknames(), 12000).then(result => { nicknames = result; nicknameUnavailable = false; })
          .catch(() => { nicknameUnavailable = true; })]);
      if (request !== generation) return;
      if (panel) renderWatch(data);
      if (page) renderPage(data);
    } catch {
      if (request !== generation) return;
      const status = (page || panel).querySelector(page ? "[data-stat-sync]" : "[data-mvp-sync]");
      status.textContent = "Tracker sync unavailable. Please try again shortly.";
      if (page && sheetData?.sheet !== selected) {
        sheetData = null;
        page.querySelector("[data-stat-table]").hidden = true;
        page.querySelector("[data-stat-guide]").hidden = true;
        page.querySelector("[data-stat-count]").textContent = "This view could not be loaded. Use Refresh to retry.";
      }
      if (panel && !panel.querySelector(".mvp-entry")) panel.querySelector("[data-mvp-rows]").innerHTML = '<li class="tracker-empty">Stats are temporarily unavailable. Open the tracker to retry.</li>';
    } finally {
      if (request === generation) { activeRequest = false; if (button) button.disabled = false; }
    }
  }
  async function initialize() {
    try {
      const [teamData, accountData, pokemonData] = await Promise.all([
        json("data/league-teams.json"), json("data/teams.json"), json("data/pokemon-catalog.json"),
      ]);
      teams = teamData.teams || []; owners = Object.values(accountData.accounts || {}); catalog = pokemonData;
    } catch { /* Stats remain usable if optional team artwork is unavailable. */ }
    if (!["all", "guide", ...teams.map(team => team.id)].includes(selected)) selected = "all";
    if (page) {
      page.querySelector("[data-stat-view]").addEventListener("change", event => {
        selected = event.target.value; sortColumn = "IMP"; sortDirection = -1;
        history.replaceState(null, "", selected === "all" ? "stat-tracker.html" : `stat-tracker.html?team=${encodeURIComponent(selected)}`);
        refresh(true);
      });
      page.querySelector("[data-stat-search]").addEventListener("input", renderTable);
      page.querySelector("[data-stat-roster-status]").addEventListener("change", renderTable);
      page.querySelector("[data-stat-refresh]").addEventListener("click", () => refresh());
      page.querySelector("thead").addEventListener("click", event => {
        const key = event.target.closest("[data-stat-sort]")?.dataset.statSort;
        if (!key) return;
        sortDirection = sortColumn === key ? -sortDirection : ["Team", "Pokemon", "Status"].includes(key) ? 1 : -1;
        sortColumn = key; renderTable();
        [...page.querySelectorAll("[data-stat-sort]")].find(button => button.dataset.statSort === key)?.focus();
      });
    }
    await refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  }
  document.addEventListener("error", event => {
    if (event.target.matches?.(".stat-sprite") && !event.target.src.endsWith("images/favicon.webp")) event.target.src = "images/favicon.webp";
  }, true);
  initialize();
})();
