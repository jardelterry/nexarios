/* ------------------------------
   GLOBAL STATE
--------------------------------*/
let currentDate = new Date();
let autoRefreshTimer = null;

/* ------------------------------
   FORMAT DATE
--------------------------------*/
function formatDate(d) {
    return d.toISOString().slice(0, 10);
}

/* ------------------------------
   LOAD DATA (single source: /rebuild)
--------------------------------*/
async function loadData() {
    try {
        const url = `https://nexari.jardelterry.workers.dev/rebuild?date=${formatDate(currentDate)}`;
        const res = await fetch(url);
        const json = await res.json();

        const games = json.games || [];
        const rosters = json.rosters || {};
        const signals = json.signals || [];
        const accuracy = json.accuracy || {};

        window.signalsData = signals;
        window.accuracyData = accuracy;

        window.gamesData = games.map(g => ({
            away: g.awayName,
            home: g.homeName,
            live: g.isLive,
            temp: g.temp,
            wind: g.wind,
            conditions: g.conditions,
            awayPlayers: (rosters[g.awayId] || []).map(p => p.name),
            homePlayers: (rosters[g.homeId] || []).map(p => p.name)
        }));

        document.getElementById("currentDateLabel").innerText = formatDate(currentDate);

        loadSignals();
        loadGames();
        loadAccuracy();
    } catch (err) {
        console.error("Load failed:", err);
    }
}

/* ------------------------------
   HR SIGNALS
--------------------------------*/
let hrLimit = 10;

document.getElementById("top10Btn").onclick = () => {
    hrLimit = 10;
    document.getElementById("top10Btn").classList.add("active");
    document.getElementById("top20Btn").classList.remove("active");
    loadSignals();
};

document.getElementById("top20Btn").onclick = () => {
    hrLimit = 20;
    document.getElementById("top20Btn").classList.add("active");
    document.getElementById("top10Btn").classList.remove("active");
    loadSignals();
};

function loadSignals() {
    const container = document.getElementById("signalsContainer");
    container.innerHTML = "";

    const sorted = [...window.signalsData].sort((a, b) => b.hr - a.hr).slice(0, hrLimit);

    sorted.forEach(s => {
        const div = document.createElement("div");
        div.className = "signal " + (
            s.tier === "Strong" ? "strong" :
            s.tier === "Playable" ? "playable" : "watch"
        );

        div.innerHTML = `
            <div class="name">${s.player}</div>
            <div class="meta">
                ${s.team} vs ${s.opponent} • ${s.hr}% • ${s.tier}<br>
                <span class="streak">Streak: ${s.streakType} (${s.streakCount})</span>
            </div>
        `;
        container.appendChild(div);
    });
}

/* ------------------------------
   GAMES
--------------------------------*/
function loadGames() {
    const container = document.getElementById("gamesContainer");
    container.innerHTML = "";

    window.gamesData.forEach(g => {
        const div = document.createElement("div");
        div.className = "game";

        div.innerHTML = `
            <div class="title">${g.away} @ ${g.home}</div>
            <div class="weather">
                ${g.live ? "LIVE • " : ""}${g.temp}°F • Wind ${g.wind}mph • ${g.conditions}
            </div>
            <div class="lineup"><strong>${g.away} Lineup:</strong> ${g.awayPlayers.join(", ")}</div>
            <div class="lineup"><strong>${g.home} Lineup:</strong> ${g.homePlayers.join(", ")}</div>
        `;
        container.appendChild(div);
    });
}

/* ------------------------------
   CALENDAR CLICKER
--------------------------------*/
document.getElementById("prevDate").onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    loadData();
};
document.getElementById("nextDate").onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    loadData();
};

/* ------------------------------
   ACCURACY (deep analytics)
--------------------------------*/
function loadAccuracy() {
    const acc = window.accuracyData;
    const container = document.getElementById("accuracyContainer");

    container.innerHTML = `
        <div>Accuracy: ${acc.percent}%</div>
        <div>System Streak: ${acc.systemStreak}</div>
        <div>Player Streak: ${acc.playerStreak}</div>
    `;

    document.getElementById("accDaily").innerText = "Daily Accuracy: " + acc.percent + "%";
    document.getElementById("acc7").innerText = "7-Day Trend: Stable";
    document.getElementById("acc30").innerText = "30-Day Trend: Stable";
    document.getElementById("accBreakdown").innerText = "Hits: " + acc.outcomes.length + " | Misses: " + acc.missed.length;
    document.getElementById("accTeams").innerText = "Team Performance: Coming Soon";
    document.getElementById("accPlayers").innerText = "Player Trends: Coming Soon";
}

/* ------------------------------
   SETTINGS
--------------------------------*/
document.getElementById("deviceModeSelect").onchange = e => {
    document.body.dataset.device = e.target.value;
};

document.getElementById("fontSizeSlider").oninput = e => {
    document.body.style.fontSize = e.target.value + "px";
};

document.getElementById("autoRefreshSelect").onchange = e => {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    const val = Number(e.target.value);
    if (val > 0) {
        autoRefreshTimer = setInterval(loadData, val * 1000);
    }
};

document.getElementById("forceRebuildBtn").onclick = () => loadData();
document.getElementById("clearCacheBtn").onclick = () => {
    window.signalsData = [];
    window.gamesData = [];
    window.accuracyData = {};
    loadSignals();
    loadGames();
    loadAccuracy();
};

/* ------------------------------
   INITIAL LOAD
--------------------------------*/
loadData();
