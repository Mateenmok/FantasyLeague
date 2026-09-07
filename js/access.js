(() => {
  const form = document.querySelector(".access-form");
  const input = document.querySelector("#accessCodeInput");
  const status = document.querySelector("[data-access-status]");
  if (!form || !input || !status) return;

  let accountsPromise;
  const loadAccounts = () => {
    if (!accountsPromise) {
      accountsPromise = fetch("data/teams.json?v=teams7", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Accounts unavailable");
          return response.json();
        });
    }
    return accountsPromise;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = input.value.trim().toUpperCase();
    if (!code) return;

    form.setAttribute("aria-busy", "true");
    status.textContent = "Checking your league pass...";

    try {
      const data = await loadAccounts();
      const account = data.accounts?.[code];
      if (!account) {
        status.textContent = "That access code is not on the league list.";
        input.select();
        return;
      }

      localStorage.setItem("pokeleague.accessCode", code);
      localStorage.setItem("pokeleague.accountId", account.id);
      window.location.assign(form.action);
    } catch {
      status.textContent = "The league gate is jammed. Please try again.";
    } finally {
      form.removeAttribute("aria-busy");
    }
  });
})();
