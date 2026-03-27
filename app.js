/* ------------------------------
   STATE + PROTECTION
--------------------------------*/
let lastGoodSignals = [];
let lastGoodGames = [];
let currentDate = new Date();
let hrLimit = 10;

/* ------------------------------
   FORMAT DATE
--------------------------------*/
function formatDate(d) {
    return d.toISOString().slice(0, 10);
}

/* ------------------------------
   DATA FETCH ENGINE
--------------------------------*/
async function loadData() {
    try {
        const dateParam = `?date=${formatDate(currentDate)}`;

        const signalsRes = await fetch("https://nexari.jardelterry.workers.dev/signals" + dateParam);
        const gamesRes = await fetch("https://nexari.jardelterry.workers.dev/games" + dateParam);
        const accuracyRes = await fetch("https://nexari.jardelterry.workers.dev/accuracy");

        const signalsJson = await signalsRes.json();
        const gamesJson = await gamesRes.json();
        const accuracyJson = await accuracyRes.json();

        window.signalsData = signalsJson.signals || [];
        window.gamesData = gamesJson.games || [];
        window.accuracyData = accuracyJson.accuracy || {};

        const dateLabel = document.getElementById("currentDateLabel");
        if (dateLabel) dateLabel.textContent = formatDate(currentDate);

        loadSignals();
        loadGames();
        loadAccuracy();
    } catch (err) {
        console.error("Data load failed:", err);
    }
}

/* ------------------------------
   NAVIGATION
--------------------------------*/
const navItems = document.querySelectorAll("#bottomNav .navItem");
const pages = document.querySelectorAll(".page");
const slider = document.getElementById("navSlider");

navItems.forEach((item, index) => {
    item.addEventListener("click", () => {
        navItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");

        pages.forEach(p => p.classList.remove("active"));
        document.getElementById(item.dataset.page).classList.add("active");

        slider.style.left = `${index * 25}%`;
    });
});

/* ------------------------------
   PLAYER NAME PROTECTION
--------------------------------*/
function safeName(name, fallback) {
    if (name && name.trim() !== "" && name !== "Unknown") return name;
    if (fallback && fallback.trim() !== "") return fallback;
    return "Player";
}

/* ------------------------------
   HR SIGNALS (color coding + top 10/20)
--------------------------------*/
function loadSignals() {
    const container = document.getElementById("signalsContainer");
    container.innerHTML = "";

    let data = Array.isArray(window.signalsData) ? [...window.signalsData] : [];
    data.sort((a, b) => b.hr - a.hr);
    data = data.slice(0, hrLimit);

    data.forEach(s => {
        const div = document.createElement("div");
        div.className = "signal";

        if (s.tier === "Strong") div.style.borderLeft = "4px solid #ff4444";
        else if (s.tier === "Playable") div.style.borderLeft = "4px solid #ffaa00";
        else div.style.borderLeft = "4px solid #777";

        div.innerHTML = `
            <div class="name">${safeName(s.player, s.cachedPlayer)}</div>
            <div class="meta">
                ${s.team} vs ${s.opponent} • ${s.hr}% • ${s.tier}<br>
                <span class="streak">Streak: ${s.streakType} (${s.streakCount})</span>
            </div>
        `;
        container.appendChild(div);
    });
}

/* ------------------------------
   HR TOGGLE BUTTONS
--------------------------------*/
document.getElementById("top10Btn").onclick = () => {
    hrLimit = 10;
    top10Btn.classList.add("active");
    top20Btn.classList.remove("active");
    loadSignals();
};

document.getElementById("top20Btn").onclick = () => {
    hrLimit = 20;
    top20Btn.classList.add("active");
    top10Btn.classList.remove("active");
    loadSignals();
};

/* ------------------------------
   GAMES
--------------------------------*/
function loadGames() {
    const container = document.getElementById("gamesContainer");
    container.innerHTML = "";

    const data = Array.isArray(window.gamesData) ? window.gamesData : [];

    data.forEach(g => {
        const div = document.createElement("div");
        div.className = "game";

        const livePrefix = g.live ? "LIVE • " : "";

        const awayLineup = Array.isArray(g.awayPlayers)
            ? g.awayPlayers.map(p => safeName(p)).join(", ")
            : "";

        const homeLineup = Array.isArray(g.homePlayers)
            ? g.homePlayers.map(p => safeName(p)).join(", ")
            : "";

        div.innerHTML = `
            <div class="title">${g.away} @ ${g.home}</div>
            <div class="weather">
                ${livePrefix}${g.temp}°F • Wind ${g.wind}mph • ${g.conditions}
            </div>

            <div class="lineup"><strong>${g.away} Lineup:</strong> ${awayLineup}</div>
            <div class="lineup"><strong>${g.home} Lineup:</strong> ${homeLineup}</div>
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
   ACCURACY (expanded)
--------------------------------*/
function loadAccuracy() {
    const container = document.getElementById("accuracyContainer");
    const deepDaily = document.getElementById("accDaily");
    const deep7 = document.getElementById("acc7");
    const deep30 = document.getElementById("acc30");
    const deepBreakdown = document.getElementById("accBreakdown");

    const data = window.accuracyData || {
        percent: 0,
        systemStreak: 0,
        playerStreak: 0,
        outcomes: [],
        missed: [],
        unlisted: []
    };

    const hits = data.outcomes.length;
    const misses = data.missed.length;
    const total = hits + misses;
    const calcAcc = total > 0 ? Math.round((hits / total) * 100) : data.percent;

    container.innerHTML = `
        <div>Accuracy: ${calcAcc}%</div>
        <div>System Streak: ${data.systemStreak}</div>
        <div>Player Streak: ${data.playerStreak}</div>
        <br>
        <div>HR Outcomes: ${data.outcomes.join(", ")}</div>
        <div>Missed HRs: ${data.missed.join(", ")}</div>
        <div>Unlisted HRs: ${data.unlisted.join(", ")}</div>
    `;

    if (deepDaily) deepDaily.textContent = `Daily Accuracy: ${calcAcc}%`;
    if (deep7) deep7.textContent = `7-Day Trend: Stable`;
    if (deep30) deep30.textContent = `30-Day Trend: Stable`;
    if (deepBreakdown) deepBreakdown.textContent = `Hits: ${hits} | Misses: ${misses} | Total: ${total}`;
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
    if (val > 0) autoRefreshTimer = setInterval(loadData, val * 1000);
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
