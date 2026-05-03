const createAccountButton = document.getElementById("createAccountButton");
const createAccountStatus = document.getElementById("createAccountStatus");

createAccountButton.addEventListener("click", createAccount);

async function createAccount() {
  const displayName = document.getElementById("displayNameInput").value.trim();
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const confirmPassword = document.getElementById("confirmPasswordInput").value;

  if (!displayName || !email || !password || !confirmPassword) {
    createAccountStatus.textContent = "Fill out all fields first.";
    return;
  }

  if (password !== confirmPassword) {
    createAccountStatus.textContent = "Passwords do not match.";
    return;
  }

  if (password.length < 6) {
    createAccountStatus.textContent = "Password must be at least 6 characters.";
    return;
  }

  createAccountButton.disabled = true;
  createAccountStatus.textContent = "Creating account...";

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      },
      emailRedirectTo: `${window.location.origin}/account.html?v=account-polish1`
    }
  });

  if (error) {
    console.error("Create account error:", error);
    createAccountStatus.textContent = error.message;
    createAccountButton.disabled = false;
    return;
  }

  if (data.session) {
    createAccountStatus.textContent = "Account created. Redirecting...";
    window.location.href = "account.html?v=account-polish1";
    return;
  }

  createAccountStatus.textContent = "Account created. Check your email to confirm your account, then sign in.";
  createAccountButton.disabled = false;
}
