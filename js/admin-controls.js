(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);

  const elements = {
    gate: $("[data-admin-gate]"),
    workspace: $("[data-admin-workspace]"),
    season: $("[data-admin-season]"),
    currentWeek: $("[data-current-week]"),
    nextWeek: $("[data-next-week]"),
    totalWeeks: $("[data-total-weeks]"),
    pointCap: $("[data-point-cap]"),
    advanceWeek: $("[data-advance-week]"),
    tabs: $$("[data-admin-tab]"),
    panels: $$("[data-admin-panel]"),
    scoreTab: $("[data-score-tab]"),
    rosterTeams: $("[data-roster-teams]"),
    selectedTeamLogo: $("[data-selected-team-logo]"),
    selectedTeamName: $("[data-selected-team-name]"),
    selectedTeamBudget: $("[data-selected-team-budget]"),
    managedRoster: $("[data-managed-roster]"),
    rosterSearch: $("[data-roster-search]"),
    rosterResults: $("[data-roster-results]"),
    scoreLock: $("[data-score-lock]"),
    scoreForm: $("[data-score-form]"),
    scoreRows: $("[data-score-rows]"),
    scheduleWeek: $("[data-schedule-week]"),
    scheduleForm: $("[data-schedule-form]"),
    scheduleRows: $("[data-schedule-rows]"),
    seasonForm: $("[data-season-form]"),
    seasonWeeks: $("[data-season-weeks]"),
    seasonPointCap: $("[data-season-point-cap]"),
    waiverWindowForm: $("[data-waiver-window-form]"),
    waiverWindowStart: $("[data-waiver-window-start]"),
    waiverWindowEnd: $("[data-waiver-window-end]"),
    waiverWindowPreview: $("[data-waiver-window-preview]"),
    playoffForm: $("[data-playoff-form]"),
    playoffCount: $("[data-playoff-count]"),
    playoffSeeds: $("[data-playoff-seeds]"),
    bracketPreview: $("[data-bracket-preview]"),
    pointSearch: $("[data-point-search]"),
    pointResults: $("[data-point-results]"),
    status: $("[data-admin-status]"),
  };

  let accounts = {};
  let teams = [];
  let baseCatalog = [];
  let catalog = [];
  let leagueState = window.PokeLeagueState.read();
  let waiverSettings = { startAt: null, endAt: null, pointCap: 50, rosterCap: 10, totalWeeks: 10 };
  let selectedTeamId = "boston-eeltics";
  let adminAccessCode = "";
  let rosterWritePending = false;
  let statusTimer;

  const findTeam = (teamId) => teams.find((team) => team.id === teamId);
  const findPokemon = (name) => catalog.find((pokemon) => pokemon.name === name);
  const rosterFor = (teamId) => Array.isArray(leagueState.rosters?.[teamId]) ? leagueState.rosters[teamId] : [];
  const pointValue = (pokemon) => Number(pokemon?.sortPoints ?? pokemon?.points) || 0;
  const rosterPoints = (teamId) => rosterFor(teamId).reduce((sum, name) => sum + pointValue(findPokemon(name)), 0);
  const scheduleWeek = () => Math.max(1, leagueState.currentWeek);

  const announce = (message, isError = false) => {
    clearTimeout(statusTimer);
    elements.status.textContent = message;
    elements.status.style.background = isError ? "#8b1f2c" : "#101113";
    statusTimer = setTimeout(() => { elements.status.textContent = ""; }, 4200);
  };

  const saveState = (message) => {
    leagueState = window.PokeLeagueState.write(leagueState);
    catalog = window.PokeLeagueState.applyCatalog(baseCatalog, leagueState);
    renderStatus();
    if (message) announce(message);
  };

  const formatDateTime = (value) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Not set";

  const toLocalInputValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const renderWaiverSettings = () => {
    elements.waiverWindowStart.value = toLocalInputValue(waiverSettings.startAt);
    elements.waiverWindowEnd.value = toLocalInputValue(waiverSettings.endAt);
    if (!waiverSettings.startAt || !waiverSettings.endAt) {
      elements.waiverWindowPreview.textContent = "Waiver period not scheduled. Transactions are closed.";
      return;
    }
    const now = Date.now();
    const start = new Date(waiverSettings.startAt).getTime();
    const end = new Date(waiverSettings.endAt).getTime();
    const status = now < start ? "Scheduled" : now <= end ? "Open now" : "Closed";
    elements.waiverWindowPreview.textContent = `${status} · ${formatDateTime(waiverSettings.startAt)} to ${formatDateTime(waiverSettings.endAt)}`;
  };

  const renderStatus = () => {
    elements.season.textContent = leagueState.season;
    elements.currentWeek.textContent = leagueState.currentWeek;
    elements.nextWeek.textContent = Math.min(leagueState.currentWeek + 1, leagueState.totalWeeks);
    elements.totalWeeks.textContent = leagueState.totalWeeks;
    elements.pointCap.textContent = leagueState.pointCap;
    elements.seasonWeeks.value = leagueState.totalWeeks;
    elements.seasonPointCap.value = leagueState.pointCap;
    elements.advanceWeek.disabled = leagueState.currentWeek >= leagueState.totalWeeks;
    elements.advanceWeek.lastChild.textContent = leagueState.currentWeek >= leagueState.totalWeeks ? " Season Complete" : "";
    const nextWeekNode = $("[data-next-week]", elements.advanceWeek);
    if (nextWeekNode) nextWeekNode.textContent = Math.min(leagueState.currentWeek + 1, leagueState.totalWeeks);
    elements.scoreTab.disabled = leagueState.currentWeek === 0;
    elements.scoreTab.title = leagueState.currentWeek === 0 ? "Scores unlock in Week 1" : "";
  };

  const setActiveTab = (name) => {
    if (name === "scores" && leagueState.currentWeek === 0) {
      announce("Input Scores unlocks after Week 0.", true);
      return;
    }
    elements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.adminTab === name));
    elements.panels.forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== name; });
    if (name === "rosters") renderRosterManager();
    if (name === "scores") renderScores();
    if (name === "schedule") renderSchedule();
    if (name === "waivers") renderWaiverSettings();
    if (name === "playoffs") renderPlayoffs();
    if (name === "points") renderPointResults();
  };

  const teamOptions = (selectedId) => teams.map((team) => (
    `<option value="${escapeHtml(team.id)}"${team.id === selectedId ? " selected" : ""}>${escapeHtml(team.name)}</option>`
  )).join("");

  const ownerMap = () => {
    const owners = new Map();
    Object.entries(leagueState.rosters || {}).forEach(([teamId, roster]) => {
      (Array.isArray(roster) ? roster : []).forEach((name) => owners.set(name, teamId));
    });
    return owners;
  };

  const renderTeamPicker = () => {
    elements.rosterTeams.innerHTML = teams.map((team) => `
      <button class="admin-team-button${team.id === selectedTeamId ? " is-active" : ""}" type="button" data-team-id="${escapeHtml(team.id)}" title="Manage ${escapeHtml(team.name)}">
        <img src="${escapeHtml(team.logo)}" alt="" loading="lazy">
        <span>${escapeHtml(team.name)}</span>
      </button>
    `).join("");
  };

  const renderManagedRoster = () => {
    const team = findTeam(selectedTeamId) || teams[0];
    if (!team) return;
    selectedTeamId = team.id;
    const roster = rosterFor(team.id);
    elements.selectedTeamLogo.src = team.logo;
    elements.selectedTeamName.textContent = team.name;
    elements.selectedTeamBudget.textContent = `${rosterPoints(team.id)} / ${leagueState.pointCap} points · ${roster.length} / 10 Pokémon`;
    const slots = Array.from({ length: 10 }, (_, index) => {
      const pokemon = findPokemon(roster[index]);
      if (!pokemon) return `<div class="managed-slot managed-slot--empty"><span>${index + 1}. Open roster slot</span></div>`;
      return `
        <div class="managed-slot">
          <img src="${escapeHtml(pokemon.sprite)}" alt="" loading="lazy">
          <span><strong>${index + 1}. ${escapeHtml(pokemon.name)}</strong><small>${escapeHtml(pokemon.tier)} · ${pointValue(pokemon)} points</small></span>
          <button class="admin-row-button admin-row-button--remove" type="button" data-remove-pokemon="${escapeHtml(pokemon.name)}">Remove</button>
        </div>`;
    });
    elements.managedRoster.innerHTML = slots.join("");
  };

  const filteredCatalog = (query) => {
    const needle = String(query || "").trim().toLowerCase();
    return catalog.filter((pokemon) => !needle || pokemon.name.toLowerCase().includes(needle)).slice(0, 40);
  };

  const renderRosterResults = () => {
    const owners = ownerMap();
    const roster = rosterFor(selectedTeamId);
    const pointsUsed = rosterPoints(selectedTeamId);
    elements.rosterResults.innerHTML = filteredCatalog(elements.rosterSearch.value).map((pokemon) => {
      const ownerId = owners.get(pokemon.name);
      const owner = findTeam(ownerId);
      const onSelectedTeam = ownerId === selectedTeamId;
      const tooExpensive = pointsUsed + pointValue(pokemon) > leagueState.pointCap;
      const full = roster.length >= 10;
      const disabled = Boolean(ownerId) || tooExpensive || full;
      let note = `${pokemon.tier} · ${pointValue(pokemon)} points`;
      if (onSelectedTeam) note = "Already on this roster";
      else if (owner) note = `Drafted by ${owner.name}`;
      else if (tooExpensive) note = "Would exceed this team's point cap";
      else if (full) note = "Roster is full";
      return `
        <div class="pokemon-result">
          <img src="${escapeHtml(pokemon.sprite)}" alt="" loading="lazy">
          <span><strong>${escapeHtml(pokemon.name)}</strong><small>${escapeHtml(note)}</small></span>
          <button class="admin-row-button" type="button" data-add-pokemon="${escapeHtml(pokemon.name)}" ${disabled ? "disabled" : ""}>Add</button>
        </div>`;
    }).join("") || `<p>No Pokémon match that search.</p>`;
  };

  const renderRosterManager = () => {
    renderTeamPicker();
    renderManagedRoster();
    renderRosterResults();
  };

  const defaultSchedule = (week) => {
    if (!teams.length) return [];
    const ids = teams.map((team) => team.id);
    const fixed = ids[0];
    const rotating = ids.slice(1);
    const offset = Math.max(0, Number(week) - 1) % rotating.length;
    const shifted = rotating.slice(offset).concat(rotating.slice(0, offset));
    const order = [fixed, ...shifted];
    return Array.from({ length: order.length / 2 }, (_, index) => ({
      home: order[index],
      away: order[order.length - 1 - index],
    }));
  };

  const renderSchedule = () => {
    const week = scheduleWeek();
    elements.scheduleWeek.textContent = week;
    const matchups = leagueState.schedules?.[week] || defaultSchedule(week);
    elements.scheduleRows.innerHTML = matchups.map((matchup, index) => `
      <div class="matchup-row" data-schedule-row>
        <div class="matchup-field"><label>Matchup ${index + 1} · Home</label><select data-home-team>${teamOptions(matchup.home)}</select></div>
        <span class="matchup-versus">VS</span>
        <div class="matchup-field"><label>Away</label><select data-away-team>${teamOptions(matchup.away)}</select></div>
      </div>`).join("");
  };

  const renderScores = () => {
    const locked = leagueState.currentWeek === 0;
    elements.scoreLock.hidden = !locked;
    elements.scoreForm.hidden = locked;
    if (locked) return;
    const week = leagueState.currentWeek;
    const schedule = leagueState.schedules?.[week] || defaultSchedule(week);
    const savedScores = leagueState.scores?.[week] || [];
    elements.scoreRows.innerHTML = schedule.map((matchup, index) => {
      const result = savedScores.find((score) => score.home === matchup.home && score.away === matchup.away) || {};
      const home = findTeam(matchup.home);
      const away = findTeam(matchup.away);
      return `
        <div class="matchup-row score-matchup" data-score-row data-home="${escapeHtml(matchup.home)}" data-away="${escapeHtml(matchup.away)}">
          <div class="score-team"><img src="${escapeHtml(home?.logo || "")}" alt=""><span>${escapeHtml(home?.name || matchup.home)}</span><input class="score-input" data-home-score type="number" min="0" step="1" aria-label="${escapeHtml(home?.name)} score" value="${result.homeScore ?? ""}"></div>
          <span class="matchup-versus">–</span>
          <div class="score-team"><img src="${escapeHtml(away?.logo || "")}" alt=""><span>${escapeHtml(away?.name || matchup.away)}</span><input class="score-input" data-away-score type="number" min="0" step="1" aria-label="${escapeHtml(away?.name)} score" value="${result.awayScore ?? ""}"></div>
        </div>`;
    }).join("");
  };

  const playoffTeamIds = () => {
    const count = Number(elements.playoffCount.value) || 8;
    const saved = Array.isArray(leagueState.playoffs?.seeds) ? leagueState.playoffs.seeds : [];
    return Array.from({ length: count }, (_, index) => saved[index] || teams[index]?.id || "");
  };

  const renderBracket = () => {
    const seeds = $$("[data-seed-team]", elements.playoffSeeds).map((select) => select.value);
    const games = [];
    for (let index = 0; index < Math.ceil(seeds.length / 2); index += 1) {
      const topSeed = index;
      const bottomSeed = seeds.length - 1 - index;
      if (topSeed >= bottomSeed) break;
      const first = findTeam(seeds[topSeed]);
      const second = findTeam(seeds[bottomSeed]);
      games.push(`<div class="bracket-game"><span>Game ${index + 1}</span><br>#${topSeed + 1} ${escapeHtml(first?.name || "TBD")} vs #${bottomSeed + 1} ${escapeHtml(second?.name || "TBD")}</div>`);
    }
    elements.bracketPreview.innerHTML = games.join("");
  };

  const renderPlayoffs = () => {
    elements.playoffCount.value = String(leagueState.playoffs?.teamCount || 8);
    const seeds = playoffTeamIds();
    elements.playoffSeeds.innerHTML = seeds.map((teamId, index) => `
      <label class="seed-row"><strong>#${index + 1}</strong><select data-seed-team>${teamOptions(teamId)}</select></label>
    `).join("");
    renderBracket();
  };

  const renderPointResults = () => {
    const query = elements.pointSearch.value;
    elements.pointResults.innerHTML = filteredCatalog(query).map((pokemon) => {
      const overridden = Object.prototype.hasOwnProperty.call(leagueState.pointOverrides || {}, pokemon.name);
      return `
        <div class="point-row" data-point-row="${escapeHtml(pokemon.name)}">
          <img src="${escapeHtml(pokemon.sprite)}" alt="" loading="lazy">
          <span><strong>${escapeHtml(pokemon.name)}</strong><small>${overridden ? "Custom league value" : "Season default"}</small></span>
          <input data-point-input type="number" min="1" max="99" value="${pointValue(pokemon)}" aria-label="${escapeHtml(pokemon.name)} points">
          <span class="point-tier">${escapeHtml(pokemon.tier)}</span>
          <button class="admin-row-button" type="button" data-save-points>Save</button>
          <button class="admin-row-button admin-row-button--remove" type="button" data-reset-points ${overridden ? "" : "disabled"}>Reset</button>
        </div>`;
    }).join("") || `<p>No Pokémon match that search.</p>`;
  };

  const persistRoster = async (teamId, roster, message) => {
    if (rosterWritePending) return false;
    rosterWritePending = true;
    announce("Saving roster…");
    try {
      await window.PokeLeagueRosters.replace(teamId, roster, adminAccessCode);
      leagueState.rosters[teamId] = roster;
      saveState(message);
      return true;
    } catch (error) {
      announce(error.message || "Roster could not be saved.", true);
      return false;
    } finally {
      rosterWritePending = false;
    }
  };

  const addPokemon = async (name) => {
    const pokemon = findPokemon(name);
    const roster = [...rosterFor(selectedTeamId)];
    if (!pokemon || ownerMap().has(name) || roster.length >= 10 || rosterPoints(selectedTeamId) + pointValue(pokemon) > leagueState.pointCap) return;
    roster.push(name);
    if (await persistRoster(selectedTeamId, roster, `${name} added to ${findTeam(selectedTeamId)?.name}.`)) {
      renderRosterManager();
    }
  };

  const removePokemon = async (name) => {
    const roster = rosterFor(selectedTeamId).filter((pokemonName) => pokemonName !== name);
    if (await persistRoster(selectedTeamId, roster, `${name} removed from ${findTeam(selectedTeamId)?.name}.`)) {
      renderRosterManager();
    }
  };

  const saveSchedule = () => {
    const matchups = $$("[data-schedule-row]", elements.scheduleRows).map((row) => ({
      home: $("[data-home-team]", row).value,
      away: $("[data-away-team]", row).value,
    }));
    const participants = matchups.flatMap((matchup) => [matchup.home, matchup.away]);
    if (matchups.some((matchup) => matchup.home === matchup.away) || new Set(participants).size !== teams.length || participants.length !== teams.length) {
      announce("Every team must appear exactly once, with no team playing itself.", true);
      return false;
    }
    leagueState.schedules[scheduleWeek()] = matchups;
    saveState(`Week ${scheduleWeek()} schedule saved.`);
    return true;
  };

  const advanceWeek = () => {
    if (leagueState.currentWeek >= leagueState.totalWeeks) return;
    leagueState.currentWeek += 1;
    const week = leagueState.currentWeek;
    if (!leagueState.schedules[week]) leagueState.schedules[week] = defaultSchedule(week);
    saveState(`Advanced to Week ${week}. Review and save the matchups below.`);
    setActiveTab("schedule");
    $("[data-admin-panel='schedule']")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bindEvents = () => {
    elements.tabs.forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.adminTab)));
    elements.advanceWeek.addEventListener("click", advanceWeek);
    elements.rosterTeams.addEventListener("click", (event) => {
      const button = event.target.closest("[data-team-id]");
      if (!button) return;
      selectedTeamId = button.dataset.teamId;
      renderRosterManager();
    });
    elements.rosterSearch.addEventListener("input", renderRosterResults);
    elements.rosterResults.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-pokemon]");
      if (button && !button.disabled) addPokemon(button.dataset.addPokemon);
    });
    elements.managedRoster.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-pokemon]");
      if (button) removePokemon(button.dataset.removePokemon);
    });
    elements.scheduleForm.addEventListener("submit", (event) => { event.preventDefault(); saveSchedule(); });
    elements.scoreForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (leagueState.currentWeek === 0) return;
      const results = [];
      for (const row of $$("[data-score-row]", elements.scoreRows)) {
        const homeValue = $("[data-home-score]", row).value;
        const awayValue = $("[data-away-score]", row).value;
        if (!homeValue && !awayValue) continue;
        if (homeValue === "" || awayValue === "") {
          announce("Enter both scores for a matchup, or leave both blank.", true);
          return;
        }
        results.push({ home: row.dataset.home, away: row.dataset.away, homeScore: Number(homeValue), awayScore: Number(awayValue) });
      }
      leagueState.scores[leagueState.currentWeek] = results;
      saveState(`Week ${leagueState.currentWeek} scores saved.`);
    });
    elements.seasonForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const totalWeeks = Number(elements.seasonWeeks.value);
      const pointCap = Number(elements.seasonPointCap.value);
      if (!Number.isInteger(totalWeeks) || totalWeeks < Math.max(1, leagueState.currentWeek) || !Number.isFinite(pointCap) || pointCap < 1) {
        announce("Enter a valid season length and point cap. Season length cannot be before the current week.", true);
        return;
      }
      const submit = $("button[type='submit']", elements.seasonForm);
      submit.disabled = true;
      try {
        await window.PokeLeagueWaivers.setSeasonRules(adminAccessCode, totalWeeks, pointCap);
        leagueState.totalWeeks = totalWeeks;
        leagueState.pointCap = pointCap;
        waiverSettings.totalWeeks = totalWeeks;
        waiverSettings.pointCap = pointCap;
        saveState("Season rules saved. Draft and roster budgets are updated.");
        renderRosterManager();
      } catch (error) {
        announce(error.message || "Season rules could not be saved.", true);
      } finally {
        submit.disabled = false;
      }
    });
    elements.waiverWindowForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const start = new Date(elements.waiverWindowStart.value);
      const end = new Date(elements.waiverWindowEnd.value);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        announce("Choose a closing time after the waiver opening time.", true);
        return;
      }
      const submit = $("button[type='submit']", elements.waiverWindowForm);
      submit.disabled = true;
      try {
        await window.PokeLeagueWaivers.setWindow(adminAccessCode, start.toISOString(), end.toISOString());
        waiverSettings.startAt = start.toISOString();
        waiverSettings.endAt = end.toISOString();
        renderWaiverSettings();
        announce("Waiver period saved for every team.");
      } catch (error) {
        announce(error.message || "Waiver period could not be saved.", true);
      } finally {
        submit.disabled = false;
      }
    });
    elements.playoffCount.addEventListener("change", () => {
      const count = Number(elements.playoffCount.value);
      const existing = $$("[data-seed-team]", elements.playoffSeeds).map((select) => select.value);
      elements.playoffSeeds.innerHTML = Array.from({ length: count }, (_, index) => `
        <label class="seed-row"><strong>#${index + 1}</strong><select data-seed-team>${teamOptions(existing[index] || teams[index]?.id)}</select></label>
      `).join("");
      renderBracket();
    });
    elements.playoffSeeds.addEventListener("change", renderBracket);
    elements.playoffForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const seeds = $$("[data-seed-team]", elements.playoffSeeds).map((select) => select.value);
      if (new Set(seeds).size !== seeds.length) {
        announce("Each playoff seed must be assigned to a different team.", true);
        return;
      }
      leagueState.playoffs = { teamCount: seeds.length, seeds };
      saveState(`${seeds.length}-team playoff bracket saved.`);
    });
    elements.pointSearch.addEventListener("input", renderPointResults);
    elements.pointResults.addEventListener("click", (event) => {
      const row = event.target.closest("[data-point-row]");
      if (!row) return;
      const name = row.dataset.pointRow;
      if (event.target.closest("[data-save-points]")) {
        const value = Number($("[data-point-input]", row).value);
        if (!Number.isInteger(value) || value < 1 || value > 99) {
          announce("Point values must be whole numbers from 1 to 99.", true);
          return;
        }
        leagueState.pointOverrides[name] = value;
        saveState(`${name} is now worth ${value} points (${window.PokeLeagueState.tierForPoints(value)}).`);
        renderPointResults();
        renderRosterManager();
      }
      if (event.target.closest("[data-reset-points]")) {
        delete leagueState.pointOverrides[name];
        saveState(`${name} restored to its season default.`);
        renderPointResults();
        renderRosterManager();
      }
    });
  };

  const initialize = async () => {
    try {
      const [accountResponse, teamResponse, catalogResponse, savedRosters, savedWaiverSettings] = await Promise.all([
        fetch("data/teams.json?v=teams7", { cache: "no-store" }),
        fetch("data/league-teams.json?v=league-teams1", { cache: "no-store" }),
        fetch("data/pokemon-catalog.json?v=season-1-3"),
        window.PokeLeagueRosters.read(),
        window.PokeLeagueWaivers.readSettings(),
      ]);
      if (!accountResponse.ok || !teamResponse.ok || !catalogResponse.ok) throw new Error("League data could not be loaded.");
      accounts = (await accountResponse.json()).accounts || {};
      teams = (await teamResponse.json()).teams || [];
      baseCatalog = await catalogResponse.json();
      leagueState.rosters = window.PokeLeagueRosters.namesFromSlugs(savedRosters, baseCatalog, teams.map((team) => team.id));
      waiverSettings = savedWaiverSettings;
      leagueState.totalWeeks = savedWaiverSettings.totalWeeks;
      leagueState.pointCap = savedWaiverSettings.pointCap;
      window.PokeLeagueState.write(leagueState);
      catalog = window.PokeLeagueState.applyCatalog(baseCatalog, leagueState);

      const accessCode = localStorage.getItem("pokeleague.accessCode") || sessionStorage.getItem("pokeleague.accessCode") || "";
      const account = accounts[String(accessCode).trim().toUpperCase()];
      const params = new URLSearchParams(location.search);
      const localPreview = ["127.0.0.1", "localhost"].includes(location.hostname) && params.get("preview") === "admin";
      const authorized = account?.isAdmin === true || localPreview;
      elements.gate.hidden = authorized;
      elements.workspace.hidden = !authorized;
      if (!authorized) return;
      adminAccessCode = String(accessCode).trim().toUpperCase();

      leagueState.rosters ||= {};
      leagueState.schedules ||= {};
      leagueState.scores ||= {};
      leagueState.pointOverrides ||= {};
      selectedTeamId = account?.teamId || teams.find((team) => team.id === selectedTeamId)?.id || teams[0]?.id;
      bindEvents();
      renderStatus();
      renderWaiverSettings();
      renderRosterManager();
      renderPlayoffs();
      setActiveTab("rosters");
    } catch (error) {
      elements.gate.hidden = false;
      elements.workspace.hidden = true;
      const copy = $("p:not(.admin-kicker)", elements.gate);
      if (copy) copy.textContent = error.message || "The admin workspace could not be loaded.";
    }
  };

  initialize();
})();
