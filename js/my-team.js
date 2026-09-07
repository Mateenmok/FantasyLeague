(() => {
  const gate = document.querySelector("[data-team-gate]");
  const dashboard = document.querySelector("[data-team-dashboard]");
  const editor = document.querySelector("[data-team-editor]");
  const accessCode = localStorage.getItem("pokeleague.accessCode")?.trim().toUpperCase();

  const normalize = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  const showGate = () => {
    gate.hidden = false;
    dashboard.hidden = true;
  };

  const rosterCard = (pokemon) => {
    const card = document.createElement("article");
    card.className = "team-pokemon-card";

    const image = document.createElement("img");
    image.src = pokemon.sprite;
    image.alt = `${pokemon.name} menu sprite`;
    image.width = 110;
    image.height = 110;

    const copy = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = pokemon.name;
    const meta = document.createElement("p");
    meta.textContent = `${pokemon.tier} · ${pokemon.points} PTS`;
    copy.append(name, meta);
    card.append(image, copy);
    return card;
  };

  const renderRoster = (roster, catalog) => {
    const target = document.querySelector("[data-team-roster]");
    const count = document.querySelector("[data-roster-count]");
    const pokemon = roster
      .map((entry) => catalog.find((candidate) => normalize(candidate.name) === normalize(entry)))
      .filter(Boolean);

    count.textContent = `${pokemon.length} Pokémon`;
    if (!pokemon.length) {
      const empty = document.createElement("div");
      empty.className = "roster-empty";
      empty.innerHTML = "<strong>Draft board empty!</strong><span>Your Pokémon will line up here once the roster is drafted.</span>";
      target.replaceChildren(empty);
      return;
    }

    target.replaceChildren(...pokemon.map(rosterCard));
  };

  const readLocalProfile = (account) => {
    try {
      return JSON.parse(localStorage.getItem(`pokeleague.teamProfile.${account.id}`)) || {};
    } catch {
      return {};
    }
  };

  const renderIdentity = (account, profile) => {
    const name = profile.teamName || account.teamName;
    const logo = profile.logo || account.logo;
    document.querySelector("[data-account-name]").textContent = account.accountName;
    document.querySelector("[data-team-name]").textContent = name;
    const logoImage = document.querySelector("[data-team-logo]");
    logoImage.src = logo;
    logoImage.alt = `${name} logo`;
    document.title = `${name} | PokeLeague`;
  };

  const applyTheme = (account) => {
    const theme = account.theme || {};
    const properties = {
      surface: "--team-surface",
      panel: "--team-panel",
      accent: "--team-accent",
      deep: "--team-deep",
      ink: "--team-ink",
      highlight: "--team-highlight",
      dots: "--team-dots",
      panelDots: "--team-panel-dots",
      matchupAccent: "--team-matchup-accent",
      rosterSurface: "--team-roster-surface",
      rosterAccent: "--team-roster-accent",
      rosterDots: "--team-roster-dots",
      surfaceGradient: "--team-surface-gradient",
      panelGradient: "--team-panel-gradient",
    };
    Object.entries(properties).forEach(([key, property]) => {
      if (!theme[key]) return;
      dashboard.style.setProperty(property, theme[key]);
      editor.style.setProperty(property, theme[key]);
    });
  };

  const bindEditor = (account) => {
    const form = editor.querySelector("[data-team-form]");
    const nameInput = editor.querySelector("[data-team-name-input]");
    const fileInput = editor.querySelector("[data-team-logo-input]");
    const preview = editor.querySelector("[data-editor-preview]");
    const status = editor.querySelector("[data-editor-status]");
    let pendingLogo = "";

    const openEditor = () => {
      const profile = readLocalProfile(account);
      nameInput.value = profile.teamName || account.teamName;
      preview.src = profile.logo || account.logo;
      pendingLogo = profile.logo || "";
      fileInput.value = "";
      status.textContent = "";
      editor.showModal();
      nameInput.focus();
    };

    document.querySelector("[data-edit-team]").addEventListener("click", openEditor);
    editor.querySelectorAll("[data-close-editor]").forEach((button) => {
      button.addEventListener("click", () => editor.close());
    });
    editor.addEventListener("click", (event) => {
      if (event.target === editor) editor.close();
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
        status.textContent = "Choose a PNG, JPG, or WebP image under 2 MB.";
        fileInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        pendingLogo = String(reader.result || "");
        preview.src = pendingLogo;
        status.textContent = `${file.name} is ready.`;
      });
      reader.readAsDataURL(file);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const profile = {
        teamName: nameInput.value.trim() || account.teamName,
        logo: pendingLogo,
      };
      try {
        localStorage.setItem(`pokeleague.teamProfile.${account.id}`, JSON.stringify(profile));
        renderIdentity(account, profile);
        editor.close();
      } catch {
        status.textContent = "That logo is too large to save on this device.";
      }
    });
  };

  if (!accessCode) {
    showGate();
    return;
  }

  Promise.all([
    fetch("data/teams.json?v=teams7", { cache: "no-store" }),
    fetch("data/league-teams.json?v=league-teams1", { cache: "no-store" }),
    fetch("data/pokemon-catalog.json?v=season-1-3"),
    window.PokeLeagueRosters.read().catch(() => null),
  ])
    .then(async ([teamsResponse, leagueTeamsResponse, catalogResponse, savedRosters]) => {
      if (!teamsResponse.ok || !leagueTeamsResponse.ok || !catalogResponse.ok) throw new Error("Team unavailable");
      return Promise.all([teamsResponse.json(), leagueTeamsResponse.json(), catalogResponse.json(), savedRosters]);
    })
    .then(([teamData, leagueTeamData, baseCatalog, savedRosters]) => {
      const account = teamData.accounts?.[accessCode];
      if (!account) {
        showGate();
        return;
      }

      const leagueState = window.PokeLeagueState?.read();
      const catalog = window.PokeLeagueState?.applyCatalog(baseCatalog, leagueState) || baseCatalog;
      const leagueTeams = leagueTeamData.teams || [];
      const permanentRosters = savedRosters
        ? window.PokeLeagueRosters.namesFromSlugs(savedRosters, baseCatalog, leagueTeams.map((team) => team.id))
        : null;
      const profile = readLocalProfile(account);
      applyTheme(account);
      renderIdentity(account, profile);
      const record = account.teamId && leagueState
        ? window.PokeLeagueState.recordsFor(leagueTeams, leagueState)[account.teamId] || account.record || {}
        : account.record || {};
      const recordText = `${record.wins || 0}–${record.losses || 0}${record.ties ? `–${record.ties}` : ""}`;
      document.querySelector("[data-team-record]").textContent = recordText;
      const currentWeek = leagueState?.currentWeek ?? account.weeklyMatchup?.week ?? 0;
      const matchup = (leagueState?.schedules?.[currentWeek] || []).find((candidate) => (
        candidate.home === account.teamId || candidate.away === account.teamId
      ));
      const opponentId = matchup ? (matchup.home === account.teamId ? matchup.away : matchup.home) : null;
      const opponent = leagueTeams.find((team) => team.id === opponentId);
      const opponentName = opponent?.name || account.weeklyMatchup?.opponent || "Schedule pending";
      document.querySelector("[data-team-season]").textContent = leagueState?.season || 1;
      document.querySelector("[data-record-season]").textContent = leagueState?.season || 1;
      document.querySelector("[data-matchup-week]").textContent = currentWeek;
      document.querySelector("[data-matchup-opponent]").textContent = opponentName;
      document.querySelector("[data-matchup-note]").textContent = opponent
        ? "Your next battle is set."
        : "Your opponent will appear here.";
      const hasPermanentRoster = permanentRosters && account.teamId && Object.prototype.hasOwnProperty.call(permanentRosters, account.teamId);
      const hasManagedRoster = account.teamId && Object.prototype.hasOwnProperty.call(leagueState?.rosters || {}, account.teamId);
      renderRoster(hasPermanentRoster
        ? permanentRosters[account.teamId]
        : hasManagedRoster ? leagueState.rosters[account.teamId] : account.roster || [], catalog);
      bindEditor(account);
      gate.hidden = true;
      dashboard.hidden = false;
    })
    .catch(showGate);
})();
