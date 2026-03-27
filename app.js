const WORKER = "https://nexari-auto.jardelterry.workers.dev";

// state
let signals = [];
let games = [];
let accuracy = null;
let currentDate = new Date();

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initSystem();
  initGamesClicker();
  updateAbout();

  loadSignals();
  loadGames();
  loadAccuracy();
});

/* UTILITIES -------------------------------------------------- */

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

/* NAV -------------------------------------------------- */

function initNav() {
  const buttons = document.querySelectorAll("#navButtons button");
  const pages = document.querySelectorAll(".page");
  const slider = document.getElementById("navSlider");

  function setActive(idx, targetId) {
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById(targetId).classList.add("active");

    buttons.forEach(b => b.classList.remove("active"));
    buttons[idx].classList.add("active");

    slider.style.transform = `translateX(${idx * 100}%)`;
  }

  buttons.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      setActive(idx, btn.dataset.target);
    });
  });

  setActive(0, "signalsPage");
}

/* SYSTEM -------------------------------------------------- */

function initSystem() {
  const themeSel = document.getElementById("themeMode");
  const compatSel = document.getElementById("compatMode");

  const savedTheme = localStorage.getItem("themeMode") || "dark";
  const savedCompat = localStorage.getItem("compatMode") || "v66";

  themeSel.value = savedTheme;
  compatSel.value = savedCompat;

  applyTheme(savedTheme);
  applyCompatMode(savedCompat);

  themeSel.onchange = e => {
    localStorage.setItem("themeMode", e.target.value);
    applyTheme(e.target.value);
  };

  compatSel.onchange = e => {
    localStorage.setItem("compatMode", e.target.value);
    applyCompatMode(e.target.value);
  };

  document.getElementById("btnRefresh").onclick = () => {
    loadSignals();
    loadGames();
    loadAccuracy();
  };

  document.getElementById("btnRebuild").onclick = async () => {
    await fetch(`${WORKER}/rebuild`);
    alert("Engine rebuild triggered.");
  };

  document.getElementById("btnDebug").onclick = async () => {
    const out = document.getElementById("debugOutput");
    const res = await fetch(`${WORKER}/debug`);
    out.textContent = JSON.stringify(await res.json(), null, 2);
  };
}

function applyTheme(mode) {
  document.body.style.background = mode === "light" ? "#f9fafb" : "#05070b";
  document.body.style.color = mode === "light" ? "#111827" : "#f3f4f6";
}

function applyCompatMode(mode) {
  document.body.dataset.compat = mode;
}

function updateAbout() {
  document.getElementById("aboutBuild").textContent = new Date().toLocaleString();
  document.getElementById("aboutWorker").textContent = WORKER;
}

/* SIGNALS -------------------------------------------------- */

async function loadSignals() {
  const res = await fetch(`${WORKER}/signals`);
  const data = await res.json();
  if (!data.ok) return;

  signals = data.signals;
  renderSignals();
  updateTicker();
}

function renderSignals() {
  const container = document.getElementById("signalsList");
  container.innerHTML = "";

  signals.forEach(sig => {
    const div = document.createElement("div");
    div.className = "signal-entry";

    div.innerHTML = `
      <div class="signal-line-main">⚾ ${sig.playerName} • ${(sig.score * 100).toFixed(1)}% HR • ${sig.tier}</div>
      <div class="signal-line-sub">${sig.teamName} vs ${sig.opponentName}</div>
      <div class="signal-line-streak">Streak: ${sig.streak} games</div>
    `;

    container.appendChild(div);
  });
}

function updateTicker() {
  if (!signals.length) return;
  const top = signals[0];
  document.getElementById("hrTicker").textContent =
    `⚾ ${top.playerName} • ${(top.score * 100).toFixed(1)}% HR • ${top.tier}`;
}

/* GAMES -------------------------------------------------- */

function initGamesClicker() {
  document.getElementById("gamesPrev").onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    updateGamesDateLabel();
    loadGames();
  };

  document.getElementById("gamesNext").onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    updateGamesDateLabel();
    loadGames();
  };

  updateGamesDateLabel();
}

function updateGamesDateLabel() {
  document.getElementById("gamesDateLabel").textContent = formatDateLabel(currentDate);
}

async function loadGames() {
  const iso = formatISODate(currentDate);
  const res = await fetch(`${WORKER}/games?date=${iso}`);
  const data = await res.json();
  if (!data.ok) return;

  games = data.games;
  renderGames();
}

function renderGames() {
  const container = document.getElementById("gamesList");
  container.innerHTML = "";

  games.forEach(g => {
    const timeStr = new Date(g.time).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });

    const div = document.createElement("div");
    div.className = "game-entry";

    div.innerHTML = `
      <div class="game-line-main">${g.homeName} vs ${g.awayName}</div>
      <div class="game-line-sub">${g.isLive ? "LIVE • " : ""}${timeStr}</div>
    `;

    container.appendChild(div);
  });
}

/* ACCURACY -------------------------------------------------- */

async function loadAccuracy() {
  const res = await fetch(`${WORKER}/accuracy`);
  const data = await res.json();
  if (!data.ok) return;

  accuracy = data.accuracy;
  renderAccuracy();
}

function renderAccuracy() {
  if (!accuracy) return;

  document.getElementById("overallHitRate").textContent =
    `${(accuracy.overallHitRate * 100).toFixed(1)}%`;

  document.getElementById("systemHrStreak").textContent =
    `HR Prediction Streak: ${accuracy.hrStreak} games`;

  document.getElementById("systemRbiStreak").textContent =
    `RBI Prediction Streak: ${accuracy.rbiStreak} games`;

  const top = signals[0];
  if (top) {
    document.getElementById("playerHitStreak").textContent =
      `Hit Streak: ${top.streak} games`;

    document.getElementById("playerRbiStreak").text