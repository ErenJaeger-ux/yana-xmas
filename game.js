(() => {
  // Telegram WebApp (если открыто в Telegram)
  const tg = window.Telegram?.WebApp;
  try {
    tg?.ready();
    tg?.expand();
  } catch {}

  // startapp параметр из QR: ...?startapp=yana
  const startParam =
    new URLSearchParams(location.search).get("tgWebAppStartParam") ||
    tg?.initDataUnsafe?.start_param ||
    "default";

  // UI элементы
  const screenStart = document.getElementById("screen-start");
  const screenWin = document.getElementById("screen-win");
  const screenLose = document.getElementById("screen-lose");
  const hud = document.getElementById("screen-hud");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");

  const btnStart = document.getElementById("btn-start");
  const btnAgainWin = document.getElementById("btn-again-win");
  const btnAgainLose = document.getElementById("btn-again-lose");
  const btnClose = document.getElementById("btn-close");
  const btnClose2 = document.getElementById("btn-close-2");

  btnClose.addEventListener("click", () => tg?.close?.());
  btnClose2.addEventListener("click", () => tg?.close?.());

  // Canvas setup
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const state = {
    running: false,
    score: 0,
    lives: 2,
    time: 0,
    lastTs: 0,
    spawnTimer: 0,
    balls: [],
    snow: [],
    targetScore: 30,
  };

  // Player (Дед Мороз как прямоугольник)
  const player = {
    x: 0,
    y: 0,
    w: 90,
    h: 38,
    speed: 900,
  };

  function resize() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    player.y = window.innerHeight - 70;
    player.x = (window.innerWidth - player.w) / 2;

    // снег
    state.snow = Array.from({ length: 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1 + Math.random() * 2.2,
      vy: 25 + Math.random() * 65,
    }));
  }
  window.addEventListener("resize", resize);
  resize();

  // Управление: пальцем/мышью по X
  let pointerDown = false;
  function setPlayerX(clientX) {
    player.x = clientX - player.w / 2;
    player.x = Math.max(8, Math.min(window.innerWidth - player.w - 8, player.x));
  }
  window.addEventListener("pointerdown", (e) => { pointerDown = true; setPlayerX(e.clientX); });
  window.addEventListener("pointermove", (e) => { if (pointerDown) setPlayerX(e.clientX); });
  window.addEventListener("pointerup", () => { pointerDown = false; });
  window.addEventListener("pointercancel", () => { pointerDown = false; });

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
  function showStart() {
    screenStart.classList.add("active");
    show(screenStart);
    hide(hud); hide(screenWin); hide(screenLose);
  }
  function showHUD() {
    hide(screenStart); hide(screenWin); hide(screenLose);
    show(hud);
  }
  function showWin() {
    state.running = false;
    hide(hud); hide(screenStart); hide(screenLose);
    show(screenWin);
  }
  function showLose() {
    state.running = false;
    hide(hud); hide(screenStart); hide(screenWin);
    show(screenLose);
  }

  function resetGame() {
    state.score = 0;
    state.lives = 2;
    state.time = 0;
    state.spawnTimer = 0;
    state.balls = [];
    scoreEl.textContent = String(state.score);
    livesEl.textContent = String(state.lives);
    player.x = (window.innerWidth - player.w) / 2;
  }

  function startGame() {
    resetGame();
    showHUD();
    state.running = true;
    state.lastTs = performance.now();
    requestAnimationFrame(loop);
  }

  btnStart.addEventListener("click", startGame);
  btnAgainWin.addEventListener("click", startGame);
  btnAgainLose.addEventListener("click", startGame);

  // Шары
  function spawnBall() {
    // сложность: частота и скорость растут со временем
    const t = state.time;
    const baseVy = 180 + Math.min(260, t * 10);   // скорость падения
    const radius = 14 + Math.random() * 10;
    const x = radius + Math.random() * (window.innerWidth - radius * 2);

    // небольшой шанс “золотого”
    const isGold = Math.random() < 0.07;

    state.balls.push({
      x, y: -radius - 10,
      r: radius,
      vy: baseVy + Math.random() * 90,
      gold: isGold
    });
  }

  function collideBallWithPlayer(ball) {
    // Простая проверка: круг (шар) vs прямоугольник (дед)
    const rx = player.x, ry = player.y, rw = player.w, rh = player.h;
    const cx = ball.x, cy = ball.y, cr = ball.r;

    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= cr * cr;
  }

  function update(dt) {
    state.time += dt;

    // спавн: чем больше time, тем чаще (но ограничим)
    const spawnInterval = Math.max(0.28, 0.85 - state.time * 0.02);
    state.spawnTimer += dt;
    while (state.spawnTimer >= spawnInterval) {
      state.spawnTimer -= spawnInterval;
      spawnBall();
    }

    // снег
    for (const s of state.snow) {
      s.y += s.vy * dt;
      if (s.y > window.innerHeight + 10) {
        s.y = -10;
        s.x = Math.random() * window.innerWidth;
      }
    }

    // шары
    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.y += b.vy * dt;

      // поймал
      if (collideBallWithPlayer(b)) {
        state.balls.splice(i, 1);

        const add = b.gold ? 3 : 1; // золотой быстрее ведёт к 30
        state.score += add;
        scoreEl.textContent = String(state.score);

        if (state.score >= state.targetScore) {
          // Тут твоя персонализация под startapp
          // Если startapp != yana, можно показывать другой текст (потом расширим)
          showWin();
          return;
        }
        continue;
      }

      // пропустил
      if (b.y - b.r > window.innerHeight + 5) {
        state.balls.splice(i, 1);
        state.lives -= 1;
        livesEl.textContent = String(state.lives);

        if (state.lives <= 0) {
          showLose();
          return;
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // фон
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // снег
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const s of state.snow) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // “ёлочные огни” сверху (простенько)
    ctx.globalAlpha = 0.6;
    for (let x = 20; x < window.innerWidth; x += 40) {
      ctx.beginPath();
      ctx.arc(x, 18, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // дед мороз (прямоугольник)
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    // “шапка”
    ctx.fillStyle = "rgba(255,80,80,0.95)";
    ctx.fillRect(player.x, player.y, player.w, 12);

    // шары
    for (const b of state.balls) {
      ctx.fillStyle = b.gold ? "rgba(255,215,0,0.95)" : "rgba(120,200,255,0.95)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // подсказка управления
    if (state.running && state.time < 3) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "16px system-ui";
      ctx.fillText("Веди пальцем/мышью, чтобы двигать Деда Мороза", 14, window.innerHeight - 18);
    }
  }

  function loop(ts) {
    if (!state.running) return;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    update(dt);
    draw();

    if (state.running) requestAnimationFrame(loop);
  }

  // стартовый экран
  showStart();

  // Для отладки
  console.log("startParam:", startParam);
})();
