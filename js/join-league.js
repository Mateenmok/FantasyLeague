const leagueCodeInput = document.getElementById("leagueCodeInput");
const teamAccessCodeInput = document.getElementById("teamAccessCodeInput");
const joinLeagueButton = document.getElementById("joinLeagueButton");
const joinLeagueMessage = document.getElementById("joinLeagueMessage");

joinLeagueButton.addEventListener("click", joinLeague);

leagueCodeInput.addEventListener("keydown", handleEnter);
teamAccessCodeInput.addEventListener("keydown", handleEnter);

function handleEnter(event) {
  if (event.key === "Enter") {
    joinLeague();
  }
}

async function joinLeague() {
  const leagueCode = leagueCodeInput.value.trim().toUpperCase();
  const teamAccessCode = teamAccessCodeInput.value.trim().toUpperCase();

  if (!leagueCode || !teamAccessCode) {
    joinLeagueMessage.textContent = "Please enter both the league code and team access code.";
    return;
  }

  joinLeagueButton.disabled = true;
  joinLeagueMessage.textContent = "Checking account...";

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  const session = sessionData?.session || null;

  if (sessionError || !session) {
    joinLeagueMessage.textContent = "Please sign in before joining a league.";
    joinLeagueButton.disabled = false;
    return;
  }

  const userId = session.user.id;

  joinLeagueMessage.textContent = "Searching for league...";

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("league_code", leagueCode)
    .maybeSingle();

  if (leagueError || !league) {
    console.error("League lookup error:", leagueError);
    joinLeagueMessage.textContent = "League not found. Check the league code.";
    joinLeagueButton.disabled = false;
    return;
  }

  joinLeagueMessage.textContent = "Checking team access code...";

  const { data: team, error: teamError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("league_id", league.id)
    .eq("team_access_code", teamAccessCode)
    .maybeSingle();

  if (teamError || !team) {
    console.error("Team access lookup error:", teamError);
    joinLeagueMessage.textContent = "Team access code not found for this league.";
    joinLeagueButton.disabled = false;
    return;
  }

  const { data: existingUserMembership, error: existingUserError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("league_id", league.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingUserError) {
    console.error("Existing user membership error:", existingUserError);
    joinLeagueMessage.textContent = "Could not check your current league access.";
    joinLeagueButton.disabled = false;
    return;
  }

  if (existingUserMembership) {
    localStorage.removeItem("guest-mode");
    localStorage.setItem("selected-league-id", league.id);
    localStorage.setItem("selected-league-code", league.league_code || leagueCode);
    localStorage.setItem("selected-league-role", existingUserMembership.role || "");
    localStorage.setItem("selected-league-team-id", existingUserMembership.league_team_id || "");

    joinLeagueMessage.textContent = `You are already in ${league.name}. Opening league...`;
    window.location.href = "league-home.html";
    return;
  }

  const { data: existingTeamMembership, error: existingTeamError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("league_id", league.id)
    .eq("league_team_id", team.id)
    .maybeSingle();

  if (existingTeamError) {
    console.error("Existing team membership error:", existingTeamError);
    joinLeagueMessage.textContent = "Could not check whether this team has already been claimed.";
    joinLeagueButton.disabled = false;
    return;
  }

  if (existingTeamMembership) {
    joinLeagueMessage.textContent = "This team has already been claimed.";
    joinLeagueButton.disabled = false;
    return;
  }

  const role = team.is_admin ? "admin" : "manager";

  joinLeagueMessage.textContent = "Joining league...";

  const { error: insertError } = await supabaseClient
    .from("league_memberships")
    .insert({
      league_id: league.id,
      user_id: userId,
      league_team_id: team.id,
      role: role
    });

  if (insertError) {
    console.error("Membership insert error:", insertError);
    joinLeagueMessage.textContent = "Could not join league. Check the console.";
    joinLeagueButton.disabled = false;
    return;
  }

  localStorage.removeItem("guest-mode");
  localStorage.setItem("selected-league-id", league.id);
  localStorage.setItem("selected-league-code", league.league_code || leagueCode);
  localStorage.setItem("selected-league-role", role);
  localStorage.setItem("selected-league-team-id", team.id);

  joinLeagueMessage.textContent = `Joined ${league.name} as ${team.team_name}. Redirecting...`;
  window.location.href = "league-home.html";
}
