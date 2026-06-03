
const POKEMON_IMAGE_OVERRIDES = {
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

function normalizePokemonImageKey(value) {
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
  ].map(normalizePokemonImageKey).filter(Boolean);

  const combined = keys.join("-");

  for (const key of keys) {
    if (POKEMON_IMAGE_OVERRIDES[key]) {
      return POKEMON_IMAGE_OVERRIDES[key];
    }
  }

  if (combined.includes("galarian-slowbro") || combined.includes("slowbro-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-slowbro"];
  }

  if (combined.includes("galarian-slowking") || combined.includes("slowking-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-slowking"];
  }

  if (combined.includes("galarian-stunfisk") || combined.includes("stunfisk-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-stunfisk"];
  }

  if (combined.includes("alolan-raichu") || combined.includes("raichu-alolan")) {
    return POKEMON_IMAGE_OVERRIDES["alolan-raichu"];
  }

  if (combined.includes("alolan-ninetales") || combined.includes("ninetales-alolan")) {
    return POKEMON_IMAGE_OVERRIDES["alolan-ninetales"];
  }

  if (combined.includes("tauros") && (combined.includes("water") || combined.includes("aqua"))) {
    return POKEMON_IMAGE_OVERRIDES["water-tauros"];
  }

  if (combined.includes("tauros") && (combined.includes("fire") || combined.includes("blaze"))) {
    return POKEMON_IMAGE_OVERRIDES["fire-tauros"];
  }

  return pokemon.image || pokemon.img || pokemon.icon || pokemon.sprite || pokemon.artwork || "";
}


const myMatchupSubtitle = document.getElementById("myMatchupSubtitle");
const myMatchupContent = document.getElementById("myMatchupContent");
const myMatchupStatus = document.getElementById("myMatchupStatus");
const pokemonDetailModal = document.getElementById("pokemonDetailModal");
const pokemonDetailShell = document.getElementById("pokemonDetailShell");

const selectedLeagueId = localStorage.getItem("selected-league-id");
const POKEAPI_POKEMON_URL = "https://pokeapi.co/api/v2/pokemon/";

let currentLeague = null;
let currentMembership = null;
let myTeam = null;
let opponentTeam = null;
let currentMatchup = null;
let leagueTeams = [];
let regularSeasonMatchups = [];
let championsPokemon = [];
let myRosterRows = [];
let opponentRosterRows = [];
let matchupLineups = [];
let lineupSubmissionCounts = {};
let pokemonUsageRows = [];
let pokemonDetailCache = {};

loadMyMatchupPage();

async function loadMyMatchupPage() {
  if (!selectedLeagueId) {
    myMatchupSubtitle.textContent = "No league selected.";
    myMatchupStatus.textContent = "Go to My Leagues and select a league first.";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    myMatchupSubtitle.textContent = "Not signed in.";
    myMatchupStatus.textContent = "Sign in before viewing your matchup.";
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
    myMatchupSubtitle.textContent = "No access.";
    myMatchupStatus.textContent = "You are not a member of this league.";
    return;
  }

  currentMembership = membership;

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    myMatchupSubtitle.textContent = "Could not load league.";
    myMatchupStatus.textContent = "Try selecting the league again.";
    return;
  }

  currentLeague = league;
  myMatchupSubtitle.textContent = league.name;

  if (!currentMembership.league_team_id) {
    myMatchupContent.innerHTML = `
      <div class="empty-state">
        <p>Your account is not assigned to a specific team in this league.</p>
        <p>If you are an admin, assign yourself to a team from Manage League.</p>
      </div>
    `;
    myMatchupStatus.textContent = "No team assigned.";
    return;
  }

  await loadMatchupData();
  await loadRosterAndLineupData();
  renderMyMatchup();
}

async function loadMatchupData() {
  const { data: teams, error: teamsError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .order("team_number", { ascending: true });

  if (teamsError) {
    console.error("Teams error:", teamsError);
    myMatchupStatus.textContent = "Could not load teams.";
    return;
  }

  leagueTeams = teams || [];
  myTeam = leagueTeams.find(team => team.id === currentMembership.league_team_id);

  if (!myTeam) {
    myMatchupStatus.textContent = "Could not find your assigned team.";
    return;
  }

  const { data: matchups, error: matchupsError } = await supabaseClient
    .from("league_matchups")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("phase", "regular")
    .order("matchup_number", { ascending: true })
    .order("display_order", { ascending: true });

  if (matchupsError) {
    console.error("Matchups error:", matchupsError);
    myMatchupStatus.textContent = "Could not load matchups.";
    return;
  }

  regularSeasonMatchups = matchups || [];

  const matchupNumber = currentLeague.current_matchup_number || 1;

  currentMatchup = regularSeasonMatchups.find(matchup =>
    matchup.matchup_number === matchupNumber &&
    (matchup.team1_id === myTeam.id || matchup.team2_id === myTeam.id)
  );

  if (!currentMatchup) {
    return;
  }

  const opponentId = currentMatchup.team1_id === myTeam.id
    ? currentMatchup.team2_id
    : currentMatchup.team1_id;

  opponentTeam = leagueTeams.find(team => team.id === opponentId);
}

async function loadRosterAndLineupData() {
  championsPokemon = [];
  matchupLineups = [];
  lineupSubmissionCounts = {};
  pokemonUsageRows = [];

  try {
    championsPokemon = await fetch("data/champions-pokemon.json?v=garchomp9")
      .then(response => response.json());
  } catch (error) {
    console.error("Champions Pokémon load error:", error);
  }

  if (!currentMatchup || !myTeam || !opponentTeam) {
    return;
  }

  const teamIds = [myTeam.id, opponentTeam.id];

  const { data: rosterRows, error: rosterError } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .in("team_id", teamIds)
    .order("slot_number", { ascending: true });

  if (rosterError) {
    console.error("Roster load error:", rosterError);
    myRosterRows = [];
    opponentRosterRows = [];
  } else {
    myRosterRows = (rosterRows || []).filter(row => row.team_id === myTeam.id);
    opponentRosterRows = (rosterRows || []).filter(row => row.team_id === opponentTeam.id);
  }

  const { data: savedMyLineupRows, error: myLineupError } = await supabaseClient
    .from("league_matchup_lineups")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("matchup_id", currentMatchup.id)
    .eq("team_id", myTeam.id)
    .order("slot_number", { ascending: true });

  if (myLineupError) {
    console.error("My lineup load error:", myLineupError);
  } else {
    matchupLineups = savedMyLineupRows || [];
  }

  lineupSubmissionCounts = teamIds.reduce((counts, teamId) => ({
    ...counts,
    [teamId]: 0
  }), {});

  const { data: statusRows, error: statusError } = await supabaseClient
    .rpc("get_matchup_lineup_status", {
      target_league_id: selectedLeagueId,
      target_matchup_id: currentMatchup.id
    });

  if (statusError) {
    console.warn("Lineup status RPC unavailable, falling back to team counts:", statusError);

    const { data: countRows, error: countError } = await supabaseClient
      .from("league_matchup_lineups")
      .select("team_id")
      .eq("league_id", selectedLeagueId)
      .eq("matchup_id", currentMatchup.id)
      .in("team_id", teamIds);

    if (countError) {
      console.error("Lineup count load error:", countError);
    } else {
      (countRows || []).forEach(row => {
        lineupSubmissionCounts[row.team_id] = (lineupSubmissionCounts[row.team_id] || 0) + 1;
      });
    }
  } else {
    (statusRows || []).forEach(row => {
      lineupSubmissionCounts[row.team_id] = Number(row.selected_count || 0);
    });
  }

  lineupSubmissionCounts[myTeam.id] = Math.max(
    lineupSubmissionCounts[myTeam.id] || 0,
    matchupLineups.filter(row => row.team_id === myTeam.id).length
  );

  if (hasBothLineupsSubmitted()) {
    const { data: opponentLineupRows, error: opponentLineupError } = await supabaseClient
      .from("league_matchup_lineups")
      .select("*")
      .eq("league_id", selectedLeagueId)
      .eq("matchup_id", currentMatchup.id)
      .eq("team_id", opponentTeam.id)
      .order("slot_number", { ascending: true });

    if (opponentLineupError) {
      console.error("Opponent lineup reveal error:", opponentLineupError);
    } else {
      matchupLineups = [
        ...matchupLineups,
        ...(opponentLineupRows || [])
      ];
    }
  }

  const { data: usageRows, error: usageError } = await supabaseClient
    .from("league_matchup_lineups")
    .select("matchup_id,pokemon_slug,team_id")
    .eq("league_id", selectedLeagueId)
    .eq("team_id", myTeam.id);

  if (usageError) {
    console.warn("Usage stats unavailable:", usageError);
  } else {
    pokemonUsageRows = usageRows || [];
  }
}

function renderMyMatchup() {
  if (!currentLeague.schedule_generated) {
    myMatchupContent.innerHTML = `
      <div class="empty-state">
        <p>No schedule has been generated yet.</p>
      </div>
    `;
    myMatchupStatus.textContent = "Waiting for schedule.";
    return;
  }

  if (!currentMatchup || !opponentTeam) {
    myMatchupContent.innerHTML = `
      <div class="empty-state">
        <p>No matchup found for your team this round.</p>
      </div>
      ${renderMySchedule()}
    `;
    myMatchupStatus.textContent = "No current matchup.";
    return;
  }

  const matchupNumber = currentLeague.current_matchup_number || 1;
  const isTeam1 = currentMatchup.team1_id === myTeam.id;

  const myScore = isTeam1 ? currentMatchup.team1_score : currentMatchup.team2_score;
  const opponentScore = isTeam1 ? currentMatchup.team2_score : currentMatchup.team1_score;

  const scoreText = currentMatchup.completed
    ? `${myScore} - ${opponentScore}`
    : "Score not reported";

  const bothLineupsSubmitted = hasBothLineupsSubmitted();

  myMatchupContent.innerHTML = `
    <section class="my-matchup-feature" data-lineups-revealed="${bothLineupsSubmitted ? "true" : "false"}">
      <div class="my-matchup-round-label">
        Matchup ${matchupNumber}
      </div>

      <div class="my-matchup-teams">
        ${renderFeaturedTeam(myTeam, "Your Team", true)}

        <div class="my-matchup-score-box">
          <div class="my-matchup-score">${escapeHtml(scoreText)}</div>
          <div class="my-matchup-vs">VS</div>
          <div class="my-matchup-status">${currentMatchup.completed ? "Final" : "Pending"}</div>
        </div>

        ${renderFeaturedTeam(opponentTeam, "Opponent", false)}
      </div>

      ${renderUsagePanel()}
    </section>

    ${renderMySchedule()}
  `;

  bindLineupControls();
  bindPokemonDetailControls();

  if (currentMatchup.completed) {
    myMatchupStatus.textContent = "This matchup has been reported.";
  } else if (bothLineupsSubmitted) {
    myMatchupStatus.textContent = "Both matchup sixes are locked and revealed.";
  } else if (hasSubmittedLineup(myTeam.id)) {
    myMatchupStatus.textContent = "Your six are saved. Waiting for both teams before revealing the matchup.";
  } else {
    myMatchupStatus.textContent = "Pick your six Pokémon for this matchup.";
  }
}

function renderMySchedule() {
  if (!myTeam || !regularSeasonMatchups.length) {
    return "";
  }

  const myMatchups = regularSeasonMatchups.filter(matchup => isMyTeamMatchup(matchup));

  if (!myMatchups.length) {
    return "";
  }

  const currentNumber = currentLeague.current_matchup_number || 1;

  return `
    <section class="my-schedule-panel">
      <div class="my-schedule-header">
        <div>
          <span class="matchup-usage-kicker">My Schedule</span>
          <h3>${escapeHtml(myTeam.team_name)} regular season</h3>
        </div>
        <span>${myMatchups.length} matchups</span>
      </div>

      <div class="my-schedule-list">
        ${myMatchups.map(matchup => renderMyScheduleRow(matchup, currentNumber)).join("")}
      </div>
    </section>
  `;
}

function renderMyScheduleRow(matchup, currentNumber) {
  const isCurrent = matchup.matchup_number === currentNumber && currentLeague.season_phase !== "complete";
  const isTeam1 = matchup.team1_id === myTeam.id;
  const opponent = getTeamById(isTeam1 ? matchup.team2_id : matchup.team1_id);
  const myScore = isTeam1 ? matchup.team1_score : matchup.team2_score;
  const opponentScore = isTeam1 ? matchup.team2_score : matchup.team1_score;
  const result = getScheduleResult(matchup, isTeam1);
  const score = matchup.completed ? `${myScore} - ${opponentScore}` : "Pending";

  return `
    <article class="my-schedule-row ${isCurrent ? "current" : ""} ${matchup.completed ? "complete" : "upcoming"}">
      <div>
        <span class="my-schedule-week">Matchup ${matchup.matchup_number}</span>
        <strong>${escapeHtml(opponent ? opponent.team_name : "Unknown opponent")}</strong>
        <small>${escapeHtml(opponent?.owner_name || "Unassigned")}</small>
      </div>
      <div class="my-schedule-score">
        <strong>${escapeHtml(score)}</strong>
        <span>${escapeHtml(isCurrent ? "Current" : result)}</span>
      </div>
    </article>
  `;
}

function isMyTeamMatchup(matchup) {
  return matchup.team1_id === myTeam.id || matchup.team2_id === myTeam.id;
}

function getTeamById(teamId) {
  return leagueTeams.find(team => team.id === teamId);
}

function getScheduleResult(matchup, isTeam1) {
  if (!matchup.completed) {
    return "Upcoming";
  }

  const myScore = Number(isTeam1 ? matchup.team1_score : matchup.team2_score);
  const opponentScore = Number(isTeam1 ? matchup.team2_score : matchup.team1_score);

  if (myScore > opponentScore) return "Win";
  if (myScore < opponentScore) return "Loss";
  return "Tie";
}

function renderFeaturedTeam(team, label, canEditLineup) {
  const logoHtml = team.logo_url
    ? `<img class="my-matchup-logo" src="${escapeHtml(team.logo_url)}" alt="${escapeHtml(team.team_name)} logo">`
    : `<div class="my-matchup-logo-placeholder">T${team.team_number}</div>`;

  return `
    <div class="my-matchup-team-card">
      <div class="my-matchup-team-header">
        <div class="my-matchup-logo-frame">
          ${logoHtml}
        </div>
        <div class="my-matchup-team-meta">
          <div class="my-matchup-label">${label}</div>
          <h2>${escapeHtml(team.team_name)}</h2>
          <p>${escapeHtml(team.owner_name || "Unassigned")}</p>
          <span class="my-matchup-record-pill">${formatTeamRecord(team)}</span>
        </div>
      </div>
      ${renderMatchupLineup(team, canEditLineup)}
    </div>
  `;
}

function renderMatchupLineup(team, canEditLineup) {
  const lineupRows = getLineupRowsForTeam(team.id);

  if (canEditLineup) {
    const selectedSlugs = new Set(lineupRows.map(row => row.pokemon_slug));

    if (!myRosterRows.length) {
      return `
        <div class="matchup-lineup-panel">
          <div class="matchup-lineup-title">Matchup Six</div>
          <p class="matchup-lineup-note">No drafted Pokémon found yet.</p>
        </div>
      `;
    }

    return `
      <div class="matchup-lineup-panel">
        <div class="matchup-lineup-title-row">
          <div class="matchup-lineup-title">Choose Your 6</div>
          <span>${lineupRows.length}/6 saved</span>
        </div>
        <div class="matchup-lineup-grid editable">
          ${myRosterRows.map(row => {
            const pokemon = getPokemonBySlug(row.pokemon_slug);
            const selected = selectedSlugs.has(row.pokemon_slug) ? "selected" : "";
            const name = pokemon ? pokemon.name : row.pokemon_slug;
            const usage = getPokemonUsageStats(row.pokemon_slug);

            return `
              <div class="matchup-lineup-choice ${selected}" role="button" tabindex="0" data-slug="${escapeHtml(row.pokemon_slug)}" aria-pressed="${selected ? "true" : "false"}">
                <span class="matchup-lineup-image">
                  ${pokemon ? `<img src="${escapeHtml(getFixedPokemonImage(pokemon))}" alt="${escapeHtml(name)}">` : `<span>?</span>`}
                </span>
                <span class="matchup-lineup-copy">
                  <strong>${escapeHtml(name)}</strong>
                  <small>${formatUsageLabel(usage)}</small>
                </span>
                ${pokemon ? `<button class="pokemon-detail-button" type="button" data-pokemon-detail-slug="${escapeHtml(row.pokemon_slug)}">Details</button>` : ""}
              </div>
            `;
          }).join("")}
        </div>
        <button id="saveMatchupLineupButton" class="matchup-lineup-save-button" type="button">
          Save Matchup Six
        </button>
        <p id="matchupLineupStatus" class="matchup-lineup-note">
          ${lineupRows.length}/6 selected.
        </p>
      </div>
    `;
  }

  if (!hasBothLineupsSubmitted()) {
    const opponentSubmitted = hasSubmittedLineup(team.id);
    const mySubmitted = myTeam ? hasSubmittedLineup(myTeam.id) : false;
    let message = "Lineups stay hidden until both teams save exactly six Pokémon.";

    if (opponentSubmitted && !mySubmitted) {
      message = "Opponent is locked in. Save your six to reveal both lineups.";
    } else if (!opponentSubmitted && mySubmitted) {
      message = "Your six are locked. Waiting on the opponent.";
    } else if (opponentSubmitted && mySubmitted) {
      message = "Both teams are locked. Refreshing reveal...";
    }

    return `
      <div class="matchup-lineup-panel matchup-lineup-panel-hidden">
        <div class="matchup-lineup-title-row">
          <div class="matchup-lineup-title">Opponent Six</div>
          <span>${opponentSubmitted ? "Locked" : "Hidden"}</span>
        </div>
        <div class="matchup-lineup-grid hidden">
          ${Array.from({ length: 6 }).map((_, index) => `
            <div class="matchup-lineup-choice locked hidden-slot">
              <span>${index + 1}</span>
            </div>
          `).join("")}
        </div>
        <p class="matchup-lineup-note">${message}</p>
      </div>
    `;
  }

  if (!lineupRows.length) {
    return `
      <div class="matchup-lineup-panel">
        <div class="matchup-lineup-title">Opponent Six</div>
        <p class="matchup-lineup-note">Opponent has not submitted yet.</p>
      </div>
    `;
  }

  return `
    <div class="matchup-lineup-panel">
      <div class="matchup-lineup-title">Opponent Six</div>
      <div class="matchup-lineup-grid">
        ${lineupRows.map(row => {
          const pokemon = getPokemonBySlug(row.pokemon_slug);
          const name = pokemon ? pokemon.name : row.pokemon_slug;

          return `
            <div class="matchup-lineup-choice locked">
              <span class="matchup-lineup-image">
                ${pokemon ? `<img src="${escapeHtml(getFixedPokemonImage(pokemon))}" alt="${escapeHtml(name)}">` : `<span>?</span>`}
              </span>
              <span class="matchup-lineup-copy">
                <strong>${escapeHtml(name)}</strong>
                <small>Slot ${row.slot_number}</small>
              </span>
              ${pokemon ? `<button class="pokemon-detail-button" type="button" data-pokemon-detail-slug="${escapeHtml(row.pokemon_slug)}">Details</button>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function bindLineupControls() {
  const choices = Array.from(document.querySelectorAll(".matchup-lineup-grid.editable .matchup-lineup-choice"));
  const saveButton = document.getElementById("saveMatchupLineupButton");
  const status = document.getElementById("matchupLineupStatus");

  choices.forEach(choice => {
    choice.addEventListener("click", function (event) {
      if (event.target.closest(".pokemon-detail-button")) {
        return;
      }

      toggleLineupChoice(this, status);
    });

    choice.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLineupChoice(this, status);
    });
  });

  if (saveButton) {
    saveButton.addEventListener("click", saveMatchupLineup);
  }
}

function bindPokemonDetailControls() {
  document.querySelectorAll(".pokemon-detail-button").forEach(button => {
    button.addEventListener("click", function (event) {
      event.stopPropagation();
      openPokemonDetailModal(this.dataset.pokemonDetailSlug);
    });
  });
}

function toggleLineupChoice(choice, status) {
  const selectedChoices = Array.from(document.querySelectorAll(".matchup-lineup-choice.selected"));

  if (choice.classList.contains("selected")) {
    choice.classList.remove("selected");
    choice.setAttribute("aria-pressed", "false");
  } else if (selectedChoices.length < 6) {
    choice.classList.add("selected");
    choice.setAttribute("aria-pressed", "true");
  }

  const selectedCount = document.querySelectorAll(".matchup-lineup-choice.selected").length;

  if (status) {
    status.textContent = `${selectedCount}/6 selected.`;
  }
}

function getLineupRowsForTeam(teamId) {
  return matchupLineups
    .filter(row => row.team_id === teamId)
    .sort((a, b) => a.slot_number - b.slot_number);
}

function getSubmittedCount(teamId) {
  return Number(lineupSubmissionCounts[teamId] || 0);
}

function hasSubmittedLineup(teamId) {
  return getSubmittedCount(teamId) >= 6;
}

function hasBothLineupsSubmitted() {
  return Boolean(myTeam && opponentTeam && hasSubmittedLineup(myTeam.id) && hasSubmittedLineup(opponentTeam.id));
}

function getPokemonUsageStats(slug) {
  const rowsForPokemon = pokemonUsageRows.filter(row => row.pokemon_slug === slug);
  const totalMatchups = new Set(pokemonUsageRows.map(row => row.matchup_id)).size;
  const matchupCount = new Set(rowsForPokemon.map(row => row.matchup_id)).size;
  const usageRate = totalMatchups ? Math.round((matchupCount / totalMatchups) * 100) : 0;

  return {
    appearances: rowsForPokemon.length,
    matchupCount,
    totalMatchups,
    usageRate
  };
}

function formatUsageLabel(usage) {
  if (!usage.totalMatchups) {
    return "No usage yet";
  }

  return `${usage.matchupCount}/${usage.totalMatchups} uses • ${usage.usageRate}%`;
}

function renderUsagePanel() {
  if (!myRosterRows.length) {
    return "";
  }

  const totalMatchups = new Set(pokemonUsageRows.map(row => row.matchup_id)).size;
  const leaders = myRosterRows
    .map(row => {
      const pokemon = getPokemonBySlug(row.pokemon_slug);
      return {
        slug: row.pokemon_slug,
        name: pokemon ? pokemon.name : row.pokemon_slug,
        usage: getPokemonUsageStats(row.pokemon_slug)
      };
    })
    .sort((a, b) => b.usage.matchupCount - a.usage.matchupCount || a.name.localeCompare(b.name))
    .slice(0, 4);

  return `
    <section class="matchup-usage-panel">
      <div>
        <span class="matchup-usage-kicker">Usage Tracking</span>
        <h3>Matchup picks are now being counted.</h3>
        <p>${totalMatchups ? `${totalMatchups} saved matchup lineup${totalMatchups === 1 ? "" : "s"} tracked for your team.` : "Save your first matchup six to begin tracking usage."}</p>
      </div>
      <div class="matchup-usage-list">
        ${leaders.map(leader => `
          <div class="matchup-usage-item">
            <strong>${escapeHtml(leader.name)}</strong>
            <span>${formatUsageLabel(leader.usage)}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

async function saveMatchupLineup() {
  const selectedChoices = Array.from(document.querySelectorAll(".matchup-lineup-choice.selected"));
  const selectedSlugs = selectedChoices.map(choice => choice.dataset.slug).filter(Boolean);

  if (selectedSlugs.length !== 6) {
    myMatchupStatus.textContent = "Select exactly 6 Pokémon before saving.";
    return;
  }

  if (new Set(selectedSlugs).size !== 6) {
    myMatchupStatus.textContent = "Each selected Pokémon must be unique.";
    return;
  }

  myMatchupStatus.textContent = "Saving matchup lineup...";

  const { error: deleteError } = await supabaseClient
    .from("league_matchup_lineups")
    .delete()
    .eq("league_id", selectedLeagueId)
    .eq("matchup_id", currentMatchup.id)
    .eq("team_id", myTeam.id);

  if (deleteError) {
    console.error("Delete lineup error:", deleteError);
    myMatchupStatus.textContent = "Could not clear old lineup.";
    return;
  }

  const rows = selectedSlugs.map((slug, index) => ({
    league_id: selectedLeagueId,
    matchup_id: currentMatchup.id,
    team_id: myTeam.id,
    pokemon_slug: slug,
    slot_number: index + 1,
    updated_at: new Date().toISOString()
  }));

  const { error: insertError } = await supabaseClient
    .from("league_matchup_lineups")
    .insert(rows);

  if (insertError) {
    console.error("Insert lineup error:", insertError);
    myMatchupStatus.textContent = "Could not save matchup lineup.";
    return;
  }

  await loadRosterAndLineupData();
  renderMyMatchup();
  myMatchupStatus.textContent = "Matchup lineup saved.";
}

async function openPokemonDetailModal(slug) {
  const pokemon = getPokemonBySlug(slug);

  if (!pokemon || !pokemonDetailModal || !pokemonDetailShell) {
    myMatchupStatus.textContent = "Could not open Pokémon details.";
    return;
  }

  pokemonDetailModal.classList.add("open");
  pokemonDetailModal.setAttribute("aria-hidden", "false");
  pokemonDetailShell.innerHTML = renderPokemonDetailLoading(pokemon);
  bindPokemonDetailModalClose();

  try {
    const detail = await loadPokemonDetail(pokemon);
    pokemonDetailShell.innerHTML = renderPokemonDetail(pokemon, detail);
    bindPokemonDetailModalClose();
    bindPokemonMoveFilters(detail);
  } catch (error) {
    console.error("Pokemon detail load error:", error);
    pokemonDetailShell.innerHTML = renderPokemonDetailError(pokemon);
    bindPokemonDetailModalClose();
  }
}

async function loadPokemonDetail(pokemon) {
  const cacheKey = pokemon.slug;

  if (pokemonDetailCache[cacheKey]) {
    return pokemonDetailCache[cacheKey];
  }

  const response = await fetch(`${POKEAPI_POKEMON_URL}${encodeURIComponent(getPokeApiPokemonKey(pokemon))}`);

  if (!response.ok) {
    throw new Error(`PokeAPI returned ${response.status}`);
  }

  const data = await response.json();
  const abilities = await loadPokemonAbilities(data.abilities || []);
  const moves = normalizePokemonMoves(data.moves || []);

  pokemonDetailCache[cacheKey] = {
    abilities,
    moves
  };

  return pokemonDetailCache[cacheKey];
}

async function loadPokemonAbilities(abilityRows) {
  const rows = await Promise.all(abilityRows.map(async row => {
    const base = {
      name: formatApiName(row.ability?.name || ""),
      isHidden: Boolean(row.is_hidden),
      description: ""
    };

    if (!row.ability?.url) {
      return base;
    }

    try {
      const response = await fetch(row.ability.url);

      if (!response.ok) {
        return base;
      }

      const data = await response.json();
      const entry = (data.effect_entries || []).find(item => item.language?.name === "en") ||
        (data.flavor_text_entries || []).find(item => item.language?.name === "en");

      return {
        ...base,
        description: entry?.short_effect || entry?.effect || entry?.flavor_text || ""
      };
    } catch (error) {
      console.warn("Ability detail skipped:", error);
      return base;
    }
  }));

  return rows.sort((a, b) => Number(a.isHidden) - Number(b.isHidden) || a.name.localeCompare(b.name));
}

function normalizePokemonMoves(moveRows) {
  return moveRows.map(row => {
    const versionDetails = row.version_group_details || [];
    const latestDetail = versionDetails[versionDetails.length - 1] || {};
    const methods = Array.from(new Set(versionDetails.map(detail => detail.move_learn_method?.name).filter(Boolean)));
    const versions = Array.from(new Set(versionDetails.map(detail => detail.version_group?.name).filter(Boolean)));
    const levels = versionDetails
      .map(detail => Number(detail.level_learned_at || 0))
      .filter(level => level > 0);

    return {
      name: formatApiName(row.move?.name || ""),
      apiName: row.move?.name || "",
      methods,
      latestMethod: latestDetail.move_learn_method?.name || methods[0] || "unknown",
      latestVersion: latestDetail.version_group?.name || versions[versions.length - 1] || "",
      minLevel: levels.length ? Math.min(...levels) : null
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function renderPokemonDetailLoading(pokemon) {
  return `
    ${renderPokemonDetailHeader(pokemon)}
    <div class="pokemon-detail-body">
      <div class="pokemon-detail-section">
        <h3>Loading moves and abilities...</h3>
        <p class="matchup-lineup-note">Fetching live Pokémon data from PokéAPI.</p>
      </div>
    </div>
  `;
}

function renderPokemonDetailError(pokemon) {
  return `
    ${renderPokemonDetailHeader(pokemon)}
    <div class="pokemon-detail-body">
      <div class="pokemon-detail-section">
        <h3>Could not load details</h3>
        <p class="matchup-lineup-note">Try again later, or check your network connection.</p>
      </div>
    </div>
  `;
}

function renderPokemonDetail(pokemon, detail) {
  return `
    ${renderPokemonDetailHeader(pokemon)}
    <div class="pokemon-detail-body">
      <div class="pokemon-detail-grid">
        <section class="pokemon-detail-section">
          <h3>Abilities</h3>
          <div class="pokemon-detail-list">
            ${detail.abilities.map(ability => `
              <div class="pokemon-detail-pill">
                ${escapeHtml(ability.name)}${ability.isHidden ? " (Hidden)" : ""}
                ${ability.description ? `<small>${escapeHtml(cleanPokemonApiText(ability.description))}</small>` : ""}
              </div>
            `).join("")}
          </div>
        </section>

        <section class="pokemon-detail-section">
          <h3>Moves</h3>
          <div class="pokemon-move-tools">
            <input id="pokemonMoveSearchInput" type="search" placeholder="Search moves">
            <select id="pokemonMoveMethodSelect">
              <option value="all">All learn methods</option>
              ${getPokemonMoveMethods(detail.moves).map(method => `
                <option value="${escapeHtml(method)}">${escapeHtml(formatApiName(method))}</option>
              `).join("")}
            </select>
          </div>
          <div id="pokemonMoveList" class="pokemon-move-list">
            ${renderPokemonMoveRows(detail.moves)}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderPokemonDetailHeader(pokemon) {
  return `
    <header class="pokemon-detail-header">
      <img src="${escapeHtml(getFixedPokemonImage(pokemon))}" alt="${escapeHtml(pokemon.name)}">
      <div>
        <h2 id="pokemonDetailTitle">${escapeHtml(pokemon.name)}</h2>
        <p>${escapeHtml((pokemon.types || []).join(" / "))} • ${escapeHtml(pokemon.tier_label || `${pokemon.tier || ""} ${pokemon.points || ""}`.trim())}</p>
      </div>
      <button class="pokemon-detail-close" type="button" aria-label="Close Pokémon details">×</button>
    </header>
  `;
}

function bindPokemonMoveFilters(detail) {
  const searchInput = document.getElementById("pokemonMoveSearchInput");
  const methodSelect = document.getElementById("pokemonMoveMethodSelect");
  const moveList = document.getElementById("pokemonMoveList");

  if (!searchInput || !methodSelect || !moveList) {
    return;
  }

  function renderFilteredMoves() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const method = methodSelect.value;
    const filteredMoves = detail.moves.filter(move => {
      const matchesSearch = !searchTerm || move.name.toLowerCase().includes(searchTerm);
      const matchesMethod = method === "all" || move.methods.includes(method);
      return matchesSearch && matchesMethod;
    });

    moveList.innerHTML = renderPokemonMoveRows(filteredMoves);
  }

  searchInput.addEventListener("input", renderFilteredMoves);
  methodSelect.addEventListener("change", renderFilteredMoves);
}

function renderPokemonMoveRows(moves) {
  if (!moves.length) {
    return `<div class="pokemon-move-row">No moves found.</div>`;
  }

  return moves.map(move => `
    <div class="pokemon-move-row">
      ${escapeHtml(move.name)}
      <small>${escapeHtml(formatPokemonMoveMeta(move))}</small>
    </div>
  `).join("");
}

function formatPokemonMoveMeta(move) {
  const parts = [];

  if (move.minLevel) {
    parts.push(`Level ${move.minLevel}+`);
  }

  if (move.methods.length) {
    parts.push(move.methods.map(formatApiName).join(", "));
  }

  if (move.latestVersion) {
    parts.push(`Latest: ${formatApiName(move.latestVersion)}`);
  }

  return parts.join(" • ") || "Move data available";
}

function getPokemonMoveMethods(moves) {
  return Array.from(new Set(moves.flatMap(move => move.methods))).sort();
}

function bindPokemonDetailModalClose() {
  document.querySelectorAll(".pokemon-detail-close").forEach(button => {
    button.addEventListener("click", closePokemonDetailModal);
  });

  if (pokemonDetailModal) {
    pokemonDetailModal.addEventListener("click", function (event) {
      if (event.target === pokemonDetailModal) {
        closePokemonDetailModal();
      }
    }, { once: true });
  }
}

function closePokemonDetailModal() {
  if (!pokemonDetailModal) {
    return;
  }

  pokemonDetailModal.classList.remove("open");
  pokemonDetailModal.setAttribute("aria-hidden", "true");
}

function getPokeApiPokemonKey(pokemon) {
  if (pokemon.id) {
    return String(pokemon.id);
  }

  return String(pokemon.slug || pokemon.name || "")
    .toLowerCase()
    .replace(/^alolan-(.+)$/, "$1-alola")
    .replace(/^galarian-(.+)$/, "$1-galar")
    .replace(/^hisuian-(.+)$/, "$1-hisui")
    .replace(/[^a-z0-9-]+/g, "-");
}

function formatApiName(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanPokemonApiText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getPokemonBySlug(slug) {
  return championsPokemon.find(pokemon => pokemon.slug === slug);
}

function formatTeamRecord(team) {
  const wins = Number(team.wins ?? 0);
  const losses = Number(team.losses ?? 0);
  const ties = Number(team.ties ?? 0);

  return `${wins}-${losses}-${ties}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
