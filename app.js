// NexariOS v6.6 — Final Build (Chunk 1/3)
// Fully patched: icons restored, sportsbook restored, nav fixed, glow-ready

// ===============================
// API BASE
// ===============================
const API_BASE = "https://nexari-auto.jardelterry.workers.dev";

function apiUrl(path) {
  const base = API_BASE.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

// ===============================
// STATE
// ===============================
let signals = [];
let games = [];
let accuracy = null;

let currentDate = null;
let currentSportsbook = "dk";

// ===============================
// DOM HOOKS
// ===============================
const pages = {
  hr: document.getElementById("page-hr"),
  games: document.getElementById("page-games"),
  accuracy: document.getElementById("page-accuracy"),
  search: document.getElementById("page-search"),
  settings: document.getElementById("page-settings")
};

const bottomNav = document.getElementById("bottomNav");
const navItems = Array.from(document.querySelectorAll(".navItem"));
const navSlider = document.getElementById("navSlider");

const signalsContainer = document.getElementById("signalsContainer");
const hrViewSelect = document.getElementById("hrViewSelect");
const sportsbookSelect = document.getElementById("sportsbookSelect");

const gamesContainer = document.getElementById("gamesContainer");

const accDaily = document.getElementById("accDaily");
const accDailyBar = document.getElementById("accDailyBar");
const acc7 = document.getElementById("acc7");
const acc30 = document.getElementById("acc30");
const trend7 = document.getElementById("trend7");
const trend30 = document.getElementById("trend30");
const trendBar7 = document.getElementById("trendBar7");
const trendBar30 = document.getElementById("trendBar30");
const accVolume = document.getElementById("accVolume");
const accHRHitters = document.getElementById("accHRHitters");

const playerSearchInput = document.getElementById("playerSearchInput");
const searchResults = document.getElementById("searchResults");

const stadiumSelect = document.getElementById("stadiumSelect");
const stadiumDetails = document.getElementById("stadiumDetails");

const themeToggle = document.getElementById("themeToggle");
const deviceModeSelect = document.getElementById("deviceModeSelect");
const fontSizeSlider = document.getElementById("fontSizeSlider");
const iconSizeSlider = document.getElementById("iconSizeSlider");
const navLayoutSelect = document.getElementById("navLayoutSelect");
const autoRefreshSelect = document.getElementById("autoRefreshSelect");
const forceRebuildBtn = document.getElementById("forceRebuildBtn");
const clearCacheBtn = document.getElementById("clearCacheBtn");
const systemInfo = document.getElementById("systemInfo");

const currentDateLabel = document.getElementById("currentDateLabel");
const prevDateBtn = document.getElementById("prevDateBtn");
const nextDateBtn = document.getElementById("nextDateBtn");

const liveTickerContent = document.getElementById("liveTickerContent");

// ===============================
// UTILITIES
// ===============================
function formatDateLabel(iso) {
  const dt = new Date(iso);
  if (isNaN(dt)) return iso;
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function shiftDate(iso, delta) {
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function getTierKey(tier) {
  if (!tier) return "watch";
  const t = tier.toLowerCase();
  if (t.includes("strong")) return "strong";
  if (t.includes("playable")) return "playable";
  return "watch";
}

function getOcmIntensityClass(ocm) {
  const v = Number(ocm) || 0;
  if (v >= 90) return "ocmHex-intensity-ultra";
  if (v >= 80) return "ocmHex-intensity-high";
  if (v >= 65) return "ocmHex-intensity-med";
  return "ocmHex-intensity-low";
}

// ===============================
// API HELPERS
// ===============================
async function apiGet(path) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`API error: ${path}`);
  return res.json();
}

async function fetchSignals(dateStr) {
  const qs = dateStr ? `?date=${encodeURIComponent(dateStr)}` : "";
  const data = await apiGet(`/signals${qs}`);
  signals = Array.isArray(data.signals) ? data.signals : [];
}

async function fetchGames(dateStr) {
  const qs = dateStr ? `?date=${encodeURIComponent(dateStr)}` : "";
  const data = await apiGet(`/games${qs}`);
  games = Array.isArray(data.games) ? data.games : [];
}

async function fetchAccuracy() {
  const data = await apiGet(`/accuracy`);
  accuracy = data.accuracy || null;
}

async function fetchDebug() {
  return apiGet(`/debug`);
}

async function forceRebuild(dateStr) {
  const qs = dateStr ? `?date=${encodeURIComponent(dateStr)}` : "";
  return apiGet(`/rebuild${qs}`);
}

// ===============================
// NAVIGATION
// ===============================
function setActivePage(key) {
  Object.keys(pages).forEach(k => {
    pages[k].classList.toggle("active", k === key);
  });

  navItems.forEach(item => {
    item.classList.toggle("active", item.dataset.target === key);
  });

  const activeItem = navItems.find(n => n.classList.contains("active"));
  if (activeItem) moveNavSliderTo(activeItem);

  renderLiveTicker();
}

function moveNavSliderTo(item) {
  const rectNav = bottomNav.getBoundingClientRect();
  const rectItem = item.getBoundingClientRect();
  navSlider.style.width = `${rectItem.width}px`;
  navSlider.style.left = `${rectItem.left - rectNav.left}px`;
}

navItems.forEach(item => {
  item.addEventListener("click", () => {
    setActivePage(item.dataset.target);
  });
});

// ===============================
// HR TAB — CLEAN RENDER
// ===============================
function renderSignals() {
  signalsContainer.innerHTML = "";

  if (!signals.length) {
    signalsContainer.innerHTML = `<div class="emptyState">No signals available.</div>`;
    return;
  }

  const limit = parseInt(hrViewSelect.value, 10) || 10;
  const sb = currentSportsbook;
  const subset = signals.slice(0, limit);

  subset.forEach(s => {
    const odds = s.sportsbooks?.[sb] ?? "N/A";
    const ocm = s.overmindCompositeMetric || 0;
    const barWidth = Math.max(8, Math.min(100, Math.round(ocm)));

    const tierKey = getTierKey(s.tier);
    const tierRingClass =
      tierKey === "strong"
        ? "tier-strong-ring"
        : tierKey === "playable"
        ? "tier-playable-ring"
        : "tier-watch-ring";

    const ocmIntensityClass = getOcmIntensityClass(ocm);
    const ocmTierClass =
      tierKey === "strong"
        ? "ocmHex-strong"
        : tierKey === "playable"
        ? "ocmHex-playable"
        : "ocmHex-watch";

    const div = document.createElement("div");
    div.className = "signal";

    div.innerHTML = `
      <div class="signalLine1">
        <span class="tierRing ${tierRingClass}"></span>
        <span class="signalPlayer">${s.player}</span>
        <span class="signalTeam">${s.team}</span>
      </div>

      <div class="signalLine2">
        <span class="signalOpponent">vs ${s.opponent}</span>
        <span class="signalOdds">${sb.toUpperCase()}: ${odds}</span>
      </div>

      <div class="signalLine3">
        <span class="signalHr">
          HR Base: ${s.hr}
          <span class="ocmHex ${ocmTierClass} ${ocmIntensityClass}">
            <span>OCM ${Math.round(ocm)}</span>
          </span>
        </span>
      </div>

      <div class="hrBar"></div>
    `;

    div.querySelector(".hrBar").style.width = `${barWidth}%`;

    signalsContainer.appendChild(div);
  });
}
// ===============================
// RENDER — GAMES
// ===============================
function renderGames() {
  gamesContainer.innerHTML = "";

  if (!games.length) {
    gamesContainer.innerHTML = `<div class="emptyState">No games scheduled.</div>`;
    return;
  }

  games.forEach(g => {
    const div = document.createElement("div");
    div.className = "game";

    const score =
      g.awayScore != null && g.homeScore != null
        ? `${g.awayScore} - ${g.homeScore}`
        : "";

    const liveBadge = g.live ? `<span class="liveBadge">LIVE</span>` : "";

    const awayPlayers = Array.isArray(g.awayPlayers) ? g.awayPlayers : [];
    const homePlayers = Array.isArray(g.homePlayers) ? g.homePlayers : [];

    div.innerHTML = `
      <div class="gameHeader">
        <div class="title">${g.away} @ ${g.home}</div>
        <div class="metaLine">
          ${g.gameTime || ""}<br>
          ${g.status || ""} ${liveBadge}<br>
          ${score}
        </div>
      </div>

      <div class="gameDetails">
        <div class="weatherLine">
          ${g.temp != null ? `${g.temp}°` : ""}
          ${g.conditions ? `· ${g.conditions}` : ""}
        </div>

        <div class="lineup">
          <strong>Away Lineup:</strong><br>
          ${awayPlayers
            .map(
              p => `
              <span class="playerTag">
                <span class="playerName">${p.name}</span>
                <span class="playerPos">${p.pos}</span>
              </span>`
            )
            .join("")}
        </div>

        <div class="lineup">
          <strong>Home Lineup:</strong><br>
          ${homePlayers
            .map(
              p => `
              <span class="playerTag">
                <span class="playerName">${p.name}</span>
                <span class="playerPos">${p.pos}</span>
              </span>`
            )
            .join("")}
        </div>
      </div>
    `;

    gamesContainer.appendChild(div);
  });
}

// ===============================
// LIVE TICKER — GAMES PAGE ONLY
// ===============================
function renderLiveTicker() {
  const gamesPage = pages.games;

  if (!gamesPage.classList.contains("active")) {
    liveTickerContent.textContent = "";
    liveTickerContent.classList.remove("scrolling");
    return;
  }

  const liveGames = games.filter(
    g =>
      g.live &&
      g.awayScore != null &&
      g.homeScore != null
  );

  if (!liveGames.length) {
    liveTickerContent.textContent = "";
    liveTickerContent.classList.remove("scrolling");
    return;
  }

  const items = liveGames.map(
    g => `${g.away} ${g.awayScore}–${g.homeScore} ${g.home}`
  );

  liveTickerContent.innerHTML =
    `<span>LIVE • ${items.join(" • ")}</span><span>LIVE • ${items.join(" • ")}</span>`;

  liveTickerContent.classList.add("scrolling");
}

// ===============================
// RENDER — ACCURACY
// ===============================
function renderAccuracy() {
  if (!accuracy) {
    accDaily.textContent = "0%";
    accDailyBar.style.width = "0%";
    acc7.textContent = "0%";
    acc30.textContent = "0%";
    trend7.textContent = "";
    trend30.textContent = "";
    trendBar7.style.width = "0%";
    trendBar30.style.width = "0%";
    accVolume.textContent = "0 picks";
    accHRHitters.innerHTML = `<div class="muted">No HR hitters recorded yet.</div>`;
    return;
  }

  const pct = accuracy.percent ?? 0;
  accDaily.textContent = `${pct}%`;
  accDailyBar.style.width = `${pct}%`;

  const h7 = accuracy.history7 || [];
  const h30 = accuracy.history30 || [];

  const avg7 = h7.length ? Math.round(h7.reduce((a, b) => a + b, 0) / h7.length) : 0;
  const avg30 = h30.length ? Math.round(h30.reduce((a, b) => a + b, 0) / h30.length) : 0;

  acc7.textContent = `${avg7}%`;
  acc30.textContent = `${avg30}%`;

  trend7.textContent = h7.map(v => `${v}%`).join(" · ");
  trend30.textContent = h30.map(v => `${v}%`).join(" · ");

  trendBar7.style.width = `${avg7}%`;
  trendBar30.style.width = `${avg30}%`;

  accVolume.textContent = `${accuracy.predictionVolume || 0} picks`;

  const hrHitters = accuracy.hrHittersToday || [];
  accHRHitters.innerHTML = hrHitters.length
    ? hrHitters.map(p => `<div class="pill">${p}</div>`).join("")
    : `<div class="muted">No HR hitters recorded yet.</div>`;
}

// ===============================
// RENDER — SEARCH RESULTS
// ===============================
function renderSearchResults(query) {
  searchResults.innerHTML = "";

  if (!query) {
    searchResults.innerHTML = `<div class="muted">Type a player or team name.</div>`;
    return;
  }

  const q = query.toLowerCase();
  const sb = currentSportsbook;

  const matches = signals.filter(s =>
    (s.player || "").toLowerCase().includes(q) ||
    (s.team || "").toLowerCase().includes(q) ||
    (s.opponent || "").toLowerCase().includes(q)
  );

  if (!matches.length) {
    searchResults.innerHTML = `<div class="emptyState">No matches found.</div>`;
    return;
  }

  matches.forEach(s => {
    const odds = s.sportsbooks?.[sb] ?? "N/A";
    const ocm = s.overmindCompositeMetric || 0;
    const barWidth = Math.max(8, Math.min(100, Math.round(ocm)));

    const tierKey = getTierKey(s.tier);
    const ocmIntensityClass = getOcmIntensityClass(ocm);
    const ocmTierClass =
      tierKey === "strong"
        ? "ocmHex-strong"
        : tierKey === "playable"
        ? "ocmHex-playable"
        : "ocmHex-watch";

    const div = document.createElement("div");
    div.className = "searchResult";

    div.innerHTML = `
      <div class="name">${s.player}</div>
      <div class="meta">${s.team} vs ${s.opponent}</div>
      <div class="oddsBlock">${sb.toUpperCase()}: ${odds}</div>
      <div class="hrBar"></div>
      <div class="ocmHex ${ocmTierClass} ${ocmIntensityClass}">
        <span>OCM ${Math.round(ocm)}</span>
      </div>
    `;

    div.querySelector(".hrBar").style.width = `${barWidth}%`;

    searchResults.appendChild(div);
  });
}

// ===============================
// STADIUM INFO — COLLAPSIBLE
// ===============================
stadiumSelect?.addEventListener("change", () => {
  const stadium = stadiumSelect.value;

  if (!stadium) {
    stadiumDetails.innerHTML = "";
    return;
  }

  stadiumDetails.innerHTML = `
    <div><strong>${stadium}</strong></div>
    <div>Park Factor: (example) 112</div>
    <div>Weather: (example) 72° · Clear</div>
    <div>Wind: (example) 8 mph Out to LF</div>
    <div>Notes: High‑altitude, HR‑friendly environment.</div>
  `;
});
// ===============================
// COLLAPSIBLE SECTIONS (Info + Stadium)
// ===============================
document.querySelectorAll(".collapsibleHeader").forEach(header => {
  header.addEventListener("click", () => {
    const targetId = header.dataset.target;
    const content = document.getElementById(targetId);
    content.classList.toggle("active");
  });
});

// ===============================
// SETTINGS — PERSISTENCE
// ===============================
const SETTINGS_KEY = "nexari-settings-v66";

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);

    if (s.theme) {
      document.body.dataset.theme = s.theme;
      themeToggle.querySelectorAll(".segBtn").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.theme === s.theme)
      );
    }

    if (s.device) {
      document.body.dataset.device = s.device;
      deviceModeSelect.value = s.device;
    }

    if (s.baseFontSize) {
      fontSizeSlider.value = s.baseFontSize;
      document.documentElement.style.setProperty("--base-font-size", s.baseFontSize + "px");
    }

    if (s.iconSize) {
      iconSizeSlider.value = s.iconSize;
      document.documentElement.style.setProperty("--icon-size", s.iconSize + "px");
    }

    if (s.navLayout) {
      document.body.dataset.navlayout = s.navLayout;
      navLayoutSelect.value = s.navLayout;
    }

    if (s.autoRefresh) {
      autoRefreshSelect.value = s.autoRefresh;
    }
  } catch (err) {
    console.error("Failed to load settings", err);
  }
}

function saveSettings() {
  const s = {
    theme: document.body.dataset.theme,
    device: document.body.dataset.device,
    baseFontSize: fontSizeSlider.value,
    iconSize: iconSizeSlider.value,
    navLayout: navLayoutSelect.value,
    autoRefresh: autoRefreshSelect.value
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ===============================
// SETTINGS — EVENT HANDLERS
// ===============================
themeToggle?.querySelectorAll(".segBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    themeToggle.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.body.dataset.theme = btn.dataset.theme;
    saveSettings();
  });
});

deviceModeSelect?.addEventListener("change", () => {
  document.body.dataset.device = deviceModeSelect.value;
  saveSettings();
});

fontSizeSlider?.addEventListener("input", () => {
  document.documentElement.style.setProperty("--base-font-size", fontSizeSlider.value + "px");
  saveSettings();
});

iconSizeSlider?.addEventListener("input", () => {
  document.documentElement.style.setProperty("--icon-size", iconSizeSlider.value + "px");
  saveSettings();
});

navLayoutSelect?.addEventListener("change", () => {
  document.body.dataset.navlayout = navLayoutSelect.value;
  saveSettings();
});

autoRefreshSelect?.addEventListener("change", saveSettings);

forceRebuildBtn?.addEventListener("click", async () => {
  try {
    await forceRebuild(currentDate);
    alert("Rebuild triggered successfully.");
  } catch (err) {
    alert("Rebuild failed.");
  }
});

clearCacheBtn?.addEventListener("click", () => {
  localStorage.clear();
  alert("Cache cleared.");
});

// ===============================
// DATE NAVIGATION
// ===============================
prevDateBtn?.addEventListener("click", () => {
  currentDate = shiftDate(currentDate, -1);
  currentDateLabel.textContent = formatDateLabel(currentDate);
  refreshAll();
});

nextDateBtn?.addEventListener("click", () => {
  currentDate = shiftDate(currentDate, 1);
  currentDateLabel.textContent = formatDateLabel(currentDate);
  refreshAll();
});

// ===============================
// AUTO REFRESH
// ===============================
let autoRefreshTimer = null;

function setupAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);

  const val = autoRefreshSelect.value;
  if (val === "off") return;

  const minutes = parseInt(val, 10);
  if (!minutes) return;

  autoRefreshTimer = setInterval(refreshAll, minutes * 60 * 1000);
}

// ===============================
// MASTER REFRESH
// ===============================
async function refreshAll() {
  try {
    await Promise.all([
      fetchSignals(currentDate),
      fetchGames(currentDate),
      fetchAccuracy()
    ]);

    renderSignals();
    renderGames();
    renderAccuracy();
    renderLiveTicker();
  } catch (err) {
    console.error("Refresh failed", err);
  }
}

// ===============================
// INIT
// ===============================
async function init() {
  loadSettings();
  setupAutoRefresh();

  const today = new Date();
  currentDate = today.toISOString().slice(0, 10);
  currentDateLabel.textContent = formatDateLabel(currentDate);

  await refreshAll();

  const activeItem = navItems.find(n => n.classList.contains("active"));
  if (activeItem) moveNavSliderTo(activeItem);
}

init();
