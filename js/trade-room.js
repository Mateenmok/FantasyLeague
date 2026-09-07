(() => {
  const gate = document.querySelector("[data-trade-gate]");
  const workspace = document.querySelector("[data-trade-workspace]");
  const weekTarget = document.querySelector("[data-trade-week]");
  const teamTarget = document.querySelector("[data-trade-team]");
  const limitTarget = document.querySelector("[data-trade-limit]");
  const statusTarget = document.querySelector("[data-trade-status]");
  const form = document.querySelector("[data-trade-form]");
  const partnerSelect = document.querySelector("[data-trade-partner]");
  const senderRosterTarget = document.querySelector("[data-sender-roster]");
  const receiverRosterTarget = document.querySelector("[data-receiver-roster]");
  const senderCountTarget = document.querySelector("[data-send-count]");
  const receiverCountTarget = document.querySelector("[data-receive-count]");
  const budgetTarget = document.querySelector("[data-trade-budget]");
  const sendButton = document.querySelector("[data-send-trade]");
  const offersTarget = document.querySelector("[data-trade-offers]");

  let accessCode = "";
  let account = null;
  let teams = [];
  let catalog = [];
  let rosters = {};
  let trades = [];
  let currentWeek = 0;
  let pointCap = 50;
  let rosterCap = 10;
  let selectedSender = new Set();
  let selectedReceiver = new Set();
  let pending = false;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const teamFor = (teamId) => teams.find((team) => team.id === teamId);
  const pokemonFor = (slug) => catalog.find((pokemon) => normalize(pokemon.name) === normalize(slug));
  const pointsFor = (slug) => Number(pokemonFor(slug)?.sortPoints ?? pokemonFor(slug)?.points) || 0;
  const rosterPoints = (teamId) => (rosters[teamId] || []).reduce((total, slug) => total + pointsFor(slug), 0);
  const myTeamId = () => account?.teamId;
  const partnerId = () => partnerSelect.value;
  const completedThisWeek = () => trades.some((trade) => Number(trade.week) === currentWeek
    && trade.status === "accepted"
    && [trade.sender_team_id, trade.receiver_team_id].includes(myTeamId()));

  const announce = (message, isError = false) => {
    statusTarget.textContent = message;
    statusTarget.classList.toggle("is-error", isError);
  };

  const pokemonButton = (slug, side) => {
    const pokemon = pokemonFor(slug);
    const selected = (side === "sender" ? selectedSender : selectedReceiver).has(slug);
    return `<button class="trade-pokemon${selected ? " is-selected" : ""}" type="button" data-trade-side="${side}" data-pokemon-slug="${escapeHtml(slug)}" aria-pressed="${selected}" ${completedThisWeek() ? "disabled" : ""}>
      <img src="${escapeHtml(pokemon?.sprite || "images/favicon.webp")}" alt="" loading="lazy">
      <strong>${escapeHtml(pokemon?.name || slug)}</strong>
      <small>${pointsFor(slug)} pts</small>
    </button>`;
  };

  const resultingTotals = () => {
    const senderOutgoing = [...selectedSender].reduce((sum, slug) => sum + pointsFor(slug), 0);
    const receiverOutgoing = [...selectedReceiver].reduce((sum, slug) => sum + pointsFor(slug), 0);
    return {
      sender: rosterPoints(myTeamId()) - senderOutgoing + receiverOutgoing,
      receiver: rosterPoints(partnerId()) - receiverOutgoing + senderOutgoing,
      senderSize: (rosters[myTeamId()] || []).length - selectedSender.size + selectedReceiver.size,
      receiverSize: (rosters[partnerId()] || []).length - selectedReceiver.size + selectedSender.size,
    };
  };

  const selectionLegal = () => {
    const totals = resultingTotals();
    return selectedSender.size >= 1 && selectedSender.size <= 2
      && selectedReceiver.size >= 1 && selectedReceiver.size <= 2
      && totals.sender <= pointCap && totals.receiver <= pointCap
      && totals.senderSize <= rosterCap && totals.receiverSize <= rosterCap
      && !completedThisWeek() && !pending;
  };

  const renderBudget = () => {
    const totals = resultingTotals();
    const partner = teamFor(partnerId());
    const senderOver = totals.sender > pointCap || totals.senderSize > rosterCap;
    const receiverOver = totals.receiver > pointCap || totals.receiverSize > rosterCap;
    budgetTarget.innerHTML = `
      <div class="${senderOver ? "is-over" : ""}"><strong>${escapeHtml(account.teamName)} after trade</strong>${totals.sender} / ${pointCap} points · ${totals.senderSize} / ${rosterCap} Pokémon</div>
      <div class="${receiverOver ? "is-over" : ""}"><strong>${escapeHtml(partner?.name || "Partner")} after trade</strong>${totals.receiver} / ${pointCap} points · ${totals.receiverSize} / ${rosterCap} Pokémon</div>`;
    senderCountTarget.textContent = `${selectedSender.size} / 2`;
    receiverCountTarget.textContent = `${selectedReceiver.size} / 2`;
    sendButton.disabled = !selectionLegal();
  };

  const renderBuilder = () => {
    const senderRoster = rosters[myTeamId()] || [];
    const receiverRoster = rosters[partnerId()] || [];
    senderRosterTarget.innerHTML = senderRoster.length
      ? senderRoster.map((slug) => pokemonButton(slug, "sender")).join("")
      : '<p class="trade-empty">Your roster has no Pokémon to offer yet.</p>';
    receiverRosterTarget.innerHTML = receiverRoster.length
      ? receiverRoster.map((slug) => pokemonButton(slug, "receiver")).join("")
      : '<p class="trade-empty">This team’s roster has not been filled yet.</p>';
    renderBudget();
  };

  const namesFor = (slugs) => (slugs || []).map((slug) => pokemonFor(slug)?.name || slug).join(" + ");

  const renderOffers = () => {
    const currentTrades = trades.filter((trade) => Number(trade.week) === currentWeek);
    offersTarget.innerHTML = currentTrades.length ? currentTrades.map((trade) => {
      const incoming = trade.receiver_team_id === myTeamId();
      const otherTeam = teamFor(incoming ? trade.sender_team_id : trade.receiver_team_id);
      const sendNames = incoming ? namesFor(trade.receiver_pokemon_slugs) : namesFor(trade.sender_pokemon_slugs);
      const receiveNames = incoming ? namesFor(trade.sender_pokemon_slugs) : namesFor(trade.receiver_pokemon_slugs);
      const actions = trade.status === "pending" ? incoming
        ? `<button type="button" data-trade-action="accept" data-trade-id="${trade.id}">Accept</button><button class="is-decline" type="button" data-trade-action="decline" data-trade-id="${trade.id}">Decline</button>`
        : `<button class="is-decline" type="button" data-trade-action="cancel" data-trade-id="${trade.id}">Cancel</button>`
        : `<span class="trade-offer-status">${escapeHtml(trade.status)}</span>`;
      return `<article class="trade-offer">
        <div class="trade-offer-team"><img src="${escapeHtml(otherTeam?.logo || "images/favicon.webp")}" alt=""><strong>${escapeHtml(otherTeam?.name || "League team")}</strong></div>
        <div class="trade-offer-copy"><small>${incoming ? "Incoming offer" : "Sent offer"} · Week ${trade.week}</small><span>You send: ${escapeHtml(sendNames)}</span><span>You receive: ${escapeHtml(receiveNames)}</span></div>
        <div class="trade-offer-actions">${actions}</div>
      </article>`;
    }).join("") : '<p class="trade-empty">No trade offers for this week yet.</p>';
  };

  const renderStatus = () => {
    weekTarget.textContent = currentWeek;
    teamTarget.textContent = account.teamName;
    limitTarget.textContent = completedThisWeek() ? "1 / 1 used" : "0 / 1 used";
    if (completedThisWeek()) announce("Your team has completed its one trade for this week. New offers unlock next week.");
  };

  const toggleSelection = (button) => {
    const selection = button.dataset.tradeSide === "sender" ? selectedSender : selectedReceiver;
    const slug = button.dataset.pokemonSlug;
    if (selection.has(slug)) selection.delete(slug);
    else if (selection.size < 2) selection.add(slug);
    else return announce("You can select at most two Pokémon from each team.", true);
    renderBuilder();
  };

  const refreshData = async () => {
    const [savedRosters, savedTrades] = await Promise.all([
      window.PokeLeagueRosters.read(),
      window.PokeLeagueTrades.read(accessCode),
    ]);
    rosters = savedRosters;
    trades = savedTrades || [];
    renderStatus();
    renderBuilder();
    renderOffers();
  };

  partnerSelect.addEventListener("change", () => {
    selectedReceiver.clear();
    renderBuilder();
  });
  [senderRosterTarget, receiverRosterTarget].forEach((target) => target.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pokemon-slug]");
    if (button && !button.disabled) toggleSelection(button);
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectionLegal()) return announce("Choose one or two Pokémon from both teams and keep both rosters under the cap.", true);
    const totals = resultingTotals();
    pending = true;
    renderBudget();
    try {
      await window.PokeLeagueTrades.propose(accessCode, partnerId(), [...selectedSender], [...selectedReceiver], totals.sender, totals.receiver);
      selectedSender.clear();
      selectedReceiver.clear();
      await refreshData();
      announce("Trade offer sent. The other manager can accept or decline it here.");
    } catch (error) {
      announce(error.message || "The trade offer could not be sent.", true);
    } finally {
      pending = false;
      renderBudget();
    }
  });

  offersTarget.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-trade-action]");
    if (!button || pending) return;
    const action = button.dataset.tradeAction;
    if (action === "accept" && !window.confirm("Accept this trade? Both team rosters will update immediately, and both teams will use their one trade for this week.")) return;
    pending = true;
    button.disabled = true;
    try {
      await window.PokeLeagueTrades.respond(accessCode, button.dataset.tradeId, action);
      await refreshData();
      announce(action === "accept"
        ? "Trade accepted. Both rosters have been updated."
        : action === "decline" ? "Trade declined." : "Trade cancelled.");
    } catch (error) {
      announce(error.message || "The trade could not be updated.", true);
    } finally {
      pending = false;
    }
  });

  const initialize = async () => {
    try {
      accessCode = (localStorage.getItem("pokeleague.accessCode") || sessionStorage.getItem("pokeleague.accessCode") || "").trim().toUpperCase();
      const [teamResponse, accountResponse, catalogResponse, savedRosters, competition] = await Promise.all([
        fetch("data/league-teams.json?v=league-teams1", { cache: "no-store" }),
        fetch("data/teams.json?v=teams8", { cache: "no-store" }),
        fetch("data/pokemon-catalog.json?v=season-1-3"),
        window.PokeLeagueRosters.read(),
        window.PokeLeagueCompetition.read(),
      ]);
      if (!teamResponse.ok || !accountResponse.ok || !catalogResponse.ok) throw new Error("Trade Room data could not be loaded.");
      teams = (await teamResponse.json()).teams || [];
      const accounts = (await accountResponse.json()).accounts || {};
      account = accounts[accessCode] || null;
      catalog = window.PokeLeagueState.applyCatalog(await catalogResponse.json());
      rosters = savedRosters;
      currentWeek = Number(competition.currentWeek) || 0;
      pointCap = Number(competition.pointCap) || 50;

      gate.hidden = Boolean(account);
      workspace.hidden = !account;
      if (!account) return;

      partnerSelect.innerHTML = teams.filter((team) => team.id !== account.teamId).map((team) => (
        `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`
      )).join("");
      const firstFilledPartner = teams.find((team) => team.id !== account.teamId && (rosters[team.id] || []).length);
      if (firstFilledPartner) partnerSelect.value = firstFilledPartner.id;
      trades = await window.PokeLeagueTrades.read(accessCode);
      renderStatus();
      renderBuilder();
      renderOffers();
      if (!completedThisWeek()) announce("Select one or two Pokémon from each roster to build an offer.");
    } catch (error) {
      gate.hidden = false;
      workspace.hidden = true;
      const message = gate.querySelector("p:not(.trade-kicker)");
      if (message) message.textContent = error.message || "The Trade Room could not be loaded.";
    }
  };

  initialize();
})();
