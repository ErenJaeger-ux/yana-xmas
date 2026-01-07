// === sounds (v1.1-sound) ===
const sounds = {
  catch: new Audio("sounds/catch.mp3"),
  miss:  new Audio("sounds/miss.mp3"),
  win:   new Audio("sounds/win.mp3"),
  lose:  new Audio("sounds/lose.mp3"),
  music: new Audio("sounds/jingle.mp3"),
};

// Настраиваем музыку по умолчанию
sounds.music.loop = true;
sounds.music.volume = 0.25;

// SFX helper
function playSfx(name, vol = 1) {
  const a = sounds[name];
  if (!a) return;
  a.volume = vol;
  a.currentTime = 0;
  a.play().catch(() => {});
}

function stopSfx(name) {
  const a = sounds[name];
  if (!a) return;
  a.pause();
  a.currentTime = 0;
}

// Music helpers
function startMusic() {
  const m = sounds.music;
  if (!m) return;
  m.muted = false;
  // не сбрасываем currentTime каждый раз — иначе может не стартовать/щёлкать
  const p = m.play();
  if (p) p.catch(() => {});
}

function stopMusic() {
  const m = sounds.music;
  if (!m) return;
  m.pause();
  m.currentTime = 0;
}

// Unlock audio on first user click/tap
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // Разблокировка аудио по первому клику (без реального звука)
  Object.values(sounds).forEach((a) => {
    if (!a) return;
    const prevVol = a.volume;
    try {
      a.muted = false;
      a.volume = 0;
      a.currentTime = 0;
      const p = a.play();
      if (p) {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = prevVol;
        }).catch(() => {
          a.volume = prevVol;
        });
      } else {
        a.volume = prevVol;
      }
    } catch (_) {
      a.volume = prevVol;
    }
  });
}

(() => {
  // Telegram WebApp
  const tg = window.Telegram?.WebApp;
  try {
    tg?.ready();
    tg?.expand();
  } catch {}

  const startParam =
    new URLSearchParams(location.search).get("tgWebAppStartParam") ||
    tg?.initDataUnsafe?.start_param ||
    "default";

  // UI элементы
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

  // --- Canvas setup ---
  const snowCanvas = document.getElementById("snow");
  const snowCtx = snowCanvas.getContext("2d", { alpha: false });

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: true });

  const confettiCanvas = document.getElementById("confetti");
  const confettiCtx = confettiCanvas.getContext("2d", { alpha: true });

  // --- VFX: снег (фон) ---
  const snowflakes = [];
  const SNOW_COUNT = 45;

  // --- VFX: Ёлка (фон) ---
  const tree = {
    x: 0,
    y: 0,
    w: 220,
    h: 320,
    ornaments: [],
    garlandLights: [],
    blinkT: 0,
  };

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

  function initTree() {
    const s = Math.min(window.innerWidth, window.innerHeight);
    tree.w = Math.max(180, Math.min(260, s * 0.33));
    tree.h = tree.w * 1.45;
    
    tree.x = window.innerWidth / 2;
    tree.y = window.innerHeight / 2 + 20;

    tree.ornaments = [];
    const colors = ["#ff3b3b", "#ffd93b", "#3bff7a", "#3bd1ff", "#ff3bda"];
    for (let i = 0; i < 14; i++) {
      const t = (i / 13);
      const layerW = tree.w * (1 - t * 0.65);
      const ox = (Math.random() - 0.5) * layerW * 0.9;
      const oy = -tree.h * 0.45 + t * tree.h * 0.9;

      tree.ornaments.push({
        ox, oy,
        r: 7 + Math.random() * 4,
        c: colors[i % colors.length],
        phase: Math.random() * Math.PI * 2,
        glowAlpha: 0,
      });
    }

    tree.garlandLights = [];
    const lightCount = 12;
    for (let i = 0; i < lightCount; i++) {
      tree.garlandLights.push({
        t: Math.random(),
        speed: 0.03 + Math.random() * 0.04,
        phase: Math.random() * Math.PI * 2,
        radius: 4 + Math.random() * 2,
        color: `hsl(${Math.floor(Math.random()*60 + 180)}, 100%, 60%)`
      });
    }
  }

  function drawStar(ctx2, x, y, rOuter, rInner) {
    ctx2.beginPath();
    const spikes = 5;
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    ctx2.moveTo(x, y - rOuter);
    for (let i = 0; i < spikes; i++) {
      ctx2.lineTo(x + Math.cos(rot) * rOuter, y + Math.sin(rot) * rOuter);
      rot += step;
      ctx2.lineTo(x + Math.cos(rot) * rInner, y + Math.sin(rot) * rInner);
      rot += step;
    }
    ctx2.closePath();
    ctx2.fill();
  }

  function drawTree(ctx2, tSec) {
    const x = tree.x;
    const y = tree.y;

    ctx2.globalAlpha = 1;
    ctx2.fillStyle = "#5b3a1f";
    ctx2.fillRect(x - 18, y + tree.h * 0.38, 36, 55);

    ctx2.fillStyle = "#0b7a3b";
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.23;
      const topY = y - tree.h * 0.5 + i * 80;
      const w = tree.w * k;
      const h = 140;

      ctx2.beginPath();
      ctx2.moveTo(x, topY);
      ctx2.lineTo(x - w / 2, topY + h);
      ctx2.lineTo(x + w / 2, topY + h);
      ctx2.closePath();
      ctx2.fill();
    }

    ctx2.strokeStyle = "rgba(255,255,255,0.35)";
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    const startY = y - tree.h * 0.25;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const px = x - tree.w * 0.35 + t * (tree.w * 0.7);
      const py = startY + Math.sin(t * 20 + tSec * 2) * 10 + t * 130;
      if (i === 0) ctx2.moveTo(px, py);
      else ctx2.lineTo(px, py);
    }
    ctx2.stroke();

    for (const light of tree.garlandLights) {
      light.t += light.speed * 0.01;
      if (light.t > 1) light.t -= 1;

      const px = x - tree.w * 0.35 + light.t * (tree.w * 0.7);
      const py = startY + Math.sin(light.t * 20 + tSec * 2) * 10 + light.t * 130;

      const alpha = 0.5 + 0.5 * Math.sin(tSec * 6 + light.phase);
      ctx2.globalAlpha = alpha;
      ctx2.fillStyle = light.color;
      ctx2.beginPath();
      ctx2.arc(px, py, light.radius, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.globalAlpha = 1;

    const blink = 0.6 + 0.4 * Math.sin(tSec * 6);
    ctx2.globalAlpha = blink;
    ctx2.fillStyle = "#ffd93b";
    drawStar(ctx2, x, y - tree.h * 0.55, 18, 8);
    ctx2.globalAlpha = 1;

    for (const o of tree.ornaments) {
      o.glowAlpha = 0.5 + 0.5 * Math.sin(tSec * 4 + o.phase);
      
      ctx2.globalAlpha = o.glowAlpha * 0.25;
      ctx2.fillStyle = o.c;
      ctx2.beginPath();
      ctx2.arc(x + o.ox, y + o.oy, o.r * 1.8, 0, Math.PI * 2);
      ctx2.fill();
      
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tSec * 5 + o.phase));
      ctx2.globalAlpha = a;
      ctx2.fillStyle = o.c;
      ctx2.beginPath();
      ctx2.arc(x + o.ox, y + o.oy, o.r, 0, Math.PI * 2);
      ctx2.fill();

      ctx2.globalAlpha = a * 0.8;
      ctx2.fillStyle = "#fff";
      ctx2.beginPath();
      ctx2.arc(x + o.ox - o.r * 0.3, y + o.oy - o.r * 0.3, o.r * 0.35, 0, Math.PI * 2);
      ctx2.fill();

      ctx2.globalAlpha = 1;
    }
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
    snowCtx.fillStyle = "#0b1020";
    snowCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    drawTree(snowCtx, performance.now() / 1000);

    snowCtx.fillStyle = "#fff";
    for (const s of snowflakes) {
      snowCtx.globalAlpha = 0.85;
      snowCtx.beginPath();
      snowCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      snowCtx.fill();
    }
    snowCtx.globalAlpha = 1;
  }

  function resizeAll() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
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
    initTree();
  }
  window.addEventListener("resize", resizeAll);
  resizeAll();

  // Игровые данные
  const state = {
    running: false,
    score: 0,
    lives: 2,
    speed: 220,
    spawnEvery: 900,
    lastSpawn: 0,
    lastTs: 0,
    balls: [],
    stars: [],
    difficultyAt: 0,
  };

  const player = {
    x: window.innerWidth / 2 - 26,
    y: window.innerHeight - 120,
    w: 52,
    h: 52,
    speed: 520,
    mouth: 0,
    mouthFlash: 0,
  };

  // --- Управление ---
  function setPlayerX(clientX) {
    player.x = clientX - player.w / 2;
    player.x = Math.max(8, Math.min(window.innerWidth - player.w - 8, player.x));
  }

  let activePointerId = null;
  let mouseDown = false;

  window.addEventListener("pointerdown", (e) => {
    activePointerId = e.pointerId;
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    setPlayerX(e.clientX);
    e.preventDefault?.();
  }, { passive: false });

  window.addEventListener("pointermove", (e) => {
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

  let keyDir = 0;
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
    // УБРАЛИ: sounds.lose.currentTime = 0; sounds.lose.play().catch(() => {});
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

    for (let i = 0; i < 3; i++) {
      const a = Math.PI + Math.random() * Math.PI * 0.3 - Math.PI * 0.15;
      const sp = 1 + Math.random() * 2;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        r: 1.5 + Math.random() * 2,
        type: 'snowTrail'
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === 'snowTrail') {
        p.vy -= 0.08;
      } else {
        p.vy += 0.12;
      }
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

  // --- VFX: Popup "+1" при поимке ---
  const popups = [];

  function spawnPlusOnePopup(x, y) {
    popups.push({
      x,
      y,
      text: "+1",
      alpha: 1,
      vy: -1.5,
      life: 60,
      fontSize: 22,
      color: "#FFD700"
    });
  }

  function updatePopups() {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.y += p.vy;
      p.vy *= 0.98;
      p.life -= 1;
      p.alpha = Math.max(0, p.life / 60);
      if (p.life <= 0) popups.splice(i, 1);
    }
  }

  function drawPopups() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of popups) {
      ctx.font = `bold ${p.fontSize}px system-ui, Arial`;
      ctx.globalAlpha = p.alpha * 0.45;
      ctx.fillStyle = "#000";
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  // --- VFX: конфетти ---
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

  // --- Игра: снежинки вместо шаров ---
  function drawSnowflake(ctx2, x, y, r, rot) {
    ctx2.save();
    ctx2.translate(x, y);
    ctx2.rotate(rot);
    ctx2.strokeStyle = "rgba(255,255,255,0.95)";
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    
    for (let i = 0; i < 6; i++) {
      ctx2.save();
      ctx2.rotate(i * Math.PI / 3);
      ctx2.moveTo(0, 0);
      ctx2.lineTo(0, -r);
      ctx2.moveTo(0, -r * 0.55);
      ctx2.lineTo(r * 0.18, -r * 0.42);
      ctx2.moveTo(0, -r * 0.55);
      ctx2.lineTo(-r * 0.18, -r * 0.42);
      ctx2.restore();
    }
    
    ctx2.stroke();
    ctx2.restore();
  }

  // --- Рисование Деда Мороза ---
  function drawSanta(ctx2) {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    ctx2.save();
    ctx2.translate(cx, cy);
    const bob = Math.sin(performance.now() / 1000 * 6) * 1.5;
    ctx2.translate(0, bob);

    if (player.mouthFlash > 0) {
      ctx2.globalAlpha = player.mouthFlash * 0.3;
      ctx2.fillStyle = "#fff";
      ctx2.beginPath();
      ctx2.arc(0, 0, 32, 0, Math.PI * 2);
      ctx2.fill();
    }

    ctx2.globalAlpha = 1;
    ctx2.fillStyle = "#f6d1b1";
    ctx2.beginPath();
    ctx2.arc(0, 0, 22, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.fillStyle = "#fff";
    ctx2.beginPath();
    ctx2.arc(0, 10, 24, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.fillStyle = "#d81f26";
    ctx2.beginPath();
    ctx2.moveTo(-22, -6);
    ctx2.lineTo(0, -30);
    ctx2.lineTo(22, -6);
    ctx2.closePath();
    ctx2.fill();

    ctx2.fillStyle = "#fff";
    ctx2.beginPath();
    ctx2.arc(0, -30, 6, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.fillStyle = "#111";
    ctx2.beginPath();
    ctx2.arc(-7, -4, 2.2, 0, Math.PI * 2);
    ctx2.arc(7, -4, 2.2, 0, Math.PI * 2);
    ctx2.fill();

    const open = player.mouth;
    ctx2.strokeStyle = "#a23";
    ctx2.lineWidth = 2;
    if (open < 0.2) {
      ctx2.beginPath();
      ctx2.moveTo(-6, 6);
      ctx2.lineTo(6, 6);
      ctx2.stroke();
    } else {
      ctx2.fillStyle = "#611";
      ctx2.beginPath();
      ctx2.ellipse(0, 7, 6, 4 + open * 6, 0, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.restore();
  }

  function resetGame() {
    state.running = true;
    state.score = 0;
    state.lives = 2;
    state.speed = 220;
    state.spawnEvery = 900;
    state.lastSpawn = 0;
    state.balls = [];
    state.difficultyAt = 0;
    popups.length = 0;
    particles.length = 0;
    player.mouth = 0;
    player.mouthFlash = 0;
    setHud();
    stopConfetti();

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
      rot: Math.random() * Math.PI * 2,
      vr: (-2 + Math.random() * 4) * 0.8,
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
    stopMusic();
    stopSfx('miss');
    playSfx('win');
    state.running = false; 
    hide(screenStart); 
    hide(screenLose); 
    show(screenWin); 
    startConfetti(); 
    
    winText.innerHTML = 
      "<div style='font-size: 28px; margin-bottom: 15px; color: #FFD700;'>🎄✨ Яночка, с наступающим Новым Годом! ✨🎄</div>" + 
      "<div style='font-size: 22px; margin: 15px 0;'>Ты набрала 30 очков 🥳</div>" + 
      "<div style='font-size: 24px; margin-top: 20px; color: #4ae0ff; font-weight: bold; text-align: center; animation: pulse 1.5s infinite;'>Бегом смотреть что дед мороз оставил у ёлки! 😉</div>";
  }

  function lose() {
    stopMusic();
    stopSfx('miss');
    playSfx('lose');
    state.running = false;
    hide(screenStart);
    hide(screenWin);
    show(screenLose);
    stopConfetti();
  }

  function update(dt, now) {
    player.mouth = Math.max(0, player.mouth - dt * 6);
    player.mouthFlash = Math.max(0, player.mouthFlash - dt * 8);

    if (keyDir !== 0) {
      player.x += keyDir * player.speed * dt;
      player.x = Math.max(8, Math.min(window.innerWidth - player.w - 8, player.x));
    }

    if (now - state.lastSpawn >= state.spawnEvery) {
      state.lastSpawn = now;
      spawnBall();
    }

    if (state.score > 0 && state.score % 5 === 0 && state.score !== state.difficultyAt) {
      state.difficultyAt = state.score;
      state.speed = 220 + state.score * 6;
      state.spawnEvery = Math.max(420, 900 - state.score * 10);
    }

    // движение снежинок
    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.y += b.vy * dt;
      b.rot += b.vr * dt;

      // поймали
      if (circleRectCollide({ x: b.x, y: b.y, r: b.r }, player)) {
        state.balls.splice(i, 1);
        state.score += 1;

        playSfx('catch');

        spawnCatchParticles(b.x, b.y);
        spawnPlusOnePopup(b.x, b.y - b.r - 10);
        player.mouth = 1;
        player.mouthFlash = 1;
        setHud();
        if (state.score >= 30) win();
        continue;
      }

      // упал вниз
      if (b.y - b.r > window.innerHeight + 40) {
        state.balls.splice(i, 1);
        state.lives -= 1;

        const willLose = state.lives <= 0;
        if (!willLose) playSfx('miss', 0.7);

        setHud();
        if (willLose) lose();
      }
    }

    updateParticles();
    updatePopups();
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    ctx.fillStyle = "#fff";
    for (const s of state.stars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const b of state.balls) {
      drawSnowflake(ctx, b.x, b.y, b.r, b.rot);
    }

    drawParticles();
    drawPopups();
    drawSanta(ctx);
  }

  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

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
    unlockAudio();
    startMusic();

    hide(screenStart);
    hide(screenWin);
    hide(screenLose);
    resetGame();
  });

  btnAgainWin.addEventListener("click", () => {
    unlockAudio();
    startMusic();

    hide(screenWin);
    hide(screenLose);
    resetGame();
  });

  btnAgainLose.addEventListener("click", () => {
    unlockAudio();
    startMusic();

    hide(screenLose);
    resetGame();
  });

  // init
  hide(screenWin);
  hide(screenLose);
  show(screenStart);
  setHud();

  console.log("startapp:", startParam);
  console.log("New Year Game with sound fixes!");
  requestAnimationFrame(loop);
})();