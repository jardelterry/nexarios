// app.js — NexariOS v7.8
// v7.8: EV/Barrel/ISO stats row in signals, career vs pitcher
//       badge (2+ HR), accuracy breakdown by tier, all tiers tracked.

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
    // Do NOT re-sort — server round-robin order is intentional
    state.signals = Array.isArray(data.signals) ? data.signals : [];
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
    state.accuracy    = data.accuracy   || null;
    state.leaders     = data.leaders    || null;
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

/* ─── SIGNAL HELPERS ─── */

function getSelectedRange() {
  const btn = document.querySelector(".range-btn.active");
  return btn ? btn.dataset.range : "10";
}
function getSelectedBook() {
  return $("sportsbook")?.value ?? "dk";
}

// Format KV stat values for compact display
function fmtStat(label, val, suffix = "") {
  if (val == null || val === 0) return null;
  const rounded = suffix === "%" ? `${(val * 100).toFixed(1)}%` : `${val}${suffix}`;
  return `<span class="sig-stat"><span class="sig-stat-label">${label}</span>${rounded}</span>`;
}

// Build the stats row from kvStats
function buildStatsRow(kvStats) {
  if (!kvStats) return "";
  const parts = [];

  // SLG — only show if above average (.370)
  if (kvStats.slg && kvStats.slg > 0.37)
    parts.push(fmtStat("SLG", kvStats.slg.toFixed(3)));

  // ISO (Isolated Power = SLG - AVG, proxy for power)
  if (kvStats.iso && kvStats.iso > 0.1)
    parts.push(fmtStat("ISO", kvStats.iso.toFixed(3)));

  // Barrel rate — only show if meaningful (>5%)
  if (kvStats.barrelRate && kvStats.barrelRate > 0.05)
    parts.push(fmtStat("Barrel", kvStats.barrelRate, "%"));

  // Hard hit rate — only show if meaningful (>35%)
  if (kvStats.hardHitRate && kvStats.hardHitRate > 0.35)
    parts.push(fmtStat("HardHit", kvStats.hardHitRate, "%"));

  // Average exit velocity — only if > 85 mph
  if (kvStats.avgEV && kvStats.avgEV > 85)
    parts.push(fmtStat("EV", `${kvStats.avgEV.toFixed(1)} mph`));

  if (parts.length === 0) return "";
  return `<div class="sig-stats-row">${parts.join("")}</div>`;
}

// Build career vs pitcher badge (only shown if 2+ HR)
function buildCareerBadge(career) {
  if (!career || career.hr < 2) return "";
  const ab  = career.ab ?? 0;
  const tip = ab > 0 ? `${career.h}H, ${career.hr}HR in ${ab} AB` : `${career.hr}HR vs this pitcher`;
  return `<div class="career-badge" title="${tip}">🏠 ${career.hr}HR vs SP</div>`;
}

/* ─── HR SIGNALS ─── */

function renderSignals() {
  const list = $("hr-list");
  const lbl  = $("current-date-label");
  if (lbl) lbl.textContent = getDateLabel(currentDateOffset);
  if (!list) return;
  list.innerHTML = "";

  if (!state.signals.length) {
    list.innerHTML = `<li class="empty-state">No signals available.</li>`;
    return;
  }

  const range = getSelectedRange();
  let signals = [...state.signals];
  if (range !== "all") signals = signals.slice(0, parseInt(range, 10) || 10);

  const book   = getSelectedBook();
  const maxOCM = Math.max(...signals.map(s => s.overmindCompositeMetric ?? s.ocm ?? 0), 1);

  signals.forEach(sig => {
    const li = document.createElement("li");
    li.className = "list-row";

    const odds   = sig.sportsbooks || sig.odds || {};
    const line   = odds[book] ?? "N/A";
    const ocm    = sig.overmindCompositeMetric ?? sig.ocm ?? 0;
    const pct    = Math.round((ocm / maxOCM) * 100);
    const rawP   = sig.hrProbability ?? sig.hrProb;
    let probPct  = 0;
    if (rawP != null) {
      probPct = rawP <= 1 ? Math.round(rawP * 100) : Math.round(rawP);
      probPct = Math.max(0, Math.min(probPct, 100));
    }

    const vsText = sig.pitcher
      ? `${sig.pitcher}${sig.pitcherHand ? " (" + sig.pitcherHand + ")" : ""}`
      : "";

    // v7.8: EV/barrel stats row + career vs pitcher badge
    const statsRow    = buildStatsRow(sig.kvStats);
    const careerBadge = buildCareerBadge(sig.careerVsPitcher);

    li.innerHTML = `
      <div class="row-main">
        <div class="row-title">${sig.player || "Unknown"}</div>
        <div class="row-sub">
          <span>${sig.team || ""}</span>
          ${sig.opponent ? `<span>vs ${sig.opponent}</span>` : ""}
        </div>
        ${vsText ? `<div class="matchup-strip"><span>vs ${vsText}</span></div>` : ""}
        ${statsRow}
        <div class="tier-bar-shell"><div class="tier-bar-fill" style="width:${pct}%;"></div></div>
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
        ${careerBadge}
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

  if (!state.games.length) {
    list.innerHTML = `<li class="empty-state">No games found.</li>`;
    return;
  }

  state.games.forEach((g, idx) => {
    const li = document.createElement("li");
    li.className = "list-row game-row";
    li.dataset.index = idx.toString();

    const wx = [];
    if (g.temp != null) wx.push(`${g.temp}°`);
    if (g.wind != null) wx.push(`${g.wind} mph`);

    let statusText = "";
    if (g.isLive && g.homeScore != null) {
      const inn = g.inning
        ? ` · ${g.inningHalf === "Top" ? "▲" : "▼"}${g.inning}`
        : " · LIVE";
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

function buildStatBadge(stats, isPitcher) {
  if (!stats) return "";
  if (isPitcher) return stats.k > 0 ? `<span class="stat-badge stat-k">${stats.k}K</span>` : "";
  const parts = [];
  if (stats.h   > 0) parts.push(`<span class="stat-badge stat-h">${stats.h}H</span>`);
  if (stats.hr  > 0) parts.push(`<span class="stat-badge stat-hr">${stats.hr}HR</span>`);
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

  const lineups      = game.lineups || {};
  const playerStats  = game.playerStats || {};
  const homeArr      = Array.isArray(lineups.home) ? lineups.home : [];
  const awayArr      = Array.isArray(lineups.away) ? lineups.away : [];
  const isFinal      = !!game.isFinal;
  const homeConfirmed = !!(lineups.homeConfirmed);
  const awayConfirmed = !!(lineups.awayConfirmed);

  const homePSP = playerStats[game.probableHomePitcher] ?? null;
  const awayPSP = playerStats[game.probableAwayPitcher] ?? null;

  const makeGrid = (roster, confirmed) => {
    if (!roster.length) return `<div class="lineup-empty">${confirmed ? "No lineup data." : "Lineup TBD."}</div>`;
    return roster.map(p => {
      const st    = isFinal ? (playerStats[p.name] ?? null) : null;
      const badge = buildStatBadge(st, false);
      const orderEl = p.order != null
        ? `<span class="lp-order">${p.order}</span>`
        : `<span class="lp-order-empty"></span>`;
      return `<div class="lineup-player">
        ${orderEl}
        <span class="lp-name">${p.name || "Unknown"}</span>
        <span class="lp-pos">${p.pos || ""}</span>
        ${badge ? `<span class="lp-stats">${badge}</span>` : ""}
      </div>`;
    }).join("");
  };

  const homeSPBadge = isFinal ? buildStatBadge(homePSP, true) : "";
  const awaySPBadge = isFinal ? buildStatBadge(awayPSP, true) : "";

  const homeLabel = homeConfirmed
    ? `<span class="lineup-status confirmed">✓ Confirmed</span>`
    : `<span class="lineup-status pending">Lineup TBD</span>`;
  const awayLabel = awayConfirmed
    ? `<span class="lineup-status confirmed">✓ Confirmed</span>`
    : `<span class="lineup-status pending">Lineup TBD</span>`;

  inner.innerHTML = `
    <div class="lineup-columns">
      <div class="lineup-col">
        <div class="lineup-title">${game.homeTeam || ""} ${homeLabel}</div>
        <div class="lineup-sp">SP: ${game.probableHomePitcher || "TBD"} ${homeSPBadge}</div>
        <div class="lineup-grid">${makeGrid(homeArr, homeConfirmed)}</div>
      </div>
      <div class="lineup-col">
        <div class="lineup-title">${game.awayTeam || ""} ${awayLabel}</div>
        <div class="lineup-sp">SP: ${game.probableAwayPitcher || "TBD"} ${awaySPBadge}</div>
        <div class="lineup-grid">${makeGrid(awayArr, awayConfirmed)}</div>
      </div>
    </div>`;

  container.classList.add("open");
  container.style.maxHeight = container.scrollHeight + "px";
}

/* ─── ACCURACY ─── */

function tierAccuracyPct(t) {
  return t.picks > 0 ? Math.round((t.hits / t.picks) * 100) : 0;
}

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
  const outcomes   = Array.isArray(acc.outcomes) ? acc.outcomes : [];
  const hasPicks   = (system.totalPicks ?? 0) > 0;

  // v7.8: tier breakdown
  const tiers = system.tiers ?? {};
  const strong = tiers.Strong ?? { picks: 0, hits: 0, misses: 0 };
  const medium = tiers.Medium ?? { picks: 0, hits: 0, misses: 0 };
  const light  = tiers.Light  ?? { picks: 0, hits: 0, misses: 0 };

  sysEl.innerHTML = `
    <div class="metric-row"><span>Total Picks Tracked</span><span>${system.totalPicks ?? 0}</span></div>
    <div class="metric-row"><span>Overall Accuracy</span><span>${system.accuracy ?? 0}%</span></div>
    ${system.lastDate ? `<div class="metric-row"><span>Last Updated</span><span>${system.lastDate}</span></div>` : ""}

    ${hasPicks ? `
    <div class="tier-accuracy-block">
      <div class="tier-acc-row">
        <span class="tier-acc-label strong-label">Strong</span>
        <span class="tier-acc-stat">${strong.picks} picks</span>
        <span class="tier-acc-stat hits">${strong.hits} hits</span>
        <span class="tier-acc-stat misses">${strong.misses} misses</span>
        <span class="tier-acc-pct">${tierAccuracyPct(strong)}%</span>
      </div>
      <div class="tier-acc-row">
        <span class="tier-acc-label medium-label">Medium</span>
        <span class="tier-acc-stat">${medium.picks} picks</span>
        <span class="tier-acc-stat hits">${medium.hits} hits</span>
        <span class="tier-acc-stat misses">${medium.misses} misses</span>
        <span class="tier-acc-pct">${tierAccuracyPct(medium)}%</span>
      </div>
      <div class="tier-acc-row">
        <span class="tier-acc-label light-label">Light</span>
        <span class="tier-acc-stat">${light.picks} picks</span>
        <span class="tier-acc-stat hits">${light.hits} hits</span>
        <span class="tier-acc-stat misses">${light.misses} misses</span>
        <span class="tier-acc-pct">${tierAccuracyPct(light)}%</span>
      </div>
    </div>` : `
    <div class="metric-row accuracy-note">
      <span>Tracking all tiers (Strong / Medium / Light). Auto-saves picks on each signals load. Outcomes compute automatically the next day.</span>
    </div>`}
  `;

  hrRbiEl.innerHTML = `
    <div class="metric-row"><span>Last 7 Days</span><span>${system.accuracy ?? 0}%</span></div>
    <div class="metric-row"><span>Last 30 Days</span><span>${system.accuracy ?? 0}%</span></div>
    <div class="metric-row">
      <span>Active Streaks</span>
      <span style="font-size:11px;text-align:right;max-width:55%">${
        hrHitters.length ? hrHitters.slice(0, 4).join(", ") : "None recorded yet"
      }</span>
    </div>
  `;

  // Outcomes — ALL tiers, sorted by date desc
  if (!outcomes.length) {
    outcomesEl.innerHTML = `<div class="empty-state">Outcomes auto-compute each day after games finish.</div>`;
  } else {
    // Group by tier for display
    const grouped = { Strong: [], Medium: [], Light: [] };
    for (const o of outcomes) {
      const t = o.tier ?? "Light";
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(o);
    }

    for (const [tierName, items] of Object.entries(grouped)) {
      if (!items.length) continue;
      const header = document.createElement("div");
      header.className = "outcomes-tier-header";
      const hits   = items.filter(o => o.hrHit).length;
      const total  = items.length;
      const pct    = total > 0 ? Math.round((hits / total) * 100) : 0;
      header.innerHTML = `<span class="tier-acc-label ${tierName.toLowerCase()}-label">${tierName}</span><span class="outcomes-tier-stat">${hits}/${total} (${pct}%)</span>`;
      outcomesEl.appendChild(header);

      items.slice(0, 10).forEach(o => {
        const div = document.createElement("div");
        div.className = "outcome-row";
        const result = o.hrHit
          ? `✅ HR · ${o.h}H ${o.hr}HR ${o.rbi}RBI`
          : `❌ No HR · ${o.h}H ${o.rbi}RBI`;
        div.innerHTML = `
          <div class="outcome-main">
            <span class="outcome-player">${o.player || "Unknown"}</span>
            <span class="outcome-team">${o.team || ""} · ${o.date || ""}</span>
          </div>
          <div class="outcome-side">
            <span class="outcome-hit">${result}</span>
          </div>`;
        outcomesEl.appendChild(div);
      });
    }
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
  if (!state.searchResults.length) {
    list.innerHTML = `<li class="empty-state">No results.</li>`;
    return;
  }
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
  document.querySelectorAll(".sidebar-item").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab));
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-view").forEach(s =>
    s.classList.toggle("active", s.id.replace("tab-", "") === tab));
  const ind = $("nav-indicator");
  if (ind && navItems.length) {
    const idx = Array.from(navItems).findIndex(i => i.dataset.tab === tab);
    if (idx >= 0) ind.style.transform = `translateX(${(idx / navItems.length) * 100}%)`;
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

  $("sportsbook")?.addEventListener("change", renderSignals);
  $("prev-day")?.addEventListener("click",       () => { currentDateOffset--;  loadSignals(); });
  $("next-day")?.addEventListener("click",       () => { currentDateOffset++;  loadSignals(); });
  $("games-prev-day")?.addEventListener("click", () => { currentGamesOffset--; loadGames(); });
  $("games-next-day")?.addEventListener("click", () => { currentGamesOffset++; loadGames(); });

  const si = $("search-input");
  if (si) {
    si.addEventListener("input", e => {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadSearch(e.target.value), 250);
    });
  }

  setActiveTab("hr");
  loadSignals();
  loadGames();
  loadAccuracy();
});