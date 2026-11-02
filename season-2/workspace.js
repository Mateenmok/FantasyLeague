(() => {
  // Keep the workspace independent of Season 1 accounts, league state and APIs.
  let hasAccess = false;
  try {
    hasAccess = sessionStorage.getItem("pokeleague.season2Workspace") === "SEASON1";
  } catch {
    // Return to the access screen if this browser cannot keep the session.
  }
  if (!hasAccess) {
    window.location.replace("../index.html");
    return;
  }
  try {
    document.documentElement.dataset.theme = localStorage.getItem("pokeleague-theme") === "dark" ? "dark" : "light";
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
