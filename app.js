// app.js — NexariOS v7.3
// v7.3: game times + scores display, compact horizontal roster,
//       real MLB leaders on accuracy tab, date fix on search.
 
const BASE = "https://nexari.jardelterry.workers.dev";
 
let currentTab = "hr";
let currentDateOffset = 0;
 
const state = {
  signals:      [],
  games:        [],
  accuracy:     null,
  leaders:      null,
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
 
/* ---------------- LOADERS ---------------- */
 
async function loadSignals() {
  try {
    const url = new URL(BASE + "/signals");
    url.searchParams.set("date", getDateISO(currentDateOffset));
    const data = await fetchJSON(url.toString());
    const raw = Array.isArray(data.signals) ? data.signals : [];
    state.signals = raw.slice().sort((a, b) => {
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
    const url = new URL(BASE + "/games");
    url.searchParams.set("date", getDateISO(currentDateOffset));
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
    const data = await fetchJSON(BASE + "/accuracy");
    state.accuracy = data.accuracy || null;
    state.leaders  = data.leaders  || null;
    renderAccuracy();
  } catch (err) {
    console.error("loadAccuracy error", err);
    state.accuracy = null;
    state.leaders  = null;
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
    url.searchParams.set("q",    query.trim());
    url.searchParams.set("date", getDateISO(currentDateOffset));
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
  const list      = $("hr-list");
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
    signals = signals.slice(0, parseInt(range, 10) || 10);
  }
 
  const book   = getSelectedBook();
  const maxOCM = Math.max(...signals.map(s => s.overmindCompositeMetric ?? s.ocm ?? 0), 1);
 
  signals.forEach(sig => {
    const li = document.createElement("li");
    li.className = "list-row";
 
    const odds        = sig.sportsbooks || sig.odds || {};
    const line        = odds[book] ?? "N/A";
    const ocm         = sig.overmindCompositeMetric ?? sig.ocm ?? 0;
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
        ${vsText ? `
          <div class="matchup-strip">
            <span>vs ${vsText}</span>
            ${sig.batterVsPitcher || sig.bvp ? `<span>${sig.batterVsPitcher || sig.bvp}</span>` : ""}
          </div>` : ""}
        <div class="tier-bar-shell">
          <div class="tier-bar-fill" style="width:${strengthPct}%;"></div>
        </div>
        ${probPct ? `
          <div class="prob-shell">
            <div class="prob-label">HR Probability</div>
            <div class="prob-bar"><div class="prob-fill" style="width:${probPct}%;"></div></div>
            <div class="prob-value">${probPct}%</div>
          </div>` : ""}
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
 
/* ---------------- GAMES + LINEUPS ---------------- */
 
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
    if (g.wind != null) weatherParts.push(`${g.wind} mph`);
 
    const isLive  = !!g.isLive;
    const isFinal = !!g.isFinal;
 
    // v7.3: build status pill text
    // Show score if live or final, otherwise show time
    let statusText = "";
    if (isLive && g.homeScore != null) {
      const inningStr = g.inning
        ? ` · ${g.inningHalf === "Top" ? "▲" : "▼"}${g.inning}`
        : " · LIVE";
      statusText = `${g.awayScore}–${g.homeScore}${inningStr}`;
    } else if (isFinal && g.homeScore != null) {
      statusText = `F: ${g.awayScore}–${g.homeScore}`;
    } else if (g.gameTimeET) {
      statusText = g.gameTimeET;
    } else {
      statusText = g.status || "";
    }
 
    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">
          ${g.awayTeam || ""} @ ${g.homeTeam || ""}
          ${isLive ? `<span class="live-dot"></span>` : ""}
        </div>
        <div class="row-sub">
          ${g.venue ? `<span>${g.venue}</span>` : ""}
          ${weatherParts.length ? `<span>${weatherParts.join(" · ")}</span>` : ""}
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
  const inner     = li.querySelector(".game-lineups-inner");
  if (!container || !inner) return;
 
  const isOpen = container.classList.contains("open");
 
  if (isOpen) {
    container.style.maxHeight = container.scrollHeight + "px";
    requestAnimationFrame(() => {
      container.classList.remove("open");
      container.style.maxHeight = "0px";
    });
    return;
  }
 
  const lineups  = game.lineups || {};
  const homeArr  = Array.isArray(lineups.home) ? lineups.home : [];
  const awayArr  = Array.isArray(lineups.away) ? lineups.away : [];
 
  // v7.3: compact left-to-right grid — each player on one line, two equal columns
  const makePlayerGrid = (roster) => {
    if (!roster.length) return `<div class="lineup-empty">No roster data.</div>`;
    return roster.map(p =>
      `<div class="lineup-player">
        <span class="lp-name">${p.name || "Unknown"}</span>
        <span class="lp-pos">${p.pos || ""}</span>
      </div>`
    ).join("");
  };
 
  inner.innerHTML = `
    <div class="lineup-columns">
      <div class="lineup-col">
        <div class="lineup-title">${game.homeTeam || ""}</div>
        <div class="lineup-sp">SP: ${game.probableHomePitcher || "TBD"}</div>
        <div class="lineup-grid">${makePlayerGrid(homeArr)}</div>
      </div>
      <div class="lineup-col">
        <div class="lineup-title">${game.awayTeam || ""}</div>
        <div class="lineup-sp">SP: ${game.probableAwayPitcher || "TBD"}</div>
        <div class="lineup-grid">${makePlayerGrid(awayArr)}</div>
      </div>
    </div>
  `;
 
  container.classList.add("open");
  container.style.maxHeight = container.scrollHeight + "px";
}
 
/* ---------------- ACCURACY ---------------- */
 
function renderAccuracy() {
  const sysEl      = $("accuracy-system");
  const hrRbiEl    = $("accuracy-hr-rbi");
  const outcomesEl = $("accuracy-hr-outcomes");
  const leadersEl  = $("accuracy-leaders");
 
  if (!sysEl || !hrRbiEl || !outcomesEl) return;
 
  sysEl.innerHTML      = "";
  hrRbiEl.innerHTML    = "";
  outcomesEl.innerHTML = "";
  if (leadersEl) leadersEl.innerHTML = "";
 
  // ── System tracker ──
  const acc        = state.accuracy || {};
  const system     = acc.system     || {};
  const history7   = Array.isArray(acc.history7)  ? acc.history7  : [];
  const history30  = Array.isArray(acc.history30) ? acc.history30 : [];
  const hrHitters  = Array.isArray(acc.hrHittersToday) ? acc.hrHittersToday : [];
  const bestStreak = acc.bestStreak || null;
  const outcomes   = Array.isArray(acc.outcomes)  ? acc.outcomes  : [];
 
  sysEl.innerHTML = `
    <div class="metric-row"><span>Total Picks</span><span>${system.totalPicks ?? 0}</span></div>
    <div class="metric-row"><span>Hits</span><span>${system.hits ?? 0}</span></div>
    <div class="metric-row"><span>Misses</span><span>${system.misses ?? 0}</span></div>
    <div class="metric-row"><span>Accuracy</span><span>${system.accuracy ?? 0}%</span></div>
    ${bestStreak?.player ? `
      <div class="metric-row">
        <span>Best HR Streak</span>
        <span>${bestStreak.player} (${bestStreak.length ?? 0} games)</span>
      </div>` : ""}
    <div class="metric-row accuracy-note">
      <span>Historical tracking requires KV backend — coming soon.</span>
    </div>
  `;
 
  const last7  = history7.length  ? history7[history7.length   - 1] : 0;
  const last30 = history30.length ? history30[history30.length - 1] : 0;
 
  hrRbiEl.innerHTML = `
    <div class="metric-row"><span>Last 7 Days</span><span>${last7}%</span></div>
    <div class="metric-row"><span>Last 30 Days</span><span>${last30}%</span></div>
    <div class="metric-row">
      <span>HR Hitters Today</span>
      <span>${hrHitters.join(", ") || "None recorded yet"}</span>
    </div>
  `;
 
  if (!outcomes.length) {
    outcomesEl.innerHTML = `<div class="empty-state">No outcomes recorded yet.</div>`;
  } else {
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
 
  // ── Season Leaders (v7.3) ──
  if (!leadersEl) return;
  const leaders = state.leaders;
 
  if (!leaders || (!leaders.hr?.length && !leaders.hits?.length && !leaders.rbi?.length)) {
    leadersEl.innerHTML = `<div class="empty-state">Leaders data unavailable.</div>`;
    return;
  }
 
  const makeLeaderTable = (arr, label, stat) => {
    if (!arr?.length) return "";
    const rows = arr.map(l =>
      `<div class="leader-row">
        <span class="leader-rank">#${l.rank}</span>
        <span class="leader-name">${l.player}</span>
        <span class="leader-team">${l.team}</span>
        <span class="leader-val">${l.value} ${stat}</span>
      </div>`
    ).join("");
    return `<div class="leader-group">
      <div class="leader-group-title">${label}</div>
      ${rows}
    </div>`;
  };
 
  leadersEl.innerHTML =
    makeLeaderTable(leaders.hr,   "Home Runs",  "HR")  +
    makeLeaderTable(leaders.hits, "Hits",        "H")   +
    makeLeaderTable(leaders.rbi,  "RBI",         "RBI");
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
          ${r.team     ? `<span>${r.team}</span>`       : ""}
          ${r.position ? `<span>${r.position}</span>`   : ""}
          ${r.opponent ? `<span>vs ${r.opponent}</span>` : ""}
          ${r.pitcher  ? `<span>P: ${r.pitcher}</span>` : ""}
        </div>
      </div>
      <div class="row-side">
        <div class="pill tier">${r.tier || ""}</div>
        <div class="pill ocm">${Math.round(r.ocm ?? 0)}</div>
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
    sec.classList.toggle("active", sec.id.replace("tab-", "") === tab);
  });
 
  const indicator = $("nav-indicator");
  if (indicator && navItems.length) {
    const index = Array.from(navItems).findIndex(i => i.dataset.tab === tab);
    if (index >= 0) {
      indicator.style.transform = `translateX(${(index / navItems.length) * 100}%)`;
    }
  }
}
 
function switchTab(tab) {
  setActiveTab(tab);
  if (tab === "hr")       renderSignals();
  if (tab === "games")    renderGames();
  if (tab === "accuracy") renderAccuracy();
  if (tab === "search")   renderSearch();
}
 
/* ---------------- INIT ---------------- */
 
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
 
  const searchInput = $("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      const q = e.target.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadSearch(q), 250);
    });
  }
 
  setActiveTab("hr");
  loadSignals();
  loadGames();
  loadAccuracy();
});
 