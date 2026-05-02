const leagueSubtitle = document.getElementById("leagueSubtitle");
const leagueStatus = document.getElementById("leagueStatus");
const manageLeagueLink = document.getElementById("manageLeagueLink");

loadSelectedLeague();

async function loadSelectedLeague() {
  const selectedLeagueId = localStorage.getItem("selected-league-id");
  const isGuestMode = localStorage.getItem("guest-mode") === "true";

  if (!selectedLeagueId) {
    leagueSubtitle.textContent = "No league selected.";
    leagueStatus.textContent = "Go to My Leagues or Join League and select a league first.";
    if (manageLeagueLink) manageLeagueLink.style.display = "none";
    return;
  }

  if (isGuestMode) {
    if (manageLeagueLink) manageLeagueLink.style.display = "none";

    const { data: league, error: leagueError } = await supabaseClient
      .from("leagues")
      .select("*")
      .eq("id", selectedLeagueId)
      .single();

    if (leagueError || !league) {
      console.error("Guest league load error:", leagueError);
      leagueSubtitle.textContent = "Could not load league.";
      leagueStatus.textContent = "Try entering the league code again.";
      return;
    }

    leagueSubtitle.textContent = league.name;
    leagueStatus.textContent =
      `Guest View • ${league.team_count} teams • ${league.team_count / 2} playoff teams`;
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    leagueSubtitle.textContent = "Not signed in.";
    leagueStatus.textContent = "Sign in before viewing this league, or continue as guest from the home page.";
    if (manageLeagueLink) manageLeagueLink.style.display = "none";
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
    leagueSubtitle.textContent = "No access.";
    leagueStatus.textContent = "You are not a member of this league.";
    if (manageLeagueLink) manageLeagueLink.style.display = "none";
    return;
  }

  localStorage.setItem("selected-league-role", membership.role || "");
  localStorage.setItem("selected-league-team-id", membership.league_team_id || "");

  if (manageLeagueLink && membership.role !== "admin") {
    manageLeagueLink.style.display = "none";
  }

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League load error:", leagueError);
    leagueSubtitle.textContent = "Could not load league.";
    leagueStatus.textContent = "Try selecting the league again.";
    return;
  }

  let teamText = "League Admin";

  if (membership.league_team_id) {
    const { data: team, error: teamError } = await supabaseClient
      .from("league_teams")
      .select("*")
      .eq("id", membership.league_team_id)
      .single();

    if (!teamError && team) {
      teamText = `${team.team_name} (#${team.team_number})`;
    }
  }

  const roleText = membership.role === "admin" ? "Admin" : "Team Manager";

  leagueSubtitle.textContent = league.name;

  leagueStatus.textContent =
    `${teamText} • ${roleText} • ${league.team_count} teams • ${league.team_count / 2} playoff teams`;
}
