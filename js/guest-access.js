(() => {
  const normalize = value => String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
  const code = () => normalize(localStorage.getItem("pokeleague.accessCode") || sessionStorage.getItem("pokeleague.accessCode"));
  const rpc = async (name, body) => {
    const response = await fetch(`https://cgvxehwqoviihxndupoj.supabase.co/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: "sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu", "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.message || "Guest access is temporarily unavailable. Please try again.");
    return result;
  };
  let currentPromise;
  const read = (accessCode = code()) => accessCode && normalize(accessCode) !== "GUEST1"
    ? rpc("read_flash_family_guest_account", { p_access_code: normalize(accessCode) }) : Promise.resolve(null);
  const current = () => currentPromise ||= read();
  const register = nickname => rpc("register_flash_family_guest", { p_access_code: "GUEST1", p_nickname: nickname });
  const submitPick = async (accessCode, week, order, teamId) => {
    const response = await fetch("https://cgvxehwqoviihxndupoj.supabase.co/rest/v1/rpc/submit_flash_family_guest_pickem", {
      method: "POST", headers: { apikey: "sb_publishable_pB_pv3N_-EXLhXBp6OXpkA_U14NjoJu", "Content-Type": "application/json" },
      body: JSON.stringify({ p_access_code: normalize(accessCode), p_week: week, p_display_order: order, p_picked_team_id: teamId }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { const body = await response.json(); throw new Error(body.message || "The pick could not be saved."); }
  };
  window.PokeLeagueGuest = { normalize, read, current, register, submitPick };

  // Context on the menu, without relying on local role flags for permissions.
  const notice = document.querySelector("[data-guest-notice]");
  if (notice) current().then(guest => {
    if (!guest) return;
    notice.hidden = false;
    notice.querySelector("[data-guest-name]").textContent = guest.accountName;
    const teamLink = document.querySelector(".league-button--my-team");
    if (teamLink) {
      teamLink.href = "rosters.html";
      teamLink.querySelector("strong").textContent = "League Teams";
      teamLink.querySelector(".button-copy > span:last-child").textContent = "Guest view · Explore every team's roster";
    }
  }).catch(() => {});
})();
