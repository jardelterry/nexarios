/* ============================================================
   NexariOS v7.1 — Core Engine
   Chunk 1: Navigation, Theme, Device Mode, Date Logic,
            Sportsbook Selector, Initial Setup
============================================================ */

const WORKER_BASE = "https://nexari.jardelterry.workers.dev";

/* ------------------------------------------------------------
   GLOBAL STATE
------------------------------------------------------------ */
let gamesData = [];
let signalsData = [];
let accuracyData = null;

let currentRange = "10";
let currentDate = new Date();
let selectedGameIndex = null;

let sportsbook = "dk"; // default
let deviceMode = "auto"; // auto | mobile | desktop

/* ------------------------------------------------------------
   DATE HELPERS
------------------------------------------------------------ */
function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(date) {
  const today = new Date();
  const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d1 - d0) / (1000 * 60 * 60 * 24);

  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return toDateString(date);
}

function updateDateLabel() {
  document.getElementById("current-date-label").textContent =
    formatDateLabel(currentDate);
}

/* ------------------------------------------------------------
   FETCH WRAPPER
------------------------------------------------------------ */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fetch failed: " + url + " " + res.status);
  return res.json();
}

/* ------------------------------------------------------------
   DEVICE MODE HANDLING
------------------------------------------------------------ */
function applyDeviceMode(mode) {
  const root = document.body;

  root.classList.remove("device-auto", "device-mobile", "device-desktop");

  if (mode === "mobile") {
    root.classList.add("device-mobile");
  } else if (mode === "desktop") {
    root.classList.add("device-desktop");
  } else {
    root.classList.add("device-auto");
  }
}

function setupDeviceMode() {
  const select = document.getElementById("device-mode");

  // Load saved mode
  const saved = localStorage.getItem("nexarios-device-mode");
  if (saved) {
    deviceMode = saved;
    select.value = saved;
    applyDeviceMode(saved);
  }

  select.addEventListener("change", () => {
    deviceMode = select.value;
    localStorage.setItem("nexarios-device-mode", deviceMode);
    applyDeviceMode(deviceMode);
  });
}

/* ------------------------------------------------------------
   THEME HANDLING
------------------------------------------------------------ */
function setupThemeToggle() {
  const body = document.body;
  const toggle = document.getElementById("theme-toggle");
  const label = document.getElementById("theme-label");

  function applyTheme(theme) {
    if (theme === "light") {
      body.classList.add("theme-light");
      body.classList.remove("theme-dark");
      label.textContent = "Soft OS (Light)";
    } else {
      body.classList.add("theme-dark");
      body.classList.remove("theme-light");
      label.textContent = "Dark‑Carbon × Neon OS";
    }
  }

  const saved = localStorage.getItem("nexarios-theme");
  applyTheme(saved || "dark");

  toggle.addEventListener("click", () => {
    const isDark = body.classList.contains("theme-dark");
    const next = isDark ? "light" : "dark";
    localStorage.setItem("nexarios-theme", next);
    applyTheme(next);
  });
}

/* ------------------------------------------------------------
   NAVIGATION (Sidebar + Bottom Nav)
------------------------------------------------------------ */
function setupNavigation() {
  const sidebarItems = document.querySelectorAll(".sidebar-item");
  const navItems = document.querySelectorAll(".nav-item");
  const tabs = document.querySelectorAll(".tab-view");
  const indicator = document.getElementById("nav-indicator");

  function activateTab(tabName) {
    // Sidebar
    sidebarItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.tab === tabName);
    });

    // Bottom nav
    navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.tab === tabName);
    });

    // Tabs
    tabs.forEach((t) => t.classList.remove("active"));
    document.getElementById("tab-" + tabName).classList.add("active");

    // Move indicator (mobile only)
    const active = document.querySelector(".nav-item.active");
    if (active && indicator) {
      const rect = active.getBoundingClientRect();
      const parentRect = active.parentElement.getBoundingClientRect();
      indicator.style.width = rect.width + "px";
      indicator.style.transform = `translateX(${rect.left - parentRect.left}px)`;
    }
  }

  sidebarItems.forEach((item) => {
    item.addEventListener("click", () => activateTab(item.dataset.tab));
  });

  navItems.forEach((item) => {
    item.addEventListener("click", () => activateTab(item.dataset.tab));
  });

  // Initialize
  activateTab("hr");
}

/* ------------------------------------------------------------
   SPORTSBOOK SELECTOR
------------------------------------------------------------ */
function setupSportsbookSelector() {
  const select = document.getElementById("sportsbook");

  const saved = localStorage.getItem("nexarios-sportsbook");
  if (saved) {
    sportsbook = saved;
    select.value = saved;
  }

  select.addEventListener("change", () => {
    sportsbook = select.value;
    localStorage.setItem("nexarios-sportsbook", sportsbook);
    renderHRView(); // refresh odds
  });
}

/* ------------------------------------------------------------
   INITIALIZATION
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const t0 = performance.now();

  setupNavigation();
  setupThemeToggle();
  setupDeviceMode();
  setupSportsbookSelector();

  // Date navigation
  document.getElementById("prev-day").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() - 1);
    updateDateLabel();
    loadDataForCurrentDate();
  });

  document.getElementById("next-day").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() + 1);
    updateDateLabel();
    loadDataForCurrentDate();
  });

  updateDateLabel();
  loadDataForCurrentDate().then(() => {
    const t1 = performance.now();
    document.getElementById("perf-render").textContent =
      Math.round(t1 - t0) + " ms";
  });
});
/* ============================================================
   NexariOS v7.1 — Signals Engine
   Chunk 2: HR Signals, Odds, Pending Logic, Rendering
============================================================ */

/* ------------------------------------------------------------
   CHECK IF ALL SIGNALS ARE PENDING
------------------------------------------------------------ */
function allSignalsPending() {
  if (!signalsData.length) return false;

  // If NO games are final, everything is pending
  const anyFinal = gamesData.some((g) => {
    const s = (g.status || "").toLowerCase();
    return s.includes("final") || s.includes("completed");
  });

  return !anyFinal;
}

/* ------------------------------------------------------------
   OUTCOME LABEL + CLASS
------------------------------------------------------------ */
function getOutcomeLabel(signal) {
  if (signal.hrHit) return "Hit";
  if (allSignalsPending()) return "Pending";
  return "Miss";
}

function getOutcomeClass(signal) {
  if (signal.hrHit) return "hit";
  if (allSignalsPending()) return "pending";
  return "miss";
}

/* ------------------------------------------------------------
   SPORTSBOOK ODDS MAPPING
------------------------------------------------------------ */
function getOddsForSignal(signal) {
  if (!signal.sportsbooks) return "N/A";

  switch (sportsbook) {
    case "dk":
      return signal.sportsbooks.dk ?? "N/A";
    case "fd":
      return signal.sportsbooks.fd ?? "N/A";
    case "cz":
      return signal.sportsbooks.cz ?? "N/A";
    case "mgm":
      return signal.sportsbooks.mgm ?? "N/A";
    case "pb":
      return signal.sportsbooks.pb ?? "N/A";
    default:
      return "N/A";
  }
}

/* ------------------------------------------------------------
   RENDER HR SIGNALS
------------------------------------------------------------ */
function renderHRView() {
  const list = document.getElementById("hr-list");
  list.innerHTML = "";

  // Filter to system picks only
  let signals = signalsData.filter((s) => s.systemPick);

  // Sort by OCM descending
  signals.sort(
    (a, b) =>
      (b.overmindCompositeMetric || 0) - (a.overmindCompositeMetric || 0)
  );

  // Apply range
  if (currentRange !== "all") {
    const n = parseInt(currentRange, 10);
    signals = signals.slice(0, n);
  }

  // Render each signal
  signals.forEach((s) => {
    const venue = s.context?.venueName || "";
    const tier = s.tier || "Watch";
    const odds = getOddsForSignal(s);
    const label = getOutcomeLabel(s);
    const cls = getOutcomeClass(s);

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="row-main">
        <span class="row-title">${s.player}</span>
        <span class="row-tag tier">${tier}</span>
        <span class="row-tag team">${s.team || ""}</span>
        <span class="row-pill ${cls}">${label}</span>
      </div>

      <div class="row-sub">
        vs ${s.opponent || "—"} · 
        OCM ${(s.overmindCompositeMetric || 0).toFixed(1)} · 
        HR ${s.hr} · 
        ${sportsbook.toUpperCase()} ${odds}
      </div>

      ${
        venue
          ? `<div class="row-sub venue">${venue}</div>`
          : ""
      }
    `;

    list.appendChild(li);
  });

  if (!signals.length) {
    list.innerHTML = `<li class="sub">No HR signals for this date.</li>`;
  }
}

/* ------------------------------------------------------------
   RANGE BUTTONS
------------------------------------------------------------ */
function setupRangeButtons() {
  const buttons = document.querySelectorAll(".range-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      currentRange = btn.dataset.range;
      renderHRView();
    });
  });
}
/* ============================================================
   NexariOS v7.1 — Games Engine
   Chunk 3: Games, Weather, Lineups (Horizontal Chips)
============================================================ */

/* ------------------------------------------------------------
   RENDER LINEUPS AS HORIZONTAL CHIPS
------------------------------------------------------------ */
function renderLineupChips(players) {
  if (!players || !players.length) {
    return `<div class="sub">No lineup data available.</div>`;
  }

  return `
    <div class="lineups-inline">
      ${players
        .map(
          (p) =>
            `<div class="lineup-chip">${p.name} (${p.pos || ""})</div>`
        )
        .join("")}
    </div>
  `;
}

/* ------------------------------------------------------------
   FORMAT GAME STATUS + WEATHER
------------------------------------------------------------ */
function formatGameStatus(game) {
  const status = (game.status || "").toLowerCase();
  const hasScore =
    game.awayScore != null && game.homeScore != null;

  const temp = game.temp != null ? `${game.temp}°` : "";
  const wind = game.wind != null ? `${game.wind} mph` : "";
  const cond = game.conditions || "";

  const weather = [temp, wind, cond].filter(Boolean).join(" · ");

  // FINAL
  if (status.includes("final") || status.includes("completed")) {
    return {
      line2: `Final · ${game.awayScore}–${game.homeScore}`,
      line3: weather
    };
  }

  // LIVE
  if (game.live && hasScore) {
    return {
      line2: `LIVE · ${game.awayScore}–${game.homeScore}`,
      line3: weather
    };
  }

  // PRE-GAME
  return {
    line2: game.gameTime || "TBD",
    line3: weather || game.status || ""
  };
}

/* ------------------------------------------------------------
   RENDER GAMES LIST
------------------------------------------------------------ */
function renderGames() {
  const list = document.getElementById("games-list");
  list.innerHTML = "";

  gamesData.forEach((g, idx) => {
    const isSelected = selectedGameIndex === idx;

    const { line2, line3 } = formatGameStatus(g);

    const li = document.createElement("li");
    li.classList.toggle("game-selected", isSelected);

    li.innerHTML = `
      <div class="row-main">
        <span class="row-title">${g.away}</span>
        <span class="row-separator">@</span>
        <span class="row-title">${g.home}</span>
      </div>

      <div class="row-sub">${line2}</div>
      ${g.venueName ? `<div class="row-sub venue">${g.venueName}</div>` : ""}
      ${line3 ? `<div class="row-sub">${line3}</div>` : ""}

      ${
        isSelected
          ? `
            <div class="subheader">Away – ${g.away}</div>
            ${renderLineupChips(g.awayPlayers)}

            <div class="subheader">Home – ${g.home}</div>
            ${renderLineupChips(g.homePlayers)}
          `
          : ""
      }
    `;

    li.addEventListener("click", () => {
      selectedGameIndex = selectedGameIndex === idx ? null : idx;
      renderGames();
    });

    list.appendChild(li);
  });

  if (!gamesData.length) {
    list.innerHTML = `<li class="sub">No games returned for this date.</li>`;
  }
}
/* ============================================================
   NexariOS v7.1 — Accuracy Engine
   Chunk 4: Pending Logic, HR/RBI Tracker, Outcomes Rendering
============================================================ */

/* ------------------------------------------------------------
   CHECK IF ANY GAME IS FINAL
------------------------------------------------------------ */
function anyGameFinal() {
  return gamesData.some((g) => {
    const s = (g.status || "").toLowerCase();
    return s.includes("final") || s.includes("completed");
  });
}

/* ------------------------------------------------------------
   BUILD ACCURACY METRICS
------------------------------------------------------------ */
function buildAccuracyMetrics() {
  const finalExists = anyGameFinal();

  // If no final games → everything is pending
  if (!finalExists) {
    return {
      accuracy: "Pending",
      volume: signalsData.filter((s) => s.systemPick).length,
      systemStreak: "Pending",
      playerStreak: "Pending",
      hrHits: 0,
      rbiHits: 0,
      hits: [],
      misses: []
    };
  }

  // Otherwise compute real accuracy
  const picks = signalsData.filter((s) => s.systemPick);
  const hits = picks.filter((s) => s.hrHit);
  const misses = picks.filter((s) => !s.hrHit);

  const hrHits = hits.length;
  const rbiHits = hits.filter((s) => s.rbiHit).length;

  const accuracy =
    picks.length > 0 ? Math.round((hrHits / picks.length) * 100) : 0;

  return {
    accuracy,
    volume: picks.length,
    systemStreak: accuracyData?.systemStreak ?? 0,
    playerStreak: accuracyData?.playerStreak ?? 0,
    hrHits,
    rbiHits,
    hits,
    misses
  };
}

/* ------------------------------------------------------------
   RENDER SYSTEM TRACKER GRID
------------------------------------------------------------ */
function renderAccuracySystem(metrics) {
  const grid = document.getElementById("accuracy-system");

  grid.innerHTML = `
    <div class="accuracy-label">Accuracy</div>
    <div class="accuracy-value">${metrics.accuracy}</div>

    <div class="accuracy-label">Volume</div>
    <div class="accuracy-value">${metrics.volume}</div>

    <div class="accuracy-label">Sys Streak</div>
    <div class="accuracy-value">${metrics.systemStreak}</div>

    <div class="accuracy-label">Player Streak</div>
    <div class="accuracy-value">${metrics.playerStreak}</div>
  `;
}

/* ------------------------------------------------------------
   RENDER HR + RBI TRACKER
------------------------------------------------------------ */
function renderHRRBITracker(metrics) {
  const grid = document.getElementById("accuracy-hr-rbi");

  grid.innerHTML = `
    <div class="accuracy-label">HR Hits</div>
    <div class="accuracy-value">${metrics.hrHits}</div>

    <div class="accuracy-label">RBI Hits</div>
    <div class="accuracy-value">${metrics.rbiHits}</div>

    <div class="accuracy-label">Hits</div>
    <div class="accuracy-value">${metrics.hits.length}</div>

    <div class="accuracy-label">Misses</div>
    <div class="accuracy-value">${metrics.misses.length}</div>
  `;
}

/* ------------------------------------------------------------
   RENDER OUTCOMES LIST
------------------------------------------------------------ */
function renderAccuracyOutcomes(metrics) {
  const container = document.getElementById("accuracy-hr-outcomes");

  const hitsList = metrics.hits
    .map(
      (s) =>
        `<div class="outcome-row hit-row">${s.player} (${s.team}) · ${s.tier}</div>`
    )
    .join("");

  const missesList = metrics.misses
    .map(
      (s) =>
        `<div class="outcome-row miss-row">${s.player} (${s.team}) · ${s.tier}</div>`
    )
    .join("");

  container.innerHTML = `
    <div class="outcomes-columns">
      <div class="outcomes-column">
        <div class="subheader">Hits</div>
        ${hitsList || `<div class="sub">No hits recorded.</div>`}
      </div>

      <div class="outcomes-column">
        <div class="subheader">Misses</div>
        ${missesList || `<div class="sub">No misses recorded.</div>`}
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------
   MAIN RENDER FUNCTION
------------------------------------------------------------ */
function renderAccuracy() {
  const metrics = buildAccuracyMetrics();

  renderAccuracySystem(metrics);
  renderHRRBITracker(metrics);
  renderAccuracyOutcomes(metrics);
}
/* ============================================================
   NexariOS v7.1 — Search Engine
   Chunk 5: Full Player Index, Deduping, Venue Matching
============================================================ */

/* ------------------------------------------------------------
   BUILD FULL SEARCH INDEX
   (Signals + Lineups + Rosters)
------------------------------------------------------------ */
function buildSearchIndex() {
  const index = [];

  // 1. HR signals players
  signalsData.forEach((s) => {
    index.push({
      player: s.player,
      team: s.team,
      opponent: s.opponent,
      venue: s.context?.venueName || "",
      ocm: s.overmindCompositeMetric || 0,
      hr: s.hr,
      tier: s.tier || "Watch",
      sportsbooks: s.sportsbooks || {},
      hrHit: s.hrHit || false
    });
  });

  // 2. Lineup players (away + home)
  gamesData.forEach((g) => {
    (g.awayPlayers || []).forEach((p) => {
      index.push({
        player: p.name,
        team: g.away,
        opponent: g.home,
        venue: g.venueName || "",
        ocm: null,
        hr: null,
        tier: "Lineup",
        sportsbooks: {},
        hrHit: false
      });
    });

    (g.homePlayers || []).forEach((p) => {
      index.push({
        player: p.name,
        team: g.home,
        opponent: g.away,
        venue: g.venueName || "",
        ocm: null,
        hr: null,
        tier: "Lineup",
        sportsbooks: {},
        hrHit: false
      });
    });
  });

  // 3. Deduplicate by player + team
  const map = new Map();
  index.forEach((item) => {
    const key = `${item.player}-${item.team}`;
    if (!map.has(key)) map.set(key, item);
  });

  // 4. Alphabetize
  return Array.from(map.values()).sort((a, b) =>
    a.player.localeCompare(b.player)
  );
}

let SEARCH_INDEX = [];

/* ------------------------------------------------------------
   RENDER SEARCH RESULTS
------------------------------------------------------------ */
function renderSearchResults(query) {
  const list = document.getElementById("search-results");
  const q = query.trim().toLowerCase();

  if (!q) {
    list.innerHTML = `<li class="sub">Type a player, team, opponent, or stadium.</li>`;
    return;
  }

  const results = SEARCH_INDEX.filter((item) => {
    return (
      item.player.toLowerCase().includes(q) ||
      (item.team || "").toLowerCase().includes(q) ||
      (item.opponent || "").toLowerCase().includes(q) ||
      (item.venue || "").toLowerCase().includes(q)
    );
  });

  if (!results.length) {
    list.innerHTML = `<li class="sub">No matches found.</li>`;
    return;
  }

  list.innerHTML = results
    .map((s) => {
      const odds = s.sportsbooks ? getOddsForSignal(s) : "N/A";
      const label = getOutcomeLabel(s);
      const cls = getOutcomeClass(s);

      return `
        <li class="search-result">
          <div class="row-main">
            <span class="row-title">${s.player}</span>
            <span class="row-tag tier">${s.tier}</span>
            <span class="row-tag team">${s.team || ""}</span>
            ${
              s.ocm !== null
                ? `<span class="row-pill ${cls}">${label}</span>`
                : ""
            }
          </div>

          <div class="row-sub">
            vs ${s.opponent || "—"}
            ${
              s.ocm !== null
                ? `· OCM ${s.ocm.toFixed(1)} · HR ${s.hr} · ${sportsbook.toUpperCase()} ${odds}`
                : ""
            }
          </div>

          ${
            s.venue
              ? `<div class="row-sub venue">${s.venue}</div>`
              : ""
          }
        </li>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------
   SETUP SEARCH INPUT
------------------------------------------------------------ */
function setupSearch() {
  const input = document.getElementById("search-input");

  input.addEventListener("input", (e) => {
    renderSearchResults(e.target.value);
  });
}
/* ============================================================
   NexariOS v7.1 — Data Loader + Render Pipeline
   Chunk 6: Worker Fetch, Integration, Full UI Render
============================================================ */

/* ------------------------------------------------------------
   LOAD DATA FOR CURRENT DATE
------------------------------------------------------------ */
async function loadDataForCurrentDate() {
  const t0 = performance.now();
  const dateStr = toDateString(currentDate);

  try {
    const [gamesRes, signalsRes, accuracyRes] = await Promise.all([
      fetchJSON(`${WORKER_BASE}/games?date=${dateStr}`),
      fetchJSON(`${WORKER_BASE}/signals?date=${dateStr}`),
      fetchJSON(`${WORKER_BASE}/accuracy`)
    ]);

    gamesData = gamesRes?.games || [];
    signalsData = signalsRes?.signals || [];
    accuracyData = accuracyRes?.accuracy || null;

    // Build search index
    SEARCH_INDEX = buildSearchIndex();

    // Render everything
    renderHRView();
    renderGames();
    renderAccuracy();
    renderSearchResults("");

    const t1 = performance.now();
    document.getElementById("perf-data").textContent =
      Math.round(t1 - t0) + " ms";
  } catch (err) {
    console.error("Data load error:", err);
  }
}

/* ------------------------------------------------------------
   FINAL HOOKS
------------------------------------------------------------ */
setupRangeButtons();
setupSearch();
