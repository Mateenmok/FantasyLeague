(() => {
  const TEST_DRAFT_ACCOUNTS = {
    DRAFTTEST1: { id: "pufferz", teamId: "boston-eeltics" },
    DRAFTTEST2: { id: "kirbbles", teamId: "massachusetts-midnight" },
    DRAFTTEST3: { id: "neto", teamId: "miami-dragapults" },
    DRAFTTEST4: { id: "shdwemp", teamId: "north-carolina-ceruledge" },
  };
  const form = document.querySelector(".access-form");
  const input = document.querySelector("#accessCodeInput");
  const status = document.querySelector("[data-access-status]");
  const guestDialog = document.querySelector("[data-guest-dialog]");
  const guestForm = document.querySelector("[data-guest-form]");
  if (!form || !input || !status) return;

  let accountsPromise;
  const signIn = (code, account) => {
    localStorage.setItem("pokeleague.accessCode", code);
    localStorage.setItem("pokeleague.accountId", account.id);
    sessionStorage.removeItem("pokeleague.accessCode");
    window.location.assign(form.action);
  };
  guestForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (guestForm.getAttribute("aria-busy") === "true") return;
    const nicknameInput = guestForm.querySelector("input");
    const message = guestForm.querySelector("[data-guest-status]");
    const submit = guestForm.querySelector('[type="submit"]');
    guestForm.setAttribute("aria-busy", "true"); submit.disabled = true;
    message.textContent = "Creating your guest account…";
    try {
      const account = await window.PokeLeagueGuest.register(nicknameInput.value);
      signIn(window.PokeLeagueGuest.normalize(account.accountName), account);
    } catch (error) {
      message.textContent = error.message; nicknameInput.focus();
    } finally { guestForm.removeAttribute("aria-busy"); submit.disabled = false; }
  });
  guestDialog.querySelector("[data-guest-cancel]").addEventListener("click", () => guestDialog.close());
  const loadAccounts = () => {
    if (!accountsPromise) {
      accountsPromise = fetch("data/teams.json?v=teams8", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Accounts unavailable");
          return response.json();
        });
    }
    return accountsPromise;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.getAttribute("aria-busy") === "true") return;
    const code = window.PokeLeagueGuest.normalize(input.value);
    if (!code) return;
    if (code === "GUEST1") {
      guestForm.querySelector("[data-guest-status]").textContent = "";
      guestDialog.showModal();
      return;
    }

    form.setAttribute("aria-busy", "true");
    status.textContent = "Checking your league pass...";

    try {
      const data = await loadAccounts();
      const account = data.accounts?.[code] || TEST_DRAFT_ACCOUNTS[code] || await window.PokeLeagueGuest.read(code);
      if (!account) {
        status.textContent = "That access code is not on the league list.";
        input.select();
        return;
      }

      signIn(code, account);
    } catch {
      status.textContent = "The league gate is jammed. Please try again.";
    } finally {
      form.removeAttribute("aria-busy");
    }
  });
})();
