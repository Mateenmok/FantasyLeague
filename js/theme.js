(() => {
  const STORAGE_KEY = "pokeleague-theme";
  const root = document.documentElement;

  const readTheme = () => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch (error) {
      return "light";
    }
  };

  const saveTheme = (theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // The theme still works for this page when storage is unavailable.
    }
  };

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    root.style.colorScheme = "dark";

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const isDark = theme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "Switch to cream mode" : "Switch to dark mode");
      button.title = isDark ? "Switch to cream mode" : "Switch to dark mode";
    });
  };

  applyTheme(readTheme());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(readTheme());
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const theme = root.dataset.theme === "dark" ? "light" : "dark";
        saveTheme(theme);
        applyTheme(theme);
      });
    });
  });
})();
