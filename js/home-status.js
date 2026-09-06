(() => {
  const seasonTarget = document.querySelector("[data-league-season]");
  const weekTarget = document.querySelector("[data-league-week]");
  const adminButton = document.querySelector("[data-admin-controls]");

  const showStatus = ({ season, currentWeek }) => {
    if (!Number.isInteger(Number(season)) || !Number.isInteger(Number(currentWeek))) return;
    seasonTarget.textContent = String(season);
    weekTarget.textContent = String(currentWeek);
    document.title = `Week ${currentWeek} | Flash Family League`;
  };

  const localState = window.PokeLeagueState?.read();
  if (localState) showStatus(localState);

  fetch("data/league-status.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("League status unavailable");
      return response.json();
    })
    .then(({ season, week }) => {
      if (localStorage.getItem(window.PokeLeagueState?.storageKey || "pokeleague.leagueState.v1")) return;
      showStatus({ season, currentWeek: week });
    })
    .catch(() => {
      // Keep the server-rendered Season 1 / Week 0 fallback visible.
    });

  if (adminButton) {
    const accessCode = localStorage.getItem("pokeleague.accessCode")?.trim().toUpperCase();
    fetch("data/teams.json?v=teams3", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (data.accounts?.[accessCode]?.isAdmin !== true) return;
        adminButton.disabled = false;
        adminButton.title = "Open Admin Controls";
        adminButton.addEventListener("click", () => window.location.assign("admin-controls.html"));
      })
      .catch(() => {});
  }

  window.addEventListener("pokeleague:statechange", (event) => showStatus(event.detail));
})();
