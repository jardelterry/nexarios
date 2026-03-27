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

    const data = Array.isArray(window.gamesData