/* ------------------------------
   STATE + PROTECTION
--------------------------------*/
let lastGoodSignals = [];
let lastGoodGames = [];
let currentDate = new Date();
let hrLimit = 10;
let autoRefreshTimer = null;

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
        runSearch(); // keep search in sync with latest data
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

function setActivePage(index) {
    navItems.forEach(i => i.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));

    const item = navItems[index];
    if (!item) return;

    item.classList.add("active");
    const pageId = item.dataset.page;
    const page = document.getElementById(pageId);
    if (page) page.classList.add("active");

    slider.style.left = `${index * 20}%`;
}

navItems.forEach((item, index) => {
    item.addEventListener("click", () => setActivePage(index));
});

/* ------------------------------
   EDGE SWIPE NAVIGATION
--------------------------------*/
let touchStartX = null;
let touchStartY = null;

document.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
}, { passive: true });

document.addEventListener("touchend", (e) => {
    if (touchStartX === null || touchStartY === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const edgeThreshold = 40;
    const swipeThreshold = 60;

    const fromLeftEdge = touchStartX < edgeThreshold;
    const fromRightEdge = touchStartX > (window.innerWidth - edgeThreshold);

    if ((fromLeftEdge || fromRightEdge) && absDx > swipeThreshold && absDx > absDy) {
        const currentIndex = Array.from(navItems).findIndex(i => i.classList.contains("active"));
        if (dx < 0 && currentIndex < navItems.length - 1) {
            setActivePage(currentIndex + 1);
        } else if (dx > 0 && currentIndex > 0) {
            setActivePage(currentIndex - 1);
        }
    }

    touchStartX = null;
    touchStartY = null;
}, { passive: true });

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
    if (!container) return;
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
                ${s.team} vs ${s.opponent} • ${s.hr}% • ${s.tier || "Tier"}<br>
                <span class="streak">Streak: ${s.streakType || "N/A"} (${s.streakCount || 0})</span>
            </div>
            <div class="hrBar" style="width:0%;" data-target="${s.hr || 0}"></div>
        `;
        container.appendChild(div);
    });

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
    if (!container) return;
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
const prevDateBtn = document.getElementById("prevDate");
const nextDateBtn = document.getElementById("nextDate");

if (prevDateBtn) {
    prevDateBtn.onclick = () => {
        currentDate.setDate(currentDate.getDate() - 1);
        loadData();
    };
}
if (nextDateBtn) {
    nextDateBtn.onclick = () => {
        currentDate.setDate(currentDate.getDate() + 1);
        loadData();
    };
}

/* ------------------------------
   SPARKLINE GENERATOR (BLOCK STYLE)
--------------------------------*/
function makeSparkline(values) {
    if (!values || !values.length) return "";
    const blocks = ["▁","▂","▃","▄","▅","▆","▇","█"];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return blocks[0].repeat(values.length);
    return values.map(v => {
        const idx = Math.floor(((v - min) / (max - min)) * (blocks.length - 1));
        return blocks[idx];
    }).join("");
}

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
    const dailyBar = document.getElementById("accDailyBar");
    const trend7 = document.getElementById("trend7");
    const trend30 = document.getElementById("trend30");

    const data = window.accuracyData || {
        percent: 0,
        systemStreak: 0,
        playerStreak: 0,
        outcomes: [],
        missed: [],
        unlisted: [],
        history7: [],
        history30: []
    };

    const hits = data.outcomes.length;
    const misses = data.missed.length;
    const total = hits + misses;
    const calcAcc = total > 0 ? Math.round((hits / total) * 100) : (data.percent || 0);

    if (container) {
        container.innerHTML = `
            <div>Accuracy: ${calcAcc}%</div>
            <div>System Streak: ${data.systemStreak || 0}</div>
            <div>Player Streak: ${data.playerStreak || 0}</div>
        `;
    }
    if (deepDaily) deepDaily.textContent = `${calcAcc}% today`;
    if (dailyBar) dailyBar.style.width = calcAcc + "%";

    const hist7 = Array.isArray(data.history7) && data.history7.length
        ? data.history7
        : Array(7).fill(calcAcc);
    const hist30 = Array.isArray(data.history30) && data.history30.length
        ? data.history30
        : Array(30).fill(calcAcc);

    if (deep7) deep7.textContent = `7‑Day Avg: ${Math.round(hist7.reduce((a,b)=>a+b,0)/hist7.length)}%`;
    if (deep30) deep30.textContent = `30‑Day Avg: ${Math.round(hist30.reduce((a,b)=>a+b,0)/hist30.length)}%`;

    if (trend7) trend7.textContent = makeSparkline(hist7);
    if (trend30) trend30.textContent = makeSparkline(hist30);

    const tierCounts = { Strong: {hit:0, miss:0}, Playable: {hit:0, miss:0}, Watch: {hit:0, miss:0} };

    data.outcomes.forEach(o => {
        if (tierCounts[o.tier]) tierCounts[o.tier].hit++;
    });
    data.missed.forEach(m => {
        if (tierCounts[m.tier]) tierCounts[m.tier].miss++;
    });

    if (deepBreakdown) {
        deepBreakdown.textContent =
            `Strong: ${tierCounts.Strong.hit}/${tierCounts.Strong.hit + tierCounts.Strong.miss} • ` +
            `Playable: ${tierCounts.Playable.hit}/${tierCounts.Playable.hit + tierCounts.Playable.miss} • ` +
            `Watch: ${tierCounts.Watch.hit}/${tierCounts.Watch.hit + tierCounts.Watch.miss}`;
    }

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

    if (deepTeams) deepTeams.textContent = topTeams.map(t => `${t.team} ${t.acc}%`).join(" • ");

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

    if (deepPlayers) deepPlayers.textContent = topPlayers.map(p => `${p.player} ${p.acc}%`).join(" • ");

    if (deepVolume) deepVolume.textContent = `Today: ${total} predictions`;
}

/* ------------------------------
   SEARCH TAB
--------------------------------*/
const searchInput = document.getElementById("playerSearchInput");
const searchResults = document.getElementById("searchResults");

function runSearch() {
    if (!searchInput || !searchResults) return;
    const q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";

    const data = Array.isArray(window.signalsData) ? window.signalsData : [];
    if (!q) return;

    const matches = data.filter(s => {
        const name = safeName(s.player, s.cachedPlayer).toLowerCase();
        const team = (s.team || "").toLowerCase();
        const opp = (s.opponent || "").toLowerCase();
        return name.includes(q) || team.includes(q) || opp.includes(q);
    });

    matches.forEach(s => {
        const div = document.createElement("div");
        div.className = "searchResult";

        const name = safeName(s.player, s.cachedPlayer);
        const hr = s.hr || 0;
        const tier = s.tier || "Tier";
        const streakType = s.streakType || "N/A";
        const streakCount = s.streakCount || 0;

        div.innerHTML = `
            <div class="name">${name} — ${hr}% (${tier})</div>
            <div class="meta">
                ${s.team} vs ${s.opponent}<br>
                Streak: ${streakType} (${streakCount})
            </div>
            <div class="hrBar" style="width:0%;" data-target="${hr}"></div>
        `;

        searchResults.appendChild(div);
    });

    setTimeout(() => {
        searchResults.querySelectorAll(".hrBar").forEach(bar => {
            bar.style.width = bar.dataset.target + "%";
        });
    }, 50);
}

if (searchInput) {
    searchInput.addEventListener("input", runSearch);
}

/* ------------------------------
   SETTINGS
--------------------------------*/
const deviceModeSelect = document.getElementById("deviceModeSelect");
const fontSizeSlider = document.getElementById("fontSizeSlider");
const autoRefreshSelect = document.getElementById("autoRefreshSelect");
const forceRebuildBtn = document.getElementById("forceRebuildBtn");
const clearCacheBtn = document.getElementById("clearCacheBtn");
const themeToggle = document.getElementById("themeToggle");

if (deviceModeSelect) {
    deviceModeSelect.onchange = e => {
        document.body.dataset.device = e.target.value;
    };
}

if (fontSizeSlider) {
    fontSizeSlider.oninput = e => {
        document.body.style.fontSize = e.target.value + "px";
    };
}

if (autoRefreshSelect) {
    autoRefreshSelect.onchange = e => {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        const val = Number(e.target.value);
        if (val > 0) autoRefreshTimer = setInterval(loadData, val * 1000);
    };
}

if (forceRebuildBtn) {
    forceRebuildBtn.onclick = () => loadData();
}

if (clearCacheBtn) {
    clearCacheBtn.onclick = () => {
        window.signalsData = [];
        window.gamesData = [];
        window.accuracyData = {};
        loadSignals();
        loadGames();
        loadAccuracy();
        runSearch();
    };
}

/* THEME TOGGLE */
function applyTheme(theme) {
    if (theme === "auto") {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.body.dataset.theme = prefersDark ? "dark" : "light";
    } else {
        document.body.dataset.theme = theme;
    }
}

if (themeToggle) {
    const buttons = themeToggle.querySelectorAll(".segBtn");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const theme = btn.dataset.theme;
            applyTheme(theme);
        });
    });
}

/* ------------------------------
   INITIAL LOAD
--------------------------------*/
loadData();
