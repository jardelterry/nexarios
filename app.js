/* --------------------------------------------------
   CONFIG
-------------------------------------------------- */

const WORKER = "https://nexari.jardelterry.workers.dev";

/* --------------------------------------------------
   INITIALIZATION
-------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initTheme();
    initAccent();
    initSystemControls();
    loadSignals();
    loadGames();
    loadAccuracy();
    updateAboutSection();
});

/* --------------------------------------------------
   NAVIGATION
-------------------------------------------------- */

function initNavigation() {
    const buttons = document.querySelectorAll("#bottomNav button");
    const pages = document.querySelectorAll(".page");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.target;

            pages.forEach(p => p.classList.remove("active"));
            document.getElementById(target).classList.add("active");

            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    // Default tab
    document.querySelector('#bottomNav button[data-target="signalsPage"]').classList.add("active");
}

/* --------------------------------------------------
   THEME + ACCENT
-------------------------------------------------- */

function initTheme() {
    const mode = localStorage.getItem("themeMode") || "dark";
    document.body.classList.remove("theme-dark", "theme-light");
    document.body.classList.add(mode === "light" ? "theme-light" : "theme-dark");

    document.getElementById("themeMode").value = mode;

    document.getElementById("themeMode").addEventListener("change", e => {
        const val = e.target.value;
        localStorage.setItem("themeMode", val);
        initTheme();
    });
}

function initAccent() {
    const accent = localStorage.getItem("accentColor") || "blue";
    document.body.classList.remove("accent-blue", "accent-purple", "accent-red", "accent-gold");
    document.body.classList.add(`accent-${accent}`);

    document.getElementById("accentColor").value = accent;

    document.getElementById("accentColor").addEventListener("change", e => {
        const val = e.target.value;
        localStorage.setItem("accentColor", val);
        initAccent();
    });
}

/* --------------------------------------------------
   SIGNALS
-------------------------------------------------- */

async function loadSignals() {
    try {
        const res = await fetch(`${WORKER}/signals`);
        const data = await res.json();

        const container = document.getElementById("signalsContainer");
        container.innerHTML = "";

        if (!data.ok || !data.signals || data.signals.length === 0) {
            container.innerHTML = `<p>No signals available.</p>`;
            return;
        }

        updateHRTicker(data.signals);

        data.signals.forEach(sig => {
            const card = document.createElement("div");
            card.className = "card";

            card.innerHTML = `
                <h3>${sig.player}</h3>
                <p>${sig.team} vs ${sig.opponent}</p>
                <p>Tier: <strong>${sig.tier}</strong></p>
                <p>Score: ${(sig.score * 100).toFixed(1)}%</p>
                <p>Confidence: ${(sig.confidence * 100).toFixed(1)}%</p>
                <div class="conf-bar">
                    <div class="conf-fill" style="width:${sig.confidence * 100}%"></div>
                </div>
            `;

            container.appendChild(card);
        });

    } catch (err) {
        console.error("Signals error:", err);
    }
}

/* --------------------------------------------------
   GAMES
-------------------------------------------------- */

async function loadGames() {
    try {
        const res = await fetch(`${WORKER}/games`);
        const data = await res.json();

        const container = document.getElementById("gamesContainer");
        container.innerHTML = "";

        if (!data.ok || !data.games) return;

        data.games.forEach(g => {
            const card = document.createElement("div");
            card.className = "card";

            card.innerHTML = `
                <h3>${g.home} vs ${g.away}</h3>
                <p>${g.time}</p>
                <p>Status: ${g.status}</p>
                ${g.isLive ? `<div class="live-ring"></div>` : ""}
            `;

            container.appendChild(card);
        });

    } catch (err) {
        console.error("Games error:", err);
    }
}

/* --------------------------------------------------
   ACCURACY
-------------------------------------------------- */

async function loadAccuracy() {
    try {
        const res = await fetch(`${WORKER}/accuracy`);
        const data = await res.json();

        const container = document.getElementById("accuracyContainer");
        container.innerHTML = "";

        if (!data.ok || !data.accuracy) return;

        container.innerHTML = `
            <div class="card">
                <h3>Overall Hit Rate</h3>
                <p>${(data.accuracy.overallHitRate * 100).toFixed(1)}%</p>
            </div>
        `;

    } catch (err) {
        console.error("Accuracy error:", err);
    }
}

/* --------------------------------------------------
   HR TICKER
-------------------------------------------------- */

function updateHRTicker(signals) {
    const ticker = document.getElementById("hrTicker");
    const top = signals[0];
    ticker.textContent = `${top.player} • ${(top.score * 100).toFixed(1)}% HR • ${top.tier}`;
}

/* --------------------------------------------------
   SYSTEM CONTROLS
-------------------------------------------------- */

function initSystemControls() {
    document.getElementById("forceRefresh").onclick = () => {
        loadSignals();
        loadGames();
        loadAccuracy();
    };

    document.getElementById("clearCache").onclick = async () => {
        if ("caches" in window) {
            const names = await caches.keys();
            for (const n of names) await caches.delete(n);
        }
        alert("Cache cleared.");
    };

    document.getElementById("rebuildEngine").onclick = async () => {
        await fetch(`${WORKER}/rebuild`);
        alert("Engine rebuild triggered.");
    };

    document.getElementById("reloadUI").onclick = () => {
        location.reload(true);
    };

    /* Developer Tools */
    document.getElementById("showRawJSON").onclick = async () => {
        const res = await fetch(`${WORKER}/debug`);
        const data = await res.json();
        document.getElementById("devOutput").textContent = JSON.stringify(data, null, 2);
    };

    document.getElementById("showWorkerInfo").onclick = async () => {
        const res = await fetch(`${WORKER}/debug`);
        const data = await res.json();
        document.getElementById("devOutput").textContent =
            `Version: ${data.version}\nGenerated: ${data.generatedAt}`;
    };

    document.getElementById("showCounts").onclick = async () => {
        const res = await fetch(`${WORKER}/debug`);
        const data = await res.json();
        document.getElementById("devOutput").textContent =
            `Signals: ${data.signals}\nGames: ${data.games}`;
    };
}

/* --------------------------------------------------
   ABOUT SECTION
-------------------------------------------------- */

function updateAboutSection() {
    document.getElementById("aboutBuild").textContent = new Date().toLocaleString();
    document.getElementById("aboutWorker").textContent = WORKER;
}
