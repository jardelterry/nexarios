const WORKER = "https://WORKER_URL_HERE";

// state
let signals = [];
let games = [];
let accuracy = null;
let currentDate = new Date(); // for games clicker

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initSystem();
  initGamesClicker();
  updateAbout();

  loadSignals();
  loadGames();
  loadAccuracy();
});

function formatDateLabel(d) {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatISODate(d) {
  return d.toISOString().slice(0, 10);
}

/* NAV + SLIDER */

function initNav() {
  const buttons = document.querySelectorAll("#navButtons button");
  const pages = document.querySelectorAll(".page");
  const slider = document.getElementById("navSlider");

  function setActive(idx, targetId) {
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById(targetId).classList.add("active");

    buttons.forEach(b => b.classList.remove("active"));
    buttons[idx].classList.add("active");

    if (slider) {
      slider.style.transform = `translateX(${idx * 100}%)`;
    }
  }

  buttons.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      setActive(idx, target);
    });
  });

  setActive(0, "signalsPage");
}

/* SYSTEM */

function initSystem() {
  const themeSel = document.getElementById("themeMode");
  const btnRefresh = document.getElementById("btnRefresh");
  const btnRebuild = document.getElementById("btnRebuild");
  const btnDebug = document.getElementById("btnDebug");

  const savedTheme = localStorage.getItem("themeMode") || "dark";
  themeSel.value = savedTheme;
  applyTheme(savedTheme);

  themeSel.onchange = e => {
    localStorage.setItem("themeMode", e.target.value);
    applyTheme(e.target.value);
  };

  if (btnRefresh) {
    btnRefresh.onclick = () => {
      loadSignals();
      loadGames();
      loadAccuracy();
    };
  }

  if (btnRebuild) {
    btnRebuild.onclick = async () => {
      try {
        await fetch(`${WORKER}/rebuild`);
        alert("Engine rebuild triggered.");
      } catch (e) {
        console.error(e);
      }
    };
  }

  if (btnDebug) {
    btnDebug.onclick = async () => {
      const out = document.getElementById("debugOutput");
      try {
        const res = await fetch(`${WORKER}/debug`);
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        out.textContent = "Debug error.";
      }
    };
  }
}

function applyTheme(mode) {
  if (mode === "light") {
    document.body.style.background = "#f9fafb";
    document.body.style.color = "#111827";
  } else {
    document.body.style.background = "#05070b";
    document.body.style.color = "#f3f4f6";
  }
}

function updateAbout() {
  const build = document.getElementById("aboutBuild");
  const worker = document.getElementById("aboutWorker");
  if (build) build.textContent = new Date().toLocaleString();
  if (worker) worker.textContent = WORKER;
}

/* SIGNALS */

async function loadSignals() {
  try {
    const res = await fetch(`${WORKER}/signals`);
    const data = await res.json();
    if (!data.ok || !data.signals) return;

    signals = data.signals;
    renderSignals();
    updateTickerFromTopSignal();
  } catch (e) {
    console.error("Signals error", e);
  }
}

function renderSignals() {
  const container = document.getElementById("signalsList");
  container.innerHTML = "";

  if (!signals.length) {
    container.textContent = "No signals available.";
    return;
  }

  signals.forEach(sig => {
    const div = document.createElement("div");
    div.className = "signal-entry";

    const main = document.createElement("div");
    main.className = "signal-line-main";
    main.textContent =
      `⚾ ${sig.playerName} • ${(sig.score * 100).toFixed(1)}% HR • ${sig.tier}`;

    const sub = document.createElement("div");
    sub.className = "signal-line-sub";
    sub.textContent = `${sig.teamName} vs ${sig.opponentName}`;

    const streak = document.createElement("div");
    streak.className = "signal-line-streak";
    streak.textContent = `Streak: ${sig.streak} games`;

    div.appendChild(main);
    div.appendChild(sub);
    div.appendChild(streak);

    container.appendChild(div);
  });
}

function updateTickerFromTopSignal() {
  const ticker = document.getElementById("hrTicker");
  if (!ticker || !signals.length) return;
  const top = signals[0];
  ticker.textContent =
    `⚾ ${top.playerName} • ${(top.score * 100).toFixed(1)}% HR • ${top.tier}`;
}

/* GAMES + CLICKER */

function initGamesClicker() {
  const prev = document.getElementById("gamesPrev");
  const next = document.getElementById("gamesNext");

  updateGamesDateLabel();

  if (prev) {
    prev.onclick = () => {
      currentDate.setDate(currentDate.getDate() - 1);
      updateGamesDateLabel();
      loadGames();
    };
  }

  if (next) {
    next.onclick = () => {
      currentDate.setDate(currentDate.getDate() + 1);
      updateGamesDateLabel();
      loadGames();
    };
  }
}

function updateGamesDateLabel() {
  const label = document.getElementById("gamesDateLabel");
  if (!label) return;
  label.textContent = formatDateLabel(currentDate); // March 27, 2026
}

async function loadGames() {
  try {
    const iso = formatISODate(currentDate);
    const res = await fetch(`${WORKER}/games?date=${iso}`);
    const data = await res.json();
    if (!data.ok || !data.games) return;

    games = data.games;
    renderGames();
  } catch (e) {
    console.error("Games error", e);
  }
}

function renderGames() {
  const container = document.getElementById("gamesList");
  container.innerHTML = "";

  if (!games.length) {
    container.textContent = "No games for this date.";
    return;
  }

  games.forEach(g => {
    const div = document.createElement("div");
    div.className = "game-entry";

    const main = document.createElement("div");
    main.className = "game-line-main";
    main.textContent = `${g.homeName} vs ${g.awayName}`;

    const sub = document.createElement("div");
    sub.className = "game-line-sub";

    const timeStr = new Date(g.time).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });

    if (g.isLive) {
      sub.textContent = `LIVE • ${timeStr}`;
    } else {
      sub.textContent = timeStr;
    }

    div.appendChild(main);
    div.appendChild(sub);
    container.appendChild(div);
  });
}

/* ACCURACY */

async function loadAccuracy() {
  try {
    const res = await fetch(`${WORKER}/accuracy`);
    const data = await res.json();
    if (!data.ok || !data.accuracy) return;

    accuracy = data.accuracy;
    renderAccuracy();
  } catch (e) {
    console.error("Accuracy error", e);
  }
}

function renderAccuracy() {
  if (!accuracy) return;
  const overall = document.getElementById("overallHitRate");
  const hrLine = document.getElementById("hrStreakLine");
  const rbiLine = document.getElementById("rbiStreakLine");

  if (overall) {
    overall.textContent = `${(accuracy.overallHitRate * 100).toFixed(1)}%`;
  }
  if (hrLine) {
    hrLine.textContent = `HR Streak: ${accuracy.hrStreak} games`;
  }
  if (rbiLine) {
    rbiLine.textContent = `RBI Streak: ${accuracy.rbiStreak} games`;
  }
}
