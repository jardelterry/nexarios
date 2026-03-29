// app.js — NexariOS v7.1C+ (Midnight OS Advanced)

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

    // sort strongest first by OCM
    state.signals.sort(
      (a, b) => (b.overmindCompositeMetric || 0) - (a.overmindCompositeMetric || 0)
    );

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
   HR SIGNALS
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
  const maxOCM = Math.max(...signals.map(s => s.overmindCompositeMetric || 0), 1);

  signals.forEach(sig => {
    const li = document.createElement("li");
    li.className = "list-row";

    const odds = sig.sportsbooks || {};
    const line = odds[book] || "N/A";

    const ocm = sig.overmindCompositeMetric || 0;
    const strengthPct = Math.round((ocm / maxOCM) * 100);

    // HR probability (0–1 or 0–100) → normalize
    const rawProb = sig.hrProbability != null ? sig.hrProbability : sig.hrProb;
    let probPct = 0;
    if (rawProb != null) {
      probPct = rawProb <= 1 ? Math.round(rawProb * 100) : Math.round(rawProb);
      probPct = Math.max(0, Math.min(probPct, 100));
    }

    const pitcherName = sig.pitcher || "";
    const pitcherHand = sig.pitcherHand || "";
    const vsText = pitcherName
      ? `${pitcherName}${pitcherHand ? " (" + pitcherHand + ")" : ""}`
      : "";

    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">${sig.player}</div>
        <div class="row-sub">
          <span>${sig.team || ""}</span>
          ${sig.opponent ? `<span>vs ${sig.opponent}</span>` : ""}
        </div>

        ${
          vsText
            ? `<div class="matchup-strip">
                 <span>vs ${vsText}</span>
                 ${
                   sig.batterVsPitcher
                     ? `<span>${sig.batterVsPitcher}</span>`
                     : ""
                 }
               </div>`
            : ""
        }

        <div class="tier-bar-shell">
          <div class="tier-bar-fill" style="width:${strengthPct}%;"></div>
        </div>

        ${
          probPct
            ? `<div class="prob-shell">
                 <div class="prob-label">HR Probability</div>
                 <div class="prob-bar">
                   <div class="prob-fill" style="width:${probPct}%;"></div>
                 </div>
                 <div class="prob-value">${probPct}%</div>
               </div>`
            : ""
        }
      </div>
      <div class="row-side">
        <div class="pill tier">${sig.tier}</div>
        <div class="pill ocm">${Math.round(ocm)}</div>
        <div class="pill odds">${line}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

/* ------------------------------
   GAMES + CLICKABLE LINEUPS
--------------------------------*/
function renderGames() {
  const list = $("games-list");
  if (!list) return;

  list.innerHTML = "";

  if (!state.games.length) {
    list.innerHTML = `<li class="empty-state">No games found.</li>`;
    return;
  }

  state.games.forEach((g, index) => {
    const li = document.createElement("li");
    li.className = "list-row game-row";
    li.dataset.index = index.toString();

    const weatherParts = [];
    if (g.temp != null) weatherParts.push(`${g.temp}°`);
    if (g.wind != null) weatherParts.push(`Wind ${g.wind} mph`);

    const isLive = !!g.isLive;
    const statusText = g.status || (isLive ? "LIVE" : g.gameTime || "");

    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">
          ${g.awayTeam} @ ${g.homeTeam}
          ${
            isLive
              ? `<span class="live-dot"></span>`
              : ""
          }
        </div>
        <div class="row-sub">
          <span>${g.venue || ""}</span>
          ${weatherParts.length ? `<span>${weatherParts.join(" • ")}</span>` : ""}
        </div>
      </div>
      <div class="row-side">
        <span class="pill game-time">${statusText}</span>
      </div>
      <div class="game-lineups anim-collapse">
        <div class="game-lineups-inner"></div>
      </div>
    `;

    li.addEventListener("click", () => toggleGameLineups(li, g));
    list.appendChild(li);
  });
}

function toggleGameLineups(li, game) {
  const container = li.querySelector(".game-lineups");
  const inner = li.querySelector(".game-lineups-inner");
  if (!container || !inner) return;

  const isOpen = container.classList.contains("open");
  if (isOpen) {
    // collapse
    container.style.maxHeight = container.scrollHeight + "px";
    requestAnimationFrame(() => {
      container.classList.remove("open");
      container.style.maxHeight = "0px";
    });
    return;
  }

  const home = (game.lineups && game.lineups.home) || [];
  const away = (game.lineups && game.lineups.away) || [];

  const homeList = home
    .map(
      p =>
        `<div class="player-row"><span>${p.name}</span><span>${p.pos || ""}</span></div>`
    )
    .join("");
  const awayList = away
    .map(
      p =>
        `<div class="player-row"><span>${p.name}</span><span>${p.pos || ""}</span></div>`
    )
    .join("");

  inner.innerHTML = `
    <div class="lineup-columns">
      <div class="lineup-col">
        <div class="lineup-title">${game.homeTeam}</div>
        ${homeList || `<div class="player-row empty-state">No lineup yet.</div>`}
      </div>
      <div class="lineup-col">
        <div class="lineup-title">${game.awayTeam}</div>
        ${awayList || `<div class="player-row empty-state">No lineup yet.</div>`}
      </div>
    </div>
  `;

  container.classList.add("open");
  container.style.maxHeight = container.scrollHeight + "px";
}

/* ------------------------------
   ACCURACY (RICHER)
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
  const history7 = state.accuracy.history7 || [];
  const history30 = state.accuracy.history30 || [];
  const hrHittersToday = state.accuracy.hrHittersToday || [];
  const bestStreak = state.accuracy.bestStreak || null;

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
    ${
      bestStreak
        ? `<div class="metric-row">
             <span>Best HR Streak</span>
             <span>${bestStreak.player} (${bestStreak.length} games)</span>
           </div>`
        : ""
    }
  `;

  const last7 = history7.length ? history7[history7.length - 1] : sys.accuracy ?? 0;
  const last30 = history30.length ? history30[history30.length - 1] : sys.accuracy ?? 0;

  hrRbiEl.innerHTML = `
    <div class="metric-row">
      <span>Last 7</span><span>${last7}%</span>
    </div>
    <div class="metric-row">
      <span>Last 30</span><span>${last30}%</span>
    </div>
    <div class="metric-row">
      <span>HR Hitters Today</span><span>${hrHittersToday.join(", ") || "None yet"}</span>
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
   TABS + NAV INDICATOR
--------------------------------*/
function setActiveTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  document.querySelectorAll(".tab-view").forEach(sec => {
    const id = sec.id.replace("tab-", "");
    sec.classList.toggle("active", id === tab);
  });

  // move nav indicator
  const indicator = $("nav-indicator");
  if (indicator && navItems.length) {
    const index = Array.from(navItems).findIndex(i => i.dataset.tab === tab);
    if (index >= 0) {
      const pct = (index / navItems.length) * 100;
      indicator.style.transform = `translateX(${pct}%)`;
    }
  }
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
