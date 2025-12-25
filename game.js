(() => {
  const TARGET_SCORE = 30;
  const START_LIVES = 2;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const startScreen = document.getElementById("startScreen");
  const winScreen = document.getElementById("winScreen");
  const loseScreen = document.getElementById("loseScreen");

  const startBtn = document.getElementById("startBtn");
  const playAgainBtnWin = document.getElementById("playAgainBtnWin");
  const playAgainBtnLose = document.getElementById("playAgainBtnLose");

  const closeBtnWin = document.getElementById("closeBtnWin");
  const closeBtnLose = document.getElementById("closeBtnLose");

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const winText = document.getElementById("winText");

  // Telegram WebApp (если открыли внутри Telegram)
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const state = {
    mode: "start", // start | play | win | lose
    score: 0,
    lives: START_LIVES,
    lastTime: 0,
    spawnTimer: 0,
    balls: [],
    pointerX: W / 2,
    usePointer: false,
    running: false,
  };

  const santa = {
    x: W / 2,
    y: H - 120,
    r: 34,
    vx: 0,
    speed: 0.18,
  };

  function setMode(mode) {
    state.mode = mode;

    startScreen.classList.toggle("hidden", mode !== "start");
    startScreen.classList.toggle("active", mode === "start");

    winScreen.classList.toggle("hidden", mode !== "win");
    winScreen.classList.toggle("active", mode === "win");

    loseScreen.classList.toggle("hidden", mode !== "lose");
    loseScreen.classList.toggle("active", mode === "lose");
  }

  function resetGame() {
    state.score = 0;
    state.lives = START_LIVES;
    state.balls = [];
    state.spawnTimer = 0;
    state.lastTime = performance.now();
    scoreEl.textContent = String(state.score);
    livesEl.textContent = String(state.lives);

    santa.x = W / 2;
    santa.y = H - 120;
    santa.vx = 0;

    state.pointerX = W / 2;
    state.usePointer = false;

    winText.textContent = "";
  }

  function closeApp() {
    if (tg) tg.close();
    else window.close();
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function spawnBall() {
    const r = rand(12, 18);
    const x = rand(r + 10, W - r - 10);
    const y = -r - 10;

    // скорость растёт с очками
    const base = 190 + state.score * 14; // px/sec
    const vy = rand(base, base + 90);

    state.balls.push({ x, y, r, vy });
  }

  function spawnIntervalMs() {
    // чем больше очков — тем чаще шары
    // от ~900мс в начале до ~220мс ближе к 30 очкам
    return Math.max(220, 900 - state.score * 23);
  }

  function update(dt) {
    if (state.mode !== "play") return;

    // Спавн шаров
    state.spawnTimer += dt * 1000;
    const interval = spawnIntervalMs();
    while (state.spawnTimer >= interval) {
      state.spawnTimer -= interval;
      spawnBall();
    }

    // Управление Санта
    // Если ведём пальцем/мышкой — двигаемся к pointerX
    // Иначе стрелками — santa.vx изменяется
    if (state.usePointer) {
      const dx = state.pointerX - santa.x;
      santa.x += dx * Math.min(1, dt * 10);
    } else {
      santa.x += santa.vx * dt;
    }
    santa.x = Math.max(santa.r + 10, Math.min(W - santa.r - 10, santa.x));
    santa.y = H - 120;

    // Двигаем шары + коллизии
    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.y += b.vy * dt;

      // Поймал?
      const dx = b.x - santa.x;
      const dy = b.y - santa.y;
      const dist2 = dx * dx + dy * dy;
      const rr = (b.r + santa.r) * (b.r + santa.r);

      if (dist2 <= rr) {
        state.balls.splice(i, 1);
        state.score += 1;
        scoreEl.textContent = String(state.score);

        if (state.score >= TARGET_SCORE) {
          winText.textContent =
            "Yana, с праздником! 🎄✨\n\nТы умница! Посмотри под ёлку 😉";
          setMode("win");
        }
        continue;
      }

      // Пропустил?
      if (b.y - b.r > H + 10) {
        state.balls.splice(i, 1);
        state.lives -= 1;
        livesEl.textContent = String(state.lives);

        if (state.lives <= 0) {
          setMode("lose");
        }
      }
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1020");
    g.addColorStop(1, "#071022");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // лёгкие "звёзды"
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 35; i++) {
      const x = (i * 97) % W;
      const y = (i * 53) % H;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawSanta() {
    // Санта как emoji
    ctx.font = "64px system-ui, Apple Color Emoji, Segoe UI Emoji";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎅", santa.x, santa.y);
  }

  function drawBalls() {
    for (const b of state.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();

      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    drawBackground();

    // В start/win/lose можно не рисовать физику, но красиво — рисуем всё равно
    drawBalls();
    drawSanta();
  }

  function loop(t) {
    if (!state.running) return;

    const dt = Math.min(0.033, (t - state.lastTime) / 1000);
    state.lastTime = t;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  function startGame() {
    resetGame();
    setMode("play");
  }

  function startLoopIfNeeded() {
    if (state.running) return;
    state.running = true;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // --- INPUT ---
  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    state.pointerX = (e.clientX - rect.left);
    state.usePointer = true;
  }

  canvas.addEventListener("pointerdown", (e) => {
    setPointerFromEvent(e);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pressure === 0 && e.buttons === 0) return;
    setPointerFromEvent(e);
  });

  window.addEventListener("keydown", (e) => {
    if (state.mode !== "play") return;

    if (e.key === "ArrowLeft") santa.vx = -420;
    if (e.key === "ArrowRight") santa.vx = 420;
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" && santa.vx < 0) santa.vx = 0;
    if (e.key === "ArrowRight" && santa.vx > 0) santa.vx = 0;
  });

  // --- UI BUTTONS ---
  startBtn.addEventListener("click", () => {
    startLoopIfNeeded();
    startGame();
  });

  playAgainBtnWin.addEventListener("click", () => {
    startLoopIfNeeded();
    startGame();
  });

  playAgainBtnLose.addEventListener("click", () => {
    startLoopIfNeeded();
    startGame();
  });

  closeBtnWin.addEventListener("click", closeApp);
  closeBtnLose.addEventListener("click", closeApp);

  // Инициализация
  resetGame();
  setMode("start");
  startLoopIfNeeded();
})();
