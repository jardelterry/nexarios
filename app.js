/* ============================================================
   NexariOS — Midnight Hybrid Radial (v7.1C)
   app.js — CHUNK 1: Core State + Utilities
============================================================ */

/* ------------------------------------------------------------
   GLOBAL STATE
------------------------------------------------------------ */
let STATE = {
  signals: [],
  games: [],
  accuracy: null,
  searchIndex: [],
  currentRange: "10",        // "10", "20", "all"
  currentDate: "today",      // "today" or YYYY-MM-DD
  currentBook: "dk",         // sportsbook key
  activeTab: "hr"            // hr, games, accuracy, search, settings
};

/* ------------------------------------------------------------
   WORKER ENDPOINTS
------------------------------------------------------------ */
const WORKER_BASE = "https://nexari.jardelterry.workers.dev";

const ENDPOINTS = {
  signals: `${WORKER_BASE}/signals`,
  games:   `${WORKER_BASE}/games`,
  accuracy:`${WORKER_BASE}/accuracy`
};

/* ------------------------------------------------------------
   SAFE FETCH WRAPPER
------------------------------------------------------------ */
async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

/* ------------------------------------------------------------
   DATE UTILITIES
------------------------------------------------------------ */
function formatDateLabel(dateStr) {
  if (dateStr === "today") return "Today";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shiftDate(days) {
  if (STATE.currentDate === "today") {
    const now = new Date();
    now.setDate(now.getDate() + days);
    STATE.currentDate = now.toISOString().slice(0, 10);
  } else {
    const d = new Date(STATE.currentDate);
    d.setDate(d.getDate() + days);
    STATE.currentDate = d.toISOString().slice(0, 10);
  }

  document.getElementById("current-date-label").textContent =
    formatDateLabel(STATE.currentDate);

  loadSignals();
}

/* ------------------------------------------------------------
   DOM HELPERS
------------------------------------------------------------ */
function $(id) {
  return document.getElementById(id);
}

function clear(el) {
  el.innerHTML = "";
}

function create(tag, className = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

/* ------------------------------------------------------------
   APPLY ACTIVE STATE TO BUTTON GROUPS
------------------------------------------------------------ */
function setActiveButton(buttons, activeValue, attr = "data-range") {
  buttons.forEach(btn => {
    if (btn.getAttribute(attr) === activeValue) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

/* ------------------------------------------------------------
   BUILD QUERY STRING FOR DATE
------------------------------------------------------------ */
function buildDateQuery() {
  if (STATE.currentDate === "today") return "";
  return `?date=${STATE.currentDate}`;
}
/* ============================================================
   NexariOS — Midnight Hybrid Radial (v7.1C)
   app.js — CHUNK 2: HR Signals Engine
============================================================ */

/* ------------------------------------------------------------
   LOAD SIGNALS
------------------------------------------------------------ */
async function loadSignals() {
  const url = ENDPOINTS.signals + buildDateQuery();
  const data = await safeFetch(url);

  if (!data || !data.signals) {
    STATE.signals = [];
    renderSignals();
    return;
  }

  STATE.signals = data.signals;
  renderSignals();
}

/* ------------------------------------------------------------
   FILTER SIGNALS BY RANGE
------------------------------------------------------------ */
function applyRangeFilter(list) {
  if (STATE.currentRange === "10") return list.slice(0, 10);
  if (STATE.currentRange === "20") return list.slice(0, 20);
  return list; // "all"
}

/* ------------------------------------------------------------
   RENDER HR SIGNALS
------------------------------------------------------------ */
function renderSignals() {
  const container = $("hr-list");
  clear(container);

  const book = STATE.currentBook;
  let list = [...STATE.signals];

  // Apply range filter
  list = applyRangeFilter(list);

  list.forEach(s => {
    const price = s.sportsbooks?.[book];

    // Skip if selected book has no price
    if (!price || price === "N/A") return;

    const li = create("li");

    li.innerHTML = `
      <div class="row-main">
        <span class="row-title">${s.player}</span>
        <span class="row-tag">${s.team}</span>
      </div>

      <div class="row-sub">
        vs ${s.opponent} • ${s.tier} • ${book.toUpperCase()} ${price}
      </div>
    `;

    container.appendChild(li);
  });
}

/* ------------------------------------------------------------
   RANGE BUTTON EVENTS
------------------------------------------------------------ */
function initRangeButtons() {
  const buttons = document.querySelectorAll(".range-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      STATE.currentRange = btn.getAttribute("data-range");
      setActiveButton(buttons, STATE.currentRange, "data-range");
      renderSignals();
    });
  });
}

/* ------------------------------------------------------------
   SPORTSBOOK SELECTOR
------------------------------------------------------------ */
function initSportsbookSelector() {
  const select = $("sportsbook");

  select.addEventListener("change", () => {
    STATE.currentBook = select.value;
    renderSignals();
  });
}

/* ------------------------------------------------------------
   DATE NAVIGATION
------------------------------------------------------------ */
function initDateNavigation() {
  $("prev-day").addEventListener("click", () => shiftDate(-1));
  $("next-day").addEventListener("click", () => shiftDate(1));
}

/* ------------------------------------------------------------
   INITIALIZE HR TAB
------------------------------------------------------------ */
function initHRTab() {
  initRangeButtons();
  initSportsbookSelector();
  initDateNavigation();
  loadSignals();
}
/* ============================================================
   NexariOS — Midnight Hybrid Radial (v7.1C)
   app.js — CHUNK 3: Games Engine
============================================================ */

/* ------------------------------------------------------------
   LOAD GAMES
------------------------------------------------------------ */
async function loadGames() {
  const url = ENDPOINTS.games + buildDateQuery();
  const data = await safeFetch(url);

  if (!data || !data.games) {
    STATE.games = [];
    renderGames();
    return;
  }

  STATE.games = data.games;
  renderGames();
}

/* ------------------------------------------------------------
   RENDER GAMES LIST
------------------------------------------------------------ */
function renderGames() {
  const container = $("games-list");
  clear(container);

  STATE.games.forEach(game => {
    const li = create("li");

    const home = game.homeTeam || "Home";
    const away = game.awayTeam || "Away";
    const venue = game.venue || "";
    const temp = game.weather?.temp || null;
    const wind = game.weather?.wind || null;

    li.innerHTML = `
      <div class="row-main">
        <span class="row-title">${away}</span>
        <span>@</span>
        <span class="row-title">${home}</span>
      </div>

      <div class="row-sub">
        ${venue}
        ${temp ? `• ${temp}°F` : ""}
        ${wind ? `• Wind ${wind}` : ""}
      </div>
    `;

    // If lineups exist, render them
    if (game.lineups && (game.lineups.home?.length || game.lineups.away?.length)) {
      const lineupBox = create("div", "lineups-inline");

      if (game.lineups.away?.length) {
        game.lineups.away.forEach(p => {
          const chip = create("div", "lineup-chip");
          chip.textContent = p;
          lineupBox.appendChild(chip);
        });
      }

      if (game.lineups.home?.length) {
        game.lineups.home.forEach(p => {
          const chip = create("div", "lineup-chip");
          chip.textContent = p;
          lineupBox.appendChild(chip);
        });
      }

      li.appendChild(lineupBox);
    }

    container.appendChild(li);
  });
}

/* ------------------------------------------------------------
   INITIALIZE GAMES TAB
------------------------------------------------------------ */
function initGamesTab() {
  loadGames();
}
/* ============================================================
   NexariOS — Midnight Hybrid Radial (v7.1C)
   app.js — CHUNK 4: Accuracy Engine
============================================================ */

/* ------------------------------------------------------------
   LOAD ACCURACY DATA
------------------------------------------------------------ */
async function loadAccuracy() {
  const url = ENDPOINTS.accuracy + buildDateQuery();
  const data = await safeFetch(url);

  if (!data) {
    STATE.accuracy = null;
    renderAccuracy();
    return;
  }

  STATE.accuracy = data;
  renderAccuracy();
}

/* ------------------------------------------------------------
   RENDER ACCURACY TAB
------------------------------------------------------------ */
function renderAccuracy() {
  renderAccuracySystem();
  renderAccuracyHRRBI();
  renderAccuracyOutcomes();
}

/* ------------------------------------------------------------
   SYSTEM TRACKER
------------------------------------------------------------ */
function renderAccuracySystem() {
  const box = $("accuracy-system");
  clear(box);

  if (!STATE.accuracy || !STATE.accuracy.system) return;

  const sys = STATE.accuracy.system;

  const metrics = [
    { label: "Total Picks", value: sys.totalPicks },
    { label: "Hits", value: sys.hits },
    { label: "Misses", value: sys.misses },
    { label: "Accuracy", value: sys.accuracy + "%" }
  ];

  metrics.forEach(m => {
    const div = create("div");
    div.innerHTML = `
      <div class="accuracy-label">${m.label}</div>
      <div class="accuracy-value">${m.value}</div>
    `;
    box.appendChild(div);
  });
}

/* ------------------------------------------------------------
   HR & RBI TRACKER
------------------------------------------------------------ */
function renderAccuracyHRRBI() {
  const box = $("accuracy-hr-rbi");
  clear(box);

  if (!STATE.accuracy || !STATE.accuracy.hrrbi) return;

  const h = STATE.accuracy.hrrbi;

  const metrics = [
    { label: "HR Picks", value: h.hrPicks },
    { label: "HR Hits", value: h.hrHits },
    { label: "RBI Picks", value: h.rbiPicks },
    { label: "RBI Hits", value: h.rbiHits }
  ];

  metrics.forEach(m => {
    const div = create("div");
    div.innerHTML = `
      <div class="accuracy-label">${m.label}</div>
      <div class="accuracy-value">${m.value}</div>
    `;
    box.appendChild(div);
  });
}

/* ------------------------------------------------------------
   HR OUTCOMES LIST
------------------------------------------------------------ */
function renderAccuracyOutcomes() {
  const box = $("accuracy-hr-outcomes");
  clear(box);

  if (!STATE.accuracy || !STATE.accuracy.outcomes) return;

  STATE.accuracy.outcomes.forEach(o => {
    const row = create("div", "row-main");

    const pillClass =
      o.result === "hit" ? "row-pill hit" :
      o.result === "miss" ? "row-pill miss" :
      "row-pill pending";

    row.innerHTML = `
      <span class="row-title">${o.player}</span>
      <span class="${pillClass}">${o.result.toUpperCase()}</span>
    `;

    box.appendChild(row);
  });
}

/* ------------------------------------------------------------
   INITIALIZE ACCURACY TAB
------------------------------------------------------------ */
function initAccuracyTab() {
  loadAccuracy();
}
/* ============================================================
   NexariOS — Midnight Hybrid Radial (v7.1C)
   app.js — CHUNK 5: Search Engine
============================================================ */

/* ------------------------------------------------------------
   BUILD SEARCH INDEX
   (Players, teams, stadiums — whatever the Worker provides)
------------------------------------------------------------ */
function buildSearchIndex() {
  STATE.searchIndex = [];

  // Pull from signals (players)
  STATE.signals.forEach(s => {
    STATE.searchIndex.push({
      type: "player",
      name: s.player,
      team: s.team,
      opponent: s.opponent
    });
  });

  // Pull from games (teams + stadiums)
  STATE.games.forEach(g => {
    if (g.homeTeam) {
      STATE.searchIndex.push({
        type: "team",
        name: g.homeTeam,
        venue: g.venue || ""
      });
    }
    if (g.awayTeam) {
      STATE.searchIndex.push({
        type: "team",
        name: g.awayTeam,
        venue: g.venue || ""
      });
    }
    if (g.venue) {
      STATE.searchIndex.push({
        type: "venue",
        name: g.venue
      });
    }
  });
}

/* ------------------------------------------------------------
   FILTER SEARCH RESULTS
------------------------------------------------------------ */
function searchFilter(query) {
  if (!query || query.trim() === "") return [];

  const q = query.toLowerCase();

  return STATE.searchIndex.filter(item =>
    item.name.toLowerCase().includes(q)
  );
}

/* ------------------------------------------------------------
   RENDER SEARCH RESULTS
------------------------------------------------------------ */
function renderSearchResults(results) {
  const box = $("search-results");
  clear(box);

  results.forEach(r => {
    const li = create("li");

    let subtitle = "";
    if (r.type === "player") {
      subtitle = `${r.team} vs ${r.opponent}`;
    } else if (r.type === "team") {
      subtitle = r.venue ? `Plays at ${r.venue}` : "";
    } else if (r.type === "venue") {
      subtitle = "Stadium";
    }

    li.innerHTML = `
      <div class="row-main">
        <span class="row-title">${r.name}</span>
        <span class="row-tag">${r.type.toUpperCase()}</span>
      </div>
      <div class="row-sub">${subtitle}</div>
    `;

    box.appendChild(li);
  });
}

/* ------------------------------------------------------------
   INITIALIZE SEARCH TAB
------------------------------------------------------------ */
function initSearchTab() {
  const input = $("search-input");

  input.addEventListener("input", () => {
    const q = input.value;
    const results = searchFilter(q);
    renderSearchResults(results);
  });
}
/* ============================================================
   NexariOS — Midnight Hybrid Radial (v7.1C)
   app.js — CHUNK 6: Navigation Engine
============================================================ */

/* ------------------------------------------------------------
   SWITCH TAB
------------------------------------------------------------ */
function switchTab(tab) {
  STATE.activeTab = tab;

  // Hide all tabs
  document.querySelectorAll(".tab-view").forEach(t => {
    t.classList.remove("active");
  });

  // Show selected tab
  const active = document.querySelector(`#tab-${tab}`);
  if (active) active.classList.add("active");

  // Update sidebar active state
  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
  });

  // Update bottom nav active state
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
  });

  // Move indicator (mobile)
  updateNavIndicator();
}

/* ------------------------------------------------------------
   NAV INDICATOR (MOBILE)
------------------------------------------------------------ */
function updateNavIndicator() {
  const indicator = $("nav-indicator");
  const active = document.querySelector(".nav-item.active");

  if (!indicator || !active) return;

  const rect = active.getBoundingClientRect();
  const parentRect = active.parentElement.getBoundingClientRect();

  const width = rect.width * 0.6;
  const left = rect.left - parentRect.left + (rect.width - width) / 2;

  indicator.style.width = `${width}px`;
  indicator.style.transform = `translateX(${left}px)`;
}

/* ------------------------------------------------------------
   SIDEBAR NAVIGATION
------------------------------------------------------------ */
function initSidebarNav() {
  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      switchTab(tab);
    });
  });
}

/* ------------------------------------------------------------
   BOTTOM NAVIGATION (MOBILE)
------------------------------------------------------------ */
function initBottomNav() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      switchTab(tab);
    });
  });
}

/* ------------------------------------------------------------
   DEVICE MODE SWITCHING
------------------------------------------------------------ */
function initDeviceMode() {
  const select = $("device-mode");

  select.addEventListener("change", () => {
    const mode = select.value;

    document.body.classList.remove("device-auto", "device-mobile", "device-desktop");

    if (mode === "auto") {
      document.body.classList.add("device-auto");
    } else if (mode === "mobile") {
      document.body.classList.add("device-mobile");
    } else if (mode === "desktop") {
      document.body.classList.add("device-desktop");
    }

    // Recalculate nav indicator after layout shift
    setTimeout(updateNavIndicator, 150);
  });
}

/* ------------------------------------------------------------
   INITIALIZE NAVIGATION
------------------------------------------------------------ */
function initNavigation() {
  initSidebarNav();
  initBottomNav();
  initDeviceMode();

  // Default tab
  switchTab("hr");

  // Ensure indicator is placed correctly on load
  setTimeout(updateNavIndicator, 200);
}
/* ============================================================
   NexariOS — Midnight Hybrid Radial (v7.1C)
   app.js — CHUNK 7: Boot Sequence
============================================================ */

/* ------------------------------------------------------------
   INITIALIZE ALL TABS
------------------------------------------------------------ */
function initTabs() {
  initHRTab();
  initGamesTab();
  initAccuracyTab();
  initSearchTab();
}

/* ------------------------------------------------------------
   BUILD SEARCH INDEX AFTER DATA LOAD
------------------------------------------------------------ */
async function loadAllDataThenBuildSearch() {
  // Load signals first (search needs players)
  await loadSignals();

  // Load games (search needs teams + venues)
  await loadGames();

  // Load accuracy (independent)
  await loadAccuracy();

  // Build search index from all loaded data
  buildSearchIndex();
}

/* ------------------------------------------------------------
   FULL SYSTEM BOOT
------------------------------------------------------------ */
async function bootNexariOS() {
  console.log("NexariOS v7.1C — Midnight Hybrid Radial booting…");

  // Initialize navigation first
  initNavigation();

  // Load all data, then build search index
  await loadAllDataThenBuildSearch();

  // Initialize tab logic (listeners, controls)
  initTabs();

  console.log("NexariOS v7.1C — System Ready.");
}

/* ------------------------------------------------------------
   DOM READY
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  bootNexariOS();
});
