(function () {
  const IMAGE_OVERRIDES = {
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
    "tauros-blaze": "images/pokemon-fixes/fire-tauros.png",

    "hisuian-decidueye": "images/pokemon-fixes/hisuian-decidueye.webp",
    "decidueye-hisui": "images/pokemon-fixes/hisuian-decidueye.webp",
    "decidueye-hisuian": "images/pokemon-fixes/hisuian-decidueye.webp",

    "hisuian-samurott": "images/pokemon-fixes/hisuian-samurott.png",
    "samurott-hisui": "images/pokemon-fixes/hisuian-samurott.png",
    "samurott-hisuian": "images/pokemon-fixes/hisuian-samurott.png",

    "hisuian-goodra": "images/pokemon-fixes/hisuian-goodra.webp",
    "goodra-hisui": "images/pokemon-fixes/hisuian-goodra.webp",
    "goodra-hisuian": "images/pokemon-fixes/hisuian-goodra.webp",

    "hisuian-typhlosion": "images/pokemon-fixes/hisuian-typhlosion.png",
    "typhlosion-hisui": "images/pokemon-fixes/hisuian-typhlosion.png",
    "typhlosion-hisuian": "images/pokemon-fixes/hisuian-typhlosion.png",

    "hisuian-arcanine": "images/pokemon-fixes/hisuian-arcanine.webp",
    "arcanine-hisui": "images/pokemon-fixes/hisuian-arcanine.webp",
    "arcanine-hisuian": "images/pokemon-fixes/hisuian-arcanine.webp",

    "hisuian-zoroark": "images/pokemon-fixes/hisuian-zoroark.webp",
    "zoroark-hisui": "images/pokemon-fixes/hisuian-zoroark.webp",
    "zoroark-hisuian": "images/pokemon-fixes/hisuian-zoroark.webp",

    "paldean-tauros-combat": "images/pokemon-fixes/paldean-tauros-combat.png",
    "tauros-paldea-combat": "images/pokemon-fixes/paldean-tauros-combat.png",
    "tauros-combat": "images/pokemon-fixes/paldean-tauros-combat.png",
    "combat-tauros": "images/pokemon-fixes/paldean-tauros-combat.png",

    "hisuian-avalugg": "images/pokemon-fixes/hisuian-avalugg.webp",
    "avalugg-hisui": "images/pokemon-fixes/hisuian-avalugg.webp",
    "avalugg-hisuian": "images/pokemon-fixes/hisuian-avalugg.webp"
  };

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getOverrideFromText(value) {
    const normalized = normalize(value);

    if (IMAGE_OVERRIDES[normalized]) return IMAGE_OVERRIDES[normalized];

    if (normalized.includes("galarian-slowbro") || normalized.includes("slowbro-galarian")) {
      return IMAGE_OVERRIDES["galarian-slowbro"];
    }

    if (normalized.includes("galarian-slowking") || normalized.includes("slowking-galarian")) {
      return IMAGE_OVERRIDES["galarian-slowking"];
    }

    if (normalized.includes("galarian-stunfisk") || normalized.includes("stunfisk-galarian")) {
      return IMAGE_OVERRIDES["galarian-stunfisk"];
    }

    if (normalized.includes("alolan-raichu") || normalized.includes("raichu-alolan")) {
      return IMAGE_OVERRIDES["alolan-raichu"];
    }

    if (normalized.includes("alolan-ninetales") || normalized.includes("ninetales-alolan")) {
      return IMAGE_OVERRIDES["alolan-ninetales"];
    }

    if (normalized.includes("tauros") && (normalized.includes("water") || normalized.includes("aqua"))) {
      return IMAGE_OVERRIDES["water-tauros"];
    }

    if (normalized.includes("tauros") && (normalized.includes("fire") || normalized.includes("blaze"))) {
      return IMAGE_OVERRIDES["fire-tauros"];
    }

    if (normalized.includes("tauros") && normalized.includes("combat")) {
      return IMAGE_OVERRIDES["paldean-tauros-combat"];
    }

    if (normalized.includes("hisuian-decidueye") || normalized.includes("decidueye-hisui")) {
      return IMAGE_OVERRIDES["hisuian-decidueye"];
    }

    if (normalized.includes("hisuian-samurott") || normalized.includes("samurott-hisui")) {
      return IMAGE_OVERRIDES["hisuian-samurott"];
    }

    if (normalized.includes("hisuian-goodra") || normalized.includes("goodra-hisui")) {
      return IMAGE_OVERRIDES["hisuian-goodra"];
    }

    if (normalized.includes("hisuian-typhlosion") || normalized.includes("typhlosion-hisui")) {
      return IMAGE_OVERRIDES["hisuian-typhlosion"];
    }

    if (normalized.includes("hisuian-arcanine") || normalized.includes("arcanine-hisui")) {
      return IMAGE_OVERRIDES["hisuian-arcanine"];
    }

    if (normalized.includes("hisuian-zoroark") || normalized.includes("zoroark-hisui")) {
      return IMAGE_OVERRIDES["hisuian-zoroark"];
    }

    if (normalized.includes("hisuian-avalugg") || normalized.includes("avalugg-hisui")) {
      return IMAGE_OVERRIDES["hisuian-avalugg"];
    }

    return "";
  }

  function closestUsefulText(img) {
    const parent =
      img.closest(".pokemon-card") ||
      img.closest(".available-pokemon-card") ||
      img.closest(".draft-card") ||
      img.closest(".team-pokemon-card") ||
      img.closest(".waiver-card") ||
      img.closest(".trade-card") ||
      img.closest(".favorite-slot") ||
      img.closest("tr") ||
      img.closest("li") ||
      img.parentElement;

    return parent ? parent.textContent || "" : "";
  }

  function fixImage(img) {
    if (!img || img.dataset.altFormFixed === "yes") return;

    const textCandidates = [
      img.alt,
      img.title,
      img.getAttribute("data-name"),
      img.getAttribute("data-pokemon"),
      img.getAttribute("aria-label"),
      closestUsefulText(img)
    ];

    let override = "";

    for (const text of textCandidates) {
      override = getOverrideFromText(text);
      if (override) break;
    }

    if (!override) return;

    img.dataset.altFormFixed = "yes";
    img.removeAttribute("srcset");
    img.srcset = "";
    img.src = override;
  }

  function scanImages(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("img").forEach(fixImage);
  }

  document.addEventListener("DOMContentLoaded", function () {
    scanImages(document);

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (!node) return;

          if (node.tagName === "IMG") {
            fixImage(node);
          } else if (node.querySelectorAll) {
            scanImages(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    let scans = 0;
    const interval = setInterval(function () {
      scanImages(document);
      scans += 1;
      if (scans >= 10) clearInterval(interval);
    }, 500);
  });
})();
