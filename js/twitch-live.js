(() => {
  const panel = document.querySelector("[data-twitch-live]");
  if (!panel) return;
  const endpoint = "https://cgvxehwqoviihxndupoj.supabase.co/functions/v1/twitch-live";
  const toggle = panel.querySelector("[data-twitch-toggle]");
  const list = panel.querySelector("[data-twitch-streams]");
  const count = panel.querySelector("[data-twitch-count]");
  const updated = panel.querySelector("[data-twitch-updated]");
  let channels = [], teams = [], busy = false, lastRequest = 0, expiryTimer, refreshTimer;
  // Start as a compact notification so live channels never cover the league menu.
  let expanded = false, signature = "", checkedAt = 0;
  const read = async url => {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Live status unavailable");
    return response.json();
  };
  const conceal = () => {
    panel.hidden = true; checkedAt = 0; signature = "";
    list.replaceChildren(); clearTimeout(expiryTimer);
  };
  const setExpanded = () => {
    toggle.setAttribute("aria-expanded", String(expanded));
    list.hidden = !expanded; updated.hidden = !expanded;
    panel.classList.toggle("is-collapsed", !expanded);
  };
  toggle.addEventListener("click", () => { expanded = !expanded; setExpanded(); });
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape" && expanded) { expanded = false; setExpanded(); toggle.focus(); }
  });
  function render(data) {
    const time = Date.parse(data.checkedAt);
    const age = Date.now() - time;
    if (data.status !== "ok" || !Array.isArray(data.streams) || !Number.isFinite(time) || age > 120000 || age < -30000) return conceal();
    const streams = channels.flatMap(channel => {
      const stream = data.streams.find(row => row.login === channel.login && row.teamId === channel.teamId);
      const team = teams.find(row => row.teamId === channel.teamId);
      return stream && team ? [{ ...stream, team }] : [];
    });
    if (!streams.length) return conceal();
    const nextSignature = JSON.stringify(streams);
    if (signature !== nextSignature) {
      // Keep keyboard focus on the same channel if a viewer count/title refreshes.
      const focusedLogin = document.activeElement?.closest("[data-twitch-login]")?.dataset.twitchLogin;
      const fragment = document.createDocumentFragment();
      streams.forEach(stream => {
        const item = document.createElement("li"), link = document.createElement("a");
        link.className = "twitch-stream"; link.dataset.twitchLogin = stream.login;
        link.href = `https://www.twitch.tv/${stream.login}`; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `${stream.team.accountName} is live on Twitch. ${stream.team.teamName}. Opens in a new tab.`);
        link.style.setProperty("--stream-accent", stream.team.theme?.accent || "#a970ff");
        link.style.setProperty("--stream-highlight", stream.team.theme?.highlight || "#cfb1ff");
        link.style.setProperty("--stream-deep", stream.team.theme?.deep || "#25183c");
        const logo = document.createElement("img");
        logo.src = stream.team.logo; logo.alt = ""; logo.width = 46; logo.height = 46;
        const copy = document.createElement("span"); copy.className = "twitch-stream-copy";
        const name = document.createElement("strong"); name.textContent = stream.team.accountName;
        const teamName = document.createElement("small"); teamName.textContent = stream.team.teamName;
        const title = document.createElement("span"); title.className = "twitch-stream-title";
        title.textContent = typeof stream.title === "string" ? stream.title.slice(0, 300) : "Live on Twitch";
        title.title = title.textContent;
        const meta = document.createElement("small"); meta.className = "twitch-stream-meta";
        const viewers = Number.isFinite(stream.viewers) ? Math.max(0, Math.floor(stream.viewers)) : 0;
        meta.textContent = `${viewers.toLocaleString()} watching${stream.category ? ` · ${String(stream.category).slice(0, 100)}` : ""}`;
        copy.append(name, teamName, title, meta);
        const badge = document.createElement("span"); badge.className = "twitch-live-badge"; badge.textContent = "LIVE";
        link.append(logo, copy, badge); item.append(link); fragment.append(item);
      });
      list.replaceChildren(fragment); signature = nextSignature;
      if (focusedLogin) list.querySelector(`[data-twitch-login="${CSS.escape(focusedLogin)}"]`)?.focus({ preventScroll: true });
    }
    count.textContent = String(streams.length);
    toggle.setAttribute("aria-label", `${streams.length} league streamer${streams.length === 1 ? " is" : "s are"} live. Show or hide streams.`);
    checkedAt = time;
    updated.textContent = `Twitch · Checked ${new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    panel.hidden = false; setExpanded();
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(conceal, Math.max(0, 120000 - age));
  }
  async function refresh(force = false) {
    if (document.hidden || busy || (!force && Date.now() - lastRequest < 15000)) return;
    busy = true; lastRequest = Date.now();
    let delay = 60000;
    try {
      const data = await read(endpoint);
      if (data.status === "not_configured") delay = 300000;
      render(data);
    } catch { conceal(); }
    finally { busy = false; clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, delay); }
  }
  const returnToPage = () => {
    if (checkedAt && Date.now() - checkedAt >= 120000) conceal();
    refresh();
  };
  Promise.all([read("data/twitch-channels.json?v=twitch1"), read("data/teams.json?v=teams8")]).then(([channelData, teamData]) => {
    channels = channelData; teams = Object.values(teamData.accounts || {});
    window.addEventListener("focus", returnToPage);
    document.addEventListener("visibilitychange", returnToPage);
    window.addEventListener("pageshow", returnToPage);
    setExpanded(); refresh(true);
  }).catch(conceal);
})();
