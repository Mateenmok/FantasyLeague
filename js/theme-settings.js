(function () {
  const STORAGE_KEY = "pokeleague-league-home-theme";

  function applyTheme() {
    const theme = localStorage.getItem(STORAGE_KEY) || "dark";

    if (document.body) {
      document.body.classList.toggle("league-light-mode", theme === "light");
      document.body.classList.toggle("league-dark-mode", theme !== "light");
    }
  }

  applyTheme();

  document.addEventListener("DOMContentLoaded", applyTheme);
})();
