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

        slider.style.left = `${index * 20}%`;
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
   HR SIGNALS (dropdown + color + animated bars)
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
            <div class="hrBar" style="width:0%;" data-target="${s.hr}"></div>
        `;
        container.appendChild(div);
    });

    // Animate HR bars
    setTimeout(() => {
        document.querySelectorAll(".hrBar").forEach(bar => {
            bar.style.width = bar.dataset.target + "%";
        });
    }, 50);
}

/* ------------------------------
   HR DROPDOWN
--------------------------------*/
const hrViewSelect = document.getElementById("hrViewSelect");
if (hrViewSelect) {
    hrViewSelect.addEventListener("change", () => {
        hrLimit = Number(hrViewSelect.value);
        loadSignals();
    });
}

/* ------------------------------
   GAMES (collapsible)
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
            <div class="gameHeader">
                <div class="title">${g.away} @ ${g.home}</div>
                <div class="weather">${livePrefix}${g.temp}°F • Wind ${g.wind}mph • ${g.conditions}</div>
            </div>

            <div class="gameDetails" style="display:none;">
                <div class="lineup"><strong>${g.away} Lineup:</strong> ${awayLineup}</div>
                <div class="lineup"><strong>${g.home} Lineup:</strong> ${homeLineup}</div>
            </div>
        `;

        div.querySelector(".gameHeader").addEventListener("click", () => {
            const details = div.querySelector(".gameDetails");
            details.style.display = details.style.display === "none" ? "block" : "none";
        });

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
   ACCURACY (futuristic mode)
--------------------------------*/
function loadAccuracy() {
    const container = document.getElementById("accuracyContainer");
    const deepDaily = document.getElementById("accDaily");
    const deep7 = document.getElementById("acc7");
    const deep30 = document.getElementById("acc30");
    const deepBreakdown = document.getElementById("accBreakdown");
    const deepTeams = document.getElementById("accTeams");
    const deepPlayers = document.getElementById("accPlayers");
    const deepVolume = document.getElementById("accVolume");

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
    `;

    /* ------------------------------
       MICRO BAR
    ------------------------------*/
    const dailyBar = document.getElementById("accDailyBar");
    if (dailyBar) {
        dailyBar.style.width = calcAcc + "%";
    }

    /* ------------------------------
       TIER BREAKDOWN
    ------------------------------*/
    const tierCounts = { Strong: {hit:0, miss:0}, Playable: {hit:0, miss:0}, Watch: {hit:0, miss:0} };

    data.outcomes.forEach(o => {
        if (tierCounts[o.tier]) tierCounts[o.tier].hit++;
    });
    data.missed.forEach(m => {
        if (tierCounts[m.tier]) tierCounts[m.tier].miss++;
    });

    deepBreakdown.textContent =
        `Strong: ${tierCounts.Strong.hit}/${tierCounts.Strong.hit + tierCounts.Strong.miss} • ` +
        `Playable: ${tierCounts.Playable.hit}/${tierCounts.Playable.hit + tierCounts.Playable.miss} • ` +
        `Watch: ${tierCounts.Watch.hit}/${tierCounts.Watch.hit + tierCounts.Watch.miss}`;

    /* ------------------------------
       TEAM ACCURACY
    ------------------------------*/
    const teamStats = {};
    data.outcomes.forEach(o => {
        if (!teamStats[o.team]) teamStats[o.team] = {hit:0, miss:0};
        teamStats[o.team].hit++;
    });
    data.missed.forEach(m => {
        if (!teamStats[m.team]) teamStats[m.team] = {hit:0, miss:0};
        teamStats[m.team].miss++;
    });

    const topTeams = Object.entries(teamStats)
        .map(([team, s]) => ({team, acc: Math.round((s.hit/(s.hit+s.miss))*100)}))
        .sort((a,b) => b.acc - a.acc)
        .slice(0,5);

    deepTeams.textContent = topTeams.map(t => `${t.team} ${t.acc}%`).join(" • ");

    /* ------------------------------
       PLAYER ACCURACY
    ------------------------------*/
    const playerStats = {};
    data.outcomes.forEach(o => {
        if (!playerStats[o.player]) playerStats[o.player] = {hit:0, miss:0};
        playerStats[o.player].hit++;
    });
    data.missed.forEach(m => {
        if (!playerStats[m.player]) playerStats[m.player] = {hit:0, miss:0};
        playerStats[m.player].miss++;
    });

    const topPlayers = Object.entries(playerStats)
        .map(([player, s]) => ({player, acc: Math.round((s.hit/(s.hit+s.miss))*100)}))
        .sort((a,b) => b.acc - a.acc)
        .slice(0,5);

    deepPlayers.textContent = topPlayers.map(p => `${p.player} ${p.acc}%`).join(" • ");

    /* ------------------------------
       PREDICTION VOLUME
    ------------------------------*/
    deepVolume.textContent = `Today: ${total} predictions`;
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

let autoRefreshTimer = null;
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
