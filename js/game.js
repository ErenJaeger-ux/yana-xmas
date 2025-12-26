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

  // --- Canvas setup (3 слоя) ---
  const snowCanvas = document.getElementById("snow");
  const snowCtx = snowCanvas.getContext("2d", { alpha: false }); // тут рисуем фон + снег

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: true }); // важно: прозрачный фон, чтобы видеть снег

  const confettiCanvas = document.getElementById("confetti");
  const confettiCtx = confettiCanvas.getContext("2d", { alpha: true });

  function resizeAll() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const c of [snowCanvas, canvas, confettiCanvas]) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = "100vw";
      c.style.height = "100vh";
    }

    snowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    initSnow();
  }
  window.addEventListener("resize", resizeAll);
  resizeAll();

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
    mouseDown = true;
    setPlayerX(e.clientX);
  });

  window.addEventListener("mousemove", (e) => {
    if (mouseDown) setPlayerX(e.clientX);
  });

  window.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  // Клавиатура
  let keyDir = 0; // -1 left, +1 right
  window.addEventListener("keydown", (e) => {
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

  // --- VFX: снег ---
  const snowflakes = [];
  const SNOW_COUNT = 45;

  function makeSnowflake(randomY = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -Math.random() * h,
      r: 1 + Math.random() * 2.5,
      vy: 0.6 + Math.random() * 1.2,
      vx: -0.3 + Math.random() * 0.6,
      drift: Math.random() * Math.PI * 2,
    };
  }

  function initSnow() {
    snowflakes.length = 0;
    for (let i = 0; i < SNOW_COUNT; i++) snowflakes.push(makeSnowflake(true));
  }

  function updateSnow() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const s of snowflakes) {
      s.drift += 0.02;
      s.x += s.vx + Math.sin(s.drift) * 0.3;
      s.y += s.vy;

      if (s.y > h + 10) {
        s.x = Math.random() * w;
        s.y = -10;
      }
      if (s.x < -20) s.x = w + 20;
      if (s.x > w + 20) s.x = -20;
    }
  }

  function drawSnow() {
    // фон
    snowCtx.fillStyle = "#0b1020";
    snowCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // снежинки
    snowCtx.fillStyle = "#fff";
    for (const s of snowflakes) {
      snowCtx.globalAlpha = 0.85;
      snowCtx.beginPath();
      snowCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      snowCtx.fill();
    }
    snowCtx.globalAlpha = 1;
  }

  // --- VFX: частицы при поимке ---
  const particles = [];

  function spawnCatchParticles(x, y) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.5,
        life: 1,
        decay: 0.03 + Math.random() * 0.03,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    ctx.fillStyle = "#fff";
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --- VFX: Popup "+1" при поимке шара ---
  const popups = [];

  function spawnPlusOnePopup(x, y) {
    popups.push({
      x,
      y,
      text: "+1",
      alpha: 1,
      vy: -1.5, // двигается вверх
      life: 60, // кадров жизни
      fontSize: 22,
      color: "#FFD700" // золотой цвет
    });
  }

  function updatePopups() {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.y += p.vy;
      p.vy *= 0.98; // замедление
      p.life -= 1;
      p.alpha = Math.max(0, p.life / 60); // плавное исчезновение (без минуса)
      
      if (p.life <= 0) {
        popups.splice(i, 1);
      }
    }
  }

  function drawPopups() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const p of popups) {
    ctx.font = `bold ${p.fontSize}px system-ui, Arial`;

    // тень (сначала)
    ctx.globalAlpha = p.alpha * 0.45;
    ctx.fillStyle = "#000";
    ctx.fillText(p.text, p.x + 1, p.y + 1);

    // основной текст (потом)
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }

  ctx.globalAlpha = 1;
}

  // --- VFX: конфетти на победе ---
  let confettiActive = false;
  const confetti = [];

  function startConfetti() {
    confettiActive = true;
    confetti.length = 0;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const count = 160;
    for (let i = 0; i < count; i++) {
      confetti.push({
        x: Math.random() * w,
        y: -Math.random() * h,
        vx: -1 + Math.random() * 2,
        vy: 2 + Math.random() * 4,
        r: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: -0.2 + Math.random() * 0.4,
        life: 1,
        decay: 0.004 + Math.random() * 0.004,
      });
    }
  }

  function stopConfetti() {
    confettiActive = false;
    confetti.length = 0;
    confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function updateConfetti() {
    if (!confettiActive) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.03;
      c.rot += c.vr;
      c.life -= c.decay;

      if (c.y > h + 20 || c.life <= 0) confetti.splice(i, 1);
    }

    if (confetti.length === 0) stopConfetti();
  }

  function drawConfetti() {
    if (!confettiActive) return;

    confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    confettiCtx.fillStyle = "#fff";

    for (const c of confetti) {
      confettiCtx.globalAlpha = Math.max(0, c.life);
      confettiCtx.save();
      confettiCtx.translate(c.x, c.y);
      confettiCtx.rotate(c.rot);
      confettiCtx.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2);
      confettiCtx.restore();
    }

    confettiCtx.globalAlpha = 1;
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
    popups.length = 0; // очищаем popup'ы
    setHud();

    stopConfetti();

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

    startConfetti();

    winText.textContent =
      "Yana, с праздником! 🎄✨\n\nТы набрала 30 очков 🥳\nПосмотри под ёлку 😉";
  }

  function lose() {
    state.running = false;
    hide(screenStart);
    hide(screenWin);
    show(screenLose);

    stopConfetti();
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
        spawnCatchParticles(b.x, b.y); // эффект поимки
        spawnPlusOnePopup(b.x, b.y - b.r - 10);   // popup "+1" над шаром
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

    updateParticles();
    updatePopups();
  }

  function draw() {
    // главный canvas теперь прозрачный — чистим его
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // звёзды (поверх снега)
    ctx.fillStyle = "#fff";
    for (const s of state.stars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // шары
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (const b of state.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // частицы
    drawParticles();
    
    // popup'ы +1
    drawPopups();

    // дед мороз (emoji)
    ctx.font = "52px system-ui, Apple Color Emoji, Segoe UI Emoji";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(santaEmoji, player.x + player.w / 2, player.y + player.h / 2);
  }

  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    // фоновые эффекты идут всегда
    updateSnow();
    drawSnow();

    if (state.running) update(dt, ts);
    draw();

    updateConfetti();
    drawConfetti();

    requestAnimationFrame(loop);
  }

  // Кнопки
  btnStart.addEventListener("click", () => {
    hide(screenStart);
    hide(screenWin);
    hide(screenLose);
    resetGame();
  });

  btnAgainWin.addEventListener("click", () => {
    hide(screenWin);
    hide(screenLose);
    resetGame();
  });

  btnAgainLose.addEventListener("click", () => {
    hide(screenLose);
    resetGame();
  });

  // init
  hide(screenWin);
  hide(screenLose);
  show(screenStart);
  setHud();

  console.log("startapp:", startParam);
  console.log("Game with VFX loaded! Snow, particles, +1 popups, confetti ready!");
  requestAnimationFrame(loop);
})();
