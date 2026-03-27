/* ------------------------------
   STATE
--------------------------------*/
let currentDate = new Date();
let hrLimit = 10;
let autoRefreshTimer = null;

let signalsData = [];
let gamesData = [];
let accuracyData = {};
let masterPlayers = []; // roster patch: full slate
let selectedBook = "dk";

/* ------------------------------
   HELPERS
--------------------------------*/
function formatDate(d) {
    return d.toISOString().slice(0, 10);
}

function safeName(name, fallback) {
    if (name && name.trim() !== "" && name !== "Unknown") return name;
    if (fallback && fallback.trim() !== "") return fallback;
    return "Player";
}

/* Build master player list from gamesData (roster patch) */
function buildMasterPlayers() {
    const players = [];
    const seen = new Set();

    (gamesData || []).forEach(g => {
        const away = g.away || "";
        const home = g.home || "";

        (g.awayPlayers || []).forEach(p => {
            const key = `${away}|${p}`;
            if (seen.has(key)) return;
            seen.add(key);
            players.push({
                player: p,
                team: away,
                opponent: home
            });
        });

        (g.homePlayers || []).forEach(p => {
            const key = `${home}|${p}`;
            if (seen.has(key)) return;
            seen.add(key);
            players.push({
                player: p,
                team: home,
                opponent: away
            });
        });
    });

    // merge HR + odds from signalsData
    players.forEach(pl => {
        const match = (signalsData || []).find(s =>
            safeName(s.player, s.cachedPlayer).toLowerCase() === pl.player.toLowerCase()
        );
        if (match) {
            pl.hr = match.hr ?? 0;
            pl.tier = match.tier || "Tier";
            pl.streakType = match.streakType || "N/A";
            pl.streakCount = match.streakCount || 0;
            pl.sportsbooks = match.sportsbooks || {};
        } else {
            pl.hr = 0; // 0% (No projection)
            pl.tier = "No projection";
            pl.streakType = "N/A";
            pl.streakCount = 0;
            pl.sportsbooks = {};
        }
    });

    masterPlayers = players;
}

/* Odds panel HTML */
function renderOddsBlock(sportsbooks) {
    if (!sportsbooks || typeof sportsbooks !== "object") {
        return `<div class="oddsBlock">Sportsbook Odds: N/A</div>`;
    }
    const lines = [];
    const dk = sportsbooks.dk ?? null;
    const fd = sportsbooks.fd ?? null;
    const mgm = sportsbooks.mgm ?? null;
    const cz = sportsbooks.cz ?? null;
    const fanatics = sportsbooks.fanatics ?? null;

    if (!dk && !fd && !mgm && !cz && !fanatics) {
        return `<div class="oddsBlock">Sportsbook Odds: N/A</div>`;
    }

    if (dk !== null) lines.push(`DK: ${dk}`);
    if (fd !== null) lines.push(`FD: ${fd}`);
    if (mgm !== null) lines.push(`MGM: ${mgm}`);
    if (cz !== null) lines.push(`CZ: ${cz}`);
    if (fanatics !== null) lines.push(`Fanatics: ${fanatics}`);

    return `
        <div class="oddsBlock">
            <div>Sportsbook Odds:</div>
            <div>${lines.join("<br>")}</div>
        </div>
    `;
}

/* ------------------------------
   DATA LOAD
--------------------------------*/
async function loadData() {
    try {
        const dateParam = `?date=${formatDate(currentDate)}`;

        const [signalsRes, gamesRes, accuracyRes] = await Promise.all([
            fetch("https://nexari.jardelterry.workers.dev/signals" + dateParam),
            fetch("https://nexari.jardelterry.workers.dev/games" + dateParam),
            fetch("https://nexari.jardelterry.workers.dev/accuracy")
        ]);

        const signalsJson = await signalsRes.json();
        const gamesJson = await gamesRes.json();
        const accuracyJson = await accuracyRes.json();

        signalsData = signalsJson.signals || [];
        gamesData = gamesJson.games || [];
        accuracyData = accuracyJson.accuracy || {};

        const dateLabel = document.getElementById("currentDateLabel");
        if (dateLabel) dateLabel.textContent = formatDate(currentDate);

        buildMasterPlayers();   // roster patch
        loadSignals();
        loadGames();
        loadAccuracy();
        runSearch();
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

/* EDGE SWIPE NAVIGATION */
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
   HR SIGNALS (from masterPlayers)
--------------------------------*/
const hrViewSelect = document.getElementById("hrViewSelect");

function loadSignals() {
    const container = document.getElementById("signalsContainer");
    if (!container) return;
    container.innerHTML = "";

    let data = Array.isArray(masterPlayers) ? [...masterPlayers] : [];
    data.sort((a, b) => (b.hr || 0) - (a.hr || 0));
    data = data.slice(0, hrLimit);

    data.forEach(p => {
        const div = document.createElement("div");
        div.className = "signal";

        if (p.tier === "Strong") div.style.borderLeft = "4px solid #ff4444";
        else if (p.tier === "Playable") div.style.borderLeft = "4px solid #ffaa00";
        else div.style.borderLeft = "4px solid #777";

        const name = safeName(p.player, p.cachedPlayer);
        const hr = p.hr || 0;
        const tier = p.tier || "Tier";
        const streakType = p.streakType || "N/A";
        const streakCount = p.streakCount || 0;

        div.innerHTML = `
            <div class="name">${name} — ${hr}% (${hr === 0 ? "No projection" : tier})</div>
            <div class="meta">
                ${p.team || ""} vs ${p.opponent || ""}<br>
                Streak: ${streakType} (${streakCount})
            </div>
            ${renderOddsBlock(p.sportsbooks)}
            <div class="hrBar" style="width:0%;" data-target="${hr}"></div>
        `;
        container.appendChild(div);
    });

    setTimeout(() => {
        container.querySelectorAll(".hrBar").forEach(bar => {
            bar.style.width = bar.dataset.target + "%";
        });
    }, 50);
}

if (hrViewSelect) {
    hrViewSelect.addEventListener("change", () => {
        hrLimit = Number(hrViewSelect.value);
        loadSignals();
    });
}

/* ------------------------------
   GAMES
--------------------------------*/
function loadGames() {
    const container = document.getElementById("gamesContainer");
    if (!container) return;
    container.innerHTML = "";

    const data = Array.isArray(gamesData) ? gamesData : [];

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
   CALENDAR
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
   SPARKLINE
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
   ACCURACY
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

    const data = accuracyData || {
        percent: 0,
        systemStreak: 0,
        playerStreak: 0,
        outcomes: [],
        missed: [],
        history7: [],
        history30: []
    };

    const hits = (data.outcomes || []).length;
    const misses = (data.missed || []).length;
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

    (data.outcomes || []).forEach(o => {
        if (tierCounts[o.tier]) tierCounts[o.tier].hit++;
    });
    (data.missed || []).forEach(m => {
        if (tierCounts[m.tier]) tierCounts[m.tier].miss++;
    });

    if (deepBreakdown) {
        deepBreakdown.textContent =
            `Strong: ${tierCounts.Strong.hit}/${tierCounts.Strong.hit + tierCounts.Strong.miss} • ` +
            `Playable: ${tierCounts.Playable.hit}/${tierCounts.Playable.hit + tierCounts.Playable.miss} • ` +
            `Watch: ${tierCounts.Watch.hit}/${tierCounts.Watch.hit + tierCounts.Watch.miss}`;
    }

    const teamStats = {};
    (data.outcomes || []).forEach(o => {
        if (!teamStats[o.team]) teamStats[o.team] = {hit:0, miss:0};
        teamStats[o.team].hit++;
    });
    (data.missed || []).forEach(m => {
        if (!teamStats[m.team]) teamStats[m.team] = {hit:0, miss:0};
        teamStats[m.team].miss++;
    });

    const topTeams = Object.entries(teamStats)
        .map(([team, s]) => ({team, acc: Math.round((s.hit/(s.hit+s.miss))*100)}))
        .sort((a,b) => b.acc - a.acc)
        .slice(0,5);

    if (deepTeams) deepTeams.textContent = topTeams.map(t => `${t.team} ${t.acc}%`).join(" • ");

    const playerStats = {};
    (data.outcomes || []).forEach(o => {
        if (!playerStats[o.player]) playerStats[o.player] = {hit:0, miss:0};
        playerStats[o.player].hit++;
    });
    (data.missed || []).forEach(m => {
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
   SEARCH TAB (full roster)
--------------------------------*/
const searchInput = document.getElementById("playerSearchInput");
const searchResults = document.getElementById("searchResults");

function runSearch() {
    if (!searchInput || !searchResults) return;
    const q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";

    let data = Array.isArray(masterPlayers) ? [...masterPlayers] : [];

    if (q) {
        data = data.filter(p => {
            const name = (p.player || "").toLowerCase();
            const team = (p.team || "").toLowerCase();
            const opp = (p.opponent || "").toLowerCase();
            return name.includes(q) || team.includes(q) || opp.includes(q);
        });
    }

    // sort by HR probability desc
    data.sort((a, b) => (b.hr || 0) - (a.hr || 0));

    data.forEach(p => {
        const div = document.createElement("div");
        div.className = "searchResult";

        const name = safeName(p.player, p.cachedPlayer);
        const hr = p.hr || 0;
        const tier = p.tier || "Tier";
        const streakType = p.streakType || "N/A";
        const streakCount = p.streakCount || 0;

        div.innerHTML = `
            <div class="name">${name} — ${hr}% (${hr === 0 ? "No projection" : tier})</div>
            <div class="meta">
                ${p.team || ""} vs ${p.opponent || ""}<br>
                Streak: ${streakType} (${streakCount})
            </div>
            ${renderOddsBlock(p.sportsbooks)}
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
   SPORTSBOOK DROPDOWNS (sync)
--------------------------------*/
const sportsbookSelects = document.querySelectorAll(".sportsbookSelect");

function applyBookSelection(book) {
    selectedBook = book;
    // Future: book-specific behavior can hook here.
    loadSignals();
    runSearch();
}

sportsbookSelects.forEach(sel => {
    sel.value = selectedBook;
    sel.addEventListener("change", e => {
        sportsbookSelects.forEach(s => s.value = e.target.value);
        applyBookSelection(e.target.value);
    });
});

/* ------------------------------
   SETTINGS
--------------------------------*/
const deviceModeSelect = document.getElementById("deviceModeSelect");
const fontSizeSlider = document.getElementById("fontSizeSlider");
const autoRefreshSelect = document.getElementById("autoRefreshSelect");
const forceRebuildBtn = document.getElementById("forceRebuildBtn");
const clearCacheBtn = document.getElementById("clearCacheBtn");
const themeToggle = document.getElementById("themeToggle");
const iconSizeSlider = document.getElementById("iconSizeSlider");

/* Dynamic Icon System */
function applyDynamicIconSize(size) {
    const s = Number(size) || 58;

    // Icon size
    document.documentElement.style.setProperty("--icon-size", s + "px");

    // Nav height scales with icon size
    const navHeight = Math.round(s * 1.65);
    document.documentElement.style.setProperty("--nav-height", navHeight + "px");

    // Glow intensity soft-cap curve
    let glow = Math.round((s - 40) * 0.55);
    if (glow < 6) glow = 6;
    if (glow > 22) glow = 22;
    document.documentElement.style.setProperty("--glow-size", glow + "px");
}

if (iconSizeSlider) {
    const savedIconSize = localStorage.getItem("iconSize");
    if (savedIconSize) {
        iconSizeSlider.value = savedIconSize;
        applyDynamicIconSize(savedIconSize);
    } else {
        applyDynamicIconSize(iconSizeSlider.value);
    }

    iconSizeSlider.oninput = e => {
        const size = e.target.value;
        applyDynamicIconSize(size);
        localStorage.setItem("iconSize", size);
    };
}

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
        signalsData = [];
        gamesData = [];
        accuracyData = {};
        masterPlayers = [];
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
