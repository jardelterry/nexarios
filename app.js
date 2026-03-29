/* ============================================================
   NexariOS Midnight OS — v7.1B
   CHUNK 1 — Core Engine + Navigation (PATCHED)
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

let sportsbook = "dk";
let deviceMode = "auto";

let SEARCH_INDEX = [];

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
  if (!res.ok) throw new Error("Fetch failed: " + url);
  return res.json();
}

/* ------------------------------------------------------------
   DEVICE MODE
------------------------------------------------------------ */
function applyDeviceMode(mode) {
  const root = document.body;
  root.classList.remove("device-auto", "device-mobile", "device-desktop");

  if (mode === "mobile") root.classList.add("device-mobile");
  else if (mode === "desktop") root.classList.add("device-desktop");
  else root.classList.add("device-auto");
}

function setupDeviceMode() {
  const select = document.getElementById("device-mode");
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
   THEME — Midnight OS stays dark
------------------------------------------------------------ */
function setupThemeToggle() {
  // Midnight OS is always dark — no toggle needed
}

/* ------------------------------------------------------------
   NAVIGATION — Midnight OS (PATCHED)
------------------------------------------------------------ */
function activateTab(tabName) {
  // Sidebar
  document.querySelectorAll(".sidebar-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabName);
  });

  // Bottom nav
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabName);
  });

  // Tabs (PATCH: ensures only one tab is visible)
  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.remove("active");
  });
  document.getElementById("tab-" + tabName).classList.add("active");

  // Mobile indicator
  const indicator = document.getElementById("nav-indicator");
  const active = document.querySelector(".nav-item.active");
  if (indicator && active) {
    const rect = active.getBoundingClientRect();
    const parentRect = active.parentElement.getBoundingClientRect();
    indicator.style.width = rect.width + "px";
    indicator.style.transform = `translateX(${rect.left - parentRect.left}px)`;
  }
}

function setupNavigation() {
  document.querySelectorAll(".sidebar-item").forEach((item) => {
    item.addEventListener("click", () => activateTab(item.dataset.tab));
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => activateTab(item.dataset.tab));
  });

  activateTab("hr");
}
/* ============================================================
   NexariOS Midnight OS — v7.1B
   CHUNK 2 — HR Signals Engine
============================================================ */

/* ------------------------------------------------------------
   SIGNAL STATUS LOGIC
------------------------------------------------------------ */
function allSignalsPending() {
  return !gamesData.some((g) => {
    const s = (g.status || "").toLowerCase();
    return s.includes("final") || s.includes("completed");
  });
}

function getOutcomeLabel(s) {
  if (s.hrHit) return "Hit";
  if (allSignalsPending()) return "Pending";
  return "Miss";
}

function getOutcomeClass(s) {
  if (s.hrHit) return "hit";
  if (allSignalsPending()) return "pending";
  return "miss";
}

/* ------------------------------------------------------------
   SPORTSBOOK ODDS
------------------------------------------------------------ */
function getOddsForSignal(s) {
  if (!s.sportsbooks) return "N/A";
  return s.sportsbooks[sportsbook] ?? "N/A";
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
    signals = signals.slice(0, parseInt(currentRange, 10));
  }

  // Render each signal
  signals.forEach((s) => {
    const label = getOutcomeLabel(s);
    const cls = getOutcomeClass(s);
    const odds = getOddsForSignal(s);

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="row-main">
        <span class="row-title">${s.player}</span>
        <span class="row-tag">${s.tier}</span>
        <span class="row-tag">${s.team}</span>
        <span class="row-pill ${cls}">${label}</span>
      </div>

      <div class="row-sub">
        vs ${s.opponent} · 
        OCM ${s.overmindCompositeMetric.toFixed(1)} · 
        HR ${s.hr} · 
        ${sportsbook.toUpperCase()} ${odds}
      </div>

      ${
        s.context?.venueName
          ? `<div class="row-sub">${s.context.venueName}</div>`
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
  document.querySelectorAll(".range-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".range-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      currentRange = btn.dataset.range;
      renderHRView();
    });
  });
}
/* ============================================================
   NexariOS Midnight OS — v7.1B
   CHUNK 3 — Games Engine
============================================================ */

/* ------------------------------------------------------------
   LINEUPS — Horizontal Chips
------------------------------------------------------------ */
function renderLineupChips(players) {
  if (!players || !players.length) return "";

  return `
    <div class="lineups-inline">
      ${players
        .map((p) => `<div class="lineup-chip">${p.name} (${p.pos})</div>`)
        .join("")}
    </div>
  `;
}

/* ------------------------------------------------------------
   GAME STATUS + WEATHER
------------------------------------------------------------ */
function formatGameStatus(g) {
  const status = (g.status || "").toLowerCase();
  const hasScore = g.awayScore != null && g.homeScore != null;

  const weather = [
    g.temp != null ? `${g.temp}°` : "",
    g.wind != null ? `${g.wind} mph` : "",
    g.conditions || ""
  ]
    .filter(Boolean)
    .join(" · ");

  // FINAL
  if (status.includes("final") || status.includes("completed")) {
    return {
      line2: `Final · ${g.awayScore}–${g.homeScore}`,
      line3: weather
    };
  }

  // LIVE
  if (g.live && hasScore) {
    return {
      line2: `LIVE · ${g.awayScore}–${g.homeScore}`,
      line3: weather
    };
  }

  // PRE-GAME
  return {
    line2: g.gameTime || "TBD",
    line3: weather
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
        <span>@</span>
        <span class="row-title">${g.home}</span>
      </div>

      <div class="row-sub">${line2}</div>
      ${g.venueName ? `<div class="row-sub">${g.venueName}</div>` : ""}
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
   NexariOS Midnight OS — v7.1B
   CHUNK 4 — Accuracy Engine + Search Engine + Data Loader
============================================================ */

/* ------------------------------------------------------------
   ACCURACY ENGINE
------------------------------------------------------------ */
function anyGameFinal() {
  return gamesData.some((g) => {
    const s = (g.status || "").toLowerCase();
    return s.includes("final") || s.includes("completed");
  });
}

function buildAccuracyMetrics() {
  const finalExists = anyGameFinal();

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

function renderAccuracySystem(m) {
  document.getElementById("accuracy-system").innerHTML = `
    <div class="accuracy-label">Accuracy</div>
    <div class="accuracy-value">${m.accuracy}</div>

    <div class="accuracy-label">Volume</div>
    <div class="accuracy-value">${m.volume}</div>

    <div class="accuracy-label">Sys Streak</div>
    <div class="accuracy-value">${m.systemStreak}</div>

    <div class="accuracy-label">Player Streak</div>
    <div class="accuracy-value">${m.playerStreak}</div>
  `;
}

function renderHRRBITracker(m) {
  document.getElementById("accuracy-hr-rbi").innerHTML = `
    <div class="accuracy-label">HR Hits</div>
    <div class="accuracy-value">${m.hrHits}</div>

    <div class="accuracy-label">RBI Hits</div>
    <div class="accuracy-value">${m.rbiHits}</div>

    <div class="accuracy-label">Hits</div>
    <div class="accuracy-value">${m.hits.length}</div>

    <div class="accuracy-label">Misses</div>
    <div class="accuracy-value">${m.misses.length}</div>
  `;
}

function renderAccuracyOutcomes(m) {
  const container = document.getElementById("accuracy-hr-outcomes");

  const hitsList = m.hits
    .map((s) => `<div class="outcome-row hit-row">${s.player} (${s.team})</div>`)
    .join("");

  const missesList = m.misses
    .map((s) => `<div class="outcome-row miss-row">${s.player} (${s.team})</div>`)
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

function renderAccuracy() {
  const m = buildAccuracyMetrics();
  renderAccuracySystem(m);
  renderHRRBITracker(m);
  renderAccuracyOutcomes(m);
}

/* ------------------------------------------------------------
   SEARCH ENGINE
------------------------------------------------------------ */
function buildSearchIndex() {
  const index = [];

  // HR signals
  signalsData.forEach((s) => {
    index.push({
      player: s.player,
      team: s.team,
      opponent: s.opponent,
      venue: s.context?.venueName || "",
      ocm: s.overmindCompositeMetric || 0,
      hr: s.hr,
      tier: s.tier,
      sportsbooks: s.sportsbooks,
      hrHit: s.hrHit
    });
  });

  // Lineups
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

  // Deduplicate
  const map = new Map();
  index.forEach((item) => {
    const key = `${item.player}-${item.team}`;
    if (!map.has(key)) map.set(key, item);
  });

  return Array.from(map.values()).sort((a, b) =>
    a.player.localeCompare(b.player)
  );
}

function renderSearchResults(query) {
  const list = document.getElementById("search-results");
  const q = query.trim().toLowerCase();

  if (!q) {
    list.innerHTML = `<li class="sub">Type a player, team, or stadium.</li>`;
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
      const odds = s.ocm !== null ? getOddsForSignal(s) : "N/A";
      const label = s.ocm !== null ? getOutcomeLabel(s) : "";
      const cls = s.ocm !== null ? getOutcomeClass(s) : "";

      return `
        <li class="search-result">
          <div class="row-main">
            <span class="row-title">${s.player}</span>
            <span class="row-tag">${s.tier}</span>
            <span class="row-tag">${s.team}</span>
            ${
              s.ocm !== null
                ? `<span class="row-pill ${cls}">${label}</span>`
                : ""
            }
          </div>

          <div class="row-sub">
            vs ${s.opponent}
            ${
              s.ocm !== null
                ? `· OCM ${s.ocm.toFixed(1)} · HR ${s.hr} · ${sportsbook.toUpperCase()} ${odds}`
                : ""
            }
          </div>

          ${s.venue ? `<div class="row-sub">${s.venue}</div>` : ""}
        </li>
      `;
    })
    .join("");
}

function setupSearch() {
  document
    .getElementById("search-input")
    .addEventListener("input", (e) => renderSearchResults(e.target.value));
}

/* ------------------------------------------------------------
   DATA LOADER
------------------------------------------------------------ */
async function loadDataForCurrentDate() {
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

    SEARCH_INDEX = buildSearchIndex();

    renderHRView();
    renderGames();
    renderAccuracy();
    renderSearchResults("");

  } catch (err) {
    console.error("Data load error:", err);
  }
}

/* ------------------------------------------------------------
   FINAL SETUP
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupRangeButtons();
  setupSportsbookSelector();
  setupSearch();
  setupDeviceMode();
  updateDateLabel();
  loadDataForCurrentDate();

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
});
