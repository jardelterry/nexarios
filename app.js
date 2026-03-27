/* ------------------------------
   STATE + PROTECTION
--------------------------------*/
let lastGoodSignals = [];
let lastGoodGames = [];

/* ------------------------------
   PAGE NAVIGATION + SLIDER
--------------------------------*/
const pages = document.querySelectorAll(".page");
const navItems = document.querySelectorAll(".navItem");
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
   PLAYER NAME PROTECTION v2
--------------------------------*/
function safeName(name, fallback) {
    if (name && name.trim() !== "" && name !== "Unknown") return name;
    if (fallback && fallback.trim() !== "") return fallback;
    return "Player";
}

/* ------------------------------
   HR SIGNALS (with streak type)
--------------------------------*/
function loadSignals() {
    const container = document.getElementById("signalsContainer");
    container.innerHTML = "";

    const data = (Array.isArray(window.signalsData) && window.signalsData.length > 0)
        ? window.signalsData
        : lastGoodSignals;

    if (Array.isArray(window.signalsData) && window.signalsData.length > 0) {
        lastGoodSignals = window.signalsData;
    }

    data.forEach(s => {
        const div = document.createElement("div");
        div.className = "signal";

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
   GAMES (players + LIVE + weather)
   Weather format: LIVE • 68°F • Wind 7mph • Clear
--------------------------------*/
function loadGames() {
    const container = document.getElementById("gamesContainer");
    container.innerHTML = "";

    const data = (Array.isArray(window.gamesData) && window.gamesData.length > 0)
        ? window.gamesData
        : lastGoodGames;

    if (Array.isArray(window.gamesData) && window.gamesData.length > 0) {
        lastGoodGames = window.gamesData;
    }

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
   ACCURACY
--------------------------------*/
function loadAccuracy() {
    const container = document.getElementById("accuracyContainer");

    const data = window.accuracyData || {
        percent: 0,
        systemStreak: 0,
        playerStreak: 0,
        outcomes: [],
        missed: [],
        unlisted: []
    };

    container.innerHTML = `
        <div>Accuracy: ${data.percent}%</div>
        <div>System Streak: ${data.systemStreak}</div>
        <div>Player Streak: ${data.playerStreak}</div>
        <br>
        <div>HR Outcomes: ${data.outcomes.join(", ")}</div>
        <div>Missed HRs: ${data.missed.join(", ")}</div>
        <div>Unlisted HRs: ${data.unlisted.join(", ")}</div>
    `;
}

/* ------------------------------
   SYSTEM SETTINGS
--------------------------------*/
const deviceModeSelect = document.getElementById("deviceModeSelect");
const backCompatSelect = document.getElementById("backCompatSelect");
const refreshBtn = document.getElementById("refreshBtn");

if (deviceModeSelect) {
    deviceModeSelect.addEventListener("change", e => {
        document.body.dataset.device = e.target.value;
    });
}

if (backCompatSelect) {
    backCompatSelect.addEventListener("change", e => {
        localStorage.setItem("backCompat", e.target.value);
    });

    const savedBackCompat = localStorage.getItem("backCompat");
    if (savedBackCompat) backCompatSelect.value = savedBackCompat;
}

if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
        loadSignals();
        loadGames();
        loadAccuracy();
    });
}

/* ------------------------------
   INITIAL LOAD
--------------------------------*/
loadSignals();
loadGames();
loadAccuracy();
