const WORKER = "https://nexari.jardelterry.workers.dev";

let lastSignals = [];
let lastGames = [];

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initAccent();
  initDeviceMode();
  initNavigation();
  initSystemControls();
  wireDetailBackButtons();
  loadSignals();
  loadGames();
  loadAccuracy();
  updateAboutSection();
  applyLayoutMode();
  window.addEventListener("resize", applyLayoutMode);
});

/* THEME / ACCENT / DEVICE MODE */

function initTheme() {
  const mode = localStorage.getItem("themeMode") || "dark";
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(mode === "light" ? "theme-light" : "theme-dark");

  const sel = document.getElementById("themeMode");
  if (sel) {
    sel.value = mode;
    sel.onchange = e => {
      localStorage.setItem("themeMode", e.target.value);
      initTheme();
    };
  }
}

function initAccent() {
  const accent = localStorage.getItem("accentColor") || "blue";
  document.body.classList.remove("accent-blue", "accent-purple", "accent-red", "accent-gold");
  document.body.classList.add(`accent-${accent}`);

  const sel = document.getElementById("accentColor");
  if (sel) {
    sel.value = accent;
    sel.onchange = e => {
      localStorage.setItem("accentColor", e.target.value);
      initAccent();
    };
  }
}

function initDeviceMode() {
  const mode = localStorage.getItem("deviceMode") || "auto";
  const sel = document.getElementById("deviceMode");
  if (sel) {
    sel.value = mode;
    sel.onchange = e => {
      localStorage.setItem("deviceMode", e.target.value);
      applyLayoutMode();
    };
  }
}

function getEffectiveMode() {
  const override = localStorage.getItem("deviceMode") || "auto";
  if (override !== "auto") return override;

  const w = window.innerWidth;
  if (w >= 1200) return "desktop";
  if (w >= 900) return "adaptive";
  return "mobile";
}

function applyLayoutMode() {
  const mode = getEffectiveMode();
  const bottomNav = document.getElementById("bottomNav");
  const desktopRight = document.getElementById("desktopRight");
  const detailBack = document.getElementById("detailBack");

  if (mode === "desktop") {
    if (bottomNav) bottomNav.style.display = "none";
    if (desktopRight) desktopRight.style.display = "block";
    if (detailBack) detailBack.classList.add("hidden");
  } else if (mode === "adaptive") {
    if (bottomNav) bottomNav.style.display = "none";
    if (desktopRight) desktopRight.style.display = "block";
    if (detailBack) detailBack.classList.remove("hidden");
  } else {
    if (bottomNav) bottomNav.style.display = "block";
    if (desktopRight) desktopRight.style.display = "none";
  }
}

/* NAVIGATION + SLIDER */

function initNavigation() {
  const buttons = document.querySelectorAll("#bottomNav button");
  const pages = document.querySelectorAll(".page");
  const slider = document.getElementById("navSlider");

  function setActive(index, targetId) {
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById(targetId).classList.add("active");

    buttons.forEach(b => b.classList.remove("active"));
    buttons[index].classList.add("active");

    if (slider) slider.style.transform = `translateX(${index * 100}%)`;
  }

  buttons.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      setActive(idx, target);
    });
  });

  setActive(0, "signalsPage");
}

/* SIGNALS */

async function loadSignals() {
  try {
    const res = await fetch(`${WORKER}/signals`);
    const data = await res.json();

    const container = document.getElementById("signalsContainer");
    container.innerHTML = "";

    if (!data.ok || !data.signals || data.signals.length === 0) {
      container.innerHTML = `<p>No signals available.</p>`;
      return;
    }

    lastSignals = data.signals;
    updateHRTicker(data.signals);

    data.signals.forEach((sig, index) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>⚾ ${sig.player}</h3>
        <p>${sig.team} vs ${sig.opponent}</p>
        <p>Tier: <strong>${sig.tier}</strong></p>
        <p>Score: ${(sig.score * 100).toFixed(1)}%</p>
        <p>Confidence: ${(sig.confidence * 100).toFixed(1)}%</p>
        <div class="conf-bar">
          <div class="conf-fill" style="width:${sig.confidence * 100}%"></div>
        </div>
      `;
      card.onclick = () => openSignalDetail(index);
      container.appendChild(card);
    });

  } catch (err) {
    console.error("Signals error:", err);
    document.getElementById("signalsContainer").innerHTML =
      `<p>Signals error. Check console.</p>`;
  }
}

function updateHRTicker(signals) {
  const ticker = document.getElementById("hrTicker");
  const top = signals[0];
  ticker.textContent =
    `⚾ ${top.player} • ${(top.score * 100).toFixed(1)}% HR • ${top.tier}`;
}

/* SIGNAL DETAIL (desktop + mobile) */

function openSignalDetail(index) {
  const sig = lastSignals[index];
  if (!sig) return;

  const mode = getEffectiveMode();

  const tickerLine =
    `⚾ ${sig.player} • ${(sig.score * 100).toFixed(1)}% HR • ${sig.tier}`;

  if (mode === "desktop" || mode === "adaptive") {
    const title = document.getElementById("detailTitle");
    const body = document.getElementById("detailBody");
    if (title) title.textContent = tickerLine;
    if (body) {
      body.innerHTML = `
        <p>${sig.team} vs ${sig.opponent}</p>
        <p>Score: ${(sig.score * 100).toFixed(1)}%</p>
        <p>Confidence: ${(sig.confidence * 100).toFixed(1)}%</p>
        <p>Tier: ${sig.tier}</p>
        <p>Streak: ${sig.streak} games</p>
      `;
    }
  } else {
    const pages = document.querySelectorAll(".page");
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById("signalDetailPage").classList.add("active");

    const t = document.getElementById("signalDetailTicker");
    const b = document.getElementById("signalDetailBody");
    if (t) t.textContent = tickerLine;
    if (b) {
      b.innerHTML = `
        <p>${sig.team} vs ${sig.opponent}</p>
        <p>Score: ${(sig.score * 100).toFixed(1)}%</p>
        <p>Confidence: ${(sig.confidence * 100).toFixed(1)}%</p>
        <p>Tier: ${sig.tier}</p>
        <p>Streak: ${sig.streak} games</p>
      `;
    }
  }
}

/* GAMES */

async function loadGames() {
  try {
    const res = await fetch(`${WORKER}/games`);
    const data = await res.json();

    const container = document.getElementById("gamesContainer");
    container.innerHTML = "";

    if (!data.ok || !data.games) return;

    lastGames = data.games;

    data.games.forEach((g, index) => {
      const localTime = new Date(g.time).toLocaleString(undefined, {
        hour: "numeric",
        minute: "2-digit"
      });

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${g.homeName} vs ${g.awayName}</h3>
        <p>${localTime}</p>
        <p>Status: ${g.status}</p>
        ${g.isLive ? `<div class="live-ring"></div>` : ""}
      `;
      card.onclick = () => openGameDetail(index);
      container.appendChild(card);
    });

  } catch (err) {
    console.error("Games error:", err);
  }
}

function openGameDetail(index) {
  const g = lastGames[index];
  if (!g) return;

  const mode = getEffectiveMode();
  const localTime = new Date(g.time).toLocaleString();
  const tickerLine = `${g.homeName} vs ${g.awayName}`;

  if (mode === "desktop" || mode === "adaptive") {
    const title = document.getElementById("detailTitle");
    const body = document.getElementById("detailBody");
    if (title) title.textContent = tickerLine;
    if (body) {
      body.innerHTML = `
        <p>Time: ${localTime}</p>
        <p>Status: ${g.status}</p>
      `;
    }
  } else {
    const pages = document.querySelectorAll(".page");
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById("gameDetailPage").classList.add("active");

    const t = document.getElementById("gameDetailTicker");
    const b = document.getElementById("gameDetailBody");
    if (t) t.textContent = tickerLine;
    if (b) {
      b.innerHTML = `
        <p>Time: ${localTime}</p>
        <p>Status: ${g.status}</p>
      `;
    }
  }
}

/* DETAIL BACK BUTTONS (mobile) */

function wireDetailBackButtons() {
  const backSignals = document.getElementById("backToSignals");
  if (backSignals) {
    backSignals.onclick = () => {
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      document.getElementById("signalsPage").classList.add("active");
    };
  }

  const backGames = document.getElementById("backToGames");
  if (backGames) {
    backGames.onclick = () => {
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      document.getElementById("gamesPage").classList.add("active");
    };
  }

  const detailBack = document.getElementById("detailBack");
  if (detailBack) {
    detailBack.onclick = () => {
      const title = document.getElementById("detailTitle");
      const body = document.getElementById("detailBody");
      if (title) title.textContent = "";
      if (body) body.innerHTML = "";
    };
  }
}

/* ACCURACY */

async function loadAccuracy() {
  try {
    const res = await fetch(`${WORKER}/accuracy`);
    const data = await res.json();

    const container = document.getElementById("accuracyContainer");
    container.innerHTML = "";

    if (!data.ok || !data.accuracy) return;

    const acc = data.accuracy;

    container.innerHTML = `
      <div class="card">
        <h3>Overall Hit Rate</h3>
        <p>${(acc.overallHitRate * 100).toFixed(1)}%</p>
      </div>
      <div class="card">
        <h3>Streaks</h3>
        <p>HR Streak: ${acc.hrStreak} games</p>
        <p>RBI Streak: ${acc.rbiStreak} games</p>
      </div>
    `;
  } catch (err) {
    console.error("Accuracy error:", err);
  }
}

/* SYSTEM CONTROLS */

function initSystemControls() {
  const forceRefresh = document.getElementById("forceRefresh");
  const clearCacheBtn = document.getElementById("clearCache");
  const rebuildEngine = document.getElementById("rebuildEngine");
  const reloadUI = document.getElementById("reloadUI");

  if (forceRefresh) {
    forceRefresh.onclick = () => {
      loadSignals();
      loadGames();
      loadAccuracy();
    };
  }

  if (clearCacheBtn) {
    clearCacheBtn.onclick = async () => {
      if ("caches" in window) {
        const names = await caches.keys();
        for (const n of names) await caches.delete(n);
      }
      alert("Cache cleared.");
    };
  }

  if (rebuildEngine) {
    rebuildEngine.onclick = async () => {
      await fetch(`${WORKER}/rebuild`);
      alert("Engine rebuild triggered.");
    };
  }

  if (reloadUI) {
    reloadUI.onclick = () => {
      location.reload(true);
    };
  }

  const devOut = document.getElementById("devOutput");
  const showRaw = document.getElementById("showRawJSON");
  const showInfo = document.getElementById("showWorkerInfo");
  const showCounts = document.getElementById("showCounts");

  if (showRaw) {
    showRaw.onclick = async () => {
      const res = await fetch(`${WORKER}/debug`);
      const data = await res.json();
      devOut.textContent = JSON.stringify(data, null, 2);
    };
  }

  if (showInfo) {
    showInfo.onclick = async () => {
      const res = await fetch(`${WORKER}/debug`);
      const data = await res.json();
      devOut.textContent =
        `Version: ${data.version}\nGenerated: ${data.generatedAt}`;
    };
  }

  if (showCounts) {
    showCounts.onclick = async () => {
      const res = await fetch(`${WORKER}/debug`);
      const data = await res.json();
      devOut.textContent =
        `Signals: ${data.signals}\nGames: ${data.games}`;
    };
  }
}

/* ABOUT */

function updateAboutSection() {
  const build = document.getElementById("aboutBuild");
  const worker = document.getElementById("aboutWorker");
  if (build) build.textContent = new Date().toLocaleString();
  if (worker) worker.textContent = WORKER;
}
