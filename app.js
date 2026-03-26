// NexariOS v5 UI – Multi-tab, date-aware, with player modal

const API_BASE = "https://nexari-auto.jardelterry.workers.dev";
const HR_ENDPOINT = `${API_BASE}/hr-legacy`;
const SCHEDULE_ENDPOINT = `${API_BASE}/schedule`;

// v5 scoring bands
const ELITE_THRESHOLD = 25;
const STRONG_THRESHOLD = 18;
const SOLID_THRESHOLD = 12;

let currentDate = null;
let hrData = { top: [], all: [] };
let scheduleData = null;
let hittersIndex = {}; // playerId -> enriched hitter
let pitchersIndex = {}; // pitcherId -> meta
let currentHrView = "top"; // "top" or "all"

document.addEventListener("DOMContentLoaded", () => {
  wireTabs();
  wireDateBar();
  wireHrToggle();
  wireSettings();
  wireModal();
  initDate();
});

// --------------------
// Date handling
// --------------------

function initDate() {
  const today = new Date().toISOString().slice(0, 10);
  currentDate = today;
  updateDateLabel();
  loadAllForDate();
}

function updateDateLabel() {
  const d = new Date(currentDate + "T00:00:00");
  const opts = { month: "long", day: "numeric", year: "numeric" };
  document.getElementById("date-label").textContent = d.toLocaleDateString(undefined, opts);
}

function shiftDate(delta) {
  const d = new Date(currentDate + "T00:00:00");
  d.setDate(d.getDate() + delta);
  currentDate = d.toISOString().slice(0, 10);
  updateDateLabel();
  loadAllForDate();
}

function wireDateBar() {
  document.getElementById("date-prev").addEventListener("click", () => shiftDate(-1));
  document.getElementById("date-next").addEventListener("click", () => shiftDate(1));
}

// --------------------
// Tabs
// --------------------

function wireTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const screen = btn.getAttribute("data-screen");
      showScreen(screen);
    });
  });
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");
}

// --------------------
// Settings
// --------------------

function wireSettings() {
  const themeBtn = document.getElementById("theme-toggle");
  themeBtn.addEventListener("click", () => {
    const body = document.body;
    const isLight = body.classList.toggle("light");
    themeBtn.textContent = isLight ? "Light" : "Dark";
  });

  const refreshBtn = document.getElementById("refresh-btn");
  refreshBtn.addEventListener("click", () => {
    loadAllForDate();
  });
}

// --------------------
// HR view toggle
// --------------------

function wireHrToggle() {
  const topBtn = document.getElementById("toggle-top");
  const allBtn = document.getElementById("toggle-all");

  topBtn.addEventListener("click", () => {
    currentHrView = "top";
    topBtn.classList.add("active");
    allBtn.classList.remove("active");
    renderHrTable();
  });

  allBtn.addEventListener("click", () => {
    currentHrView = "all";
    allBtn.classList.add("active");
    topBtn.classList.remove("active");
    renderHrTable();
  });
}

// --------------------
// Modal
// --------------------

function wireModal() {
  const backdrop = document.getElementById("player-modal-backdrop");
  const closeBtn = document.getElementById("modal-close");

  closeBtn.addEventListener("click", () => {
    backdrop.classList.add("hidden");
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.classList.add("hidden");
  });
}

function openPlayerModal(player) {
  const backdrop = document.getElementById("player-modal-backdrop");
  backdrop.classList.remove("hidden");

  document.getElementById("modal-player-name").textContent = player.player || "Unknown";
  document.getElementById("modal-score").textContent = player.score != null ? player.score.toFixed(1) : "-";
  document.getElementById("modal-hrpa").textContent = player.hrPerPA != null ? (player.hrPerPA * 100).toFixed(1) + "%" : "-";
  document.getElementById("modal-ev").textContent = formatEV(player.avgEV);

  const conf = player.confidence != null ? player.confidence : 0.5;
  const risk = player.risk != null ? player.risk : 0.5;

  document.getElementById("modal-confidence").textContent = (conf * 100).toFixed(0) + "%";
  document.getElementById("modal-risk").textContent = (risk * 100).toFixed(0) + "%";

  // Matchup placeholders (can be wired to real factors later)
  document.getElementById("modal-era").textContent = player.matchupEra != null ? player.matchupEra.toFixed(2) : "—";
  document.getElementById("modal-hr9").textContent = player.matchupHr9 != null ? player.matchupHr9.toFixed(2) : "—";
  document.getElementById("modal-ev-allowed").textContent = player.matchupEvAllowed != null ? player.matchupEvAllowed.toFixed(1) + " mph" : "—";
  document.getElementById("modal-handed").textContent = player.matchupHanded || "—";
  document.getElementById("modal-pitch-type").textContent = player.matchupPitchType || "—";
}

// --------------------
// Data loading
// --------------------

async function loadAllForDate() {
  setStatus("Loading HR candidates and schedule…");
  try {
    const [hrRes, schedRes] = await Promise.all([
      fetch(HR_ENDPOINT, { cache: "no-store" }),
      fetch(SCHEDULE_ENDPOINT, { cache: "no-store" })
    ]);

    if (!hrRes.ok) throw new Error("HR HTTP " + hrRes.status);
    if (!schedRes.ok) throw new Error("Schedule HTTP " + schedRes.status);

    hrData = await hrRes.json();
    scheduleData = await schedRes.json();

    buildIndexes();
    renderHrTable();
    renderGames();
    renderMatchups();
    renderPlayers();

    const eliteCount = (hrData.top || []).filter(p => p.score >= ELITE_THRESHOLD).length;
    if (eliteCount === 0) {
      setStatus("No v5-elite HR candidates (25+), but strong options exist.");
    } else {
      setStatus(`Found ${eliteCount} v5-elite HR candidates (25+).`);
    }

    document.getElementById("last-rebuild").textContent = scheduleData.date || currentDate;
  } catch (err) {
    console.error(err);
    setStatus("Error loading HR candidates or schedule.");
    renderHrEmpty();
  }
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

// --------------------
// Index building
// --------------------

function buildIndexes() {
  hittersIndex = {};
  pitchersIndex = {};

  // Build hitters index from hrData.all
  (hrData.all || []).forEach(h => {
    hittersIndex[h.playerId] = {
      ...h,
      confidence: h.confidence ?? 0.5,
      risk: h.risk ?? 0.5
    };
  });

  // Build pitchers index from scheduleData.games
  (scheduleData.games || []).forEach(g => {
    const pitchers = g.pitchers || {};
    Object.entries(pitchers).forEach(([pid, p]) => {
      pitchersIndex[pid] = p;
    });
  });
}

// --------------------
// HR table
// --------------------

function renderHrEmpty() {
  const tbody = document.getElementById("hr-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="empty">No candidates</td></tr>`;
}

function renderHrTable() {
  const tbody = document.getElementById("hr-body");
  if (!tbody) return;

  const list = currentHrView === "top" ? (hrData.top || []) : (hrData.all || []);
  if (!list.length) {
    renderHrEmpty();
    return;
  }

  tbody.innerHTML = "";

  list.forEach((p, idx) => {
    const tr = document.createElement("tr");
    const tier = classifyTier(p.score);
    tr.className = tier.className;

    const rankTd = cell(idx + 1);
    const nameTd = cell(p.player || "Unknown");
    const scoreTd = cell(p.score != null ? p.score.toFixed(1) : "-");
    const hrpTd = cell(p.hrPerPA != null ? (p.hrPerPA * 100).toFixed(1) + "%" : "-");
    const evTd = cell(formatEV(p.avgEV));

    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(scoreTd);
    tr.appendChild(hrpTd);
    tr.appendChild(evTd);

    tr.addEventListener("click", () => {
      openPlayerModal(enrichPlayerForModal(p));
    });

    tbody.appendChild(tr);
  });
}

function classifyTier(score) {
  if (score == null || isNaN(score)) return { label: "unknown", className: "tier-unknown" };
  if (score >= ELITE_THRESHOLD) return { label: "elite", className: "tier-elite" };
  if (score >= STRONG_THRESHOLD) return { label: "strong", className: "tier-strong" };
  if (score >= SOLID_THRESHOLD) return { label: "solid", className: "tier-solid" };
  return { label: "deep", className: "tier-deep" };
}

function formatEV(ev) {
  if (!ev || !isFinite(ev) || ev <= 0) return "—";
  return ev.toFixed(1) + " mph";
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

// --------------------
// Games view
// --------------------

function renderGames() {
  const container = document.getElementById("games-list");
  if (!container) return;
  container.innerHTML = "";

  const games = scheduleData?.games || [];
  if (!games.length) {
    container.innerHTML = `<div class="empty">No games for this date.</div>`;
    return;
  }

  games.forEach(g => {
    const card = document.createElement("div");
    card.className = "game-card";

    const header = document.createElement("div");
    header.className = "game-header";

    const teams = document.createElement("div");
    teams.className = "game-teams";
    teams.textContent = `${g.away.name} @ ${g.home.name}`;

    const meta = document.createElement("div");
    meta.className = "game-meta";
    meta.textContent = `Game ${g.gamePk}`;

    header.appendChild(teams);
    header.appendChild(meta);

    const toggle = document.createElement("div");
    toggle.className = "game-toggle";
    toggle.textContent = "Show hitters";
    header.appendChild(toggle);

    const hittersDiv = document.createElement("div");
    hittersDiv.className = "game-hitters";
    hittersDiv.style.display = "none";

    const hitters = [];
    Object.entries(g.hitters || {}).forEach(([pid, stats]) => {
      const h = hittersIndex[pid];
      if (!h) return;
      hitters.push(h);
    });
    hitters.sort((a, b) => (b.score || 0) - (a.score || 0));

    if (hitters.length) {
      const table = document.createElement("table");
      table.innerHTML = `
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
            <th>HR/PA</th>
            <th>EV</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = table.querySelector("tbody");
      hitters.forEach(h => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${h.player}</td>
          <td>${h.score != null ? h.score.toFixed(1) : "-"}</td>
          <td>${h.hrPerPA != null ? (h.hrPerPA * 100).toFixed(1) + "%" : "-"}</td>
          <td>${formatEV(h.avgEV)}</td>
        `;
        tr.addEventListener("click", () => openPlayerModal(enrichPlayerForModal(h)));
        tb.appendChild(tr);
      });
      hittersDiv.appendChild(table);
    } else {
      hittersDiv.innerHTML = `<div class="empty">No hitters with HR data.</div>`;
    }

    toggle.addEventListener("click", () => {
      const visible = hittersDiv.style.display !== "none";
      hittersDiv.style.display = visible ? "none" : "block";
      toggle.textContent = visible ? "Show hitters" : "Hide hitters";
    });

    card.appendChild(header);
    card.appendChild(hittersDiv);
    container.appendChild(card);
  });
}

// --------------------
// Matchups view
// --------------------

function renderMatchups() {
  const container = document.getElementById("matchups-list");
  if (!container) return;
  container.innerHTML = "";

  const games = scheduleData?.games || [];
  if (!games.length) {
    container.innerHTML = `<div class="empty">No matchups for this date.</div>`;
    return;
  }

  const matchupCards = [];

  games.forEach(g => {
    const pitchers = g.pitchers || {};
    Object.entries(pitchers).forEach(([pid, p]) => {
      matchupCards.push({
        game: g,
        pitcherId: pid,
        pitcher: p
      });
    });
  });

  if (!matchupCards.length) {
    container.innerHTML = `<div class="empty">No pitchers found.</div>`;
    return;
  }

  matchupCards.forEach(m => {
    const card = document.createElement("div");
    card.className = "matchup-card";

    const header = document.createElement("div");
    header.className = "matchup-header";

    const name = document.createElement("div");
    name.textContent = m.pitcher.name || "Pitcher";

    const meta = document.createElement("div");
    meta.className = "matchup-meta";
    meta.textContent = `${m.game.away.name} @ ${m.game.home.name}`;

    header.appendChild(name);
    header.appendChild(meta);

    const body = document.createElement("div");
    body.className = "matchup-body";

    const era = m.pitcher.era != null ? m.pitcher.era.toFixed(2) : "—";
    const hr9 = m.pitcher.hrPer9 != null ? m.pitcher.hrPer9.toFixed(2) : "—";
    const evAllowed = m.pitcher.evAllowed != null ? m.pitcher.evAllowed.toFixed(1) + " mph" : "—";
    const throws = m.pitcher.throws || "R";

    body.innerHTML = `
      <div class="modal-row">
        <span class="modal-label">ERA</span>
        <span class="modal-value">${era}</span>
      </div>
      <div class="modal-row">
        <span class="modal-label">HR/9</span>
        <span class="modal-value">${hr9}</span>
      </div>
      <div class="modal-row">
        <span class="modal-label">EV allowed</span>
        <span class="modal-value">${evAllowed}</span>
      </div>
      <div class="modal-row">
        <span class="modal-label">Throws</span>
        <span class="modal-value">${throws}</span>
      </div>
    `;

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });
}

// --------------------
// Players view
// --------------------

function renderPlayers() {
  const container = document.getElementById("players-list");
  if (!container) return;
  container.innerHTML = "";

  const list = Object.values(hittersIndex);
  if (!list.length) {
    container.innerHTML = `<div class="empty">No players found.</div>`;
    return;
  }

  list.sort((a, b) => (a.player || "").localeCompare(b.player || ""));

  const searchInput = document.getElementById("players-search-input");
  const query = (searchInput.value || "").toLowerCase();

  list
    .filter(p => !query || (p.player || "").toLowerCase().includes(query))
    .forEach(p => {
      const row = document.createElement("div");
      row.className = "player-row";

      const name = document.createElement("div");
      name.className = "player-name";
      name.textContent = p.player || "Unknown";

      const score = document.createElement("div");
      score.className = "player-score";
      score.textContent = p.score != null ? p.score.toFixed(1) : "-";

      row.appendChild(name);
      row.appendChild(score);

      row.addEventListener("click", () => openPlayerModal(enrichPlayerForModal(p)));

      container.appendChild(row);
    });

  searchInput.oninput = () => renderPlayers();
}

// --------------------
// Enrichment for modal
// --------------------

function enrichPlayerForModal(p) {
  // Placeholder for matchup enrichment; can be wired to real data later
  return {
    ...p,
    confidence: p.confidence ?? 0.5,
    risk: p.risk ?? 0.5,
    matchupEra: p.matchupEra ?? null,
    matchupHr9: p.matchupHr9 ?? null,
    matchupEvAllowed: p.matchupEvAllowed ?? null,
    matchupHanded: p.matchupHanded ?? null,
    matchupPitchType: p.matchupPitchType ?? null
  };
}
