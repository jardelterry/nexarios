// app.js — NexariOS v7.5
// v7.5: Player game stats (H/HR/RBI/K) in past game lineups,
//       leaders API note display, accuracy reads cron KV data.

const BASE = "https://nexari.jardelterry.workers.dev";

let currentTab         = "hr";
let currentDateOffset  = 0;
let currentGamesOffset = 0;

const state = {
  signals:       [],
  games:         [],
  accuracy:      null,
  leaders:       null,
  leadersNote:   null,
  searchResults: []
};

function $(id) { return document.getElementById(id); }

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
  if (offset === 0)  return "Today";
  if (offset === -1) return "Yesterday";
  if (offset === 1)  return "Tomorrow";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ─── LOADERS ─── */

async function loadSignals() {
  try {
    const url = new URL(BASE + "/signals");
    url.searchParams.set("date", getDateISO(currentDateOffset));
    const data = await fetchJSON(url.toString());
    state.signals = (Array.isArray(data.signals) ? data.signals : [])
      .sort((a,b) => (b.overmindCompositeMetric ?? b.ocm ?? 0) - (a.overmindCompositeMetric ?? a.ocm ?? 0));
    renderSignals();
  } catch (err) {
    console.error("loadSignals", err);
    state.signals = [];
    renderSignals();
  }
}

async function loadGames() {
  try {
    const url = new URL(BASE + "/games");
    url.searchParams.set("date", getDateISO(currentGamesOffset));
    const data = await fetchJSON(url.toString());
    state.games = Array.isArray(data.games) ? data.games : [];
    renderGames();
  } catch (err) {
    console.error("loadGames", err);
    state.games = [];
    renderGames();
  }
}

async function loadAccuracy() {
  try {
    const data = await fetchJSON(BASE + "/accuracy");
    state.accuracy   = data.accuracy   || null;
    state.leaders    = data.leaders    || null;
    state.leadersNote = data.leadersNote || null;
    renderAccuracy();
  } catch (err) {
    console.error("loadAccuracy", err);
    state.accuracy = state.leaders = state.leadersNote = null;
    renderAccuracy();
  }
}

let searchTimeout = null;
async function loadSearch(query) {
  if (!query?.trim()) { state.searchResults = []; renderSearch(); return; }
  try {
    const url = new URL(BASE + "/search");
    url.searchParams.set("q",    query.trim());
    url.searchParams.set("date", getDateISO(currentDateOffset));
    const data = await fetchJSON(url.toString());
    state.searchResults = Array.isArray(data.results) ? data.results : [];
    renderSearch();
  } catch (err) {
    console.error("loadSearch", err);
    state.searchResults = [];
    renderSearch();
  }
}

/* ─── HR SIGNALS ─── */

function getSelectedRange() {
  const btn = document.querySelector(".range-btn.active");
  return btn ? btn.dataset.range : "10";
}
function getSelectedBook() {
  return $("sportsbook")?.value ?? "dk";
}

function renderSignals() {
  const list = $("hr-list");
  const lbl  = $("current-date-label");
  if (lbl) lbl.textContent = getDateLabel(currentDateOffset);
  if (!list) return;
  list.innerHTML = "";
  if (!state.signals.length) { list.innerHTML = `<li class="empty-state">No signals available.</li>`; return; }

  const range  = getSelectedRange();
  let signals  = [...state.signals];
  if (range !== "all") signals = signals.slice(0, parseInt(range,10) || 10);
  const book   = getSelectedBook();
  const maxOCM = Math.max(...signals.map(s => s.overmindCompositeMetric ?? s.ocm ?? 0), 1);

  signals.forEach(sig => {
    const li  = document.createElement("li");
    li.className = "list-row";
    const odds = sig.sportsbooks || sig.odds || {};
    const line = odds[book] ?? "N/A";
    const ocm  = sig.overmindCompositeMetric ?? sig.ocm ?? 0;
    const pct  = Math.round((ocm / maxOCM) * 100);
    const rawP = sig.hrProbability ?? sig.hrProb;
    let probPct = 0;
    if (rawP != null) { probPct = rawP <= 1 ? Math.round(rawP*100) : Math.round(rawP); probPct = Math.max(0, Math.min(probPct,100)); }
    const vsText = sig.pitcher ? `${sig.pitcher}${sig.pitcherHand ? " ("+sig.pitcherHand+")" : ""}` : "";

    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">${sig.player || "Unknown"}</div>
        <div class="row-sub">
          <span>${sig.team || ""}</span>
          ${sig.opponent ? `<span>vs ${sig.opponent}</span>` : ""}
        </div>
        ${vsText ? `<div class="matchup-strip"><span>vs ${vsText}</span></div>` : ""}
        <div class="tier-bar-shell"><div class="tier-bar-fill" style="width:${pct}%;"></div></div>
        ${probPct ? `<div class="prob-shell">
          <div class="prob-label">HR Probability</div>
          <div class="prob-bar"><div class="prob-fill" style="width:${probPct}%;"></div></div>
          <div class="prob-value">${probPct}%</div>
        </div>` : ""}
      </div>
      <div class="row-side">
        <div class="pill tier">${sig.tier || "Strong"}</div>
        <div class="pill ocm">${Math.round(ocm)}</div>
        <div class="pill odds">${line}</div>
      </div>`;
    list.appendChild(li);
  });
}

/* ─── GAMES + LINEUPS ─── */

function renderGames() {
  const list = $("games-list");
  const lbl  = $("games-date-label");
  if (lbl) lbl.textContent = getDateLabel(currentGamesOffset);
  if (!list) return;
  list.innerHTML = "";
  if (!state.games.length) { list.innerHTML = `<li class="empty-state">No games found.</li>`; return; }

  state.games.forEach((g, idx) => {
    const li = document.createElement("li");
    li.className = "list-row game-row";
    li.dataset.index = idx.toString();

    const wx = [];
    if (g.temp != null) wx.push(`${g.temp}°`);
    if (g.wind != null) wx.push(`${g.wind} mph`);

    let statusText = "";
    if (g.isLive && g.homeScore != null) {
      const inn = g.inning ? ` · ${g.inningHalf === "Top" ? "▲" : "▼"}${g.inning}` : " · LIVE";
      statusText = `${g.awayScore}–${g.homeScore}${inn}`;
    } else if (g.isFinal && g.homeScore != null) {
      statusText = `F: ${g.awayScore}–${g.homeScore}`;
    } else {
      statusText = g.gameTimeET || g.status || "";
    }

    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">
          ${g.awayTeam || ""} @ ${g.homeTeam || ""}
          ${g.isLive ? `<span class="live-dot"></span>` : ""}
        </div>
        <div class="row-sub">
          ${g.venue ? `<span>${g.venue}</span>` : ""}
          ${wx.length ? `<span>${wx.join(" · ")}</span>` : ""}
        </div>
      </div>
      <div class="row-side"><span class="pill game-time">${statusText}</span></div>
      <div class="game-lineups anim-collapse"><div class="game-lineups-inner"></div></div>`;

    li.addEventListener("click", () => toggleGameLineups(li, g));
    list.appendChild(li);
  });
}

function buildStatBadge(stats, name, isPitcher) {
  // For pitchers (SP line) show Ks
  if (isPitcher) {
    const k = stats?.k ?? 0;
    return k > 0 ? `<span class="stat-badge stat-k">${k}K</span>` : "";
  }
  // For batters show H / HR / RBI — only non-zero values
  if (!stats) return "";
  const parts = [];
  if (stats.h  > 0) parts.push(`<span class="stat-badge stat-h">${stats.h}H</span>`);
  if (stats.hr > 0) parts.push(`<span class="stat-badge stat-hr">${stats.hr}HR</span>`);
  if (stats.rbi > 0) parts.push(`<span class="stat-badge stat-rbi">${stats.rbi}RBI</span>`);
  return parts.join("");
}

function toggleGameLineups(li, game) {
  const container = li.querySelector(".game-lineups");
  const inner     = li.querySelector(".game-lineups-inner");
  if (!container || !inner) return;

  if (container.classList.contains("open")) {
    container.style.maxHeight = container.scrollHeight + "px";
    requestAnimationFrame(() => {
      container.classList.remove("open");
      container.style.maxHeight = "0px";
    });
    return;
  }

  const lineups     = game.lineups     || {};
  const playerStats = game.playerStats || {};  // { "Name": { h, hr, rbi, k, isP } }
  const homeArr     = Array.isArray(lineups.home) ? lineups.home : [];
  const awayArr     = Array.isArray(lineups.away) ? lineups.away : [];
  const isFinal     = !!game.isFinal;

  // Pitcher stats from boxscore (SP may appear in playerStats with isP:true)
  const homePitcherStats = playerStats[game.probableHomePitcher] ?? null;
  const awayPitcherStats = playerStats[game.probableAwayPitcher] ?? null;

  const makeGrid = (roster, side) => {
    if (!roster.length) return `<div class="lineup-empty">No roster data.</div>`;
    return roster.map(p => {
      const st    = isFinal ? (playerStats[p.name] ?? null) : null;
      const badge = st ? buildStatBadge(st, p.name, false) : "";
      return `<div class="lineup-player">
        <span class="lp-name">${p.name || "Unknown"}</span>
        <span class="lp-pos">${p.pos || ""}</span>
        ${badge ? `<span class="lp-stats">${badge}</span>` : ""}
      </div>`;
    }).join("");
  };

  const homeSPBadge = isFinal ? buildStatBadge(homePitcherStats, game.probableHomePitcher, true) : "";
  const awaySPBadge = isFinal ? buildStatBadge(awayPitcherStats, game.probableAwayPitcher, true) : "";

  inner.innerHTML = `
    <div class="lineup-columns">
      <div class="lineup-col">
        <div class="lineup-title">${game.homeTeam || ""}</div>
        <div class="lineup-sp">SP: ${game.probableHomePitcher || "TBD"} ${homeSPBadge}</div>
        <div class="lineup-grid">${makeGrid(homeArr, "home")}</div>
      </div>
      <div class="lineup-col">
        <div class="lineup-title">${game.awayTeam || ""}</div>
        <div class="lineup-sp">SP: ${game.probableAwayPitcher || "TBD"} ${awaySPBadge}</div>
        <div class="lineup-grid">${makeGrid(awayArr, "away")}</div>
      </div>
    </div>`;

  container.classList.add("open");
  container.style.maxHeight = container.scrollHeight + "px";
}

/* ─── ACCURACY ─── */

function renderAccuracy() {
  const sysEl      = $("accuracy-system");
  const hrRbiEl    = $("accuracy-hr-rbi");
  const outcomesEl = $("accuracy-hr-outcomes");
  const leadersEl  = $("accuracy-leaders");
  if (!sysEl || !hrRbiEl || !outcomesEl) return;

  sysEl.innerHTML = hrRbiEl.innerHTML = outcomesEl.innerHTML = "";
  if (leadersEl) leadersEl.innerHTML = "";

  const acc        = state.accuracy ?? {};
  const system     = acc.system     ?? {};
  const hrHitters  = Array.isArray(acc.hrHittersToday) ? acc.hrHittersToday : [];
  const bestStreak = acc.bestStreak ?? null;
  const outcomes   = Array.isArray(acc.outcomes) ? acc.outcomes : [];

  // System Tracker
  const hasPicks = (system.totalPicks ?? 0) > 0;
  sysEl.innerHTML = `
    <div class="metric-row"><span>Total Picks</span><span>${system.totalPicks ?? 0}</span></div>
    <div class="metric-row"><span>Hits</span><span>${system.hits ?? 0}</span></div>
    <div class="metric-row"><span>Misses</span><span>${system.misses ?? 0}</span></div>
    <div class="metric-row"><span>Accuracy</span><span>${system.accuracy ?? 0}%</span></div>
    ${bestStreak?.player ? `<div class="metric-row"><span>Best Pick Streak</span><span>${bestStreak.player} (${bestStreak.length ?? 0} days)</span></div>` : ""}
    ${!hasPicks ? `<div class="metric-row accuracy-note"><span>Pick history builds automatically each day via cron. Check back after the first full game day.</span></div>` : ""}
  `;

  // HR & RBI Tracker
  hrRbiEl.innerHTML = `
    <div class="metric-row"><span>Last 7 Days</span><span>${system.accuracy ?? 0}%</span></div>
    <div class="metric-row"><span>Last 30 Days</span><span>${system.accuracy ?? 0}%</span></div>
    <div class="metric-row">
      <span>Active Streaks</span>
      <span style="font-size:11px;text-align:right;max-width:55%;">${hrHitters.length ? hrHitters.slice(0,4).join(", ") : "None recorded yet"}</span>
    </div>
  `;

  // HR Outcomes — from cron OUTCOMES_{date}
  if (!outcomes.length) {
    outcomesEl.innerHTML = `<div class="empty-state">No outcomes yet — cron records results nightly after games finish.</div>`;
  } else {
    outcomes.slice(0, 20).forEach(o => {
      const div = document.createElement("div");
      div.className = "outcome-row";
      div.innerHTML = `
        <div class="outcome-main">
          <span class="outcome-player">${o.player || "Unknown"}</span>
          <span class="outcome-team">${o.team || ""}</span>
        </div>
        <div class="outcome-side">
          <span class="outcome-tier">${o.tier || "Strong"}</span>
          <span class="outcome-hit">${o.hrHit ? `✅ HR (${o.h}H ${o.hr}HR ${o.rbi}RBI)` : "❌ No HR"}</span>
        </div>`;
      outcomesEl.appendChild(div);
    });
  }

  // Season Leaders
  if (!leadersEl) return;
  const leaders = state.leaders;
  const note    = state.leadersNote;

  if (!leaders || (!leaders.hr?.length && !leaders.hits?.length && !leaders.rbi?.length)) {
    leadersEl.innerHTML = `<div class="empty-state">${note ?? "2026 leaders loading — MLB Stats API updates throughout the day."}</div>`;
    return;
  }

  const makeTable = (arr, label, stat) => {
    if (!arr?.length) return "";
    return `<div class="leader-group">
      <div class="leader-group-title">${label}</div>
      ${arr.map(l => `<div class="leader-row">
        <span class="leader-rank">#${l.rank}</span>
        <span class="leader-name">${l.player}</span>
        <span class="leader-team">${l.team}</span>
        <span class="leader-val">${l.value} ${stat}</span>
      </div>`).join("")}
    </div>`;
  };

  leadersEl.innerHTML =
    makeTable(leaders.hr,   "Home Runs", "HR") +
    makeTable(leaders.hits, "Hits",      "H")  +
    makeTable(leaders.rbi,  "RBI",       "RBI");
}

/* ─── SEARCH ─── */

function renderSearch() {
  const list = $("search-results");
  if (!list) return;
  list.innerHTML = "";
  if (!state.searchResults.length) { list.innerHTML = `<li class="empty-state">No results.</li>`; return; }
  state.searchResults.forEach(r => {
    const li = document.createElement("li");
    li.className = "list-row";
    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">${r.player || "Unknown"}</div>
        <div class="row-sub">
          ${r.team     ? `<span>${r.team}</span>`        : ""}
          ${r.position ? `<span>${r.position}</span>`    : ""}
          ${r.opponent ? `<span>vs ${r.opponent}</span>` : ""}
          ${r.pitcher  ? `<span>P: ${r.pitcher}</span>`  : ""}
        </div>
      </div>
      <div class="row-side">
        <div class="pill tier">${r.tier || ""}</div>
        <div class="pill ocm">${Math.round(r.ocm ?? 0)}</div>
      </div>`;
    list.appendChild(li);
  });
}

/* ─── TABS ─── */

function setActiveTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".sidebar-item").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-view").forEach(s => s.classList.toggle("active", s.id.replace("tab-","") === tab));
  const ind = $("nav-indicator");
  if (ind && navItems.length) {
    const idx = Array.from(navItems).findIndex(i => i.dataset.tab === tab);
    if (idx >= 0) ind.style.transform = `translateX(${(idx/navItems.length)*100}%)`;
  }
}

function switchTab(tab) {
  setActiveTab(tab);
  if (tab === "hr")       renderSignals();
  if (tab === "games")    renderGames();
  if (tab === "accuracy") renderAccuracy();
  if (tab === "search")   renderSearch();
}

/* ─── INIT ─── */

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-tab]").forEach(el => {
    el.addEventListener("click", () => switchTab(el.dataset.tab));
  });

  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderSignals();
    });
  });

  const bookSel = $("sportsbook");
  if (bookSel) bookSel.addEventListener("change", renderSignals);

  $("prev-day")?.addEventListener("click", () => { currentDateOffset--;  loadSignals(); });
  $("next-day")?.addEventListener("click", () => { currentDateOffset++;  loadSignals(); });

  $("games-prev-day")?.addEventListener("click", () => { currentGamesOffset--; loadGames(); });
  $("games-next-day")?.addEventListener("click", () => { currentGamesOffset++; loadGames(); });

  const searchInput = $("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadSearch(e.target.value), 250);
    });
  }

  setActiveTab("hr");
  loadSignals();
  loadGames();
  loadAccuracy();
});