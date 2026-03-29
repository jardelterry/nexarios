/* ============================================================
   NexariOS v6.6 — Core Engine
   Deep Space + Carbon Shimmer • Balanced Neon • Glow Pulse
   ============================================================ */

/* ------------------------------
   GLOBAL STATE
--------------------------------*/
let gamesData = [];
let signalsData = [];
let currentSportsbook = "DK";
let currentView = "top10";

/* ------------------------------
   DOM ELEMENTS
--------------------------------*/
const hrList = document.getElementById("hrList");
const gamesList = document.getElementById("gamesList");
const dailyAccuracyList = document.getElementById("dailyAccuracyList");
const systemPerformanceList = document.getElementById("systemPerformanceList");
const streakList = document.getElementById("streakList");
const searchResults = document.getElementById("searchResults");

const sportsbookSelect = document.getElementById("sportsbookSelect");
const viewSelect = document.getElementById("viewSelect");
const systemDate = document.getElementById("systemDate");

/* ------------------------------
   DATE RENDERING
--------------------------------*/
function renderSystemDate() {
  const now = new Date();
  const formatted = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  systemDate.textContent = formatted;
}
renderSystemDate();

/* ------------------------------
   TAB NAVIGATION
--------------------------------*/
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.getAttribute("data-tab");
    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.remove("active");
      if (panel.id === tab) panel.classList.add("active");
    });
  });
});

/* ------------------------------
   FETCH DATA (SIMPLIFIED)
--------------------------------*/
async function loadData() {
  try {
    const gamesRes = await fetch("games.json");
    const signalsRes = await fetch("signals.json");

    gamesData = await gamesRes.json();
    signalsData = await signalsRes.json();

    renderHRView();
    renderGames();
  } catch (err) {
    console.error("Data load error:", err);
  }
}
loadData();

/* ------------------------------
   HR VIEW RENDERING
--------------------------------*/
function renderHRView() {
  hrList.innerHTML = "";

  let sorted = [...signalsData].sort((a, b) => b.overmindCompositeMetric - a.overmindCompositeMetric);

  if (currentView === "top10") sorted = sorted.slice(0, 10);
  if (currentView === "top20") sorted = sorted.slice(0, 20);

  sorted.forEach(sig => {
    const card = document.createElement("div");
    card.className = "card hr-card";

    const odds = sig.sportsbooks?.[currentSportsbook] ?? "N/A";

    card.innerHTML = `
      <div class="hr-player">${sig.player}</div>
      <div class="hr-meta">${sig.team} vs ${sig.opponent}</div>
      <div class="hr-meta">HR Base: ${sig.hr}</div>
      <div class="ocm-badge">OCM ${sig.overmindCompositeMetric}</div>
      <div class="odds">${currentSportsbook}: ${odds}</div>
    `;

    hrList.appendChild(card);
  });
}

/* ------------------------------
   SELECT HANDLERS
--------------------------------*/
sportsbookSelect.addEventListener("change", () => {
  currentSportsbook = sportsbookSelect.value;
  renderHRView();
});

viewSelect.addEventListener("change", () => {
  currentView = viewSelect.value;
  renderHRView();
});
/* ============================================================
   FULL PLAYER POOL + SEARCH ENGINE
   ============================================================ */

/* ------------------------------
   BUILD FULL PLAYER POOL
--------------------------------*/
function buildFullPlayerPool() {
  const allPlayers = [];

  gamesData.forEach(game => {
    // Away players
    if (game.awayPlayers) {
      game.awayPlayers.forEach(p => {
        allPlayers.push({
          name: p.name,
          team: game.away,
          opponent: game.home,
          ...p
        });
      });
    }

    // Home players
    if (game.homePlayers) {
      game.homePlayers.forEach(p => {
        allPlayers.push({
          name: p.name,
          team: game.home,
          opponent: game.away,
          ...p
        });
      });
    }
  });

  // Merge HR data into players
  allPlayers.forEach(player => {
    const sig = signalsData.find(s => s.player === player.name);

    if (sig) {
      player.ocm = sig.overmindCompositeMetric;
      player.hr = sig.hr;
      player.odds = sig.sportsbooks?.[currentSportsbook] ?? "N/A";
      player.hasProjection = true;
    } else {
      player.ocm = 0;
      player.hr = 0;
      player.odds = "N/A";
      player.hasProjection = false;
    }
  });

  return allPlayers;
}

/* ------------------------------
   SEARCH ENGINE
--------------------------------*/
const playerSearchInput = document.getElementById("playerSearchInput");
const showAllPlayersToggle = document.getElementById("showAllPlayersToggle");
const searchResultCount = document.getElementById("searchResultCount");

playerSearchInput.addEventListener("input", runSearch);
showAllPlayersToggle.addEventListener("change", runSearch);

function runSearch() {
  const query = playerSearchInput.value.trim().toLowerCase();
  const showAll = showAllPlayersToggle.checked;

  const pool = buildFullPlayerPool();

  // Filter by name
  let results = pool.filter(p => p.name.toLowerCase().includes(query));

  // Default: only projected players
  if (!showAll) {
    results = results.filter(p => p.hasProjection);
  }

  renderSearchResults(results);
}

/* ------------------------------
   RENDER SEARCH RESULTS
--------------------------------*/
function renderSearchResults(results) {
  searchResults.innerHTML = "";

  if (results.length === 0) {
    searchResultCount.textContent = "No players found";
    return;
  }

  searchResultCount.textContent = `${results.length} players`;

  results.forEach(p => {
    const card = document.createElement("div");
    card.className = "card hr-card";

    const hrDisplay = p.hasProjection
      ? `${p.hr}`
      : `0% (No projection)`;

    const ocmDisplay = p.hasProjection
      ? `OCM ${p.ocm}`
      : `OCM 0`;

    card.innerHTML = `
      <div class="hr-player">${p.name}</div>
      <div class="hr-meta">${p.team} vs ${p.opponent}</div>
      <div class="hr-meta">HR Base: ${hrDisplay}</div>
      <div class="ocm-badge">${ocmDisplay}</div>
      <div class="odds">${currentSportsbook}: ${p.odds}</div>
    `;

    searchResults.appendChild(card);
  });
}
/* ============================================================
   GAMES VIEW + ACCURACY VIEW + STREAKS + SYSTEM PERFORMANCE
   ============================================================ */

/* ------------------------------
   RENDER GAMES VIEW
--------------------------------*/
function renderGames() {
  gamesList.innerHTML = "";

  gamesData.forEach(game => {
    const card = document.createElement("div");
    card.className = "card";

    const time = game.time ?? "TBD";

    card.innerHTML = `
      <div class="hr-player">${game.away} @ ${game.home}</div>
      <div class="hr-meta">Start: ${time}</div>
      <div class="hr-meta">Venue: ${game.venue ?? "—"}</div>
    `;

    gamesList.appendChild(card);
  });
}

/* ============================================================
   ACCURACY VIEW
   ============================================================ */

/* ------------------------------
   DAILY ACCURACY
--------------------------------*/
function renderDailyAccuracy(data = []) {
  dailyAccuracyList.innerHTML = "";

  if (!data.length) {
    dailyAccuracyList.innerHTML = `<div class="hr-meta">No accuracy data available</div>`;
    return;
  }

  data.forEach(day => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="hr-player">${day.date}</div>
      <div class="hr-meta">Hits: ${day.hits}</div>
      <div class="hr-meta">Misses: ${day.misses}</div>
      <div class="hr-meta">Accuracy: ${day.accuracy}%</div>
    `;

    dailyAccuracyList.appendChild(card);
  });
}

/* ------------------------------
   SYSTEM PERFORMANCE
--------------------------------*/
function renderSystemPerformance(data = []) {
  systemPerformanceList.innerHTML = "";

  if (!data.length) {
    systemPerformanceList.innerHTML = `<div class="hr-meta">No system performance data</div>`;
    return;
  }

  data.forEach(sys => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="hr-player">${sys.name}</div>
      <div class="hr-meta">Record: ${sys.record}</div>
      <div class="hr-meta">Hit Rate: ${sys.hitRate}%</div>
      <div class="hr-meta">Units: ${sys.units}</div>
    `;

    systemPerformanceList.appendChild(card);
  });
}

/* ============================================================
   STREAKS VIEW
   ============================================================ */

/* ------------------------------
   PLAYER STREAKS
--------------------------------*/
function renderStreaks(data = []) {
  streakList.innerHTML = "";

  if (!data.length) {
    streakList.innerHTML = `<div class="hr-meta">No streak data available</div>`;
    return;
  }

  data.forEach(p => {
    const row = document.createElement("div");
    row.className = "card";

    row.innerHTML = `
      <div class="hr-player">${p.player}</div>
      <div class="hr-meta">Team: ${p.team}</div>
      <div class="hr-meta">Streak: ${p.streak} games</div>
    `;

    streakList.appendChild(row);
  });
}

/* ============================================================
   OPTIONAL: HOOKS FOR FUTURE EXPANSION
   (You can feed accuracy/streak/system data here)
   ============================================================ */

function loadAccuracyData() {
  // Placeholder for future integration
  // renderDailyAccuracy(accuracyData);
  // renderSystemPerformance(systemData);
  // renderStreaks(streakData);
}

/* Auto-run accuracy loaders if needed */
loadAccuracyData();
