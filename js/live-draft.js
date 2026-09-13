(() => {
  const SUPABASE_URL = "https://cgvxehwqoviihxndupoj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu";
  const POINT_CAP = 50;
  const ROSTER_SIZE = 10;
  const LIVE_ROUNDS = 9;
  const POLL_INTERVAL = 2500;
  const TEST_CPU_DELAY = 150;
  const TEST_CODES = new Set(["DRAFTTEST1", "DRAFTTEST2", "DRAFTTEST3", "DRAFTTEST4"]);
  const TEST_HUMAN_TEAMS = new Set([
    "boston-eeltics", "massachusetts-midnight",
    "miami-dragapults", "north-carolina-ceruledge",
  ]);

  const TEAM_CONFIG = {
    "daytona-torterras": { name: "Daytona Torterras", short: "Torterras", mascot: "Torterra", color: "#3fa129", logo: "images/teams/daytona-torterras.webp?v=daytona2" },
    "kansas-krooks": { name: "Kansas Krooks", short: "Krooks", mascot: "Krookodile", color: "#d8443e", logo: "images/teams/draft/kansas-krooks.png" },
    "south-jersey-hounds": { name: "South Jersey Hounds", short: "Hounds", mascot: "Houndoom", color: "#ef554f", logo: "images/teams/draft/south-jersey-hounds.png" },
    "chicago-conkquerers": { name: "Chicago Conkquerers", short: "Conkquerers", mascot: "Conkeldurr", color: "#ef6f45", logo: "images/teams/draft/chicago-conkquerers.png" },
    "las-vegas-gatrs": { name: "Las Vegas Gatrs", short: "Gatrs", mascot: "Feraligatr", color: "#d13f76", logo: "images/teams/draft/las-vegas-gatrs.png" },
    "north-carolina-ceruledge": { name: "North Carolina Ceruledge", short: "Ceruledge", mascot: "Ceruledge", color: "#7b61e8", logo: "images/teams/draft/north-carolina-ceruledge.png" },
    "uconn-arcanines": { name: "UConn Arcanines", short: "UConn", mascot: "Hisuian Arcanine", color: "#4c78d5", logo: "images/teams/draft/uconn-arcanines.png" },
    "boston-eeltics": { name: "Boston Eeltics", short: "Eeltics", mascot: "Eelektross", color: "#62a629", logo: "images/teams/draft/boston-eeltics.png" },
    "sunnyshore-city-shelter": { name: "Sunnyshore City Shelter", short: "Shelter", mascot: "Hisuian Goodra", color: "#6e9ddb", logo: "images/teams/draft/sunnyshore-city-shelter.png" },
    "massachusetts-midnight": { name: "Massachusetts Midnight", short: "Midnight", mascot: "Umbreon", color: "#6154b7", logo: "images/teams/draft/massachusetts-midnight.png" },
    "miami-dragapults": { name: "Miami Dragapults", short: "Dragapults", mascot: "Dragapult", color: "#20a493", logo: "images/teams/draft/miami-dragapults.png" },
    "san-francisco-soulfire": { name: "San Francisco Soulfire", short: "Soulfire", mascot: "Chandelure", color: "#874dc9", logo: "images/teams/draft/san-francisco-soulfire.png" },
    "stockholm-spin-cycles": { name: "Stockholm Spin Cycles", short: "Spin Cycles", mascot: "Rotom-Wash", color: "#31a6cb", logo: "images/teams/draft/stockholm-spin-cycles.png" },
    "dallas-disguises": { name: "Dallas Disguises", short: "Disguises", mascot: "Mimikyu", color: "#d7a93a", logo: "images/teams/draft/dallas-disguises.png" },
  };

  const MAIN_ORDER = [
    "daytona-torterras", "kansas-krooks", "south-jersey-hounds",
    "chicago-conkquerers", "las-vegas-gatrs", "north-carolina-ceruledge",
    "uconn-arcanines", "boston-eeltics", "sunnyshore-city-shelter",
    "massachusetts-midnight", "miami-dragapults", "san-francisco-soulfire",
    "stockholm-spin-cycles", "dallas-disguises",
  ];

  const TYPE_COLORS = {
    Bug: "#91a119", Dark: "#50413f", Dragon: "#5060e1", Electric: "#fac000",
    Fairy: "#ef70ef", Fighting: "#ff8000", Fire: "#e62829", Flying: "#81b9ef",
    Ghost: "#704170", Grass: "#3fa129", Ground: "#915121", Ice: "#3fd8ff",
    Normal: "#9fa19f", Poison: "#9141cb", Psychic: "#ef4179", Rock: "#afa981",
    Steel: "#60a1b8", Water: "#2980ef",
  };
  const TIER_SYMBOLS = { Diamond: "◆", Gold: "●", Silver: "●", Bronze: "●" };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const elements = {
    entry: $("[data-draft-entry]"),
    entryStatus: $("[data-draft-entry-status]"),
    openLive: $("[data-open-live-draft]"),
    openMock: $("[data-open-mock-draft]"),
    mockSetup: $("[data-draft-setup]"),
    mockApp: $("[data-draft-app]"),
    live: $("[data-live-draft]"),
    leave: $("[data-leave-live-draft]"),
    roomKicker: $("[data-live-room-kicker]"),
    roomLabel: $("[data-live-room-label]"),
    roomSchedule: $("[data-live-room-schedule]"),
    roomState: $("[data-live-room-state]"),
    board: $("[data-live-board]"),
    clockKicker: $("[data-live-clock-kicker]"),
    clockTeam: $("[data-live-clock-team]"),
    clockLogo: $("[data-live-clock-logo]"),
    clockDetail: $("[data-live-clock-detail]"),
    timer: $("[data-live-timer]"),
    adminPanel: $("[data-live-admin-panel]"),
    adminHint: $("[data-live-admin-hint]"),
    start: $("[data-live-start]"),
    pause: $("[data-live-pause]"),
    undo: $("[data-live-undo]"),
    reset: $("[data-live-reset]"),
    timerSetting: $("[data-live-timer-setting]"),
    overall: $("[data-live-overall-pick]"),
    round: $("[data-live-round]"),
    pointsUsed: $("[data-live-points-used]"),
    rosterCount: $("[data-live-roster-count]"),
    recommendationName: $("[data-live-recommendation-name]"),
    recommendationReason: $("[data-live-recommendation-reason]"),
    recommendationPick: $("[data-live-recommendation-pick]"),
    resultCount: $("[data-live-result-count]"),
    grid: $("[data-live-pokemon-grid]"),
    empty: $("[data-live-empty-state]"),
    nameFilter: $("[data-live-name-filter]"),
    pointFilter: $("[data-live-point-filter]"),
    typeFilter: $("[data-live-type-filter]"),
    clearFilters: $("[data-live-clear-filters]"),
    help: $("[data-live-pick-help]"),
    userTeamName: $("[data-live-user-team-name]"),
    budgetLeft: $("[data-live-budget-left]"),
    userRoster: $("[data-live-user-roster]"),
    log: $("[data-live-draft-log]"),
    template: $("#draftCardTemplate"),
  };

  const state = {
    accessCode: "",
    roomKey: "main",
    participants: MAIN_ORDER,
    catalog: [],
    byName: new Map(),
    bySlug: new Map(),
    payload: null,
    rosters: {},
    serverOffset: 0,
    pollTimer: null,
    clockTimer: null,
    cpuTimer: null,
    cpuPickInFlight: false,
    busy: false,
    expired: false,
    initialized: false,
  };

  const slugify = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const responseError = async (response) => {
    try {
      const body = await response.json();
      return body.message || body.hint || `Draft request failed (${response.status}).`;
    } catch {
      return `Draft request failed (${response.status}).`;
    }
  };

  const rpc = async (name, body) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await responseError(response));
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  const readDraft = () => rpc("read_flash_family_live_draft", {
    p_access_code: state.accessCode,
    p_room_key: state.roomKey,
  });

  const participantsForRoom = () => MAIN_ORDER;
  const isTestCpuTeam = (teamId) => state.roomKey === "test" && !TEST_HUMAN_TEAMS.has(teamId);
  const totalLivePicks = () => state.participants.length * LIVE_ROUNDS;
  const currentRound = () => Math.min(LIVE_ROUNDS, Math.floor((state.payload?.picks?.length || 0) / state.participants.length) + 1);

  const expectedTeam = () => {
    const pickIndex = state.payload?.picks?.length || 0;
    if (pickIndex >= totalLivePicks()) return null;
    const roundIndex = Math.floor(pickIndex / state.participants.length);
    const position = pickIndex % state.participants.length;
    return roundIndex % 2 === 0
      ? state.participants[position]
      : state.participants[state.participants.length - 1 - position];
  };

  const catalogPokemon = (slug) => state.bySlug.get(slugify(slug));
  const pointValue = (pokemon) => Number(pokemon?.sortPoints ?? pokemon?.points ?? 0);
  const pokemonSprite = (pokemon) => pokemon?.sprite || "images/favicon.webp";

  const rosterFor = (teamId) => {
    if (state.roomKey === "main") {
      return (state.rosters[teamId] || []).map(catalogPokemon).filter(Boolean);
    }
    const mascot = catalogPokemon(TEAM_CONFIG[teamId]?.mascot);
    const picks = (state.payload?.picks || [])
      .filter((pick) => pick.teamId === teamId)
      .map((pick) => catalogPokemon(pick.pokemonSlug))
      .filter(Boolean);
    return [mascot, ...picks].filter(Boolean);
  };

  const teamPoints = (teamId) => rosterFor(teamId).reduce((total, pokemon) => total + pointValue(pokemon), 0);

  const recommendationContext = () => {
    const teams = {};
    const taken = takenSlugs();
    state.participants.forEach((teamId, index) => {
      const mascotName = TEAM_CONFIG[teamId].mascot;
      teams[index + 1] = {
        id: index + 1,
        picks: rosterFor(teamId).map((pokemon) => ({
          ...pokemon,
          mascot: pokemon.name === mascotName,
        })),
      };
    });
    return {
      teams,
      available: new Set(state.catalog.filter((pokemon) => !taken.has(slugify(pokemon.name))).map((pokemon) => pokemon.name)),
      pickIndex: state.payload?.picks?.length || 0,
      log: (state.payload?.picks || []).map((pick) => ({
        team: state.participants.indexOf(pick.teamId) + 1,
        pokemon: catalogPokemon(pick.pokemonSlug),
        overall: pick.overallPick,
      })).filter((entry) => entry.team > 0 && entry.pokemon),
      humanTeamId: state.participants.indexOf(expectedTeam()) + 1,
    };
  };

  const recommendationForCurrentTeam = () => {
    const advisor = window.PokeLeagueDraftAdvisor;
    const onClock = expectedTeam();
    if (!advisor?.ai || !onClock) return null;
    const context = recommendationContext();
    const team = context.teams[context.humanTeamId];
    if (!team) return null;
    return { team, choice: advisor.ai.choose(team, context, { isCpu: false }) };
  };

  const renderRecommendation = () => {
    const room = state.payload?.room;
    const onClock = expectedTeam();
    const allowed = canViewerPick();
    if (!room?.isStarted || room.isPaused || draftComplete() || !onClock) {
      elements.recommendationName.textContent = draftComplete() ? "Draft complete!" : room?.isPaused ? "Draft paused" : "Waiting for the draft…";
      elements.recommendationReason.textContent = draftComplete() ? "Every live roster slot is filled." : "Recommendations update when the next team is on the clock.";
      elements.recommendationPick.replaceChildren();
      return;
    }
    if (!allowed) {
      elements.recommendationName.textContent = `Waiting on ${TEAM_CONFIG[onClock].short}…`;
      elements.recommendationReason.textContent = "Your recommendation will appear as soon as your team is on the clock.";
      elements.recommendationPick.replaceChildren();
      return;
    }
    const result = recommendationForCurrentTeam();
    if (!result) {
      elements.recommendationName.textContent = "Evaluating the board…";
      elements.recommendationReason.textContent = "The mock-draft recommendation engine is loading.";
      elements.recommendationPick.replaceChildren();
      return;
    }
    const { team, choice } = result;
    const pokemon = choice?.pokemon;
    if (!pokemon) {
      elements.recommendationName.textContent = "No legal pick available";
      elements.recommendationReason.textContent = "This roster cannot add another Pokémon within the point cap.";
      elements.recommendationPick.replaceChildren();
      return;
    }
    const pieces = [`adds a ${pointValue(pokemon)}-point ${pokemon.tier.toLowerCase()} pick`];
    if (choice.reasons?.length) pieces.push(choice.reasons.slice(0, 3).join(" + "));
    pieces.push(`${POINT_CAP - team.picks.reduce((sum, pick) => sum + pointValue(pick), 0) - pointValue(pokemon)} points remain`);
    elements.recommendationName.textContent = `${pokemon.name} · ${pointValue(pokemon)} PTS`;
    elements.recommendationReason.textContent = pieces.join(" · ");
    elements.recommendationPick.innerHTML = `<img src="${escapeHtml(pokemonSprite(pokemon))}" alt=""><button class="comic-button comic-button--primary" type="button">Draft pick</button>`;
    elements.recommendationPick.querySelector("button").addEventListener("click", () => submitPick(pokemon));
  };

  const secondsRemaining = () => {
    const room = state.payload?.room;
    if (!room) return 0;
    if (!room.isStarted) return Number(room.pickSeconds) || 90;
    if (room.isPaused) return Number(room.pausedSecondsRemaining ?? room.pickSeconds) || 0;
    const serverNow = Date.now() + state.serverOffset;
    const started = Date.parse(room.currentPickStartedAt);
    if (!Number.isFinite(started)) return Number(room.pickSeconds) || 90;
    return Math.max(0, Math.ceil(Number(room.pickSeconds) - ((serverNow - started) / 1000)));
  };

  const draftComplete = () => (state.payload?.picks?.length || 0) >= totalLivePicks();
  const canViewerPick = () => {
    const payload = state.payload;
    const onClock = expectedTeam();
    if (!payload?.room?.isStarted || payload.room.isPaused || !onClock || state.busy) return false;
    if (isTestCpuTeam(onClock)) return payload.viewer.isAdmin;
    if (payload.viewer.isAdmin) return true;
    return payload.viewer.teamId === onClock && secondsRemaining() > 0;
  };

  const showEntryStatus = (message, isError = false) => {
    elements.entryStatus.textContent = message;
    elements.entryStatus.style.color = isError ? "#b3261e" : "";
  };

  const typeBadge = (type) => {
    const span = document.createElement("span");
    span.className = "type-badge";
    span.innerHTML = `<img src="images/types/${type.toLowerCase()}.png" alt="" width="20" height="20"><span>${escapeHtml(type)}</span>`;
    return span;
  };

  const takenSlugs = () => {
    const taken = new Set(Object.values(TEAM_CONFIG).map((team) => slugify(team.mascot)));
    (state.payload?.picks || []).forEach((pick) => taken.add(pick.pokemonSlug));
    if (state.roomKey === "main") {
      Object.values(state.rosters).flat().forEach((slug) => taken.add(slugify(slug)));
    }
    return taken;
  };

  const filteredPokemon = () => {
    const query = elements.nameFilter.value.trim().toLowerCase();
    const points = elements.pointFilter.value;
    const type = elements.typeFilter.value;
    const taken = takenSlugs();
    return state.catalog
      .filter((pokemon) => !taken.has(slugify(pokemon.name)))
      .filter((pokemon) => !query || [pokemon.name, ...(pokemon.aliases || [])].some((name) => name.toLowerCase().includes(query)))
      .filter((pokemon) => !points || String(pointValue(pokemon)) === points)
      .filter((pokemon) => !type || pokemon.types.includes(type))
      .sort((a, b) => pointValue(b) - pointValue(a) || a.name.localeCompare(b.name));
  };

  const renderPokemon = () => {
    if (!state.payload) return;
    const matches = filteredPokemon();
    const onClock = expectedTeam();
    const currentPoints = onClock ? teamPoints(onClock) : 0;
    const currentCount = onClock ? rosterFor(onClock).length : 0;
    const allowed = canViewerPick();
    const fragment = document.createDocumentFragment();

    matches.forEach((pokemon) => {
      const card = elements.template.content.firstElementChild.cloneNode(true);
      const affordable = currentCount < ROSTER_SIZE && currentPoints + pointValue(pokemon) <= POINT_CAP;
      card.dataset.tier = pokemon.tier;
      card.style.setProperty("--type-one", TYPE_COLORS[pokemon.types[0]] || TYPE_COLORS.Normal);
      card.style.setProperty("--type-two", TYPE_COLORS[pokemon.types[1] || pokemon.types[0]] || TYPE_COLORS.Normal);
      card.querySelector(".tier-symbol").textContent = TIER_SYMBOLS[pokemon.tier] || "●";
      card.querySelector(".tier-name").textContent = pokemon.tier;
      card.querySelector(".point-value").textContent = pointValue(pokemon);
      card.querySelector(".pokemon-name").textContent = pokemon.name;
      const sprite = card.querySelector(".pokemon-sprite");
      sprite.src = pokemonSprite(pokemon);
      sprite.alt = `${pokemon.name} menu sprite`;
      const typeList = card.querySelector(".type-list");
      pokemon.types.forEach((pokemonType) => typeList.append(typeBadge(pokemonType)));

      const info = card.querySelector(".card-info");
      info.setAttribute("aria-label", `View ${pokemon.name} details`);
      info.addEventListener("click", () => window.PokemonDetails?.open(pokemon, info));

      const pick = card.querySelector(".draft-pick-button");
      const cpuTurn = isTestCpuTeam(onClock);
      const adminPick = Boolean(state.payload.viewer.isAdmin && onClock);
      pick.dataset.adminPick = String(adminPick);
      pick.textContent = adminPick ? `Draft for ${TEAM_CONFIG[onClock].short}` : cpuTurn ? "CPU choosing…" : "Draft";
      pick.disabled = !allowed || !affordable;
      pick.title = !affordable ? "This pick would exceed the roster limit or point cap." : "";
      pick.addEventListener("click", () => submitPick(pokemon));
      if (!affordable) card.classList.add("is-unavailable");
      fragment.append(card);
    });

    elements.grid.replaceChildren(fragment);
    elements.grid.setAttribute("aria-busy", "false");
    elements.resultCount.textContent = String(matches.length);
    elements.empty.hidden = matches.length > 0;
  };

  const renderGrid = () => {
    const onClock = expectedTeam();
    const activeRound = currentRound();
    const picksBySlot = new Map(
      (state.payload?.picks || []).map((pick) => [`${pick.roundNumber}:${pick.teamId}`, pick])
    );
    const pieces = ['<div class="live-board-corner">Slot</div>'];

    state.participants.forEach((teamId) => {
      const team = TEAM_CONFIG[teamId];
      const cpu = isTestCpuTeam(teamId);
      pieces.push(`<div class="live-board-team${teamId === onClock ? " is-on-clock" : ""}${cpu ? " is-cpu" : ""}" style="--team-color:${team.color}"><img src="${escapeHtml(team.logo)}" alt=""><strong title="${escapeHtml(team.name)}">${escapeHtml(team.short)}</strong>${cpu ? '<span class="live-board-cpu">CPU</span>' : ""}</div>`);
    });

    for (let row = 0; row < ROSTER_SIZE; row += 1) {
      pieces.push(`<div class="live-board-round">${row === 0 ? "M" : `R${row}`}</div>`);
      state.participants.forEach((teamId) => {
        const team = TEAM_CONFIG[teamId];
        const pick = row === 0 ? null : picksBySlot.get(`${row}:${teamId}`);
        const pokemon = row === 0 ? catalogPokemon(team.mascot) : catalogPokemon(pick?.pokemonSlug);
        const current = row > 0 && row === activeRound && teamId === onClock;
        pieces.push(`<div class="live-board-cell${row === 0 ? " is-mascot" : ""}${current ? " is-current" : ""}" style="--team-color:${team.color}" title="${escapeHtml(pokemon?.name || (current ? "On the clock" : "Open slot"))}">
          ${pick ? `<small>#${pick.overallPick}</small>` : ""}
          ${pokemon ? `<img src="${escapeHtml(pokemonSprite(pokemon))}" alt=""><strong>${escapeHtml(pokemon.name)}</strong>` : `<strong>${current ? "On clock" : "—"}</strong>`}
        </div>`);
      });
    }

    elements.board.style.setProperty("--live-team-count", String(state.participants.length));
    elements.board.style.setProperty("--live-board-min", state.participants.length === 14 ? "1260px" : "520px");
    elements.board.innerHTML = pieces.join("");
  };

  const renderRoster = () => {
    const teamId = state.payload.viewer.teamId;
    const team = TEAM_CONFIG[teamId];
    const roster = rosterFor(teamId);
    elements.userTeamName.textContent = team.name;
    elements.budgetLeft.textContent = `${POINT_CAP - teamPoints(teamId)} left`;
    elements.pointsUsed.textContent = `${teamPoints(teamId)} / ${POINT_CAP}`;
    elements.rosterCount.textContent = `${roster.length} / ${ROSTER_SIZE}`;

    const rows = [];
    for (let index = 0; index < ROSTER_SIZE; index += 1) {
      const pokemon = roster[index];
      if (!pokemon) {
        rows.push(`<div class="roster-slot roster-slot--empty"><span><strong>${index + 1}. Open slot</strong><br><small>Waiting for a live pick</small></span></div>`);
      } else {
        rows.push(`<div class="roster-slot"><img src="${escapeHtml(pokemonSprite(pokemon))}" alt=""><span><strong>${index + 1}. ${escapeHtml(pokemon.name)}</strong><br><small>${index === 0 ? "Team mascot" : "Live draft pick"}</small></span><span>${pointValue(pokemon)}</span></div>`);
      }
    }
    elements.userRoster.innerHTML = rows.join("");
  };

  const renderLog = () => {
    const picks = state.payload?.picks || [];
    if (!picks.length) {
      elements.log.innerHTML = "<p>No live picks yet.</p>";
      return;
    }
    elements.log.innerHTML = picks.slice(-18).reverse().map((pick) => {
      const pokemon = catalogPokemon(pick.pokemonSlug);
      return `<div class="log-row"><span>#${pick.overallPick}</span><strong>${escapeHtml(pokemon?.name || pick.pokemonSlug)} · ${escapeHtml(TEAM_CONFIG[pick.teamId].name)}</strong><span>${pick.pointValue} pts</span></div>`;
    }).join("");
  };

  const renderRoom = () => {
    const payload = state.payload;
    const room = payload.room;
    const onClock = expectedTeam();
    const complete = draftComplete();
    const pickNumber = payload.picks.length + 1;

    elements.roomLabel.textContent = room.label;
    elements.roomKicker.textContent = state.roomKey === "test" ? "Private full-league rehearsal" : "Official league event";
    elements.roomSchedule.textContent = state.roomKey === "test"
      ? "14 teams · 4 human managers · 10 admin-controlled CPU teams"
      : "Commissioner-controlled · start whenever your league is ready";
    elements.adminPanel.hidden = !payload.viewer.isAdmin;
    elements.timerSetting.value = String(room.pickSeconds);

    elements.roomState.className = "live-room-pill";
    if (complete) {
      elements.roomState.textContent = "Draft complete";
      elements.roomState.classList.add("is-complete");
    } else if (!room.isStarted) {
      elements.roomState.textContent = "Waiting room";
    } else if (room.isPaused) {
      elements.roomState.textContent = "Paused";
      elements.roomState.classList.add("is-paused");
    } else {
      elements.roomState.textContent = "Live now";
      elements.roomState.classList.add("is-live");
    }

    if (complete) {
      elements.clockKicker.textContent = "Final buzzer";
      elements.clockTeam.textContent = "Draft complete";
      elements.clockDetail.textContent = "Every live roster slot is filled.";
      elements.clockLogo.src = "images/favicon.webp";
    } else if (!room.isStarted) {
      elements.clockKicker.textContent = "Waiting for commissioner";
      elements.clockTeam.textContent = room.label;
      elements.clockDetail.textContent = state.roomKey === "main"
        ? "The draft begins whenever an admin presses Start."
        : "DraftTest1 or DraftTest3 starts the test when all four managers are ready; the other ten teams are admin-controlled CPUs.";
      elements.clockLogo.src = TEAM_CONFIG[payload.viewer.teamId].logo;
    } else {
      const team = TEAM_CONFIG[onClock];
      elements.clockKicker.textContent = room.isPaused
        ? "Draft paused"
        : payload.viewer.teamId === onClock ? "You are on the clock!" : "On the clock";
      elements.clockTeam.textContent = team.name;
      elements.clockLogo.src = team.logo;
      const cpuTurn = isTestCpuTeam(onClock);
      elements.clockDetail.textContent = `Round ${currentRound()} · Live pick #${pickNumber}${cpuTurn ? " · CPU auto-pick in progress" : payload.viewer.isAdmin ? " · Commissioner pick access enabled" : ""}`;
    }

    elements.overall.textContent = complete ? `${totalLivePicks()} / ${totalLivePicks()}` : `${pickNumber} / ${totalLivePicks()}`;
    elements.round.textContent = `${complete ? LIVE_ROUNDS : currentRound()} / ${LIVE_ROUNDS}`;

    if (payload.viewer.isAdmin) {
      elements.start.textContent = !room.isStarted ? "Start draft" : room.isPaused ? "Resume draft" : "Draft running";
      elements.start.disabled = complete || (room.isStarted && !room.isPaused) || state.busy;
      elements.pause.disabled = !room.isStarted || room.isPaused || complete || state.busy;
      elements.undo.disabled = !payload.picks.length || state.busy;
      elements.reset.disabled = state.busy;
      elements.adminHint.textContent = isTestCpuTeam(onClock)
        ? `${TEAM_CONFIG[onClock].name} will pick automatically; commissioners can also submit its pick below.`
        : state.expired && onClock
        ? `Time expired for ${TEAM_CONFIG[onClock].name}. Choose their Pokémon below.`
        : `Commissioner pick access is locked to the team currently on the clock.`;
    }

    const allowed = canViewerPick();
    elements.help.textContent = complete
      ? "The draft is complete."
      : !room.isStarted
        ? "The commissioner must start the room before picks can be submitted."
        : room.isPaused
          ? "The draft is paused. The clock and all picks are frozen."
          : isTestCpuTeam(onClock)
              ? `${TEAM_CONFIG[onClock].name} is choosing automatically.`
            : state.expired && !payload.viewer.isAdmin
              ? "Time expired. An admin must make this pick."
            : allowed
              ? payload.viewer.isAdmin
                ? `Choose a Pokémon for ${TEAM_CONFIG[onClock].name}.`
                : "Your team is on the clock. Choose a legal Pokémon."
              : `${TEAM_CONFIG[onClock].name} is choosing now.`;

    renderGrid();
    renderRoster();
    renderLog();
    renderRecommendation();
    renderPokemon();
    scheduleTestCpuPick();
  };

  const scheduleTestCpuPick = () => {
    clearTimeout(state.cpuTimer);
    state.cpuTimer = null;
    const room = state.payload?.room;
    const onClock = expectedTeam();
    if (state.roomKey !== "test" || !room?.isStarted || room.isPaused || draftComplete() || !isTestCpuTeam(onClock) || state.cpuPickInFlight) return;

    state.cpuTimer = window.setTimeout(async () => {
      state.cpuPickInFlight = true;
      try {
        await rpc("auto_pick_flash_family_test_draft", { p_access_code: state.accessCode });
        await refresh(true);
      } catch (error) {
        console.warn("Test CPU pick delayed:", error.message);
        await refresh(false);
      } finally {
        state.cpuPickInFlight = false;
        scheduleTestCpuPick();
      }
    }, TEST_CPU_DELAY);
  };

  const updateClock = () => {
    if (!state.payload) return;
    if (state.roomKey === "test" && isTestCpuTeam(expectedTeam())) {
      elements.timer.textContent = "AUTO";
      elements.timer.classList.remove("is-warning", "is-expired");
      if (state.expired) {
        state.expired = false;
        renderRoom();
      }
      return;
    }
    const remaining = secondsRemaining();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    elements.timer.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
    elements.timer.classList.toggle("is-warning", remaining > 0 && remaining <= 15);
    elements.timer.classList.toggle("is-expired", remaining === 0 && state.payload.room.isStarted && !state.payload.room.isPaused && !draftComplete());

    const expired = remaining === 0 && state.payload.room.isStarted && !state.payload.room.isPaused;
    if (expired !== state.expired) {
      state.expired = expired;
      renderRoom();
    }
  };

  const refresh = async (force = false) => {
    try {
      const payload = await readDraft();
      const changed = force
        || !state.payload
        || payload.room.revision !== state.payload.room.revision
        || payload.picks.length !== state.payload.picks.length;
      state.serverOffset = Date.parse(payload.serverNow) - Date.now();
      state.payload = payload;
      if (state.roomKey === "main" && (changed || force)) {
        state.rosters = await window.PokeLeagueRosters.read();
      }
      if (changed) renderRoom();
      updateClock();
    } catch (error) {
      if (force) throw error;
      elements.clockDetail.textContent = `Connection issue: ${error.message}`;
    }
  };

  const setBusy = (busy) => {
    state.busy = busy;
    if (state.payload) renderRoom();
  };

  const submitPick = async (pokemon) => {
    if (!canViewerPick()) return;
    const onClock = expectedTeam();
    const question = state.payload.viewer.isAdmin
      ? `Draft ${pokemon.name} for ${TEAM_CONFIG[onClock].name}?`
      : `Draft ${pokemon.name} for your roster?`;
    if (!window.confirm(question)) return;

    setBusy(true);
    try {
      await rpc("submit_flash_family_live_draft_pick", {
        p_access_code: state.accessCode,
        p_room_key: state.roomKey,
        p_pokemon_slug: slugify(pokemon.name),
        p_for_team_id: state.payload.viewer.isAdmin ? onClock : null,
      });
      await refresh(true);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  const controlDraft = async (action, value = null) => {
    setBusy(true);
    try {
      await rpc("control_flash_family_live_draft", {
        p_access_code: state.accessCode,
        p_room_key: state.roomKey,
        p_action: action,
        p_value: value,
      });
      await refresh(true);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  const stopLiveUpdates = () => {
    clearInterval(state.pollTimer);
    clearInterval(state.clockTimer);
    clearTimeout(state.cpuTimer);
    state.pollTimer = null;
    state.clockTimer = null;
    state.cpuTimer = null;
  };

  const openLive = async () => {
    state.accessCode = (localStorage.getItem("pokeleague.accessCode") || sessionStorage.getItem("pokeleague.accessCode") || "").trim().toUpperCase();
    if (!state.accessCode) {
      showEntryStatus("Enter your league access code on the title screen first.", true);
      return;
    }

    state.roomKey = TEST_CODES.has(state.accessCode) ? "test" : "main";
    state.participants = participantsForRoom();
    showEntryStatus("Connecting to the draft room…");
    elements.openLive.disabled = true;

    try {
      if (!state.initialized) {
        const response = await fetch("data/pokemon-catalog.json?v=consolidated-forms1", { cache: "no-store" });
        if (!response.ok) throw new Error("The Pokémon draft board is unavailable.");
        const catalog = await response.json();
        // Live values must match the server-enforced official draft pool exactly.
        state.catalog = catalog;
        state.byName = new Map(state.catalog.map((pokemon) => [pokemon.name, pokemon]));
        state.bySlug = new Map(state.catalog.map((pokemon) => [slugify(pokemon.name), pokemon]));
        state.initialized = true;
      }

      await refresh(true);
      elements.entry.hidden = true;
      elements.mockSetup.hidden = true;
      elements.mockApp.hidden = true;
      elements.live.hidden = false;
      showEntryStatus("");
      stopLiveUpdates();
      state.pollTimer = window.setInterval(() => refresh(false), POLL_INTERVAL);
      state.clockTimer = window.setInterval(updateClock, 250);
      window.scrollTo({ top: elements.live.offsetTop - 18, behavior: "smooth" });
    } catch (error) {
      showEntryStatus(error.message, true);
    } finally {
      elements.openLive.disabled = false;
    }
  };

  const openMock = () => {
    stopLiveUpdates();
    elements.entry.hidden = true;
    elements.live.hidden = true;
    elements.mockSetup.hidden = false;
    window.scrollTo({ top: elements.mockSetup.offsetTop - 18, behavior: "smooth" });
  };

  const leaveLive = () => {
    stopLiveUpdates();
    elements.live.hidden = true;
    elements.entry.hidden = false;
    showEntryStatus(state.roomKey === "test" ? "Your DraftTest code opens the private full-league test room." : "");
    window.scrollTo({ top: elements.entry.offsetTop - 18, behavior: "smooth" });
  };

  const clearFilters = () => {
    elements.nameFilter.value = "";
    elements.pointFilter.value = "";
    elements.typeFilter.value = "";
    renderPokemon();
  };

  const initialize = () => {
    for (let points = 10; points >= 1; points -= 1) {
      elements.pointFilter.insertAdjacentHTML("beforeend", `<option value="${points}">${points} points</option>`);
    }
    Object.keys(TYPE_COLORS).sort().forEach((type) => {
      elements.typeFilter.insertAdjacentHTML("beforeend", `<option value="${type}">${type}</option>`);
    });

    elements.openLive.addEventListener("click", openLive);
    elements.openMock.addEventListener("click", openMock);
    elements.leave.addEventListener("click", leaveLive);
    [elements.nameFilter, elements.pointFilter, elements.typeFilter].forEach((control) => control.addEventListener("input", renderPokemon));
    elements.clearFilters.addEventListener("click", clearFilters);
    elements.start.addEventListener("click", () => controlDraft("start"));
    elements.pause.addEventListener("click", () => controlDraft("pause"));
    elements.undo.addEventListener("click", () => {
      if (window.confirm("Undo the most recent live pick? The main-draft Pokémon will also be removed from that team’s permanent roster.")) controlDraft("undo");
    });
    elements.reset.addEventListener("click", () => {
      const label = state.roomKey === "test" ? "TEST DRAFT" : "MAIN DRAFT";
      if (window.confirm(`Reset the entire ${label}? Every pick will be cleared${state.roomKey === "main" ? " and all main-draft roster additions will be removed" : ""}.`)) controlDraft("reset");
    });
    elements.timerSetting.addEventListener("change", () => controlDraft("set_timer", Number(elements.timerSetting.value)));

    const currentCode = (localStorage.getItem("pokeleague.accessCode") || "").trim().toUpperCase();
    if (TEST_CODES.has(currentCode)) showEntryStatus("Your DraftTest code opens the private 14-team TEST DRAFT; four teams are human-controlled.");
    window.addEventListener("pokeleague:draft-advisor-ready", () => {
      if (state.payload && !elements.live.hidden) renderRecommendation();
    });
  };

  initialize();
})();
