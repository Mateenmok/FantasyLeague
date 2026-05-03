const signInButton = document.getElementById("signInButton");
const signInStatus = document.getElementById("signInStatus");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

signInButton.addEventListener("click", signIn);

emailInput.addEventListener("keydown", handleEnter);
passwordInput.addEventListener("keydown", handleEnter);

function handleEnter(event) {
  if (event.key === "Enter") {
    signIn();
  }
}

async function signIn() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    signInStatus.textContent = "Enter your email and password first.";
    return;
  }

  signInButton.disabled = true;
  signInStatus.textContent = "Signing in...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("Sign in error:", error);
    signInStatus.textContent = error.message;
    signInButton.disabled = false;
    return;
  }

  if (!data.session) {
    signInStatus.textContent = "Sign in did not return a session. Check email confirmation settings.";
    signInButton.disabled = false;
    return;
  }

  signInStatus.textContent = "Signed in. Redirecting...";
  window.location.href = "account.html?v=account-polish1";
}
