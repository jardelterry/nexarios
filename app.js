// -----------------------------
// Service Worker Registration
// -----------------------------
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js")
            .then(() => console.log("SW registered"))
            .catch(err => console.error("SW failed:", err));
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
// Helpers
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
// Fetch Games (sorted by HR density)
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

            const card = document.createElement("div");
            card.className = "card";

            const indexPct = (index * 100).toFixed(1);

            card.innerHTML = `
                <div class="card-title">${away} @ ${home}</div>
                <div class="card-sub">${time}</div>
                <div class="card-sub">HR Density Index: ${indexPct}%</div>
            `;

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
// Auto-load on startup
// -----------------------------
loadSignals();
loadGames();
loadSystem();
loadAccuracy();
