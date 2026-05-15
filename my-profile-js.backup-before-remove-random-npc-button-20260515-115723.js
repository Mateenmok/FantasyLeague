document.addEventListener("DOMContentLoaded", initProfile);

const NPC_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const NPC_BASE_PATH = "images/profile-npcs";

async function initProfile() {
  const avatarImg = document.getElementById("profileAvatar");
  const avatarFallback = document.getElementById("avatarFallback");
  const usernameEl = document.getElementById("profileUsername");
  const emailEl = document.getElementById("profileEmail");
  const avatarTypeEl = document.getElementById("profileAvatarType");
  const userIdEl = document.getElementById("profileUserId");
  const statusEl = document.getElementById("profileStatus");
  const miniStatusEl = document.getElementById("profileMiniStatus");
  const uploadInput = document.getElementById("avatarUpload");
  const randomizeBtn = document.getElementById("randomizeNpcBtn");
  const resetBtn = document.getElementById("resetAvatarBtn");

  const client = getSupabaseClient();

  if (!client) {
    usernameEl.textContent = "Could not load account";
    miniStatusEl.textContent = "Supabase unavailable";
    statusEl.textContent = "Supabase client was not found. Check js/supabaseClient.js.";
    return;
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) {
    console.error(sessionError);
    usernameEl.textContent = "Could not load account";
    miniStatusEl.textContent = "Session error";
    statusEl.textContent = "There was a problem loading your session.";
    return;
  }

  if (!sessionData || !sessionData.session) {
    window.location.href = "sign-in.html";
    return;
  }

  const user = sessionData.session.user;
  const email = user.email || "";
  const username =
    user.user_metadata?.username ||
    user.user_metadata?.display_name ||
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    email.split("@")[0] ||
    "Trainer";

  const profileKey = `fantasy_profile_${user.id || email}`;
  const avatarKey = `${profileKey}_avatar`;
  const npcKey = `${profileKey}_npc`;
  const winsKey = `${profileKey}_wins`;
  const lossesKey = `${profileKey}_losses`;

  usernameEl.textContent = username;
  emailEl.textContent = email;
  userIdEl.textContent = `User ID: ${(user.id || "unknown").slice(0, 8)}...`;
  miniStatusEl.textContent = "Account loaded";
  setFallbackInitial(avatarFallback, username);

  await loadAvatar({
    avatarImg,
    avatarFallback,
    avatarTypeEl,
    statusEl,
    avatarKey,
    npcKey
  });

  updateStats(winsKey, lossesKey);

  uploadInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      statusEl.textContent = "Please choose an image file.";
      return;
    }

    try {
      statusEl.textContent = "Saving profile picture...";
      const dataUrl = await resizeImageFile(file, 512);
      localStorage.setItem(avatarKey, dataUrl);
      showAvatar(avatarImg, avatarFallback, dataUrl);
      avatarTypeEl.textContent = "Avatar: Custom";
      statusEl.textContent = "Profile picture updated.";
    } catch (error) {
      console.error(error);
      statusEl.textContent = "Could not save that image.";
    }
  });

  randomizeBtn.addEventListener("click", async () => {
    const npc = await chooseRandomNpc();

    if (!npc) {
      statusEl.textContent = "No NPC images found. Add npc1-npc9 images to images/profile-npcs.";
      return;
    }

    localStorage.removeItem(avatarKey);
    localStorage.setItem(npcKey, npc);
    showAvatar(avatarImg, avatarFallback, npc);
    avatarTypeEl.textContent = "Avatar: NPC";
    statusEl.textContent = "Random NPC picture selected.";
  });

  resetBtn.addEventListener("click", async () => {
    localStorage.removeItem(avatarKey);
    localStorage.removeItem(npcKey);

    await loadAvatar({
      avatarImg,
      avatarFallback,
      avatarTypeEl,
      statusEl,
      avatarKey,
      npcKey
    });

    statusEl.textContent = "Avatar reset to a random NPC.";
  });
}

function getSupabaseClient() {
  try {
    if (typeof supabaseClient !== "undefined") {
      return supabaseClient;
    }
  } catch (error) {
    console.error(error);
  }

  if (window.supabaseClient) {
    return window.supabaseClient;
  }

  return null;
}

async function loadAvatar({ avatarImg, avatarFallback, avatarTypeEl, statusEl, avatarKey, npcKey }) {
  const savedAvatar = localStorage.getItem(avatarKey);

  if (savedAvatar) {
    showAvatar(avatarImg, avatarFallback, savedAvatar);
    avatarTypeEl.textContent = "Avatar: Custom";
    statusEl.textContent = "Custom profile picture loaded.";
    return;
  }

  const savedNpc = localStorage.getItem(npcKey);

  if (savedNpc && await imageExists(savedNpc)) {
    showAvatar(avatarImg, avatarFallback, savedNpc);
    avatarTypeEl.textContent = "Avatar: NPC";
    statusEl.textContent = "NPC profile picture loaded.";
    return;
  }

  const npc = await chooseRandomNpc();

  if (npc) {
    localStorage.setItem(npcKey, npc);
    showAvatar(avatarImg, avatarFallback, npc);
    avatarTypeEl.textContent = "Avatar: NPC";
    statusEl.textContent = "Random NPC profile picture selected.";
  } else {
    avatarTypeEl.textContent = "Avatar: Default";
    statusEl.textContent = "Add npc1-npc9 images to images/profile-npcs to enable random NPC pictures.";
  }
}

function setFallbackInitial(fallbackEl, username) {
  fallbackEl.textContent = (username || "T").trim().charAt(0).toUpperCase();
}

function showAvatar(imgEl, fallbackEl, src) {
  imgEl.onload = () => {
    imgEl.style.display = "block";
    fallbackEl.style.display = "none";
  };

  imgEl.onerror = () => {
    imgEl.style.display = "none";
    fallbackEl.style.display = "flex";
  };

  imgEl.src = src;
}

function npcCandidates() {
  const candidates = [];

  for (let i = 1; i <= 9; i += 1) {
    for (const ext of NPC_EXTENSIONS) {
      candidates.push(`${NPC_BASE_PATH}/npc${i}.${ext}`);
    }
  }

  return candidates;
}

async function chooseRandomNpc() {
  const available = [];

  for (const src of npcCandidates()) {
    if (await imageExists(src)) {
      available.push(src);
    }
  }

  if (!available.length) return "";

  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

function imageExists(src) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);

    img.src = `${src}?v=${Date.now()}`;
  });
}

function resizeImageFile(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/png"));
      };

      img.onerror = reject;
      img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function updateStats(winsKey, lossesKey) {
  const wins = Number(localStorage.getItem(winsKey) || 0);
  const losses = Number(localStorage.getItem(lossesKey) || 0);
  const total = wins + losses;

  document.getElementById("lifetimeWL").textContent = `${wins}-${losses}`;
  document.getElementById("winPct").textContent = total ? `${Math.round((wins / total) * 100)}%` : "--";
}
