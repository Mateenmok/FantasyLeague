const tradeSubtitle = document.getElementById("tradeSubtitle");
const tradeNoTeamPanel = document.getElementById("tradeNoTeamPanel");
const tradeContent = document.getElementById("tradeContent");
const tradePointStatus = document.getElementById("tradePointStatus");
const offeredPokemonSelect = document.getElementById("offeredPokemonSelect");
const receiverTeamSelect = document.getElementById("receiverTeamSelect");
const requestedPokemonSelect = document.getElementById("requestedPokemonSelect");
const tradeMessageInput = document.getElementById("tradeMessageInput");
const tradePreview = document.getElementById("tradePreview");
const sendTradeOfferButton = document.getElementById("sendTradeOfferButton");
const incomingTradeList = document.getElementById("incomingTradeList");
const sentTradeList = document.getElementById("sentTradeList");
const tradeHistoryList = document.getElementById("tradeHistoryList");
const tradePageStatus = document.getElementById("tradePageStatus");

const selectedLeagueId = localStorage.getItem("selected-league-id");

let currentLeague = null;
let currentMembership = null;
let myTeam = null;
let leagueTeams = [];
let allRosterRows = [];
let tradeOffers = [];
let championsPokemon = [];
let isAdmin = false;

offeredPokemonSelect.addEventListener("change", renderTradePreview);
receiverTeamSelect.addEventListener("change", function () {
  renderRequestedPokemonOptions();
  renderTradePreview();
});
requestedPokemonSelect.addEventListener("change", renderTradePreview);
sendTradeOfferButton.addEventListener("click", sendTradeOffer);

loadTradingPage();

async function loadTradingPage() {
  if (!selectedLeagueId) {
    tradeSubtitle.textContent = "No league selected.";
    tradePageStatus.textContent = "Go to My Leagues and select a league first.";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    tradeSubtitle.textContent = "Not signed in.";
    tradePageStatus.textContent = "Sign in before trading.";
    return;
  }

  const userId = sessionData.session.user.id;

  const { data: membership, error: membershipError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("league_id", selectedLeagueId)
    .single();

  if (membershipError || !membership) {
    console.error("Membership error:", membershipError);
    tradeSubtitle.textContent = "No access.";
    tradePageStatus.textContent = "You are not a member of this league.";
    return;
  }

  currentMembership = membership;
  isAdmin = membership.role === "admin";

  try {
    championsPokemon = await fetch("data/champions-pokemon.json?v=trades1").then(response => response.json());
  } catch (error) {
    console.error("Pokémon data load error:", error);
    tradePageStatus.textContent = "Could not load Pokémon data.";
    return;
  }

  await refreshTradeData();
}

async function refreshTradeData() {
  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    tradeSubtitle.textContent = "Could not load league.";
    tradePageStatus.textContent = "Try selecting the league again.";
    return;
  }

  currentLeague = league;
  tradeSubtitle.textContent = league.name;

  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
    tradePageStatus.textContent = "Could not load teams.";
    return;
  }

  leagueTeams = teams || [];
  myTeam = currentMembership.league_team_id
    ? leagueTeams.find(team => team.id === currentMembership.league_team_id)
    : null;

  const { data: rosterRows, error: rosterError } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("slot_number", { ascending: true });

  if (rosterError) {
    console.error("Roster error:", rosterError);
    tradePageStatus.textContent = "Could not load rosters.";
    return;
  }

  allRosterRows = rosterRows || [];

  const { data: offers, error: offersError } = await supabaseClient
    .from("league_trade_offers")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("created_at", { ascending: false });

  if (offersError) {
    console.error("Trade offers error:", offersError);
    tradePageStatus.textContent = "Could not load trade offers.";
    return;
  }

  tradeOffers = offers || [];

  renderTradingPage();
}

function renderTradingPage() {
  if (!myTeam) {
    tradeNoTeamPanel.classList.remove("hidden");
    tradeContent.classList.add("hidden");
    tradePageStatus.textContent = "No team assigned.";
    return;
  }

  tradeNoTeamPanel.classList.add("hidden");
  tradeContent.classList.remove("hidden");

  renderPointStatus();
  renderTradeOfferForm();
  renderTradeLists();

  tradePageStatus.textContent = "Trading loaded.";
}

function renderPointStatus() {
  const pointCap = Number(currentLeague.roster_point_cap || 50);
  const usedPoints = getTeamPointUsage(myTeam.id);

  tradePointStatus.innerHTML = `
    <div class="draft-point-grid">
      <div class="draft-point-card">
        <p><strong>My Team Points</strong></p>
        <p>${escapeHtml(myTeam.team_name)}: ${usedPoints}/${pointCap}</p>
        <p class="small-note">Trades cannot put either team above the point cap.</p>
        <div class="draft-point-bar">
          <div style="width:${Math.min((usedPoints / pointCap) * 100, 100)}%"></div>
        </div>
      </div>

      <div class="draft-point-card">
        <p><strong>Trade Format</strong></p>
        <p>1 Pokémon for 1 Pokémon</p>
        <p class="small-note">Multi-Pokémon trades will be added later.</p>
      </div>
    </div>
  `;
}

function renderTradeOfferForm() {
  const myRoster = getRosterRowsForTeam(myTeam.id);
  const otherTeams = leagueTeams.filter(team => team.id !== myTeam.id && getRosterRowsForTeam(team.id).length > 0);

  if (!myRoster.length) {
    offeredPokemonSelect.innerHTML = `<option value="">Your roster is empty</option>`;
    receiverTeamSelect.innerHTML = `<option value="">No teams available</option>`;
    requestedPokemonSelect.innerHTML = `<option value="">No Pokémon available</option>`;
    sendTradeOfferButton.disabled = true;
    tradePreview.textContent = "You need Pokémon on your roster before sending trades.";
    return;
  }

  if (!otherTeams.length) {
    offeredPokemonSelect.innerHTML = `<option value="">No trade partners</option>`;
    receiverTeamSelect.innerHTML = `<option value="">No teams with rosters</option>`;
    requestedPokemonSelect.innerHTML = `<option value="">No Pokémon available</option>`;
    sendTradeOfferButton.disabled = true;
    tradePreview.textContent = "No other teams have Pokémon available to trade.";
    return;
  }

  sendTradeOfferButton.disabled = false;

  const previousOffered = offeredPokemonSelect.value;
  const previousReceiver = receiverTeamSelect.value;

  offeredPokemonSelect.innerHTML = myRoster.map(row => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);
    return `<option value="${escapeHtml(row.pokemon_slug)}">${escapeHtml(getPokemonOptionLabel(pokemon, row.pokemon_slug))}</option>`;
  }).join("");

  receiverTeamSelect.innerHTML = otherTeams.map(team => {
    return `<option value="${escapeHtml(team.id)}">${escapeHtml(getTeamLabel(team))}</option>`;
  }).join("");

  if (previousOffered && myRoster.some(row => row.pokemon_slug === previousOffered)) {
    offeredPokemonSelect.value = previousOffered;
  }

  if (previousReceiver && otherTeams.some(team => team.id === previousReceiver)) {
    receiverTeamSelect.value = previousReceiver;
  }

  renderRequestedPokemonOptions();
  renderTradePreview();
}

function renderRequestedPokemonOptions() {
  const receiverTeamId = receiverTeamSelect.value;
  const receiverRoster = getRosterRowsForTeam(receiverTeamId);
  const previousRequested = requestedPokemonSelect.value;

  if (!receiverRoster.length) {
    requestedPokemonSelect.innerHTML = `<option value="">No Pokémon available</option>`;
    return;
  }

  requestedPokemonSelect.innerHTML = receiverRoster.map(row => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);
    return `<option value="${escapeHtml(row.pokemon_slug)}">${escapeHtml(getPokemonOptionLabel(pokemon, row.pokemon_slug))}</option>`;
  }).join("");

  if (previousRequested && receiverRoster.some(row => row.pokemon_slug === previousRequested)) {
    requestedPokemonSelect.value = previousRequested;
  }
}

function renderTradePreview() {
  if (!myTeam) return;

  const receiverTeam = getTeamById(receiverTeamSelect.value);
  const offeredPokemon = getPokemonBySlug(offeredPokemonSelect.value);
  const requestedPokemon = getPokemonBySlug(requestedPokemonSelect.value);

  if (!receiverTeam || !offeredPokemon || !requestedPokemon) {
    tradePreview.textContent = "Select both Pokémon to preview the trade.";
    return;
  }

  const result = getProjectedTradeStatus(myTeam.id, receiverTeam.id, offeredPokemon.slug, requestedPokemon.slug);

  tradePreview.innerHTML = `
    <strong>Preview:</strong>
    ${escapeHtml(myTeam.team_name)} sends ${escapeHtml(offeredPokemon.name)} (${getPokemonPoints(offeredPokemon)} pts)
    for ${escapeHtml(requestedPokemon.name)} (${getPokemonPoints(requestedPokemon)} pts).
    <br>
    ${escapeHtml(result.message)}
  `;

  sendTradeOfferButton.disabled = !result.valid;
}

function renderTradeLists() {
  renderIncomingOffers();
  renderSentOffers();
  renderHistoryOffers();
}

function renderIncomingOffers() {
  const incoming = tradeOffers.filter(offer =>
    offer.receiver_team_id === myTeam.id &&
    offer.status === "pending"
  );

  if (!incoming.length) {
    incomingTradeList.innerHTML = `<div class="empty-state"><p>No incoming trade offers.</p></div>`;
    return;
  }

  incomingTradeList.innerHTML = incoming.map(offer => renderTradeOfferCard(offer, "incoming")).join("");

  document.querySelectorAll(".accept-trade-button").forEach(button => {
    button.addEventListener("click", function () {
      acceptTradeOffer(this.dataset.tradeId);
    });
  });

  document.querySelectorAll(".decline-trade-button").forEach(button => {
    button.addEventListener("click", function () {
      declineTradeOffer(this.dataset.tradeId);
    });
  });
}

function renderSentOffers() {
  const sent = tradeOffers.filter(offer =>
    offer.sender_team_id === myTeam.id &&
    offer.status === "pending"
  );

  if (!sent.length) {
    sentTradeList.innerHTML = `<div class="empty-state"><p>No sent pending offers.</p></div>`;
    return;
  }

  sentTradeList.innerHTML = sent.map(offer => renderTradeOfferCard(offer, "sent")).join("");

  document.querySelectorAll(".cancel-trade-button").forEach(button => {
    button.addEventListener("click", function () {
      cancelTradeOffer(this.dataset.tradeId);
    });
  });
}

function renderHistoryOffers() {
  const history = tradeOffers.filter(offer =>
    offer.status !== "pending" &&
    (offer.sender_team_id === myTeam.id || offer.receiver_team_id === myTeam.id || isAdmin)
  ).slice(0, 12);

  if (!history.length) {
    tradeHistoryList.innerHTML = `<div class="empty-state"><p>No completed trade history yet.</p></div>`;
    return;
  }

  tradeHistoryList.innerHTML = history.map(offer => renderTradeOfferCard(offer, "history")).join("");
}

function renderTradeOfferCard(offer, mode) {
  const senderTeam = getTeamById(offer.sender_team_id);
  const receiverTeam = getTeamById(offer.receiver_team_id);
  const offeredPokemon = getPokemonBySlug(offer.offered_pokemon_slug);
  const requestedPokemon = getPokemonBySlug(offer.requested_pokemon_slug);

  const statusClass = `trade-status-${offer.status}`;
  const messageHtml = offer.message
    ? `<p class="trade-message">"${escapeHtml(offer.message)}"</p>`
    : "";

  let actions = "";

  if (mode === "incoming") {
    actions = `
      <div class="trade-actions">
        <button class="pkmn-button small accept-trade-button" data-trade-id="${escapeHtml(offer.id)}">Accept</button>
        <button class="pkmn-button small danger decline-trade-button" data-trade-id="${escapeHtml(offer.id)}">Decline</button>
      </div>
    `;
  }

  if (mode === "sent") {
    actions = `
      <div class="trade-actions">
        <button class="pkmn-button small danger cancel-trade-button" data-trade-id="${escapeHtml(offer.id)}">Cancel Offer</button>
      </div>
    `;
  }

  return `
    <article class="trade-card">
      <div class="trade-card-header">
        <strong>${escapeHtml(senderTeam ? getTeamLabel(senderTeam) : "Unknown Team")}</strong>
        <span class="${statusClass}">${escapeHtml(offer.status.toUpperCase())}</span>
        <strong>${escapeHtml(receiverTeam ? getTeamLabel(receiverTeam) : "Unknown Team")}</strong>
      </div>

      <div class="trade-pokemon-swap">
        ${renderTradePokemon(offeredPokemon, offer.offered_pokemon_slug, "Offering")}
        <div class="trade-arrow">⇄</div>
        ${renderTradePokemon(requestedPokemon, offer.requested_pokemon_slug, "Requesting")}
      </div>

      ${messageHtml}
      ${actions}
    </article>
  `;
}

function renderTradePokemon(pokemon, fallbackSlug, label) {
  if (!pokemon) {
    return `
      <div class="trade-pokemon-mini">
        <p>${label}</p>
        <strong>${escapeHtml(fallbackSlug)}</strong>
      </div>
    `;
  }

  return `
    <div class="trade-pokemon-mini">
      <p>${label}</p>
      <img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">
      ${renderMegaBadge(pokemon)}
      <strong>${escapeHtml(pokemon.name)}</strong>
      ${renderPokemonTierBadge(pokemon)}
      ${renderPokemonTypeBadges(pokemon)}
    </div>
  `;
}

async function sendTradeOffer() {
  const receiverTeam = getTeamById(receiverTeamSelect.value);
  const offeredPokemon = getPokemonBySlug(offeredPokemonSelect.value);
  const requestedPokemon = getPokemonBySlug(requestedPokemonSelect.value);

  if (!receiverTeam || !offeredPokemon || !requestedPokemon) {
    tradePageStatus.textContent = "Select both Pokémon first.";
    return;
  }

  const result = getProjectedTradeStatus(myTeam.id, receiverTeam.id, offeredPokemon.slug, requestedPokemon.slug);

  if (!result.valid) {
    tradePageStatus.textContent = result.message;
    return;
  }

  sendTradeOfferButton.disabled = true;
  tradePageStatus.textContent = "Sending trade offer...";

  const { error } = await supabaseClient
    .from("league_trade_offers")
    .insert({
      id: makeId(),
      league_id: selectedLeagueId,
      sender_team_id: myTeam.id,
      receiver_team_id: receiverTeam.id,
      offered_pokemon_slug: offeredPokemon.slug,
      requested_pokemon_slug: requestedPokemon.slug,
      message: tradeMessageInput.value.trim() || null,
      status: "pending"
    });

  if (error) {
    console.error("Send trade error:", error);
    tradePageStatus.textContent = "Could not send trade offer. Check console.";
    sendTradeOfferButton.disabled = false;
    return;
  }

  tradeMessageInput.value = "";
  tradePageStatus.textContent = "Trade offer sent.";
  sendTradeOfferButton.disabled = false;

  await refreshTradeData();
}

async function acceptTradeOffer(tradeId) {
  const offer = tradeOffers.find(item => item.id === tradeId);

  if (!offer) {
    tradePageStatus.textContent = "Could not find trade offer.";
    return;
  }

  const result = getProjectedTradeStatus(
    offer.sender_team_id,
    offer.receiver_team_id,
    offer.offered_pokemon_slug,
    offer.requested_pokemon_slug
  );

  if (!result.valid) {
    tradePageStatus.textContent = result.message;
    return;
  }

  const confirmed = window.confirm("Accept this trade offer?");

  if (!confirmed) {
    tradePageStatus.textContent = "Trade acceptance cancelled.";
    return;
  }

  tradePageStatus.textContent = "Accepting trade...";

  const { error } = await supabaseClient
    .rpc("accept_trade_offer_as_manager", {
      p_trade_id: tradeId
    });

  if (error) {
    console.error("Accept trade error:", error);
    tradePageStatus.textContent = "Could not accept trade. Check console.";
    return;
  }

  tradePageStatus.textContent = "Trade accepted.";
  await refreshTradeData();
}

async function declineTradeOffer(tradeId) {
  tradePageStatus.textContent = "Declining trade...";

  const { error } = await supabaseClient
    .from("league_trade_offers")
    .update({
      status: "declined",
      updated_at: new Date().toISOString()
    })
    .eq("id", tradeId)
    .eq("receiver_team_id", myTeam.id)
    .eq("status", "pending");

  if (error) {
    console.error("Decline trade error:", error);
    tradePageStatus.textContent = "Could not decline trade.";
    return;
  }

  tradePageStatus.textContent = "Trade declined.";
  await refreshTradeData();
}

async function cancelTradeOffer(tradeId) {
  tradePageStatus.textContent = "Cancelling offer...";

  const { error } = await supabaseClient
    .from("league_trade_offers")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("id", tradeId)
    .eq("sender_team_id", myTeam.id)
    .eq("status", "pending");

  if (error) {
    console.error("Cancel trade error:", error);
    tradePageStatus.textContent = "Could not cancel trade.";
    return;
  }

  tradePageStatus.textContent = "Trade offer cancelled.";
  await refreshTradeData();
}

function getProjectedTradeStatus(senderTeamId, receiverTeamId, offeredSlug, requestedSlug) {
  const pointCap = Number(currentLeague.roster_point_cap || 50);

  const senderTeam = getTeamById(senderTeamId);
  const receiverTeam = getTeamById(receiverTeamId);

  const offeredPokemon = getPokemonBySlug(offeredSlug);
  const requestedPokemon = getPokemonBySlug(requestedSlug);

  const offeredRow = getRosterRow(senderTeamId, offeredSlug);
  const requestedRow = getRosterRow(receiverTeamId, requestedSlug);

  if (!senderTeam || !receiverTeam || !offeredPokemon || !requestedPokemon) {
    return {
      valid: false,
      message: "Could not validate this trade."
    };
  }

  if (!offeredRow) {
    return {
      valid: false,
      message: `${senderTeam.team_name} no longer has ${offeredPokemon.name}.`
    };
  }

  if (!requestedRow) {
    return {
      valid: false,
      message: `${receiverTeam.team_name} no longer has ${requestedPokemon.name}.`
    };
  }

  const senderCurrent = getTeamPointUsage(senderTeamId);
  const receiverCurrent = getTeamPointUsage(receiverTeamId);

  const offeredPoints = getPokemonPoints(offeredPokemon);
  const requestedPoints = getPokemonPoints(requestedPokemon);

  const senderProjected = senderCurrent - offeredPoints + requestedPoints;
  const receiverProjected = receiverCurrent - requestedPoints + offeredPoints;

  if (senderProjected > pointCap) {
    return {
      valid: false,
      message: `${senderTeam.team_name} would exceed the point cap: ${senderProjected}/${pointCap}.`
    };
  }

  if (receiverProjected > pointCap) {
    return {
      valid: false,
      message: `${receiverTeam.team_name} would exceed the point cap: ${receiverProjected}/${pointCap}.`
    };
  }

  return {
    valid: true,
    message: `${senderTeam.team_name}: ${senderProjected}/${pointCap}. ${receiverTeam.team_name}: ${receiverProjected}/${pointCap}.`
  };
}

function getRosterRowsForTeam(teamId) {
  return allRosterRows
    .filter(row => row.team_id === teamId)
    .sort((a, b) => Number(a.slot_number || 0) - Number(b.slot_number || 0));
}

function getRosterRow(teamId, pokemonSlug) {
  return allRosterRows.find(row =>
    row.team_id === teamId &&
    row.pokemon_slug === pokemonSlug
  );
}

function getTeamPointUsage(teamId) {
  return getRosterRowsForTeam(teamId).reduce((total, row) => {
    const pokemon = getPokemonBySlug(row.pokemon_slug);
    return total + getPokemonPoints(pokemon);
  }, 0);
}

function getPokemonPoints(pokemon) {
  return Number(pokemon?.points || 1);
}

function getPokemonBySlug(slug) {
  return championsPokemon.find(pokemon => pokemon.slug === slug);
}

function getTeamById(teamId) {
  return leagueTeams.find(team => team.id === teamId);
}

function getTeamLabel(team) {
  const manager = team.owner_name || team.manager_name || team.manager_email || "Unassigned";

  if (manager && manager !== "Unassigned") {
    return `${team.team_name} (${manager})`;
  }

  return team.team_name;
}

function getPokemonOptionLabel(pokemon, fallbackSlug) {
  if (!pokemon) return fallbackSlug;

  return `${pokemon.name} - ${getPokemonPoints(pokemon)} pts`;
}

function getPokemonLabel(pokemon) {
  const sameNameCount = championsPokemon.filter(p => p.name.toLowerCase() === pokemon.name.toLowerCase()).length;

  if (sameNameCount > 1) {
    return `${pokemon.name} (${(pokemon.types || []).join("/")})`;
  }

  return pokemon.name;
}

function getTypeClass(type) {
  return `type-${String(type || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function renderPokemonTypeBadges(pokemon) {
  const types = pokemon.types || [];

  if (!types.length) {
    return "";
  }

  const typeClass = types.length === 1 ? "single" : "dual";

  return `
    <div class="pokemon-type-strip ${typeClass}">
      ${types.map(type => `
        <span class="pokemon-type-segment ${getTypeClass(type)}">
          ${escapeHtml(type)}
        </span>
      `).join("")}
    </div>
  `;
}

function renderPokemonTierBadge(pokemon) {
  const tier = pokemon.tier || "Bronze";
  const points = pokemon.points || 1;
  const icon = pokemon.tier_icon || "images/tiers/BronzeButton.png";

  return `
    <div class="pokemon-tier-badge">
      <img src="${icon}" alt="${tier}">
      <span>${tier} ${points}</span>
    </div>
  `;
}

function renderMegaBadge(pokemon) {
  if (!pokemon || !pokemon.mega_eligible) {
    return "";
  }

  return `<img class="mega-badge-overlay" src="images/MegaEvolution.png" alt="Mega Evolution">`;
}

function makeId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
