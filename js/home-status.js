(() => {
  const seasonTarget = document.querySelector("[data-league-season]");
  const weekTarget = document.querySelector("[data-league-week]");

  fetch("data/league-status.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("League status unavailable");
      return response.json();
    })
    .then(({ season, week }) => {
      if (!Number.isInteger(season) || !Number.isInteger(week)) return;
      seasonTarget.textContent = String(season);
      weekTarget.textContent = String(week);
      document.title = `Week ${week} | Flash Family League`;
    })
    .catch(() => {
      // Keep the server-rendered Season 1 / Week 0 fallback visible.
    });
})();
