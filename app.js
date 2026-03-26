/* ============================================================
   Nexari OS — app.js (v4.4, Worker URL Patched)
   ============================================================ */

let SCHEDULE = null;

/* -----------------------------
   MAIN ENTRY
----------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  showLoading(true);

  SCHEDULE = await loadNexariSchedule();

  renderHRSignals();
  renderGames();
  renderSettings();

  showLoading(false);
});

/* -----------------------------
   FETCH ULTRA-ARTIFACT
----------------------------- */
async function loadNexariSchedule() {
  try {
    const res = await fetch("https://nexari.jardelterry.workers.dev/schedule", {
      cache: "no-store"
    });

    if (!res.ok) throw new Error("Bad response");
    return await res.json();

  } catch (err) {
    console.error("Schedule fetch failed:", err);
    return { date: "N/A", games: [] };
  }
}

/* -----------------------------
   UI HELPERS
----------------------------- */
function showLoading(state) {
  const el = document.getElementById("loading");
  el.style.display = state ? "block" : "none";
}

function switchTab(tab) {
  document.getElementById("tab-hr").style.display = "none";
  document.getElementById("tab-games").style.display = "none";
  document.getElementById("tab-settings").style.display = "none";

  document.getElementById("nav-hr").classList.remove("active");
  document.getElementById("nav-games").classList.remove("active");
  document.getElementById("nav-settings").classList.remove("active");

  if (tab === "hr") {
    document.getElementById("tab-hr").style.display = "block";
    document.getElementById("nav-hr").classList.add("active");
  }
  if (tab === "games") {
    document.getElementById("tab-games").style.display = "block";
    document.getElementById("nav-games").classList.add("active");
  }
  if (tab === "settings") {
    document.getElementById("tab-settings").style.display = "block";
    document.getElementById("nav-settings").classList.add("active");
  }
}

/* ============================================================
   TAB 1 — HR SIGNALS
   ============================================================ */

function renderHRSignals() {
  const container = document.getElementById("tab-hr");

  if (!SCHEDULE.games.length) {
    container.innerHTML = `<p>No games today.</p>`;
    return;
  }

  let html = "";

  SCHEDULE.games.forEach(g => {
    html += `
      <div class="card">
        <h2>${g.away.teamName} @ ${g.home.teamName}</h2>
        <p>Home HR Score: <strong>${safeNum(g.nexari.homeHRScore)}</strong></p>
        <p>Away HR Score: <strong>${safeNum(g.nexari.awayHRScore)}</strong></p>
        <p>Weather Adj: ${safeNum(g.nexari.weatherAdjustment)}</p>
        <p>Park HR Factor: ${g.parkFactors.hr}</p>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ============================================================
   TAB 2 — GAMES LIST
   ============================================================ */

function renderGames() {
  const container = document.getElementById("tab-games");

  if (!SCHEDULE.games.length) {
    container.innerHTML = `<p>No games today.</p>`;
    return;
  }

  let html = "";

  SCHEDULE.games.forEach(g => {
    html += `
      <div class="card">
        <h2>${g.away.teamName} @ ${g.home.teamName}</h2>
        <p><strong>Time:</strong> ${g.gameTime}</p>
        <p><strong>Pitchers:</strong><br>
          ${g.away.probablePitcher.name || "TBD"} (Away)<br>
          ${g.home.probablePitcher.name || "TBD"} (Home)
        </p>
        <p><strong>Weather:</strong> ${g.weather.temp}°F — ${g.weather.forecast}</p>
        <button onclick="openGameDetail(${g.gamePk})">View Details</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ============================================================
   GAME DETAIL MODAL
   ============================================================ */

function openGameDetail(gamePk) {
  const g = SCHEDULE.games.find(x => x.gamePk === gamePk);
  const modal = document.getElementById("game-modal");
  const body = document.getElementById("game-modal-body");

  const injuriesHome = g.home.roster.filter(p => p.injury);
  const injuriesAway = g.away.roster.filter(p => p.injury);

  body.innerHTML = `
    <h2>${g.away.teamName} @ ${g.home.teamName}</h2>

    <h3>Weather</h3>
    <p>${g.weather.temp}°F — ${g.weather.forecast}</p>

    <h3>Pitchers</h3>
    <p>${g.away.probablePitcher.name || "TBD"} (Away)</p>
    <p>${g.home.probablePitcher.name || "TBD"} (Home)</p>

    <h3>HR Scores</h3>
    <p>Home: ${safeNum(g.nexari.homeHRScore)}</p>
    <p>Away: ${safeNum(g.nexari.awayHRScore)}</p>

    <h3>Injuries</h3>
    <strong>${g.away.teamName}</strong>
    ${injuriesAway.length ? injuriesAway.map(i => `<p>${i.name}: ${i.injury.description}</p>`).join("") : "<p>No injuries</p>"}

    <strong>${g.home.teamName}</strong>
    ${injuriesHome.length ? injuriesHome.map(i => `<p>${i.name}: ${i.injury.description}</p>`).join("") : "<p>No injuries</p>"}
  `;

  modal.style.display = "block";
}

function closeGameDetail() {
  document.getElementById("game-modal").style.display = "none";
}

/* ============================================================
   TAB 3 — SETTINGS
   ============================================================ */

function renderSettings() {
  const container = document.getElementById("tab-settings");

  container.innerHTML = `
    <div class="card">
      <h2>Nexari OS</h2>
      <p>Version: 4.4</p>
      <p>Data Source: Ultra-Artifact</p>
      <p>Auto Refresh: Daily @ 9 AM EST</p>
    </div>
  `;
}

/* ============================================================
   UTIL
   ============================================================ */

function safeNum(n) {
  return n === null || n === undefined ? "N/A" : Number(n).toFixed(2);
}
