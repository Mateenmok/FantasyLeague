document.addEventListener("DOMContentLoaded", initLeaguemateProfile);

const NPC_IMAGES = [
  "images/profile-npcs/npc1.png",
  "images/profile-npcs/npc2.webp",
  "images/profile-npcs/npc3.webp",
  "images/profile-npcs/npc4.jpeg",
  "images/profile-npcs/npc5.jpg",
  "images/profile-npcs/npc6.webp",
  "images/profile-npcs/npc7.webp",
  "images/profile-npcs/npc8.jpg",
  "images/profile-npcs/npc9.webp"
];

let selectedLeagueId = localStorage.getItem("selected-league-id");
let pokemonDatabase = [];
let pokemonByName = new Map();

async function initLeaguemateProfile() {
  const statusEl = document.getElementById("profileViewStatus");
  const params = new URLSearchParams(window.location.search);
  const teamId = params.get("teamId");

  if (!selectedLeagueId || !teamId) {
    statusEl.textContent = "Missing league or team selection.";
    return;
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    statusEl.textContent = "Sign in before viewing profiles.";
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
    statusEl.textContent = "You are not a member of this league.";
    return;
  }

  const { data: team, error: teamError } = await supabaseClient
    .from("league_teams")
    .select("*")
    .eq("id", teamId)
    .eq("league_id", selectedLeagueId)
    .single();

  if (teamError || !team) {
    console.error(teamError);
    statusEl.textContent = "Could not load that team.";
    return;
  }

  pokemonDatabase = await loadPokemonDatabase();
  pokemonByName = new Map(pokemonDatabase.map(pokemon => [normalizeNameKey(pokemon.name), pokemon]));

  const profile = await loadSharedProfile(team.manager_email);

  renderProfile(team, profile);
  statusEl.textContent = profile
    ? "Profile loaded."
    : "Showing default profile. This user has not saved shared profile data yet.";
}

async function loadSharedProfile(email) {
  if (!email) return null;

  try {
    const { data, error } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("email", String(email).toLowerCase())
      .maybeSingle();

    if (error) {
      console.warn("Shared profile table may not be set up yet:", error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn("Could not load shared profile:", error);
    return null;
  }
}

function renderProfile(team, profile) {
  const ownerName = profile?.username || team.owner_name || "Unassigned";
  const teamName = team.team_name || `Team ${team.team_number}`;
  const avatarSrc =
    profile?.avatar_data_url ||
    profile?.default_npc_url ||
    getStableNpcForTeam(team);

  document.getElementById("profileViewName").textContent = ownerName;
  document.getElementById("profileViewTeam").textContent = teamName;
  document.getElementById("profileViewTeamSlot").textContent = `#${team.team_number || "-"}`;
  document.getElementById("profileViewRecord").textContent = team.record || "0-0";
  document.getElementById("profileViewRole").textContent = team.is_admin ? "Admin" : "Manager";

  showAvatar(avatarSrc, ownerName);

  const favorites = Array.isArray(profile?.favorite_pokemon)
    ? profile.favorite_pokemon
    : [];

  renderFavorites([favorites[0] || "", favorites[1] || "", favorites[2] || ""]);
}

function showAvatar(src, ownerName) {
  const img = document.getElementById("profileViewAvatar");
  const fallback = document.getElementById("profileViewFallback");

  fallback.textContent = getInitial(ownerName);

  if (!src) {
    img.style.display = "none";
    fallback.style.display = "flex";
    return;
  }

  img.onload = () => {
    img.style.display = "block";
    fallback.style.display = "none";
  };

  img.onerror = () => {
    img.style.display = "none";
    fallback.style.display = "flex";
  };

  img.src = src;
}

function renderFavorites(favorites) {
  const container = document.getElementById("profileViewFavorites");

  container.innerHTML = favorites.map((name, index) => {
    const pokemon = name ? findPokemonByName(name) : null;
    const imgHtml = pokemon?.image
      ? `<img src="${escapeHtml(pokemon.image)}" alt="${escapeHtml(pokemon.name)}" onload="this.style.display='block'; this.nextElementSibling.style.display='none';" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">`
      : "";

    return `
      <div class="favorite-slot">
        <div class="favorite-circle">
          ${imgHtml}
          <span class="favorite-empty">${pokemon ? escapeHtml(pokemon.name.charAt(0).toUpperCase()) : "+"}</span>
        </div>
        <div class="favorite-name">${pokemon ? escapeHtml(pokemon.name) : `Favorite ${index + 1}`}</div>
      </div>
    `;
  }).join("");
}

function getStableNpcForTeam(team) {
  const seed = String(
    team.manager_email ||
    team.owner_name ||
    team.team_name ||
    team.id ||
    team.team_number ||
    "trainer"
  );

  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }

  return NPC_IMAGES[Math.abs(hash) % NPC_IMAGES.length];
}

async function loadPokemonDatabase() {
  const data = await fetchJsonSafe("data/pokemon.json?v=profile-view-full1");
  const items = flattenPokemonData(data);
  const normalized = [];

  for (const raw of items) {
    const pokemon = normalizePokemon(raw);
    if (pokemon.name) normalized.push(pokemon);
  }

  normalized.sort((a, b) => a.name.localeCompare(b.name));
  return normalized;
}

async function fetchJsonSafe(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn(error);
    return null;
  }
}

function flattenPokemonData(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.pokemon)) return data.pokemon;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data)) return data.data;
  if (typeof data === "object") return Object.values(data).filter(value => value && typeof value === "object");
  return [];
}

function normalizePokemon(raw) {
  const name =
    raw.name ||
    raw.Name ||
    raw.pokemon ||
    raw.Pokemon ||
    raw.species ||
    raw.Species ||
    raw.species_name ||
    raw.label ||
    "";

  return {
    raw,
    name: cleanPokemonName(String(name || "")),
    image: findPokemonImage(raw)
  };
}

function cleanPokemonName(name) {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function findPokemonByName(name) {
  const key = normalizeNameKey(name);
  if (pokemonByName.has(key)) return pokemonByName.get(key);
  return pokemonDatabase.find(pokemon => normalizeNameKey(pokemon.name).includes(key)) || null;
}

function findPokemonImage(raw) {
  const preferredKeys = [
    "sprite", "sprites", "image", "img", "icon", "artwork",
    "image_url", "imageUrl", "front_default", "frontDefault",
    "sprite_url", "spriteUrl"
  ];

  for (const key of preferredKeys) {
    const value = raw[key];

    if (typeof value === "string" && looksLikeImage(value)) return normalizeImagePath(value);
    if (value && typeof value === "object") {
      const nested = findPokemonImage(value);
      if (nested) return nested;
    }
  }

  const recursive = findImageStringRecursive(raw);
  return recursive ? normalizeImagePath(recursive) : "";
}

function findImageStringRecursive(value) {
  if (!value || typeof value !== "object") return "";

  for (const item of Object.values(value)) {
    if (typeof item === "string" && looksLikeImage(item)) return item;

    if (item && typeof item === "object") {
      const nested = findImageStringRecursive(item);
      if (nested) return nested;
    }
  }

  return "";
}

function looksLikeImage(value) {
  return /\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(value) ||
    value.includes("raw.githubusercontent.com") ||
    value.includes("img.pokemondb.net") ||
    value.includes("play.pokemonshowdown.com/sprites") ||
    value.includes("assets.pokemon.com");
}

function normalizeImagePath(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("./")) return path.slice(2);
  if (path.startsWith("/")) return path.slice(1);
  return path;
}

function normalizeNameKey(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getInitial(value) {
  return String(value || "T").trim().charAt(0).toUpperCase() || "T";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
