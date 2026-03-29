// app.js — NexariOS v7.1C (wired to current HTML)

// MAIN WORKER
const BASE = "https://nexari.jardelterry.workers.dev";

let currentTab = "hr";
let currentDateOffset = 0; // 0 = today, -1 = yesterday, etc.

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

function formatDateLabel(offset) {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  if (offset === 1) return "Tomorrow";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function getDateParam(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------
   LOADERS
--------------------------------*/
async function loadSignals() {
  try {
    const dateStr = getDateParam(currentDateOffset);
    const url = new URL(BASE + "/signals");
    url.searchParams.set("date", dateStr);

    const data = await fetchJSON(url.toString());
    state.signals = Array.isArray(data.signals) ? data.signals : [];
    renderSignals();
  } catch (e) {
    console.error("loadSignals error", e);
    state.signals = [];
    renderSignals();
  }
}

async function loadGames() {
  try {
    const dateStr = getDateParam(currentDateOffset);
    const url = new URL(BASE + "/games");
    url.searchParams.set("date", dateStr);

    const data = await fetchJSON(url.toString());
    state.games = Array.isArray(data.games) ? data.games : [];
    renderGames();
  } catch (e) {
    console.error("loadGames error", e);
    state.games = [];
    renderGames();
  }
}

async function loadAccuracy() {
  try {
    const url = new URL(BASE + "/accuracy");
    const data = await fetchJSON(url.toString());
    state.accuracy = data.accuracy || null;
    renderAccuracy();
  } catch (e) {
    console.error("loadAccuracy error", e);
    state.accuracy = null;
    renderAccuracy();
  }
}

/* ------------------------------
   RENDER: HR SIGNALS
--------------------------------*/
function getSelectedRange() {
  const btn = document.querySelector(".range-btn.active");
  if (!btn) return "10";
  return btn.dataset.range;
}

function getSelectedBook() {
  const sel = $("sportsbook");
  return sel ? sel.value : "dk";
}

function renderSignals() {
  const list = $("hr-list");
  const dateLabel = $("current-date-label");
  if (dateLabel) dateLabel.textContent = formatDateLabel(currentDateOffset);
  if (!list) return;

  list.innerHTML = "";

  if (!state.signals.length) {
    list.innerHTML = `<li class="empty-state">No signals available.</li>`;
    return;
  }

  const range = getSelectedRange();
  let signals = [...state.signals];

  if (range !== "all") {
    const n = parseInt(range, 10) || 10;
    signals = signals.slice(0, n);
  }

  const book = getSelectedBook();

  signals.forEach(sig => {
    const li = document.createElement("li");
    li.className = "list-row";

    const odds = sig.sportsbooks || {};
    const line = odds[book] || "N/A";

    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">${sig.player}</div>
        <div class="row-sub">
          <span>${sig.team || ""}</span>
          ${sig.opponent ? `<span>vs ${sig.opponent}</span>` : ""}
        </div>
      </div>
      <div class="row-side">
        <div class="pill tier">${sig.tier}</div>
        <div class="pill ocm">${Math.round(sig.overmindCompositeMetric || 0)}</div>
        <div class="pill odds">${line}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

/* ------------------------------
   RENDER: GAMES
--------------------------------*/
function renderGames() {
  const list = $("games-list");
  if (!list) return;

  list.innerHTML = "";

  if (!state.games.length) {
    list.innerHTML = `<li class="empty-state">No games found.</li>`;
    return;
  }

  state.games.forEach(g => {
    const li = document.createElement("li");
    li.className = "list-row";

    const weatherParts = [];
    if (g.temp != null) weatherParts.push(`${g.temp}°`);
    if (g.wind != null) weatherParts.push(`Wind ${g.wind} mph`);

    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">${g.awayTeam} @ ${g.homeTeam}</div>
        <div class="row-sub">
          <span>${g.venue || ""}</span>
          ${weatherParts.length ? `<span>${weatherParts.join(" • ")}</span>` : ""}
        </div>
      </div>
    `;
    list.appendChild(li);
  });
}

/* ------------------------------
   RENDER: ACCURACY
--------------------------------*/
function renderAccuracy() {
  const sysEl = $("accuracy-system");
  const hrRbiEl = $("accuracy-hr-rbi");
  const outcomesEl = $("accuracy-hr-outcomes");
  if (!sysEl || !hrRbiEl || !outcomesEl) return;

  sysEl.innerHTML = "";
  hrRbiEl.innerHTML = "";
  outcomesEl.innerHTML = "";

  if (!state.accuracy) {
    sysEl.textContent = "No accuracy data.";
    return;
  }

  const sys = state.accuracy.system || {};
  sysEl.innerHTML = `
    <div class="metric-row">
      <span>Total Picks</span><span>${sys.totalPicks ?? 0}</span>
    </div>
    <div class="metric-row">
      <span>Hits</span><span>${sys.hits ?? 0}</span>
    </div>
    <div class="metric-row">
      <span>Misses</span><span>${sys.misses ?? 0}</span>
    </div>
    <div class="metric-row">
      <span>Accuracy</span><span>${sys.accuracy ?? 0}%</span>
    </div>
  `;

  // Simple HR/RBI tracker placeholder using same system stats
  hrRbiEl.innerHTML = `
    <div class="metric-row">
      <span>HR/RBI Tracker</span>
      <span>${sys.accuracy ?? 0}% (last window)</span>
    </div>
  `;

  const outcomes = state.accuracy.outcomes || [];
  if (!outcomes.length) {
    outcomesEl.innerHTML = `<div class="empty-state">No outcomes yet.</div>`;
    return;
  }

  outcomes.forEach(o => {
    const div = document.createElement("div");
    div.className = "outcome-row";
    div.innerHTML = `
      <div class="outcome-main">
        <span class="outcome-player">${o.player}</span>
        <span class="outcome-team">${o.team || ""}</span>
      </div>
      <div class="outcome-side">
        <span class="outcome-tier">${o.tier || ""}</span>
        <span class="outcome-hit">${o.hrHit ? "HR ✅" : "No HR"}</span>
      </div>
    `;
    outcomesEl.appendChild(div);
  });
}

/* ------------------------------
   TABS
--------------------------------*/
function setActiveTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  document.querySelectorAll(".tab-view").forEach(sec => {
    const id = sec.id.replace("tab-", "");
    sec.classList.toggle("active", id === tab);
  });
}

function switchTab(tab) {
  setActiveTab(tab);
  if (tab === "hr") renderSignals();
  if (tab === "games") renderGames();
  if (tab === "accuracy") renderAccuracy();
}

/* ------------------------------
   INIT + EVENTS
--------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  // Tab buttons (sidebar + bottom nav)
  document.querySelectorAll("[data-tab]").forEach(el => {
    el.addEventListener("click", () => {
      const tab = el.dataset.tab;
      switchTab(tab);
    });
  });

  // Range buttons
  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderSignals();
    });
  });

  // Sportsbook selector
  const bookSel = $("sportsbook");
  if (bookSel) {
    bookSel.addEventListener("change", renderSignals);
  }

  // Date nav
  const prevBtn = $("prev-day");
  const nextBtn = $("next-day");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentDateOffset -= 1;
      loadSignals();
      loadGames();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentDateOffset += 1;
      loadSignals();
      loadGames();
    });
  }

  // Initial
  setActiveTab("hr");
  loadSignals();
  loadGames();
  loadAccuracy();
});
