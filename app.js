// NexariOS v6.6 — Full UI Logic Upgrade
// Includes: Glow Rings, Hex Badge, Pulse, Ticker, Swipe Nav, Desktop Layout

const API_BASE = "";

// ------------------------------
// DOM HOOKS
// ------------------------------
const body = document.body;

// Pages
const pages = {
  hr: document.getElementById("hrPage"),
  games: document.getElementById("gamesPage"),
  accuracy: document.getElementById("accuracyPage"),
  search: document.getElementById("searchPage"),
  settings: document.getElementById("settingsPage")
};

// Nav
const bottomNav = document.getElementById("bottomNav");
const navItems = Array.from(bottomNav.querySelectorAll(".navItem"));
const navSlider = document.getElementById("navSlider");

// HR
const signalsContainer = document.getElementById("signalsContainer");
const hrViewSelect = document.getElementById("hrViewSelect");
const sportsbookSelects = Array.from(document.querySelectorAll(".sportsbookSelect"));

// Games
const gamesContainer = document.getElementById("gamesContainer");
const prevDateBtn = document.getElementById("prevDate");
const nextDateBtn = document.getElementById("nextDate");
const currentDateLabel = document.getElementById("currentDateLabel");

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

// LIVE Ticker
const liveTickerContent = document.getElementById("liveTickerContent");

// ------------------------------
// STATE
// ------------------------------
let signals = [];
let games = [];
let accuracy = null;
let currentDate = null;
let autoRefreshTimer = null;
let currentSportsbook = "dk";
let overmindMode = "c"; // logic preserved

// ------------------------------
// UTILITIES
// ------------------------------
function formatDateLabel(iso) {
  const dt = new Date(iso + "T12:00:00");
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function shiftDate(iso, delta) {
  const dt = new Date(iso + "T12:00:00");
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function saveSettings() {
  const s = {
    theme: body.dataset.theme,
    device: body.dataset.device,
    navlayout: body.dataset.navlayout,
    fontSize: fontSizeSlider.value,
    iconSize: iconSizeSlider.value,
    autoRefresh: autoRefreshSelect.value,
    overmindMode
  };
  localStorage.setItem("nexarios-settings", JSON.stringify(s));
}

function loadSettings() {
  const raw = localStorage.getItem("nexarios-settings");
  if (!raw) return;
  try {
    const s = JSON.parse(raw);

    if (s.theme) {
      body.dataset.theme = s.theme;
      themeToggle.querySelectorAll(".segBtn").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.theme === s.theme)
      );
    }

    if (s.device) {
      body.dataset.device = s.device;
      deviceModeSelect.value = s.device;
    }

    if (s.navlayout) {
      body.dataset.navlayout = s.navlayout;
      navLayoutSelect.value = s.navlayout;
    }

    if (s.fontSize) {
      fontSizeSlider.value = s.fontSize;
      document.documentElement.style.setProperty("--base-font-size", s.fontSize + "px");
    }

    if (s.iconSize) {
      iconSizeSlider.value = s.iconSize;
      document.documentElement.style.setProperty("--icon-size", s.iconSize + "px");
    }

    if (s.autoRefresh) {
      autoRefreshSelect.value = s.autoRefresh;
    }

    if (s.overmindMode) {
      overmindMode = s.overmindMode;
    }
  } catch {}
}

function applyAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  const sec = parseInt(autoRefreshSelect.value, 10);
  if (sec > 0) {
    autoRefreshTimer = setInterval(refreshAll, sec * 1000);
  }
}

// ------------------------------
// TIER + OCM HELPERS
// ------------------------------
function getTierKey(tier) {
  if (!tier) return "watch";
  const t = tier.toLowerCase();
  if (t.includes("strong")) return "strong";
  if (t.includes("playable")) return "playable";
  return "watch";
}

function getOcmIntensityClass(ocm) {
  if (ocm == null) return "ocmHex-intensity-low";
  if (ocm < 40) return "ocmHex-intensity-low";
  if (ocm < 70) return "ocmHex-intensity-med";
  if (ocm < 90) return "ocmHex-intensity-high";
  return "ocmHex-intensity-ultra";
}

// ------------------------------
// NAVIGATION
// ------------------------------
function setActivePage(pageId) {
  Object.values(pages).forEach(p => p.classList.remove("active"));
  pages[pageId].classList.add("active");

  navItems.forEach(item => {
    const active = item.dataset.page === pages[pageId].id;
    item.classList.toggle("active", active);
    if (active) moveNavSliderTo(item);
  });
}

function moveNavSliderTo(item) {
  const rect = item.getBoundingClientRect();
  const parent = bottomNav.getBoundingClientRect();
  navSlider.style.left = `${rect.left - parent.left}px`;
  navSlider.style.width = `${rect.width}px`;
}

navItems.forEach(item => {
  item.addEventListener("click", () => {
    const page = item.dataset.page;
    if (page === "hrPage") setActivePage("hr");
    if (page === "gamesPage") setActivePage("games");
    if (page === "accuracyPage") setActivePage("accuracy");
    if (page === "searchPage") setActivePage("search");
    if (page === "settingsPage") setActivePage("settings");
  });
});

// ------------------------------
// API
// ------------------------------
async function apiGet(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${path}`);
  return res.json();
}

async function fetchSignals(date) {
  const data = await apiGet("/signals", date ? { date } : {});
  signals = data.signals || [];
}

async function fetchGames(date) {
  const data = await apiGet("/games", date ? { date } : {});
  games = data.games || [];
}

async function fetchAccuracy() {
  const data = await apiGet("/accuracy");
  accuracy = data.accuracy || null;
}

async function fetchDebug() {
  return apiGet("/debug");
}

async function forceRebuild(date) {
  return apiGet("/rebuild", date ? { date } : {});
}
// ------------------------------
// RENDER — HR SIGNALS (UPGRADED)
// ------------------------------
function renderSignals() {
  signalsContainer.innerHTML = "";

  if (!signals.length) {
    signalsContainer.innerHTML = `<div class="emptyState">No signals available.</div>`;
    return;
  }

  const limit = parseInt(hrViewSelect.value, 10);
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
    bar.style.width = `${barWidth}%`;

    // Momentum pulse
    if (ocm >= 80 && tierKey === "strong") {
      bar.classList.add("momentumStrong");
    } else if (ocm >= 70 && tierKey === "playable") {
      bar.classList.add("momentumPlayable");
    }

    signalsContainer.appendChild(div);
  });
}

// ------------------------------
// RENDER — GAMES
// ------------------------------
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

    div.innerHTML = `
      <div class="gameHeader">
        <div class="title">${g.away} @ ${g.home}</div>
        <div class="metaLine">
          ${g.gameTime}<br>
          ${g.status} ${liveBadge}<br>
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
          ${g.awayPlayers
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
          ${g.homePlayers
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

  // Daily accuracy
  const pct = accuracy.percent ?? 0;
  accDaily.textContent = `${pct}%`;
  accDailyBar.style.width = `${pct}%`;

  // 7‑day + 30‑day averages
  const h7 = accuracy.history7 || [];
  const h30 = accuracy.history30 || [];

  const avg7 = h7.length ? Math.round(h7.reduce((a, b) => a + b, 0) / h7.length) : 0;
  const avg30 = h30.length ? Math.round(h30.reduce((a, b) => a + b, 0) / h30.length) : 0;

  acc7.textContent = `${avg7}%`;
  acc30.textContent = `${avg30}%`;

  // Trend text
  trend7.textContent = h7.map(v => `${v}%`).join(" · ");
  trend30.textContent = h30.map(v => `${v}%`).join(" · ");

  // Trend bars
  trendBar7.style.width = `${avg7}%`;
  trendBar30.style.width = `${avg30}%`;

  // Prediction volume
  accVolume.textContent = `${accuracy.predictionVolume || 0} picks`;

  // HR hitters today
  const hrHitters = accuracy.hrHittersToday || [];
  accHRHitters.innerHTML = hrHitters.length
    ? hrHitters.map(p => `<div class="pill">${p}</div>`).join("")
    : `<div class="muted">No HR hitters recorded yet.</div>`;
}

// ------------------------------
// RENDER — SEARCH RESULTS
// ------------------------------
function renderSearchResults(query) {
  searchResults.innerHTML = "";

  if (!query) {
    searchResults.innerHTML = `<div class="muted">Type a player or team name.</div>`;
    return;
  }

  const q = query.toLowerCase();
  const sb = currentSportsbook;

  const matches = signals.filter(s => {
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
    bar.style.width = `${barWidth}%`;

    searchResults.appendChild(div);
  });
}
// ------------------------------
// SETTINGS HANDLERS
// ------------------------------
themeToggle.addEventListener("click", e => {
  if (!e.target.classList.contains("segBtn")) return;
  const theme = e.target.dataset.theme;
  body.dataset.theme = theme;

  themeToggle.querySelectorAll(".segBtn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.theme === theme)
  );

  saveSettings();
});

deviceModeSelect.addEventListener("change", () => {
  body.dataset.device = deviceModeSelect.value;
  saveSettings();
});

fontSizeSlider.addEventListener("input", () => {
  document.documentElement.style.setProperty("--base-font-size", fontSizeSlider.value + "px");
  saveSettings();
});

iconSizeSlider.addEventListener("input", () => {
  document.documentElement.style.setProperty("--icon-size", iconSizeSlider.value + "px");
  saveSettings();
});

navLayoutSelect.addEventListener("change", () => {
  body.dataset.navlayout = navLayoutSelect.value;
  saveSettings();
});

autoRefreshSelect.addEventListener("change", () => {
  applyAutoRefresh();
  saveSettings();
});

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

clearCacheBtn.addEventListener("click", () => {
  localStorage.clear();
  location.reload();
});

// ------------------------------
// DATE NAVIGATION
// ------------------------------
prevDateBtn.addEventListener("click", () => {
  currentDate = shiftDate(currentDate, -1);
  currentDateLabel.textContent = formatDateLabel(currentDate);
  refreshAll();
});

nextDateBtn.addEventListener("click", () => {
  currentDate = shiftDate(currentDate, 1);
  currentDateLabel.textContent = formatDateLabel(currentDate);
  refreshAll();
});

// ------------------------------
// SEARCH INPUT
// ------------------------------
playerSearchInput.addEventListener("input", () => {
  renderSearchResults(playerSearchInput.value.trim());
});

// ------------------------------
// SYSTEM INFO
// ------------------------------
async function renderSystemInfo() {
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
    renderSearchResults(playerSearchInput.value.trim());
    renderLiveTicker();
    await renderSystemInfo();
  } catch (err) {
    console.error("Refresh error:", err);
  }
}

// ------------------------------
// SWIPE NAVIGATION (MOBILE)
// ------------------------------
let touchStartX = null;
let touchStartY = null;
let touchLocked = false;

function getCurrentPageIndex() {
  const order = ["hr", "games", "accuracy", "search", "settings"];
  const activeKey = order.find(key => pages[key].classList.contains("active"));
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

document.addEventListener("touchmove", e => {
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
}, { passive: false });

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
  currentDateLabel.textContent = formatDateLabel(currentDate);

  sportsbookSelects.forEach(sel => {
    sel.addEventListener("change", () => {
      currentSportsbook = sel.value;
      sportsbookSelects.forEach(s2 => (s2.value = sel.value));
      renderSignals();
      renderSearchResults(playerSearchInput.value.trim());
    });
  });

  applyAutoRefresh();
  await refreshAll();
  moveNavSliderTo(navItems[0]);
}

init();
