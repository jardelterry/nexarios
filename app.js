// app.js — NexariOS v7.1C (Full Rewrite, Normalized Workers)

// MAIN ENGINE
const MAIN_BASE = "https://nexari.jardel.workers.dev";
// AUTO ENGINE (no /games, only /signals + /accuracy)
const AUTO_BASE = "https://nexari-auto.jardel.workers.dev";

let currentEngine = "main"; // "main" | "auto"
let currentTab = "hr";      // "hr" | "games" | "accuracy" | "search" | "settings"

let state = {
  signals: [],
  games: [],
  accuracy: null
};

function $(id) {
  return document.getElementById(id);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} ${res.status}`);
  return res.json();
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "";
}

function setActiveTab(tab) {
  currentTab = tab;
  document.querySelectorAll("[data-tab]").forEach(el => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
  document.querySelectorAll("[data-panel]").forEach(el => {
    el.classList.toggle("active", el.dataset.panel === tab);
  });
}
function getBaseUrl() {
  return currentEngine === "auto" ? AUTO_BASE : MAIN_BASE;
}

async function loadSignals(date = null) {
  try {
    const base = getBaseUrl();
    const url = new URL(base + "/signals");
    if (date) url.searchParams.set("date", date);

    const data = await fetchJSON(url.toString());
    // Expect: { ok, date, signals: [ { player, team, opponent, tier, sportsbooks, overmindCompositeMetric } ] }
    if (!data.ok || !Array.isArray(data.signals)) {
      console.warn("Unexpected signals payload", data);
      state.signals = [];
    } else {
      state.signals = data.signals;
    }
    renderSignals();
  } catch (e) {
    console.error("loadSignals error", e);
    state.signals = [];
    renderSignals();
  }
}

async function loadGames(date = null) {
  // Only main engine has /games
  if (currentEngine === "auto") {
    state.games = [];
    renderGames();
    return;
  }

  try {
    const base = getBaseUrl();
    const url = new URL(base + "/games");
    if (date) url.searchParams.set("date", date);

    const data = await fetchJSON(url.toString());
    // Expect: { ok, date, games: [ { homeTeam, awayTeam, venue, temp, wind, lineups: { home, away } } ] }
    if (!data.ok || !Array.isArray(data.games)) {
      console.warn("Unexpected games payload", data);
      state.games = [];
    } else {
      state.games = data.games;
    }
    renderGames();
  } catch (e) {
    console.error("loadGames error", e);
    state.games = [];
    renderGames();
  }
}

async function loadAccuracy() {
  try {
    const base = getBaseUrl();
    const url = new URL(base + "/accuracy");

    const data = await fetchJSON(url.toString());
    // Expect: { ok, accuracy: { system: {...}, outcomes: [...] } }
    if (!data.ok || !data.accuracy) {
      console.warn("Unexpected accuracy payload", data);
      state.accuracy = null;
    } else {
      state.accuracy = data.accuracy;
    }
    renderAccuracy();
  } catch (e) {
    console.error("loadAccuracy error", e);
    state.accuracy = null;
    renderAccuracy();
  }
}
/* ------------------------------
   RENDER: HR / SIGNALS
--------------------------------*/
function renderSignals() {
  const container = $("signals-list");
  if (!container) return;

  container.innerHTML = "";

  if (!state.signals.length) {
    container.innerHTML = `<div class="empty-state">No signals available.</div>`;
    return;
  }

  state.signals.forEach(sig => {
    const div = document.createElement("div");
    div.className = "signal-row";

    const odds = sig.sportsbooks || {};
    const bestLine = odds.dk || odds.fd || odds.mgm || "N/A";

    div.innerHTML = `
      <div class="signal-main">
        <div class="signal-player">${sig.player}</div>
        <div class="signal-meta">
          <span class="signal-team">${sig.team || ""}</span>
          <span class="signal-vs">${sig.opponent ? `vs ${sig.opponent}` : ""}</span>
        </div>
      </div>
      <div class="signal-side">
        <div class="signal-tier">${sig.tier}</div>
        <div class="signal-ocm">${Math.round(sig.overmindCompositeMetric || 0)}</div>
        <div class="signal-odds">${bestLine}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ------------------------------
   RENDER: GAMES + LINEUPS
--------------------------------*/
function renderGames() {
  const titleEl = $("game-title");
  const venueEl = $("venue");
  const weatherEl = $("weather");
  const homeContainer = $("home-lineup");
  const awayContainer = $("away-lineup");

  if (!titleEl || !venueEl || !weatherEl || !homeContainer || !awayContainer) return;

  if (!state.games.length) {
    titleEl.textContent = currentEngine === "auto"
      ? "Games not available in Auto mode"
      : "No games found";
    venueEl.textContent = "";
    weatherEl.textContent = "";
    homeContainer.innerHTML = "";
    awayContainer.innerHTML = "";
    return;
  }

  // For now, show the first game (you can add next/prev later)
  const game = state.games[0];

  titleEl.textContent = `${game.awayTeam} @ ${game.homeTeam}`;
  venueEl.textContent = game.venue || "";

  const weatherParts = [];
  if (game.temp != null) weatherParts.push(`${game.temp}°`);
  if (game.wind != null) weatherParts.push(`Wind ${game.wind} mph`);
  weatherEl.textContent = weatherParts.join(" • ");

  renderLineup(game.lineups?.home || [], homeContainer);
  renderLineup(game.lineups?.away || [], awayContainer);
}

function renderLineup(list, container) {
  container.innerHTML = "";

  list.forEach(player => {
    // player is an object: { name, pos, ... }
    const div = document.createElement("div");
    div.className = "player-tile";

    const name = player.name || "";
    const pos = player.pos || "";

    div.innerHTML = `
      <span class="player-name">${name}</span>
      ${pos ? `<span class="player-pos">${pos}</span>` : ""}
    `;

    container.appendChild(div);
  });
}
/* ------------------------------
   RENDER: ACCURACY
--------------------------------*/
function renderAccuracy() {
  const systemEl = $("accuracy-system");
  const listEl = $("accuracy-list");
  if (!systemEl || !listEl) return;

  listEl.innerHTML = "";

  if (!state.accuracy) {
    systemEl.textContent = "No accuracy data.";
    return;
  }

  const sys = state.accuracy.system || {};
  systemEl.textContent =
    `Picks: ${sys.totalPicks ?? 0} • Hits: ${sys.hits ?? 0} • Misses: ${sys.misses ?? 0} • Accuracy: ${sys.accuracy ?? 0}%`;

  const outcomes = state.accuracy.outcomes || [];
  if (!outcomes.length) {
    listEl.innerHTML = `<div class="empty-state">No outcomes yet.</div>`;
    return;
  }

  outcomes.forEach(o => {
    const div = document.createElement("div");
    div.className = "accuracy-row";
    div.innerHTML = `
      <div class="accuracy-player">${o.player}</div>
      <div class="accuracy-meta">
        <span class="accuracy-team">${o.team || ""}</span>
        <span class="accuracy-tier">${o.tier || ""}</span>
        <span class="accuracy-hit">${o.hrHit ? "HR ✅" : "No HR"}</span>
      </div>
    `;
    listEl.appendChild(div);
  });
}

/* ------------------------------
   TAB + ENGINE SWITCHING
--------------------------------*/
function switchTab(tab) {
  setActiveTab(tab);
  if (tab === "hr") {
    renderSignals();
  } else if (tab === "games") {
    renderGames();
  } else if (tab === "accuracy") {
    renderAccuracy();
  }
}

function switchEngine(engine) {
  if (engine !== "main" && engine !== "auto") return;
  currentEngine = engine;

  // Reload everything relevant
  loadSignals();
  loadGames();
  loadAccuracy();
}

/* ------------------------------
   INIT
--------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  // Tab buttons
  document.querySelectorAll("[data-tab]").forEach(el => {
    el.addEventListener("click", () => {
      const tab = el.dataset.tab;
      switchTab(tab);
    });
  });

  // Engine toggle (if present)
  const mainBtn = $("engine-main");
  const autoBtn = $("engine-auto");
  if (mainBtn) {
    mainBtn.addEventListener("click", () => switchEngine("main"));
  }
  if (autoBtn) {
    autoBtn.addEventListener("click", () => switchEngine("auto"));
  }

  // Initial state
  setActiveTab("hr");
  switchEngine("main"); // loads signals, games, accuracy
});
