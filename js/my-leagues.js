const myLeaguesList = document.getElementById("myLeaguesList");
const myLeaguesStatus = document.getElementById("myLeaguesStatus");

loadMyLeagues();

async function loadMyLeagues() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
    myLeaguesStatus.textContent = "Could not check your account.";
    return;
  }

  const session = sessionData.session;

  if (!session) {
    myLeaguesStatus.textContent = "You need to sign in first.";
    myLeaguesList.innerHTML = `
      <div class="empty-state">
        <p>You are not signed in.</p>
        <div class="league-actions" style="justify-content:center;">
          <a href="sign-in.html">Sign In</a>
        </div>
      </div>
    `;
    return;
  }

  const userId = session.user.id;

  const { data: memberships, error: membershipError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (membershipError) {
    console.error("Membership error:", membershipError);
    myLeaguesStatus.textContent = "Could not load your leagues.";
    return;
  }

  if (!memberships || memberships.length === 0) {
    myLeaguesStatus.textContent = "0/3 leagues used.";
    myLeaguesList.innerHTML = `
      <div class="empty-state">
        <p>You are not in any leagues yet.</p>
        <div class="league-actions" style="justify-content:center;">
          <a href="create-league.html">Create Your First League</a>
        </div>
      </div>
    `;
    return;
  }

  const leagueIds = memberships.map(membership => membership.league_id);

  const { data: leagues, error: leaguesError } = await supabaseClient
    .from("leagues")
    .select("*")
    .in("id", leagueIds);

  if (leaguesError) {
    console.error("Leagues error:", leaguesError);
    myLeaguesStatus.textContent = "Could not load league details.";
    return;
  }

  const leaguesById = {};

  leagues.forEach(league => {
    leaguesById[league.id] = league;
  });

  myLeaguesList.innerHTML = memberships.map(membership => {
    const league = leaguesById[membership.league_id];

    if (!league) {
      return "";
    }

    const roleLabel = membership.role === "admin" ? "League Admin" : "Team Manager";

    return `
      <div class="league-card">
        <h2>${escapeHtml(league.name)}</h2>
        <p><strong>League Code:</strong> ${escapeHtml(league.league_code)}</p>
        <p><strong>Teams:</strong> ${league.team_count}</p>
        <p><strong>Role:</strong> ${roleLabel}</p>

        <div class="league-actions">
          <button data-league-id="${league.id}" data-league-code="${league.league_code}" class="select-league-button">
            Select League
          </button>
          <a href="create-league.html" class="secondary">Create Another</a>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".select-league-button").forEach(button => {
    button.addEventListener("click", function () {
      localStorage.setItem("selected-league-id", this.dataset.leagueId);
      localStorage.setItem("selected-league-code", this.dataset.leagueCode);
      myLeaguesStatus.textContent = "League selected.";
    });
  });

  myLeaguesStatus.textContent = `${memberships.length}/3 leagues used.`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
