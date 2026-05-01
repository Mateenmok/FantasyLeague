const myTeamSubtitle = document.getElementById("myTeamSubtitle");
const myTeamContent = document.getElementById("myTeamContent");
const myTeamStatus = document.getElementById("myTeamStatus");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let myTeam = null;
let championsPokemon = [];

loadMyTeamPage();

async function loadMyTeamPage() {
  if (!selectedLeagueId) {
    myTeamSubtitle.textContent = "No league selected.";
    myTeamStatus.textContent = "Go to My Leagues and select a league first.";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    myTeamSubtitle.textContent = "Not signed in.";
    myTeamStatus.textContent = "Sign in before viewing your team.";
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
    myTeamSubtitle.textContent = "No access.";
    myTeamStatus.textContent = "You are not a member of this league.";
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
    myTeamSubtitle.textContent = "Could not load league.";
    myTeamStatus.textContent = "Try selecting the league again.";
    return;
  }

  myTeamSubtitle.textContent = league.name;

  if (!currentMembership.league_team_id) {
    myTeamContent.innerHTML = `
      <div class="empty-state">
        <p>Your account is an admin for this league, but it is not assigned to a specific team.</p>
        <p>Use Manage League to assign your email to a team.</p>
      </div>
    `;
    myTeamStatus.textContent = "No team assigned.";
    return;
  }

  const { data: team, error: teamError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("id", currentMembership.league_team_id)
    .single();

  if (teamError || !team) {
    console.error("Team error:", teamError);
    myTeamStatus.textContent = "Could not load your team.";
    return;
  }

  myTeam = team;

  try {
    championsPokemon = await fetch("data/champions-pokemon.json").then(response => response.json());
  } catch (error) {
    console.error("Could not load Champions Pokémon data:", error);
    championsPokemon = [];
  }

  await renderMyTeam();
}

async function renderMyTeam() {
  const logoUrl = myTeam.logo_url || "";
  const ownerName = myTeam.owner_name || "Unassigned";

  const logoHtml = logoUrl
    ? `<img class="my-team-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(myTeam.team_name)} logo">`
    : `<div class="my-team-logo-placeholder">T${myTeam.team_number}</div>`;

  const rosterHtml = await getRosterHtml();

  myTeamContent.innerHTML = `
    <section class="my-team-layout">
      <div class="my-team-profile-card">
        <div class="my-team-header">
          <div class="team-number-badge">#${myTeam.team_number}</div>
          ${logoHtml}
          <div>
            <h2>${escapeHtml(myTeam.team_name)}</h2>
            <p><strong>Owner:</strong> ${escapeHtml(ownerName)}</p>
            <p><strong>Manager:</strong> ${escapeHtml(myTeam.manager_email || "Unassigned")}</p>
            <p><strong>Record:</strong> ${escapeHtml(myTeam.record || "0-0")} <span class="small-note">(Admin controlled)</span></p>
          </div>
        </div>

        <div class="team-edit-form">
          <label>Team Name</label>
          <input id="myTeamNameInput" type="text" value="${escapeHtml(myTeam.team_name)}">

          <label>Owner Name</label>
          <input id="myOwnerNameInput" type="text" value="${escapeHtml(ownerName)}">

          <label>Logo URL</label>
          <input id="myLogoUrlInput" type="text" value="${escapeHtml(logoUrl)}" placeholder="Paste image URL">

          <button id="saveMyTeamButton" class="pkmn-button small">Save My Team</button>
        </div>
      </div>

      <div class="my-team-roster-card">
        <h2>Drafted Roster</h2>
        ${rosterHtml}
      </div>
    </section>
  `;

  document.getElementById("saveMyTeamButton").addEventListener("click", saveMyTeam);
  myTeamStatus.textContent = "My Team loaded.";
}

async function getRosterHtml() {
  const { data: rosterRows, error } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("team_id", myTeam.id)
    .order("slot_number", { ascending: true });

  if (error) {
    console.error("Roster load error:", error);
    return `<div class="empty-state"><p>Roster not connected yet.</p></div>`;
  }

  if (!rosterRows || rosterRows.length === 0) {
    return `<div class="empty-state"><p>No Pokémon drafted yet.</p></div>`;
  }

  return `
    <div class="my-team-roster-grid">
      ${rosterRows.map(row => {
        const pokemon = championsPokemon.find(p => p.slug === row.pokemon_slug);

        if (!pokemon) {
          return `
            <div class="my-team-roster-slot">
              <div class="missing-image">?</div>
              <p>${escapeHtml(row.pokemon_slug)}</p>
            </div>
          `;
        }

        return `
          <div class="my-team-roster-slot">
            <img src="${pokemon.image}" alt="${escapeHtml(pokemon.name)}">
            <p>${escapeHtml(pokemon.name)}</p>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function saveMyTeam() {
  const teamName = document.getElementById("myTeamNameInput").value.trim() || `Team ${myTeam.team_number}`;
  const ownerName = document.getElementById("myOwnerNameInput").value.trim() || "Unassigned";
  const logoUrl = document.getElementById("myLogoUrlInput").value.trim();

  myTeamStatus.textContent = "Saving team...";

  const { error } = await supabaseClient
    .from("league_teams")
    .update({
      team_name: teamName,
      owner_name: ownerName,
      logo_url: logoUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", myTeam.id)
    .eq("league_id", selectedLeagueId);

  if (error) {
    console.error("Save My Team error:", error);
    myTeamStatus.textContent = "Error saving team. Check the console.";
    return;
  }

  const { data: updatedTeam, error: reloadError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("id", myTeam.id)
    .single();

  if (!reloadError && updatedTeam) {
    myTeam = updatedTeam;
  }

  myTeamStatus.textContent = "My Team saved.";
  await renderMyTeam();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
