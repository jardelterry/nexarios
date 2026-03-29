// NexariOS v6.6 – Frontend Engine (Hardened)
// Wired to Nexari Auto Worker: https://nexari-auto.jardelterry.workers.dev

// ------------------------------
// API BASE (Nexari Auto Worker)
// ------------------------------
const API_BASE = "https://nexari-auto.jardelterry.workers.dev";

// Normalize base so we never get double slashes
function apiUrl(path) {
  const base = API_BASE.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

// ------------------------------
// STATE
// ------------------------------
let signals = [];
let games = [];
let accuracy = null;

let currentDate = null;
let currentSportsbook = "dk";

// ------------------------------
// DOM HOOKS
// ------------------------------
const body = document.body;

// Pages
const pages = {
  hr: document.getElementById("page-hr"),
  games: document.getElementById("page-games"),
  accuracy: document.getElementById("page-accuracy"),
  search: document.getElementById("page-search"),
  settings: document.getElementById("page-settings")
};

// Nav
const bottomNav = document.getElementById("bottomNav");
const navItems = Array.from(document.querySelectorAll(".navItem"));
const navSlider = document.getElementById("navSlider");

// HR
const signalsContainer = document.getElementById("signalsContainer");
const hrViewSelect = document.getElementById("hrViewSelect");
const sportsbookSelects = Array.from(document.querySelectorAll(".sportsbookSelect"));

// Games
const gamesContainer = document.getElementById("gamesContainer");

// Accuracy
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

// Search
const playerSearchInput = document.getElementById("playerSearchInput");
const searchResults = document.getElementById("searchResults");

// Settings
const themeToggle = document.getElementById("themeToggle");
const deviceModeSelect = document.getElementById("deviceModeSelect");
const fontSizeSlider = document.getElementById("fontSizeSlider");
const iconSizeSlider = document.getElementById("iconSizeSlider");
const navLayoutSelect = document.getElementById("navLayoutSelect");
const autoRefreshSelect = document.getElementById("autoRefreshSelect");
const forceRebuildBtn = document.getElementById("forceRebuildBtn");
const clearCacheBtn = document.getElementById("clearCacheBtn");
const systemInfo = document.getElementById("systemInfo");

// Date nav
const currentDateLabel = document.getElementById("currentDateLabel");
const prevDateBtn = document.getElementById("prevDateBtn");
const nextDateBtn = document.getElementById("nextDateBtn");

// Live ticker
const liveTickerContent = document.getElementById("liveTickerContent");

// ------------------------------
// UTILITIES
// ------------------------------
function formatDateLabel(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  return fmt.format(dt);
}

function shiftDate(iso, deltaDays) {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  dt.setDate(dt.getDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function getTierKey(tier) {
  if (!tier) return "watch";
  const t = tier.toLowerCase();
  if (t.startsWith("strong")) return "strong";
  if (t.startsWith("playable")) return "playable";
  return "watch";
}

function getOcmIntensityClass(ocm) {
  const v = Number(ocm) || 0;
  if (v >= 90) return "ocmHex-intensity-ultra";
  if (v >= 80) return "ocmHex-intensity-high";
  if (v >= 65) return "ocmHex-intensity-med";
  return "ocmHex-intensity-low";
}

// ------------------------------
// API HELPERS
// ------------------------------
async function apiGet(path) {
  const url = apiUrl(path);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${path}`);
  }
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
  accuracy = data && data.accuracy ? data.accuracy : null;
}

async function fetchDebug() {
  const data = await apiGet(`/debug`);
  return {
    version: data.version,
    signalCount: data.signals,
    gameCount: data.games,
    lastUpdate: data.date
  };
}

async function forceRebuild(dateStr) {
  const qs = dateStr ? `?date=${encodeURIComponent(dateStr)}` : "";
  return apiGet(`/rebuild${qs}`);
}

// ------------------------------
// SETTINGS PERSISTENCE
// ------------------------------
const SETTINGS_KEY = "nexari-settings-v66";

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;

    const s = JSON.parse(raw);

    if (s.theme) {
      body.dataset.theme = s.theme;
      themeToggle.querySelectorAll(".segBtn").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.theme === s.theme)
      );
    }

    if (s.device) {
      body.dataset.device = s.device;
      if (deviceModeSelect) deviceModeSelect.value = s.device;
    }

    if (typeof s.baseFontSize === "number" && fontSizeSlider) {
      fontSizeSlider.value = s.baseFontSize;
      document.documentElement.style.setProperty("--base-font-size", s.baseFontSize + "px");
    }

    if (typeof s.iconSize === "number" && iconSizeSlider) {
      iconSizeSlider.value = s.iconSize;
      document.documentElement.style.setProperty("--icon-size", s.iconSize + "px");
    }

    if (s.navLayout && navLayoutSelect) {
      body.dataset.navlayout = s.navLayout;
      navLayoutSelect.value = s.navLayout;
    }

    if (s.autoRefresh && autoRefreshSelect) {
      autoRefreshSelect.value = s.autoRefresh;
    }

    if (s.sportsbook && sportsbookSelects.length) {
      currentSportsbook = s.sportsbook;
      sportsbookSelects.forEach(sel => (sel.value = s.sportsbook));
    }
  } catch (e) {
    console.warn("Settings load failed:", e);
  }
}

function saveSettings() {
  try {
    const s = {
      theme: body.dataset.theme || "dark",
      device: body.dataset.device || "auto",
      baseFontSize: fontSizeSlider ? Number(fontSizeSlider.value) : 16,
      iconSize: iconSizeSlider ? Number(iconSizeSlider.value) : 58,
      navLayout: body.dataset.navlayout || "stacked",
      autoRefresh: autoRefreshSelect ? autoRefreshSelect.value : "off",
      sportsbook: currentSportsbook
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn("Settings save failed:", e);
  }
}

// ------------------------------
// AUTO REFRESH
// ------------------------------
let autoRefreshTimer = null;

function applyAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (!autoRefreshSelect) return;

  const mode = autoRefreshSelect.value;
  if (mode === "off") return;

  let intervalMs = 0;
  if (mode === "5") intervalMs = 5 * 60 * 1000;
  if (mode === "10") intervalMs = 10 * 60 * 1000;
  if (mode === "15") intervalMs = 15 * 60 * 1000;

  if (intervalMs > 0) {
    autoRefreshTimer = setInterval(() => {
      refreshAll();
    }, intervalMs);
  }
}

// ------------------------------
// NAVIGATION
// ------------------------------
function setActivePage(key) {
  Object.keys(pages).forEach(k => {
    if (!pages[k]) return;
    pages[k].classList.toggle("active", k === key);
  });

  navItems.forEach(item => {
    const target = item.dataset.target;
    item.classList.toggle("active", target === key);
  });

  const activeItem = navItems.find(n => n.classList.contains("active"));
  if (activeItem) {
    moveNavSliderTo(activeItem);
  }
}

function moveNavSliderTo(item) {
  if (!navSlider || !item || !bottomNav) return;

  const rectNav = bottomNav.getBoundingClientRect();
  const rectItem = item.getBoundingClientRect();

  const width = rectItem.width;
  const left = rectItem.left - rectNav.left;

  navSlider.style.width = `${width}px`;
  navSlider.style.left = `${left}px`;
}

navItems.forEach(item => {
  item.addEventListener("click", () => {
    const target = item.dataset.target;
    if (!target) return;
    setActivePage(target);
  });
});

// ------------------------------
// RENDER — HR SIGNALS (UPGRADED)
// ------------------------------
function renderSignals() {
  if (!signalsContainer) return;

  signalsContainer.innerHTML = "";

  if (!signals || !signals.length) {
    signalsContainer.innerHTML = `<div class="emptyState">No signals available.</div>`;
    return;
  }

  const limit = parseInt(hrViewSelect.value, 10) || 10;
  const sb = currentSportsbook;
  const subset = signals.slice(0, limit);

  subset.forEach((s, idx) => {
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
        <span class="signalRank">#${idx + 1}</span>
        <span class="signalPlayer">${s.player}</span>
        <span class="signalTeam">${s.team || ""}</span>
      </div>

      <div class="signalLine2">
        <span class="signalMatchup">
          ${s.team && s.opponent ? `${s.team} vs ${s.opponent}` : ""}
        </span>
        <span class="signalTier">${s.tier}</span>
        <span class="signalOdds">${sb.toUpperCase()}: ${odds}</span>
      </div>

      <div class="signalLine3">
        <span class="signalContext">
          ${s.context?.venueName || ""} ·
          ${s.context?.temp != null ? `${s.context.temp}°` : ""}
          ${s.context?.conditions ? `· ${s.context.conditions}` : ""}
        </span>
        <span class="signalHr">
          HR Base: ${s.hr}
          <span class="ocmHex ${ocmTierClass} ${ocmIntensityClass}">
            <span>OCM ${Math.round(ocm)}</span>
          </span>
        </span>
      </div>

      <div class="hrBar"></div>
    `;

    const bar = div.querySelector(".hrBar");
    if (bar) {
      bar.style.width = `${barWidth}%`;
      if (ocm >= 80 && tierKey === "strong") {
        bar.classList.add("momentumStrong");
      } else if (ocm >= 70 && tierKey === "playable") {
        bar.classList.add("momentumPlayable");
      }
    }

    signalsContainer.appendChild(div);
  });
}

// ------------------------------
// RENDER — GAMES
// ------------------------------
function renderGames() {
  if (!gamesContainer) return;

  gamesContainer.innerHTML = "";

  if (!games || !games.length) {
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

// ------------------------------
// LIVE TICKER
// ------------------------------
function renderLiveTicker() {
  if (!liveTickerContent) return;

  if (!games || !games.length) {
    liveTickerContent.textContent = "";
    liveTickerContent.classList.remove("scrolling");
    return;
  }

  const liveGames = games.filter(
    g => g.live || (g.status && g.status.toLowerCase().includes("live"))
  );

  if (!liveGames.length) {
    liveTickerContent.textContent = "";
    liveTickerContent.classList.remove("scrolling");
    return;
  }

  const items = liveGames.map(g => {
    const score =
      g.awayScore != null && g.homeScore != null
        ? `${g.awayScore} - ${g.homeScore}`
        : "";
    return `${g.away} @ ${g.home} ${score} (${g.status})`;
  });

  liveTickerContent.innerHTML =
    `<span>${items.join(" • ")}</span><span>${items.join(" • ")}</span>`;

  liveTickerContent.classList.add("scrolling");
}

// ------------------------------
// RENDER — ACCURACY
// ------------------------------
function renderAccuracy() {
  if (!accuracy) {
    if (accDaily) accDaily.textContent = "0%";
    if (accDailyBar) accDailyBar.style.width = "0%";
    if (acc7) acc7.textContent = "0%";
    if (acc30) acc30.textContent = "0%";
    if (trend7) trend7.textContent = "";
    if (trend30) trend30.textContent = "";
    if (trendBar7) trendBar7.style.width = "0%";
    if (trendBar30) trendBar30.style.width = "0%";
    if (accVolume) accVolume.textContent = "0 picks";
    if (accHRHitters) accHRHitters.innerHTML = `<div class="muted">No HR hitters recorded yet.</div>`;
    return;
  }

  const pct = accuracy.percent ?? 0;
  if (accDaily) accDaily.textContent = `${pct}%`;
  if (accDailyBar) accDailyBar.style.width = `${pct}%`;

  const h7 = Array.isArray(accuracy.history7) ? accuracy.history7 : [];
  const h30 = Array.isArray(accuracy.history30) ? accuracy.history30 : [];

  const avg7 = h7.length ? Math.round(h7.reduce((a, b) => a + b, 0) / h7.length) : 0;
  const avg30 = h30.length ? Math.round(h30.reduce((a, b) => a + b, 0) / h30.length) : 0;

  if (acc7) acc7.textContent = `${avg7}%`;
  if (acc30) acc30.textContent = `${avg30}%`;

  if (trend7) trend7.textContent = h7.map(v => `${v}%`).join(" · ");
  if (trend30) trend30.textContent = h30.map(v => `${v}%`).join(" · ");

  if (trendBar7) trendBar7.style.width = `${avg7}%`;
  if (trendBar30) trendBar30.style.width = `${avg30}%`;

  if (accVolume) accVolume.textContent = `${accuracy.predictionVolume || 0} picks`;

  const hrHitters = Array.isArray(accuracy.hrHittersToday) ? accuracy.hrHittersToday : [];
  if (accHRHitters) {
    accHRHitters.innerHTML = hrHitters.length
      ? hrHitters.map(p => `<div class="pill">${p}</div>`).join("")
      : `<div class="muted">No HR hitters recorded yet.</div>`;
  }
}

// ------------------------------
// RENDER — SEARCH RESULTS
// ------------------------------
function renderSearchResults(query) {
  if (!searchResults) return;

  searchResults.innerHTML = "";

  if (!query) {
    searchResults.innerHTML = `<div class="muted">Type a player or team name.</div>`;
    return;
  }

  const q = query.toLowerCase();
  const sb = currentSportsbook;

  const matches = (signals || []).filter(s => {
    return (
      (s.player || "").toLowerCase().includes(q) ||
      (s.team || "").toLowerCase().includes(q) ||
      (s.opponent || "").toLowerCase().includes(q)
    );
  });

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

    const bar = div.querySelector(".hrBar");
    if (bar) bar.style.width = `${barWidth}%`;

    searchResults.appendChild(div);
  });
}

// ------------------------------
// SYSTEM INFO
// ------------------------------
async function renderSystemInfo() {
  if (!systemInfo) return;
  try {
    const dbg = await fetchDebug();
    systemInfo.innerHTML = `
      <div class="sysLine">Version: ${dbg.version}</div>
      <div class="sysLine">Signals: ${dbg.signalCount}</div>
      <div class="sysLine">Games: ${dbg.gameCount}</div>
      <div class="sysLine">Last Update: ${dbg.lastUpdate}</div>
    `;
  } catch {
    systemInfo.innerHTML = `<div class="muted">System info unavailable.</div>`;
  }
}

// ------------------------------
// REFRESH ALL
// ------------------------------
async function refreshAll() {
  try {
    await fetchSignals(currentDate);
    await fetchGames(currentDate);
    await fetchAccuracy();

    renderSignals();
    renderGames();
    renderAccuracy();
    renderSearchResults(playerSearchInput ? playerSearchInput.value.trim() : "");
    renderLiveTicker();
    await renderSystemInfo();
  } catch (err) {
    console.error("Refresh error:", err);
  }
}

// ------------------------------
// SETTINGS HANDLERS
// ------------------------------
if (themeToggle) {
  themeToggle.addEventListener("click", e => {
    if (!e.target.classList.contains("segBtn")) return;
    const theme = e.target.dataset.theme;
    body.dataset.theme = theme;

    themeToggle.querySelectorAll(".segBtn").forEach(btn =>
      btn.classList.toggle("active", btn.dataset.theme === theme)
    );

    saveSettings();
  });
}

if (deviceModeSelect) {
  deviceModeSelect.addEventListener("change", () => {
    body.dataset.device = deviceModeSelect.value;
    saveSettings();
  });
}

if (fontSizeSlider) {
  fontSizeSlider.addEventListener("input", () => {
    document.documentElement.style.setProperty("--base-font-size", fontSizeSlider.value + "px");
    saveSettings();
  });
}

if (iconSizeSlider) {
  iconSizeSlider.addEventListener("input", () => {
    document.documentElement.style.setProperty("--icon-size", iconSizeSlider.value + "px");
    saveSettings();
  });
}

if (navLayoutSelect) {
  navLayoutSelect.addEventListener("change", () => {
    body.dataset.navlayout = navLayoutSelect.value;
    saveSettings();
  });
}

if (autoRefreshSelect) {
  autoRefreshSelect.addEventListener("change", () => {
    applyAutoRefresh();
    saveSettings();
  });
}

if (forceRebuildBtn) {
  forceRebuildBtn.addEventListener("click", async () => {
    forceRebuildBtn.disabled = true;
    forceRebuildBtn.textContent = "Rebuilding…";
    try {
      await forceRebuild(currentDate);
      await refreshAll();
    } catch (err) {
      console.error(err);
    }
    forceRebuildBtn.disabled = false;
    forceRebuildBtn.textContent = "Force Rebuild";
  });
}

if (clearCacheBtn) {
  clearCacheBtn.addEventListener("click", () => {
    localStorage.clear();
    location.reload();
  });
}

// ------------------------------
// DATE NAVIGATION
// ------------------------------
if (prevDateBtn) {
  prevDateBtn.addEventListener("click", () => {
    currentDate = shiftDate(currentDate, -1);
    if (currentDateLabel) currentDateLabel.textContent = formatDateLabel(currentDate);
    refreshAll();
  });
}

if (nextDateBtn) {
  nextDateBtn.addEventListener("click", () => {
    currentDate = shiftDate(currentDate, 1);
    if (currentDateLabel) currentDateLabel.textContent = formatDateLabel(currentDate);
    refreshAll();
  });
}

// ------------------------------
// SEARCH INPUT
// ------------------------------
if (playerSearchInput) {
  playerSearchInput.addEventListener("input", () => {
    renderSearchResults(playerSearchInput.value.trim());
  });
}

// ------------------------------
// SWIPE NAVIGATION (MOBILE)
// ------------------------------
let touchStartX = null;
let touchStartY = null;
let touchLocked = false;

function getCurrentPageIndex() {
  const order = ["hr", "games", "accuracy", "search", "settings"];
  const activeKey = order.find(key => pages[key] && pages[key].classList.contains("active"));
  return order.indexOf(activeKey);
}

function setPageByIndex(idx) {
  const order = ["hr", "games", "accuracy", "search", "settings"];
  if (idx < 0 || idx >= order.length) return;
  setActivePage(order[idx]);
}

document.addEventListener("touchstart", e => {
  if (window.innerWidth > 900) return;
  if (e.touches.length !== 1) return;

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchLocked = false;
});

document.addEventListener(
  "touchmove",
  e => {
    if (window.innerWidth > 900) return;
    if (!touchStartX || !touchStartY) return;

    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    if (!touchLocked && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 24) {
      touchLocked = true;
      document.body.classList.add("swiping-horizontal");
    }

    if (touchLocked) {
      e.preventDefault();
    }
  },
  { passive: false }
);

document.addEventListener("touchend", e => {
  if (window.innerWidth > 900) return;
  if (!touchLocked) {
    touchStartX = null;
    touchStartY = null;
    return;
  }

  const dx = (e.changedTouches[0]?.clientX || 0) - touchStartX;
  const threshold = 60;

  if (Math.abs(dx) > threshold) {
    const currentIndex = getCurrentPageIndex();
    if (dx < 0) {
      setPageByIndex(currentIndex + 1);
    } else {
      setPageByIndex(currentIndex - 1);
    }
  }

  document.body.classList.remove("swiping-horizontal");
  touchStartX = null;
  touchStartY = null;
  touchLocked = false;
});

// ------------------------------
// INIT
// ------------------------------
async function init() {
  loadSettings();

  currentDate = new Date().toISOString().slice(0, 10);
  if (currentDateLabel) currentDateLabel.textContent = formatDateLabel(currentDate);

  if (sportsbookSelects.length) {
    sportsbookSelects.forEach(sel => {
      sel.addEventListener("change", () => {
        currentSportsbook = sel.value;
        sportsbookSelects.forEach(s2 => (s2.value = sel.value));
        renderSignals();
        renderSearchResults(playerSearchInput ? playerSearchInput.value.trim() : "");
        saveSettings();
      });
    });
  }

  applyAutoRefresh();
  setActivePage("hr");
  await refreshAll();
  if (navItems.length) moveNavSliderTo(navItems[0]);
}

init();
