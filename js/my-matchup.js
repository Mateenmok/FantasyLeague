const myMatchupSubtitle = document.getElementById("myMatchupSubtitle");
const myMatchupContent = document.getElementById("myMatchupContent");
const myMatchupStatus = document.getElementById("myMatchupStatus");

const selectedLeagueId = localStorage.getItem("selected-league-id");

let currentLeague = null;
let currentMembership = null;
let myTeam = null;
let opponentTeam = null;
let currentMatchup = null;
let championsPokemon = [];
let myRosterRows = [];
let opponentRosterRows = [];
let matchupLineups = [];

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
    .eq("league_id", selectedLeagueId);

  if (teamsError) {
    console.error("Teams error:", teamsError);
    myMatchupStatus.textContent = "Could not load teams.";
    return;
  }

  myTeam = teams.find(team => team.id === currentMembership.league_team_id);

  if (!myTeam) {
    myMatchupStatus.textContent = "Could not find your assigned team.";
    return;
  }

  const matchupNumber = currentLeague.current_matchup_number || 1;

  const { data: matchups, error: matchupsError } = await supabaseClient
    .from("league_matchups")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("phase", "regular")
    .eq("matchup_number", matchupNumber);

  if (matchupsError) {
    console.error("Matchups error:", matchupsError);
    myMatchupStatus.textContent = "Could not load matchups.";
    return;
  }

  currentMatchup = (matchups || []).find(matchup =>
    matchup.team1_id === myTeam.id || matchup.team2_id === myTeam.id
  );

  if (!currentMatchup) {
    return;
  }

  const opponentId = currentMatchup.team1_id === myTeam.id
    ? currentMatchup.team2_id
    : currentMatchup.team1_id;

  opponentTeam = teams.find(team => team.id === opponentId);
}

async function loadRosterAndLineupData() {
  championsPokemon = [];

  try {
    championsPokemon = await fetch("data/champions-pokemon.json?v=my-matchup-lineups1")
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

  const { data: lineupRows, error: lineupError } = await supabaseClient
    .from("league_matchup_lineups")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("matchup_id", currentMatchup.id)
    .in("team_id", teamIds)
    .order("slot_number", { ascending: true });

  if (lineupError) {
    console.error("Lineup load error:", lineupError);
    matchupLineups = [];
  } else {
    matchupLineups = lineupRows || [];
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

  myMatchupContent.innerHTML = `
    <section class="my-matchup-feature">
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
    </section>
  `;

  bindLineupControls();

  myMatchupStatus.textContent = currentMatchup.completed
    ? "This matchup has been reported."
    : "Pick your six Pokémon for this matchup.";
}

function renderFeaturedTeam(team, label, canEditLineup) {
  const logoHtml = team.logo_url
    ? `<img class="my-matchup-logo" src="${escapeHtml(team.logo_url)}" alt="${escapeHtml(team.team_name)} logo">`
    : `<div class="my-matchup-logo-placeholder">T${team.team_number}</div>`;

  return `
    <div class="my-matchup-team-card">
      <div class="my-matchup-label">${label}</div>
      ${logoHtml}
      <h2>${escapeHtml(team.team_name)}</h2>
      <p>${formatTeamRecord(team)}</p>
      <p>${escapeHtml(team.owner_name || "Unassigned")}</p>
      ${renderMatchupLineup(team, canEditLineup)}
    </div>
  `;
}

function renderMatchupLineup(team, canEditLineup) {
  const lineupRows = matchupLineups
    .filter(row => row.team_id === team.id)
    .sort((a, b) => a.slot_number - b.slot_number);

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
        <div class="matchup-lineup-title">Choose Your 6</div>
        <div class="matchup-lineup-grid editable">
          ${myRosterRows.map(row => {
            const pokemon = getPokemonBySlug(row.pokemon_slug);
            const selected = selectedSlugs.has(row.pokemon_slug) ? "selected" : "";

            return `
              <button class="matchup-lineup-choice ${selected}" type="button" data-slug="${escapeHtml(row.pokemon_slug)}">
                ${pokemon ? `<img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">` : `<span>?</span>`}
              </button>
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

          return `
            <div class="matchup-lineup-choice locked">
              ${pokemon ? `<img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}">` : `<span>?</span>`}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function bindLineupControls() {
  const choices = Array.from(document.querySelectorAll(".matchup-lineup-choice:not(.locked)"));
  const saveButton = document.getElementById("saveMatchupLineupButton");
  const status = document.getElementById("matchupLineupStatus");

  choices.forEach(choice => {
    choice.addEventListener("click", function () {
      const selectedChoices = Array.from(document.querySelectorAll(".matchup-lineup-choice.selected"));

      if (this.classList.contains("selected")) {
        this.classList.remove("selected");
      } else if (selectedChoices.length < 6) {
        this.classList.add("selected");
      }

      const selectedCount = document.querySelectorAll(".matchup-lineup-choice.selected").length;

      if (status) {
        status.textContent = `${selectedCount}/6 selected.`;
      }
    });
  });

  if (saveButton) {
    saveButton.addEventListener("click", saveMatchupLineup);
  }
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
