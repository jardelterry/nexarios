// app.js — NexariOS v7.1C
// Logic-only rewrite. UI stays EXACTLY the same.

const BASE = "https://nexari.jardelterry.workers.dev";

let currentTab = "hr";
let currentDateOffset = 0;

const state = {
  signals: [],
  games: [],
  accuracy: null,
  searchResults: []
};

function $(id) {
  return document.getElementById(id);
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${url} ${res.status}`);
  return res.json();
}

function getDateISO(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function getDateLabel(offset) {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  if (offset === 1) return "Tomorrow";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

/* ---------------- LOADERS ---------------- */

async function loadSignals() {
  try {
    const date = getDateISO(currentDateOffset);
    const url = new URL(BASE + "/signals");
    url.searchParams.set("date", date);

    const data = await fetchJSON(url.toString());
    const raw = Array.isArray(data.signals) ? data.signals : [];
    state.signals = raw.slice();

    // Sort strongest first
    state.signals.sort((a, b) => {
      const ao = a.overmindCompositeMetric ?? a.ocm ?? 0;
      const bo = b.overmindCompositeMetric ?? b.ocm ?? 0;
      return bo - ao;
    });

    renderSignals();
  } catch (err) {
    console.error("loadSignals error", err);
    state.signals = [];
    renderSignals();
  }
}

async function loadGames() {
  try {
    const date = getDateISO(currentDateOffset);
    const url = new URL(BASE + "/games");
    url.searchParams.set("date", date);

    const data = await fetchJSON(url.toString());
    state.games = Array.isArray(data.games) ? data.games : [];
    renderGames();
  } catch (err) {
    console.error("loadGames error", err);
    state.games = [];
    renderGames();
  }
}

async function loadAccuracy() {
  try {
    const url = new URL(BASE + "/accuracy");
    const data = await fetchJSON(url.toString());
    state.accuracy = data.accuracy || data || null;
    renderAccuracy();
  } catch (err) {
    console.error("loadAccuracy error", err);
    state.accuracy = null;
    renderAccuracy();
  }
}

let searchTimeout = null;
async function loadSearch(query) {
  if (!query || !query.trim()) {
    state.searchResults = [];
    renderSearch();
    return;
  }

  try {
    const url = new URL(BASE + "/search");
    url.searchParams.set("q", query.trim());
    const data = await fetchJSON(url.toString());
    state.searchResults = Array.isArray(data.results) ? data.results : [];
    renderSearch();
  } catch (err) {
    console.error("loadSearch error", err);
    state.searchResults = [];
    renderSearch();
  }
}
/* ---------------- HR SIGNALS ---------------- */

function getSelectedRange() {
  const btn = document.querySelector(".range-btn.active");
  return btn ? btn.dataset.range : "10";
}

function getSelectedBook() {
  const sel = $("sportsbook");
  return sel ? sel.value : "dk";
}

function renderSignals() {
  const list = $("hr-list");
  const dateLabel = $("current-date-label");
  if (dateLabel) dateLabel.textContent = getDateLabel(currentDateOffset);
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
  const maxOCM = Math.max(
    ...signals.map(s => (s.overmindCompositeMetric ?? s.ocm ?? 0)),
    1
  );

  signals.forEach(sig => {
    const li = document.createElement("li");
    li.className = "list-row";

    const odds = sig.sportsbooks || sig.odds || {};
    const line = odds[book] ?? "N/A";

    const ocm = sig.overmindCompositeMetric ?? sig.ocm ?? 0;
    const strengthPct = Math.round((ocm / maxOCM) * 100);

    const rawProb = sig.hrProbability ?? sig.hrProb;
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
        <div class="row-title">${sig.player || sig.name || "Unknown"}</div>
        <div class="row-sub">
          <span>${sig.team || ""}</span>
          ${sig.opponent || sig.opp ? `<span>vs ${sig.opponent || sig.opp}</span>` : ""}
        </div>

        ${
          vsText
            ? `<div class="matchup-strip">
                 <span>vs ${vsText}</span>
                 ${
                   sig.batterVsPitcher || sig.bvp
                     ? `<span>${sig.batterVsPitcher || sig.bvp}</span>`
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
        <div class="pill tier">${sig.tier || "Strong"}</div>
        <div class="pill ocm">${Math.round(ocm)}</div>
        <div class="pill odds">${line}</div>
      </div>
    `;

    list.appendChild(li);
  });
}
//* ---------------- GAMES + LINEUPS ---------------- */

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
    const statusText =
      g.status ||
      (isLive ? "LIVE" : g.gameTime || g.time || "");

    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">
          ${g.awayTeam || g.away || ""} @ ${g.homeTeam || g.home || ""}
          ${isLive ? `<span class="live-dot"></span>` : ""}
        </div>

        <div class="row-sub">
          <span>${g.venue || ""}</span>
          ${
            weatherParts.length
              ? `<span>${weatherParts.join(" • ")}</span>`
              : ""
          }
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

  // expand
  const lineups = game.lineups || {};
  const homeArr = Array.isArray(lineups.home) ? lineups.home : [];
  const awayArr = Array.isArray(lineups.away) ? lineups.away : [];

  const homeList = homeArr
    .map(
      p => `
        <div class="player-row">
          <span>${p.name || p.player || "Unknown"}</span>
          <span>${p.pos || p.position || ""}</span>
        </div>
      `
    )
    .join("");

  const awayList = awayArr
    .map(
      p => `
        <div class="player-row">
          <span>${p.name || p.player || "Unknown"}</span>
          <span>${p.pos || p.position || ""}</span>
        </div>
      `
    )
    .join("");

  inner.innerHTML = `
    <div class="lineup-columns">
      <div class="lineup-col">
        <div class="lineup-title">${game.homeTeam || game.home || ""}</div>
        ${
          homeList ||
          `<div class="player-row empty-state">No lineup yet.</div>`
        }
      </div>

      <div class="lineup-col">
        <div class="lineup-title">${game.awayTeam || game.away || ""}</div>
        ${
          awayList ||
          `<div class="player-row empty-state">No lineup yet.</div>`
        }
      </div>
    </div>
  `;

  container.classList.add("open");
  container.style.maxHeight = container.scrollHeight + "px";
}
/* ---------------- ACCURACY ---------------- */

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

  const acc = state.accuracy;
  const system = acc.system || acc || {};
  const history7 = Array.isArray(acc.history7) ? acc.history7 : [];
  const history30 = Array.isArray(acc.history30) ? acc.history30 : [];
  const hrHittersToday = Array.isArray(acc.hrHittersToday)
    ? acc.hrHittersToday
    : [];
  const bestStreak = acc.bestStreak || null;
  const outcomes = Array.isArray(acc.outcomes) ? acc.outcomes : [];

  sysEl.innerHTML = `
    <div class="metric-row">
      <span>Total Picks</span><span>${system.totalPicks ?? 0}</span>
    </div>
    <div class="metric-row">
      <span>Hits</span><span>${system.hits ?? 0}</span>
    </div>
    <div class="metric-row">
      <span>Misses</span><span>${system.misses ?? 0}</span>
    </div>
    <div class="metric-row">
      <span>Accuracy</span><span>${system.accuracy ?? 0}%</span>
    </div>
    ${
      bestStreak
        ? `<div class="metric-row">
             <span>Best HR Streak</span>
             <span>${bestStreak.player || "Unknown"} (${bestStreak.length ?? 0} games)</span>
           </div>`
        : ""
    }
  `;

  const last7 = history7.length ? history7[history7.length - 1] : system.accuracy ?? 0;
  const last30 = history30.length ? history30[history30.length - 1] : system.accuracy ?? 0;

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

  if (!outcomes.length) {
    outcomesEl.innerHTML = `<div class="empty-state">No outcomes yet.</div>`;
    return;
  }

  outcomes.forEach(o => {
    const div = document.createElement("div");
    div.className = "outcome-row";
    div.innerHTML = `
      <div class="outcome-main">
        <span class="outcome-player">${o.player || "Unknown"}</span>
        <span class="outcome-team">${o.team || ""}</span>
      </div>
      <div class="outcome-side">
        <span class="outcome-tier">${o.tier || "Strong"}</span>
        <span class="outcome-hit">${o.hrHit ? "HR ✅" : "No HR"}</span>
      </div>
    `;
    outcomesEl.appendChild(div);
  });
}

/* ---------------- SEARCH ---------------- */

function renderSearch() {
  const list = $("search-results");
  if (!list) return;

  list.innerHTML = "";

  if (!state.searchResults.length) {
    list.innerHTML = `<li class="empty-state">No results.</li>`;
    return;
  }

  state.searchResults.forEach(r => {
    const li = document.createElement("li");
    li.className = "list-row";
    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">${r.player || r.name || "Unknown"}</div>
        <div class="row-sub">
          ${r.team ? `<span>${r.team}</span>` : ""}
          ${r.position ? `<span>${r.position}</span>` : ""}
          ${r.stadium ? `<span>${r.stadium}</span>` : ""}
        </div>
      </div>
    `;
    list.appendChild(li);
  });
}

/* ---------------- TABS ---------------- */

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
  if (tab === "search") renderSearch();
}

/* ---------------- INIT ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Tabs
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

  // Search input
  const searchInput = $("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      const q = e.target.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadSearch(q), 250);
    });
  }

  // Initial load
  setActiveTab("hr");
  loadSignals();
  loadGames();
  loadAccuracy();
});
