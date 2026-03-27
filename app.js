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
   PLAYER NAME PROTECTION
--------------------------------*/
function safeName(name) {
    if (!name || name.trim() === "" || name === "Unknown") return "Player";
    return name;
}

/* ------------------------------
   HR SIGNALS (with streak type)
--------------------------------*/
function loadSignals() {
    const container = document.getElementById("signalsContainer");
    container.innerHTML = "";

    signalsData.forEach(s => {
        const div = document.createElement("div");
        div.className = "signal";

        div.innerHTML = `
            <div class="name">${safeName(s.player)}</div>
            <div class="meta">
                ${s.team} vs ${s.opponent} • ${s.hr}% • ${s.tier}<br>
                <span class="streak">Streak: ${s.streakType} (${s.streakCount})</span>
            </div>
        `;

        container.appendChild(div);
    });
}

/* ------------------------------
   GAMES (with players + LIVE + weather)
--------------------------------*/
function loadGames() {
    const container = document.getElementById("gamesContainer");
    container.innerHTML = "";

    gamesData.forEach(g => {
        const div = document.createElement("div");
        div.className = "game";

        div.innerHTML = `
            <div class="title">${g.away} @ ${g.home}</div>
            <div class="weather">
                ${g.live ? "LIVE • " : ""}
                ${g.temp}°F • Wind ${g.wind}mph • ${g.conditions}
            </div>

            <div class="lineup"><strong>${g.away} Lineup:</strong> ${g.awayPlayers.map(safeName).join(", ")}</div>
            <div class="lineup"><strong>${g.home} Lineup:</strong> ${g.homePlayers.map(safeName).join(", ")}</div>
        `;

        container.appendChild(div);
    });
}

/* ------------------------------
   ACCURACY
--------------------------------*/
function loadAccuracy() {
    const container = document.getElementById("accuracyContainer");

    container.innerHTML = `
        <div>Accuracy: ${accuracyData.percent}%</div>
        <div>System Streak: ${accuracyData.systemStreak}</div>
        <div>Player Streak: ${accuracyData.playerStreak}</div>
        <br>
        <div>HR Outcomes: ${accuracyData.outcomes.join(", ")}</div>
        <div>Missed HRs: ${accuracyData.missed.join(", ")}</div>
        <div>Unlisted HRs: ${accuracyData.unlisted.join(", ")}</div>
    `;
}

/* ------------------------------
   SYSTEM SETTINGS
--------------------------------*/
document.getElementById("deviceModeSelect").addEventListener("change", e => {
    document.body.dataset.device = e.target.value;
});

/* ------------------------------
   INITIAL LOAD
--------------------------------*/
loadSignals();
loadGames();
loadAccuracy();
