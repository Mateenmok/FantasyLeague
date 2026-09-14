(() => {
  const preview = document.querySelector("[data-transaction-preview]");
  if (!preview) return;
  const status = document.querySelector("[data-transaction-status]");
  const retry = document.querySelector("[data-transaction-retry]");
  const dialog = document.querySelector("[data-transaction-dialog]");
  const history = document.querySelector("[data-transaction-history]");
  const historyStatus = document.querySelector("[data-transaction-history-status]");
  const more = document.querySelector("[data-transaction-more]");
  const PAGE_SIZE = 30;
  const teams = new Map();
  const names = new Map();
  let previewRequest = 0;
  let historyRequest = 0;
  let cursor = null;

  const readJson = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load transaction labels.");
    return response.json();
  };
  // Labels can fall back to readable slugs without blocking the durable feed.
  const labelsReady = Promise.all([
    readJson("data/teams.json?v=teams8").then((data) => {
      Object.values(data.accounts || {}).forEach((team) => {
        if (!teams.has(team.teamId)) teams.set(team.teamId, team);
      });
    }).catch(() => {}),
    readJson("data/pokemon-catalog.json?v=season-1-3").then((catalog) => {
      catalog.forEach((pokemon) => names.set(window.PokeLeagueWaivers.slugify(pokemon.name), pokemon.name));
    }).catch(() => {}),
  ]);

  const readable = (slug) => String(slug || "").split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

  const rowFor = (row) => {
    const item = document.createElement("li");
    item.className = "transaction-entry";
    const team = teams.get(row.team_id);
    if (team?.logo) {
      const logo = document.createElement("img");
      logo.src = team.logo;
      logo.alt = "";
      logo.width = 34;
      logo.height = 34;
      logo.loading = "lazy";
      logo.addEventListener("error", () => logo.remove(), { once: true });
      item.append(logo);
    }
    const copy = document.createElement("div");
    const text = document.createElement("p");
    const teamName = document.createElement("strong");
    teamName.textContent = team?.teamName || readable(row.team_id);
    const action = document.createElement("span");
    action.className = `transaction-action${row.action === "dropped" ? " is-drop" : ""}`;
    action.textContent = row.action === "dropped" ? "dropped" : "added";
    text.append(teamName, " ", action, ` ${names.get(row.pokemon_slug) || readable(row.pokemon_slug)}`);
    const meta = document.createElement("small");
    const date = new Date(row.created_at);
    if (!Number.isNaN(date.getTime())) {
      const time = document.createElement("time");
      time.dateTime = date.toISOString();
      time.title = date.toLocaleString();
      time.textContent = date.toLocaleString(undefined, {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
      });
      meta.append(time, " · ");
    }
    meta.append(row.source === "trade" ? "Trade" : "Waivers");
    copy.append(text, meta);
    item.append(copy);
    return item;
  };

  const refresh = async () => {
    const request = ++previewRequest;
    try {
      const [rows] = await Promise.all([window.PokeLeagueWaivers.readTransactions({ limit: 6 }), labelsReady]);
      if (request !== previewRequest) return;
      preview.replaceChildren(...rows.slice(0, 6).map(rowFor));
      status.textContent = rows.length ? "" : "No transactions yet. Completed waiver moves and trades will appear here.";
      retry.hidden = true;
    } catch {
      if (request !== previewRequest) return;
      status.textContent = preview.children.length
        ? "Could not refresh the log. Showing the last loaded moves."
        : "The transaction log could not load. Your waiver controls are still available.";
      retry.hidden = false;
    }
  };

  const loadHistory = async (reset = false) => {
    const request = ++historyRequest;
    if (reset) {
      cursor = null;
      history.replaceChildren();
      dialog.querySelector(".transaction-scroll").scrollTop = 0;
    }
    more.disabled = true;
    historyStatus.textContent = "Loading moves…";
    try {
      const [rows] = await Promise.all([
        window.PokeLeagueWaivers.readTransactions({ limit: PAGE_SIZE + 1, before: cursor }), labelsReady,
      ]);
      if (request !== historyRequest || !dialog.open) return;
      const page = rows.slice(0, PAGE_SIZE);
      history.append(...page.map(rowFor));
      if (page.length) cursor = page[page.length - 1].id;
      more.hidden = rows.length <= PAGE_SIZE;
      more.textContent = "Load older moves";
      historyStatus.textContent = !history.children.length ? "No transactions yet. Completed waiver moves and trades will appear here."
        : more.hidden ? "You're all caught up." : "";
    } catch {
      if (request !== historyRequest || !dialog.open) return;
      historyStatus.textContent = "Could not load these moves. Please try again.";
      more.hidden = false;
      more.textContent = "Retry";
    } finally {
      if (request === historyRequest) more.disabled = false;
    }
  };

  document.querySelector("[data-transaction-open]").addEventListener("click", () => {
    dialog.showModal();
    more.hidden = true;
    loadHistory(true);
  });
  document.querySelector("[data-transaction-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { historyRequest += 1; });
  more.addEventListener("click", () => loadHistory());
  retry.addEventListener("click", refresh);
  window.addEventListener("pokeleague:transaction", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  refresh();
})();
