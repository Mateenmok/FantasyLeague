
const POKEMON_IMAGE_OVERRIDES = {
  "galarian-slowbro": "images/pokemon-fixes/galarian-slowbro.png",
  "slowbro-galarian": "images/pokemon-fixes/galarian-slowbro.png",

  "galarian-slowking": "images/pokemon-fixes/galarian-slowking.png",
  "slowking-galarian": "images/pokemon-fixes/galarian-slowking.png",

  "galarian-stunfisk": "images/pokemon-fixes/galarian-stunfisk.png",
  "stunfisk-galarian": "images/pokemon-fixes/galarian-stunfisk.png",

  "alolan-raichu": "images/pokemon-fixes/alolan-raichu.png",
  "raichu-alolan": "images/pokemon-fixes/alolan-raichu.png",

  "alolan-ninetales": "images/pokemon-fixes/alolan-ninetales.png",
  "ninetales-alolan": "images/pokemon-fixes/alolan-ninetales.png",

  "water-tauros": "images/pokemon-fixes/water-tauros.png",
  "tauros-water": "images/pokemon-fixes/water-tauros.png",
  "paldean-tauros-water": "images/pokemon-fixes/water-tauros.png",
  "tauros-paldea-aqua": "images/pokemon-fixes/water-tauros.png",
  "tauros-aqua": "images/pokemon-fixes/water-tauros.png",

  "fire-tauros": "images/pokemon-fixes/fire-tauros.png",
  "tauros-fire": "images/pokemon-fixes/fire-tauros.png",
  "paldean-tauros-fire": "images/pokemon-fixes/fire-tauros.png",
  "tauros-paldea-blaze": "images/pokemon-fixes/fire-tauros.png",
  "tauros-blaze": "images/pokemon-fixes/fire-tauros.png"
};

function normalizePokemonImageKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFixedPokemonImage(pokemon) {
  if (!pokemon) {
    return "";
  }

  const keys = [
    pokemon.slug,
    pokemon.name,
    pokemon.ranked_name,
    pokemon.display_name,
    pokemon.species,
    pokemon.form
  ].map(normalizePokemonImageKey).filter(Boolean);

  const combined = keys.join("-");

  for (const key of keys) {
    if (POKEMON_IMAGE_OVERRIDES[key]) {
      return POKEMON_IMAGE_OVERRIDES[key];
    }
  }

  if (combined.includes("galarian-slowbro") || combined.includes("slowbro-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-slowbro"];
  }

  if (combined.includes("galarian-slowking") || combined.includes("slowking-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-slowking"];
  }

  if (combined.includes("galarian-stunfisk") || combined.includes("stunfisk-galarian")) {
    return POKEMON_IMAGE_OVERRIDES["galarian-stunfisk"];
  }

  if (combined.includes("alolan-raichu") || combined.includes("raichu-alolan")) {
    return POKEMON_IMAGE_OVERRIDES["alolan-raichu"];
  }

  if (combined.includes("alolan-ninetales") || combined.includes("ninetales-alolan")) {
    return POKEMON_IMAGE_OVERRIDES["alolan-ninetales"];
  }

  if (combined.includes("tauros") && (combined.includes("water") || combined.includes("aqua"))) {
    return POKEMON_IMAGE_OVERRIDES["water-tauros"];
  }

  if (combined.includes("tauros") && (combined.includes("fire") || combined.includes("blaze"))) {
    return POKEMON_IMAGE_OVERRIDES["fire-tauros"];
  }

  return pokemon.image || pokemon.img || pokemon.icon || pokemon.sprite || pokemon.artwork || "";
}


const myTeamSubtitle = document.getElementById("myTeamSubtitle");
const myTeamContent = document.getElementById("myTeamContent");
const myTeamStatus = document.getElementById("myTeamStatus");

let selectedLeagueId = localStorage.getItem("selected-league-id");
let currentMembership = null;
let myTeam = null;
let championsPokemon = [];
let selectedLogoFile = null;

loadMyTeamPage();

async function loadMyTeamPage() {
  if (!selectedLeagueId) {
    myTeamSubtitle.textContent = "No league selected.";
    myTeamStatus.textContent = "Go to My Leagues and select a league first.";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Session error:", sessionError);
    myTeamSubtitle.textContent = "Not signed in.";
    myTeamStatus.textContent = "Sign in before viewing your team.";
    return;
  }

  const userId = sessionData.session.user.id;

  const { data: membership, error: membershipError } = await supabaseClient
    .from("league_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("league_id", selectedLeagueId)
    .single();

  if (membershipError || !membership) {
    console.error("Membership error:", membershipError);
    myTeamSubtitle.textContent = "No access.";
    myTeamStatus.textContent = "You are not a member of this league.";
    return;
  }

  currentMembership = membership;

  const { data: league, error: leagueError } = await supabaseClient
    .from("leagues")
    .select("*")
    .eq("id", selectedLeagueId)
    .single();

  if (leagueError || !league) {
    console.error("League error:", leagueError);
    myTeamSubtitle.textContent = "Could not load league.";
    myTeamStatus.textContent = "Try selecting the league again.";
    return;
  }

  myTeamSubtitle.textContent = league.name;

  if (!currentMembership.league_team_id) {
    myTeamContent.innerHTML = `
      <div class="empty-state">
        <p>Your account is an admin for this league, but it is not assigned to a specific team.</p>
        <p>Use Manage League to assign your email to a team.</p>
      </div>
    `;
    myTeamStatus.textContent = "No team assigned.";
    return;
  }

  const { data: team, error: teamError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("id", currentMembership.league_team_id)
    .single();

  if (teamError || !team) {
    console.error("Team error:", teamError);
    myTeamStatus.textContent = "Could not load your team.";
    return;
  }

  myTeam = team;

  try {
    championsPokemon = await fetch("data/champions-pokemon.json").then(response => response.json());
  } catch (error) {
    console.error("Could not load Champions Pokémon data:", error);
    championsPokemon = [];
  }

  await renderMyTeam();
}

async function renderMyTeam() {
  const logoUrl = myTeam.logo_url || "";
  const ownerName = myTeam.owner_name || "Unassigned";

  const logoHtml = logoUrl
    ? `<img class="my-team-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(myTeam.team_name)} logo">`
    : `<div class="my-team-logo-placeholder">T${myTeam.team_number}</div>`;

  const rosterHtml = await getRosterHtml();

  myTeamContent.innerHTML = `
    <section class="my-team-layout">
      <div class="my-team-profile-card">
        <div class="my-team-header">
          <div class="team-number-badge">#${myTeam.team_number}</div>
          ${logoHtml}
          <div>
            <h2>${escapeHtml(myTeam.team_name)}</h2>
            <p><strong>Owner:</strong> ${escapeHtml(ownerName)}</p>
            <p><strong>Manager:</strong> ${escapeHtml(myTeam.manager_email || "Unassigned")}</p>
            <p><strong>Record:</strong> ${escapeHtml(myTeam.record || "0-0")} <span class="small-note">(Admin controlled)</span></p>
          </div>
        </div>

        <div class="team-edit-form">
          <label>Team Name</label>
          <input id="myTeamNameInput" type="text" value="${escapeHtml(myTeam.team_name)}">

          <label>Owner Name</label>
          <input id="myOwnerNameInput" type="text" value="${escapeHtml(ownerName)}">

          <label>Team Logo</label>
          <div class="team-logo-upload-box">
            <input id="myLogoFileInput" class="team-logo-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
            <p id="myLogoUploadNote" class="small-note">
              ${logoUrl ? "Current logo saved. Upload a new image to replace it." : "Upload a PNG, JPG, WEBP, or GIF."}
            </p>
          </div>

          <button id="saveMyTeamButton" class="pkmn-button small">Save My Team</button>
        </div>
      </div>

      <div class="my-team-roster-card">
        <h2>Drafted Roster</h2>
        ${rosterHtml}
      </div>
    </section>
  `;

  document.getElementById("saveMyTeamButton").addEventListener("click", saveMyTeam);

  attachMyTeamRosterActionCards();

  const logoFileInput = document.getElementById("myLogoFileInput");
  if (logoFileInput) {
    logoFileInput.addEventListener("change", function () {
      selectedLogoFile = this.files && this.files.length > 0 ? this.files[0] : null;

      const note = document.getElementById("myLogoUploadNote");
      if (note) {
        note.textContent = selectedLogoFile
          ? `Selected: ${selectedLogoFile.name}`
          : "Upload a PNG, JPG, WEBP, or GIF.";
      }
    });
  }

  myTeamStatus.textContent = "My Team loaded.";
}

async function getRosterHtml() {
  const { data: rosterRows, error } = await supabaseClient
    .from("team_rosters")
    .select("*")
    .eq("league_id", selectedLeagueId)
    .eq("team_id", myTeam.id)
    .order("slot_number", { ascending: true });

  if (error) {
    console.error("Roster load error:", error);
    return `<div class="empty-state"><p>Roster not connected yet.</p></div>`;
  }

  if (!rosterRows || rosterRows.length === 0) {
    return `<div class="empty-state"><p>No Pokémon drafted yet.</p></div>`;
  }

  return `
    <div class="my-team-roster-grid">
      ${rosterRows.map(row => {
        const pokemon = championsPokemon.find(p => p.slug === row.pokemon_slug);

        if (!pokemon) {
          return `
            <div
              class="my-team-roster-slot my-team-roster-action-card"
              role="button"
              tabindex="0"
              data-roster-id="${escapeHtml(row.id)}"
              data-pokemon-name="${escapeHtml(row.pokemon_slug)}"
              data-pokemon-slug="${escapeHtml(row.pokemon_slug)}"
            >
              <div class="missing-image">?</div>
              <p>${escapeHtml(row.pokemon_slug)}</p>
              <p class="small-note roster-action-hint"></p>
            </div>
          `;
        }

        return `
          <div
            class="my-team-roster-slot my-team-roster-action-card"
            role="button"
            tabindex="0"
            data-roster-id="${escapeHtml(row.id)}"
            data-pokemon-name="${escapeHtml(pokemon.name)}"
            data-pokemon-slug="${escapeHtml(pokemon.slug)}"
          >
            <img src="${getFixedPokemonImage(pokemon)}" alt="${escapeHtml(pokemon.name)}">
            <p>${escapeHtml(pokemon.name)}</p>
            ${renderMyTeamTypeBadges(pokemon)}
            <p class="small-note roster-action-hint"></p>
          </div>
        `;
      }).join("")}
    </div>
  `;
}


async function logMyTeamActivityEvent({ eventType, pokemonName, pokemonSlug, title, description }) {
  if (!selectedLeagueId || !myTeam) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("league_activity_events")
      .insert({
        league_id: selectedLeagueId,
        team_id: myTeam.id,
        team_name: myTeam.team_name,
        event_type: eventType,
        pokemon_name: pokemonName || null,
        pokemon_slug: pokemonSlug || null,
        title,
        description
      });

    if (error) {
      console.warn("League activity log skipped:", error);
    }
  } catch (error) {
    console.warn("League activity log failed:", error);
  }
}

function attachMyTeamRosterActionCards() {
  document.querySelectorAll(".my-team-roster-action-card").forEach(card => {
    card.addEventListener("click", function () {
      showMyTeamPokemonActionMenu({
        rosterId: this.dataset.rosterId,
        pokemonName: this.dataset.pokemonName,
        pokemonSlug: this.dataset.pokemonSlug
      });
    });

    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();

        showMyTeamPokemonActionMenu({
          rosterId: this.dataset.rosterId,
          pokemonName: this.dataset.pokemonName,
          pokemonSlug: this.dataset.pokemonSlug
        });
      }
    });
  });
}

function closeMyTeamPokemonActionMenu() {
  const existingMenu = document.getElementById("myTeamPokemonActionMenu");

  if (existingMenu) {
    existingMenu.remove();
  }
}

function showMyTeamPokemonActionMenu({ rosterId, pokemonName, pokemonSlug }) {
  closeMyTeamPokemonActionMenu();

  const safeName = pokemonName || "this Pokémon";
  const safeSlug = pokemonSlug || "";

  const menu = document.createElement("div");
  menu.id = "myTeamPokemonActionMenu";
  menu.className = "my-team-action-menu-backdrop";

  menu.innerHTML = `
    <div class="my-team-action-menu-card">
      <p class="my-team-action-menu-kicker">Roster Options</p>
      <h3>${escapeHtml(safeName)}</h3>
      <p class="small-note">Choose what you want to do with this Pokémon.</p>

      <div class="my-team-action-menu-buttons">
        <button id="myTeamTradePokemonButton" class="my-team-action-button trade" type="button">Trade</button>
        <button id="myTeamDropPokemonButton" class="my-team-action-button drop" type="button">Drop</button>
        <button id="myTeamCancelPokemonButton" class="my-team-action-button cancel" type="button">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(menu);

  document.getElementById("myTeamCancelPokemonButton").addEventListener("click", closeMyTeamPokemonActionMenu);

  document.getElementById("myTeamTradePokemonButton").addEventListener("click", function () {
    localStorage.setItem("pokeleague_trade_target_pokemon_slug", safeSlug);
    localStorage.setItem("pokeleague_trade_target_pokemon_name", safeName);
    window.location.href = `trading.html?pokemon=${encodeURIComponent(safeSlug)}`;
  });

  document.getElementById("myTeamDropPokemonButton").addEventListener("click", async function () {
    closeMyTeamPokemonActionMenu();
    await dropMyTeamRosterPokemon(rosterId, safeName);
  });

  menu.addEventListener("click", function (event) {
    if (event.target === menu) {
      closeMyTeamPokemonActionMenu();
    }
  });
}

async function dropMyTeamRosterPokemon(rosterId, pokemonName) {
  if (!rosterId || !myTeam) {
    myTeamStatus.textContent = "Could not identify that roster slot.";
    return;
  }

  const confirmed = window.confirm(`Drop ${pokemonName || "this Pokémon"} from your roster?`);

  if (!confirmed) {
    myTeamStatus.textContent = "Drop cancelled.";
    return;
  }

  myTeamStatus.textContent = `Dropping ${pokemonName || "Pokémon"}...`;

  const { error } = await supabaseClient
    .from("team_rosters")
    .delete()
    .eq("id", rosterId)
    .eq("league_id", selectedLeagueId)
    .eq("team_id", myTeam.id);

  if (error) {
    console.error("My Team roster drop error:", error);
    myTeamStatus.textContent = "Could not drop Pokémon. Check console.";
    return;
  }

  await logMyTeamActivityEvent({
    eventType: "drop",
    pokemonName: pokemonName || "Pokémon",
    pokemonSlug: "",
    title: `${myTeam.team_name} dropped ${pokemonName || "a Pokémon"}`,
    description: `${myTeam.team_name} dropped ${pokemonName || "a Pokémon"} from its roster.`
  });

  myTeamStatus.textContent = `Dropped ${pokemonName || "Pokémon"}.`;
  await renderMyTeam();
}

async function saveMyTeam() {
  const teamName = document.getElementById("myTeamNameInput").value.trim() || `Team ${myTeam.team_number}`;
  const ownerName = document.getElementById("myOwnerNameInput").value.trim() || "Unassigned";

  let logoUrl = myTeam.logo_url || "";

  myTeamStatus.textContent = selectedLogoFile ? "Uploading logo..." : "Saving team...";

  if (selectedLogoFile) {
    const uploadedLogoUrl = await uploadTeamLogo(selectedLogoFile);

    if (!uploadedLogoUrl) {
      return;
    }

    logoUrl = uploadedLogoUrl;
  }

  myTeamStatus.textContent = "Saving team...";

  const { error } = await supabaseClient
    .from("league_teams")
    .update({
      team_name: teamName,
      owner_name: ownerName,
      logo_url: logoUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", myTeam.id)
    .eq("league_id", selectedLeagueId);

  if (error) {
    console.error("Save My Team error:", error);
    myTeamStatus.textContent = "Error saving team. Check the console.";
    return;
  }

  selectedLogoFile = null;

  const { data: updatedTeam, error: reloadError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("id", myTeam.id)
    .single();

  if (!reloadError && updatedTeam) {
    myTeam = updatedTeam;
  }

  myTeamStatus.textContent = "My Team saved.";
  await renderMyTeam();
}

async function uploadTeamLogo(file) {
  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  if (!allowedTypes.includes(file.type)) {
    myTeamStatus.textContent = "Logo must be a PNG, JPG, WEBP, or GIF.";
    return "";
  }

  const maxSizeBytes = 2 * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    myTeamStatus.textContent = "Logo file must be under 2 MB.";
    return "";
  }

  const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const safeLeagueId = String(selectedLeagueId).replace(/[^a-zA-Z0-9_-]/g, "");
  const safeTeamId = String(myTeam.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = `${safeLeagueId}/${safeTeamId}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("team-logos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) {
    console.error("Team logo upload error:", uploadError);
    myTeamStatus.textContent = "Logo upload failed. Check Supabase Storage policies.";
    return "";
  }

  const { data } = supabaseClient.storage
    .from("team-logos")
    .getPublicUrl(filePath);

  return data.publicUrl || "";
}


function getTypeClass(type) {
  return `type-${String(type || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function renderMyTeamTypeBadges(pokemon) {
  const types = pokemon.types || [];

  if (!types.length) {
    return "";
  }

  const typeClass = types.length === 1 ? "single" : "dual";

  return `
    <div class="pokemon-type-strip my-team-type-strip ${typeClass}">
      ${types.map(type => `
        <span class="pokemon-type-segment ${getTypeClass(type)}">
          ${escapeHtml(type)}
        </span>
      `).join("")}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
