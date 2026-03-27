// ---------------------------------------------------------
// NexariOS — Patched App.js
// Includes:
// - SW auto-update
// - LIVE game detection
// - HR ticker
// - LIVE ring
// - Confidence bars
// - Signals, Games, System, Accuracy loaders
// ---------------------------------------------------------

// -----------------------------
// Service Worker Registration (Patched)
// -----------------------------
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").then(reg => {
        // Force update if waiting
        if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        // Detect new SW
        reg.addEventListener("updatefound", () => {
            const newSW = reg.installing;
            newSW.addEventListener("statechange", () => {
                if (newSW.state === "installed" && navigator.serviceWorker.controller) {
                    newSW.postMessage({ type: "SKIP_WAITING" });
                }
            });
        });
    });
}

// -----------------------------
// Tab Navigation (mobile)
// -----------------------------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPages = document.querySelectorAll(".tab-page");

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.tab;

        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        if (window.innerWidth < 900) {
            tabPages.forEach(page => {
                page.classList.remove("active");
                if (page.id === target) page.classList.add("active");
            });
        }
    });
});

// -----------------------------
// Worker URL
// -----------------------------
const WORKER = "https://nexari.jardelterry.workers.dev";

// -----------------------------
// Shared State
// -----------------------------
let latestSignals = [];

// -----------------------------
// HR Ticker (NEW)
// -----------------------------
function showHRTicker(text) {
    const bar = document.getElementById("hrTicker");
    const label = document.getElementById("hrTickerText");
    if (!bar || !label) return;

    label.textContent = text;
    bar.style.display = "flex";
    bar.classList.add("hr-pulse");

    setTimeout(() => bar.classList.remove("hr-pulse"), 800);

    if (bar._hideTimer) clearTimeout(bar._hideTimer);
    bar._hideTimer = setTimeout(() => {
        bar.style.display = "none";
    }, 8000);
}

// -----------------------------
// LIVE Ring Attachment (NEW)
// -----------------------------
function attachLiveRing(container, isLive) {
    if (!container) return;

    const existing = container.querySelector(".live-ring");
    if (!isLive) {
        if (existing) existing.remove();
        return;
    }

    if (existing) return;

    const ring = document.createElement("div");
    ring.className = "live-ring";
    container.appendChild(ring);
}

// -----------------------------
// Confidence Bar
// -----------------------------
function createConfidenceBar(conf) {
    const bar = document.createElement("div");
    bar.className = "confidence-bar";

    const fill = document.createElement("div");
    fill.className = "confidence-fill";

    const pct = (conf ?? 0) * 100;

    if (pct < 20) fill.classList.add("conf-low");
    else if (pct < 40) fill.classList.add("conf-midlow");
    else if (pct < 60) fill.classList.add("conf-mid");
    else if (pct < 80) fill.classList.add("conf-high");
    else fill.classList.add("conf-elite");

    requestAnimationFrame(() => {
        fill.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
    });

    bar.appendChild(fill);
    return bar;
}

// -----------------------------
// Helpers
// -----------------------------
function formatTeam(team) {
    if (typeof team === "string") return team;
    if (!team) return "TEAM";
    return team.teamId || team.abbreviation || team.code || team.name || "TEAM";
}

function computeGameHRIndex(game) {
    if (!latestSignals || latestSignals.length === 0) return 0;

    const home = formatTeam(game.home);
    const away = formatTeam(game.away);
    const teams = new Set([home, away]);

    let total = 0;
    let weightSum = 0;

    latestSignals.forEach(sig => {
        if (!sig.team || !teams.has(sig.team)) return;

        const prob = sig.score ?? 0;
        const conf = sig.confidence ?? 0;
        const tier = sig.tier ?? "Low";

        let tierWeight = 1;
        if (tier === "Elite") tierWeight = 1.5;
        else if (tier === "Strong") tierWeight = 1.2;
        else if (tier === "Playable") tierWeight = 1.0;
        else tierWeight = 0.8;

        const w = 1 + conf + tierWeight;
        total += prob * w;
        weightSum += w;
    });

    if (!weightSum) return 0;
    return total / weightSum;
}

// -----------------------------
// Fetch HR Signals
// -----------------------------
async function loadSignals() {
    const container = document.getElementById("signalsContainer");
    container.innerHTML = "<p>Loading...</p>";

    try {
        const res = await fetch(`${WORKER}/signals`);
        const data = await res.json();

        container.innerHTML = "";

        if (!data.signals || data.signals.length === 0) {
            container.innerHTML = "<p>No signals available.</p>";
            latestSignals = [];
            return;
        }

        latestSignals = data.signals;

        data.signals.forEach(sig => {
            const prob = sig.score ?? 0;
            const conf = sig.confidence ?? 0;
            const tier = sig.tier ?? "Low";

            const card = document.createElement("div");
            card.className = "card";

            card.innerHTML = `
                <div class="card-title">${sig.player}</div>
                <div class="card-sub">Team: ${sig.team}</div>
                <div class="card-sub">HR Probability: ${(prob * 100).toFixed(1)}%</div>
                <div class="card-sub">Confidence: ${(conf * 100).toFixed(1)}%</div>
                <span class="badge ${tier}">${tier}</span>
            `;

            const bar = createConfidenceBar(conf);
            card.appendChild(bar);

            container.appendChild(card);
        });

    } catch (err) {
        container.innerHTML = "<p>Error loading signals.</p>";
        latestSignals = [];
    }
}

// -----------------------------
// Fetch Games (with LIVE ring + HR index)
// -----------------------------
async function loadGames() {
    const container = document.getElementById("gamesContainer");
    container.innerHTML = "<p>Loading...</p>";

    try {
        const res = await fetch(`${WORKER}/games`);
        const data = await res.json();

        container.innerHTML = "";

        if (!data.games || data.games.length === 0) {
            container.innerHTML = "<p>No games today.</p>";
            return;
        }

        const gamesWithIndex = data.games.map(g => ({
            game: g,
            index: computeGameHRIndex(g)
        }));

        gamesWithIndex.sort((a, b) => b.index - a.index);

        gamesWithIndex.forEach(({ game, index }) => {
            const home = formatTeam(game.home);
            const away = formatTeam(game.away);
            const time = game.time ?? "Unknown Time";
            const isLive = game.status === "In Progress" || game.isLive;

            const card = document.createElement("div");
            card.className = "card";

            const indexPct = (index * 100).toFixed(1);

            card.innerHTML = `
                <div class="card-title">${away} @ ${home}</div>
                <div class="card-sub">${time} ${isLive ? "• LIVE" : ""}</div>
                <div class="card-sub">HR Density Index: ${indexPct}%</div>
            `;

            // LIVE ring wrapper
            const wrapper = document.createElement("div");
            wrapper.className = "live-ring-wrapper";
            card.prepend(wrapper);
            attachLiveRing(wrapper, isLive);

            container.appendChild(card);
        });

    } catch {
        container.innerHTML = "<p>Error loading games.</p>";
    }
}

// -----------------------------
// System Diagnostics
// -----------------------------
async function loadSystem() {
    const container = document.getElementById("systemContainer");
    container.innerHTML = "<p>Loading...</p>";

    try {
        const res = await fetch(`${WORKER}/debug`);
        const data = await res.json();

        const version = data.version ?? "4.1";
        const lastRefresh = data.lastRefreshTime ?? data.lastRefresh ?? "Unknown";

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="card-title">System Status</div>
            <div class="card-sub">Version: ${version}</div>
            <div class="card-sub">Last Refresh: ${lastRefresh}</div>
        `;

        container.innerHTML = "";
        container.appendChild(card);

    } catch {
        container.innerHTML = "<p>Error loading system diagnostics.</p>";
    }
}

// -----------------------------
// Elite Accuracy Tracker
// -----------------------------
async function loadAccuracy() {
    const container = document.getElementById("accuracyContainer");
    container.innerHTML = "<p>Loading...</p>";

    try {
        const res = await fetch(`${WORKER}/accuracy`);
        if (!res.ok) {
            container.innerHTML = "<p>Elite accuracy tracking not active yet.</p>";
            return;
        }

        const data = await res.json();

        const today = data.today ?? null;
        const rolling7 = data.rolling7 ?? null;
        const rolling30 = data.rolling30 ?? null;
        const lifetime = data.lifetime ?? null;

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="card-title">Elite Accuracy</div>
            <div class="card-sub">Today: ${
                today ? `${(today.accuracy * 100).toFixed(1)}% (${today.eliteHR}/${today.eliteCount})` : "N/A"
            }</div>
            <div class="card-sub">Last 7 Days: ${
                rolling7 !== null ? `${(rolling7 * 100).toFixed(1)}%` : "N/A"
            }</div>
            <div class="card-sub">Last 30 Days: ${
                rolling30 !== null ? `${(rolling30 * 100).toFixed(1)}%` : "N/A"
            }</div>
            <div class="card-sub">Lifetime: ${
                lifetime !== null ? `${(lifetime * 100).toFixed(1)}%` : "N/A"
            }</div>
        `;

        container.innerHTML = "";
        container.appendChild(card);

    } catch {
        container.innerHTML = "<p>Elite accuracy tracking not active yet.</p>";
    }
}

// -----------------------------
// LIVE Game Watcher (NEW)
// -----------------------------
async function gameStateWatcher() {
    try {
        const res = await fetch(`${WORKER}/games`);
        const data = await res.json();
        if (!data.games) return;

        const now = Date.now();
        let anyLive = false;

        for (const g of data.games) {
            if (!g.time) continue;

            const start = new Date(g.time).getTime();
            const diff = start - now;

            if (diff < 10 * 60 * 1000 && diff > -5 * 60 * 1000) {
                loadGames();
                loadSignals();
            }

            if (g.status === "In Progress" || g.isLive) {
                anyLive = true;
            }
        }

        if (anyLive) {
            if (!window._liveRefresh) {
                window._liveRefresh = setInterval(() => {
                    loadGames();
                    loadSignals();
                }, 10000);
            }
        } else {
            if (window._liveRefresh) {
                clearInterval(window._liveRefresh);
                window._liveRefresh = null;
            }
        }
    } catch {}
}

setInterval(gameStateWatcher, 60000);

// -----------------------------
// Auto-load on startup
// -----------------------------
loadSignals();
loadGames();
loadSystem();
loadAccuracy();
