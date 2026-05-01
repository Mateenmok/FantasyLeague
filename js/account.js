const accountStatus = document.getElementById("accountStatus");
const signOutButton = document.getElementById("signOutButton");

checkSession();

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    accountStatus.textContent = "Could not check account status.";
    return;
  }

  const session = data.session;

  if (!session) {
    accountStatus.textContent = "You are not signed in.";
    signOutButton.style.display = "none";
    return;
  }

  const user = session.user;
  const displayName = user.user_metadata?.display_name || user.email;

  accountStatus.textContent = `Signed in as ${displayName}`;
}

signOutButton.addEventListener("click", async function () {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Sign out error:", error);
    accountStatus.textContent = "Could not sign out.";
    return;
  }

  window.location.href = "index.html";
});
