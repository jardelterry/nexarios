// NexariOS v5 UI – HR Legacy View

const API_URL = "https://nexari-auto.jardelterry.workers.dev/hr-legacy";

// v5 scoring bands
const ELITE_THRESHOLD = 25;   // v5: 25+ is elite
const STRONG_THRESHOLD = 18;  // 18–25 strong
const SOLID_THRESHOLD = 12;   // 12–18 solid

document.addEventListener("DOMContentLoaded", () => {
  loadHrCandidates();
});

async function loadHrCandidates() {
  setStatus("Loading HR candidates...");
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    const list = Array.isArray(data.top) ? data.top : [];
    if (!list.length) {
      setStatus("No HR candidates available for this slate.");
      renderEmpty();
      return;
    }

    renderHrTable(list);
    const eliteCount = list.filter(p => p.score >= ELITE_THRESHOLD).length;
    if (eliteCount === 0) {
      setStatus("No v5-elite HR candidates (25+), but strong options exist.");
    } else {
      setStatus(`Found ${eliteCount} v5-elite HR candidates (25+).`);
    }
  } catch (err) {
    console.error(err);
    setStatus("Error loading HR candidates.");
    renderEmpty();
  }
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function renderEmpty() {
  const tbody = document.getElementById("hr-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="empty">No candidates</td></tr>`;
}

function renderHrTable(players) {
  const tbody = document.getElementById("hr-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  players.forEach((p, idx) => {
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
