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

  // UI элементы (используем ID из index.html)
  const screenStart = document.getElementById("startScreen");
  const screenWin = document.getElementById("winScreen");
  const screenLose = document.getElementById("loseScreen");

  const winText = document.getElementById("winText");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");

  const btnStart = document.getElementById("startBtn");
  const btnAgainWin = document.getElementById("playAgainBtnWin");
  const btnAgainLose = document.getElementById("playAgainBtnLose");
  const btnClose = document.getElementById("closeBtnWin");
  const btnClose2 = document.getElementById("closeBtnLose");

  btnClose.addEventListener("click", () => tg?.close?.());
  btnClose2.addEventListener("click", () => tg?.close?.());

  // Canvas setup
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  function resize() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // Игровые данные
  const state = {
    running: false,
    score: 0,
    lives: 2,
    speed: 220, // базовая скорость падения
    spawnEvery: 900, // мс
    lastSpawn: 0,
    lastTs: 0,
    balls: [],
    stars: [],
  };

  const player = {
    x: window.innerWidth / 2 - 26,
    y: window.innerHeight - 120,
    w: 52,
    h: 52,
    speed: 520, // скорость по клавиатуре
  };

  // Картинка "Дед Мороз" (emoji)
  const santaEmoji = "🎅";

  // --- Управление ---
  function setPlayerX(clientX) {
    player.x = clientX - player.w / 2;
    player.x = Math.max(8, Math.min(window.innerWidth - player.w - 8, player.x));
  }

  let activePointerId = null;
  let mouseDown = false;

  // Для тач-устройств и стилусов
  window.addEventListener("pointerdown", (e) => {
    console.log("Pointer down at:", e.clientX, e.clientY);
    activePointerId = e.pointerId;
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    setPlayerX(e.clientX);
    e.preventDefault?.();
  }, { passive: false });

  window.addEventListener("pointermove", (e) => {
    // Двигаем даже если просто водишь пальцем/мышкой
    if (activePointerId === null || e.pointerId === activePointerId) {
      setPlayerX(e.clientX);
    }
    e.preventDefault?.();
  }, { passive: false });

  window.addEventListener("pointerup", (e) => {
    if (e.pointerId === activePointerId) activePointerId = null;
  });
  window.addEventListener("pointercancel", () => {
    activePointerId = null;
  });

  // Для мыши на ПК (дополнительно)
  window.addEventListener("mousedown", (e) => {
    console.log("Mouse down at:", e.clientX, e.clientY);
    mouseDown = true;
    setPlayerX(e.clientX);
  });

  window.addEventListener("mousemove", (e) => {
    if (mouseDown) {
      setPlayerX(e.clientX);
    }
  });

  window.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  // Клавиатура
  let keyDir = 0; // -1 left, +1 right
  window.addEventListener("keydown", (e) => {
    console.log("Key pressed:", e.key);
    if (e.key === "ArrowLeft") keyDir = -1;
    if (e.key === "ArrowRight") keyDir = 1;
  });
  
  window.addEventListener("keyup", (e) => {
    if ((e.key === "ArrowLeft" && keyDir === -1) || (e.key === "ArrowRight" && keyDir === 1)) {
      keyDir = 0;
    }
  });

  // --- UI helpers ---
  function show(el) {
    el?.classList.remove("hidden");
    el?.classList.add("active");
  }
  
  function hide(el) {
    el?.classList.add("hidden");
    el?.classList.remove("active");
  }

  function setHud() {
    scoreEl.textContent = String(state.score);
    livesEl.textContent = String(state.lives);
  }

  // --- Игра ---
  function resetGame() {
    state.running = true;
    state.score = 0;
    state.lives = 2;
    state.speed = 220;
    state.spawnEvery = 900;
    state.lastSpawn = 0;
    state.balls = [];
    setHud();

    // звёзды
    state.stars = [];
    for (let i = 0; i < 90; i++) {
      state.stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2 + 0.4,
        a: Math.random() * 0.6 + 0.15,
      });
    }

    player.x = window.innerWidth / 2 - player.w / 2;
    player.y = window.innerHeight - 120;
  }

  function spawnBall() {
    const r = 18 + Math.random() * 14;
    state.balls.push({
      x: r + Math.random() * (window.innerWidth - 2 * r),
      y: -r - 10,
      r,
      vy: state.speed + Math.random() * 120,
    });
  }

  function circleRectCollide(c, r) {
    const closestX = Math.max(r.x, Math.min(c.x, r.x + r.w));
    const closestY = Math.max(r.y, Math.min(c.y, r.y + r.h));
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    return dx * dx + dy * dy <= c.r * c.r;
  }

  function win() {
    state.running = false;
    hide(screenStart);
    hide(screenLose);
    show(screenWin);

    winText.textContent =
      "Yana, с праздником! 🎄✨\n\nТы набрала 30 очков 🥳\nПосмотри под ёлку 😉";
  }

  function lose() {
    state.running = false;
    hide(screenStart);
    hide(screenWin);
    show(screenLose);
  }

  function update(dt, now) {
    // Движение по клавиатуре (ПК)
    if (keyDir !== 0) {
      player.x += keyDir * player.speed * dt;
      player.x = Math.max(8, Math.min(window.innerWidth - player.w - 8, player.x));
    }

    // спавн шаров
    if (now - state.lastSpawn >= state.spawnEvery) {
      state.lastSpawn = now;
      spawnBall();
    }

    // усложнение
    if (state.score > 0 && state.score % 5 === 0) {
      state.speed = 220 + state.score * 6;
      state.spawnEvery = Math.max(420, 900 - state.score * 10);
    }

    // движение шаров
    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.y += b.vy * dt;

      // поймали
      if (circleRectCollide({ x: b.x, y: b.y, r: b.r }, player)) {
        state.balls.splice(i, 1);
        state.score += 1;
        setHud();
        if (state.score >= 30) win();
        continue;
      }

      // упал вниз
      if (b.y - b.r > window.innerHeight + 40) {
        state.balls.splice(i, 1);
        state.lives -= 1;
        setHud();
        if (state.lives <= 0) lose();
      }
    }
  }

  function draw() {
    // фон
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // звёзды
    for (const s of state.stars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // шары
    for (const b of state.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
    }

    // дед мороз (emoji)
    ctx.font = "52px system-ui, Apple Color Emoji, Segoe UI Emoji";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(santaEmoji, player.x + player.w / 2, player.y + player.h / 2);
  }

  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    if (state.running) update(dt, ts);
    draw();

    requestAnimationFrame(loop);
  }

  // Кнопки
  btnStart.addEventListener("click", () => {
    console.log("Start button clicked");
    hide(screenStart);
    hide(screenWin);
    hide(screenLose);
    resetGame();
  });

  btnAgainWin.addEventListener("click", () => {
    console.log("Play again (win) button clicked");
    hide(screenWin);
    hide(screenLose);
    resetGame();
  });

  btnAgainLose.addEventListener("click", () => {
    console.log("Play again (lose) button clicked");
    hide(screenLose);
    resetGame();
  });

  // init
  hide(screenWin);
  hide(screenLose);
  show(screenStart);
  setHud();

  // Для красоты: показать параметр из QR (если нужно)
  console.log("startapp:", startParam);
  console.log("Game initialized. Test controls in console.");

  requestAnimationFrame(loop);
})();