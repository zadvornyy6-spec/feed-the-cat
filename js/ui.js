import {
  CONFIG, SAVE_KEY, CLOUD_MOCK_KEY } from "./config.js";
import {
  state,
  fmt,
  fmtTime,
  hexToRgba,
  getSkin,
  activeSkin,
  xpNeeded,
  ingredientCost,
  dishPrice,
  dailyIngredientLimit,
  dailyDishLimit,
  autoclickerPerSecond,
  BuffManager,
  BossSystem,
  GachaSystem,
  TutorialSystem,
  calculatePrestigeStars,
  calculatePrestigeStarsBase,
  effectivePity,
  buyIngredient,
  buyDish,
  cookDish,
  feedDish,
  doPrestige,
  buyUpgrade,
  selectSkin,
  toggleAutoclicker,
  performClick,
  SaveManager,
  Platform,
  t,
    setLanguage,
    skinBonusText,
    activeSkinIncomeMult,
  } from "./game.js";
import { ICO } from "./game.js";

const $ = (sel) => document.querySelector(sel);

/************************************************************
ICON HELPER
************************************************************/
function iconHtml(src, size = 36) {
  if (!src) return "";
  if (/\.(svg|webp|png|jpe?g)$/i.test(src)) {
    return `<img src="${src}" class="asset-icon" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0" />`;
  }
  return src;
}

/************************************************************
Формат дохода ЗА ОДИН КЛИК:
- округление до 0.1 (стандартное, Math.round);
- целые без ".0" (1.0 -> "1", 1.3 -> "1.3");
- большие числа (>=1000) сокращаются K/M/B... тоже с 1 знаком.
************************************************************/
function fmtClick(n) {
  n = Number(n) || 0;
  if (n < 1000) {
    const r = Math.round(n * 10) / 10;     // round до 0.1
    if (r >= 1000) return fmtClick(r);     // край: 999.99 -> 1000 -> "1K"
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  const units = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp"];
  let u = 0, v = n;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  const r = Math.round(v * 10) / 10;       // 1 знак после запятой
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + units[u];
}

/************************************************************
VIBRATION (только мобильные, учитывает настройку)
************************************************************/
export function vibrate(pattern) {
  if (!state.settings.vibration) return;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

/************************************************************
TOAST
************************************************************/
export function toast(message, ms = 2200) {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/************************************************************
AUDIO MANAGER
************************************************************/
export const AudioManager = {
  ctx: null,
  musicTimer: null,
  ensure() {
    if (!state.settings.sound && !state.settings.music) return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },
  tone(freq, duration = 0.08, type = "sine", volume = 0.04, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  },
  play(name) {
    if (!state.settings.sound) return;
    // До первого жеста браузер звук не даст — не создаём AudioContext и не спамим в консоль.
    if (typeof window.SFX !== "undefined" && !window.SFX._unlocked) return;
    if (typeof window.SFX !== "undefined") {
      window.SFX.play(name);
    }
  },
  setMusic(enabled) { MusicManager.setEnabled(enabled); },
  suspend() {
    if (typeof window.SFX !== "undefined") window.SFX.setMute(true);
  },
  resume() {
    if (typeof window.SFX !== "undefined") {
      window.SFX.setMute(!state.settings.sound);
    }
  },
};

/***********************************************************************
MUSIC MANAGER — фоновые петли + джинглы из Assets/music/.
Гейтится настройкой state.settings.music и user-gesture (autoplay-политика).
main_loop — фон, boss_loop — во время боя, gacha_sting — джингл результата.
***********************************************************************/
const MUSIC_TRACKS = {
  main: "Assets/music/main_loop.mp3",
  boss: "Assets/music/boss_loop.mp3",
};
const noop = () => {};
export const MusicManager = {
  a: null, b: null, cur: "a", sting: null, _fadeT: null,
  enabled: false, want: "main", vol: 0.35,
  _playingUrl: "",
  _mk() { const e = new Audio(); e.loop = true; e.volume = 0; e.preload = "auto"; return e; },
  /***********************
  PRECONNECT: греем оба трека ДО первого жеста (src + load()), но play()
  НЕ зовём. На мобильных браузерах «холодный» элемент часто отклоняет
  play() даже при наличии касания; разогретый — проходит. Это главный
  мобильный фикс «тишина до выкл/вкл».
  ***********************/
  _init() {
    if (this.a) return;
    this.a = this._mk(); this.b = this._mk();
    this.sting = new Audio(); this.sting.volume = 0.5;
    if (MUSIC_TRACKS.main) { this.a.src = MUSIC_TRACKS.main; try { this.a.load(); } catch (e) {} }
    if (MUSIC_TRACKS.boss)  { this.b.src = MUSIC_TRACKS.boss;  try { this.b.load(); } catch (e) {} }
  },
  _active() { return this.cur === "a" ? this.a : this.b; },
  _other()  { return this.cur === "a" ? this.b : this.a; },
  setEnabled(on) {
    this._init(); this.enabled = !!on;
    if (on) this._tryPlay(this.want || "main");
    else { this._active().pause(); this._other().pause(); this._playingUrl = ""; }
  },
  setVolume(v) { this._init(); this.vol = v; const a = this._active(); if (a && !a.paused) a.volume = v; },
  playTrack(name) { this._init(); this.want = name; if (this.enabled) this._tryPlay(name); },
  /***********************
  Робастный старт. Состояние играющего трека ведём флагом _playingUrl,
  а НЕ по «a.paused» — иначе один отклонённый мобильным браузером play()
  залипал в мёртвом элементе (симптом «оживает только после тумблера»).
  cur переключаем и fade вешаем ТОЛЬКО в then() успешного play(): без
  жеста play() реджектится → состояние остаётся чистым → следующий жест
  (tryStart) стартует трек с первого раза. Из тишины — быстрый fade-in.
  ***********************/
  _tryPlay(name) {
    name = name || this.want || "main";
    const url = MUSIC_TRACKS[name]; if (!url) return;
    if (this._playingUrl === url) return;                 // уже играет этот трек
    const o = this._other();
    if (!o.src || o.src.indexOf(url) === -1) { o.src = url; try { o.load(); } catch (e) {} }
    o.loop = true;
    const a = this._active();
    const fromVol = (a && a.volume) ? a.volume : 0;
    o.volume = fromVol === 0 ? this.vol * 0.6 : 0;
    const startFade = () => {
      this.cur = (o === this.a) ? "a" : "b";
      this._playingUrl = url;
      const from = fromVol, to = this.vol;
      const steps = from === 0 ? 6 : 30;                  // из тишины ~0.3с, иначе кроссфейд 1.5с
      let i = from === 0 ? 4 : 0;
      clearInterval(this._fadeT);
      this._fadeT = setInterval(() => {
        i++; const t = i / steps;
        o.volume = to * t; if (a) a.volume = from * (1 - t);
        if (i >= steps) { clearInterval(this._fadeT); if (a) { a.pause(); a.volume = 0; } o.volume = to; }
      }, 50);
    };
    const p = o.play();
    if (p && typeof p.then === "function") p.then(startFade).catch(noop); // нет жеста → тихо ждём
    else startFade();
  },
  playSting(name) {
    this._init(); if (!this.enabled) return;
    const url = MUSIC_TRACKS[name]; if (!url) return;
    this.sting.src = url; this.sting.currentTime = 0; this.sting.play().catch(noop);
  },
  tryStart() { if (this.enabled) this._tryPlay(this.want || "main"); },
  pause() { this._init(); this._active().pause(); this._other().pause(); },
  resume() {
    this._init(); if (!this.enabled) return;
    const a = this._active();
    if (a && a.src && a.paused) a.play().catch(noop);
    this._tryPlay(this.want || "main");
  },
};

/************************************************************
SVG FX HELPERS
************************************************************/
const SVG_FX_PATH = "Assets/svg_anim/";

function spawnSVG(filename, x, y, size = 80, lifetime = 2000) {
  const layer = $("#svg-fx-layer");
  if (!layer) return;
  const img = document.createElement("img");
  img.src = SVG_FX_PATH + filename;
  img.className = "svg-fx";
  img.alt = "";
  img.draggable = false;
  img.style.width = size + "px";
  img.style.height = size + "px";
  img.style.left = `${x - size / 2}px`;
  img.style.top = `${y - size / 2}px`;
  img.style.objectFit = "contain";
  layer.appendChild(img);
  setTimeout(() => {
    if (img.parentNode) img.parentNode.removeChild(img);
  }, lifetime);
}

function spawnAmbientSVG(filename, x, y, size = 120) {
  const layer = $("#svg-fx-layer");
  if (!layer) return;
  const img = document.createElement("img");
  img.src = SVG_FX_PATH + filename;
  img.className = "svg-fx svg-fx-ambient";
  img.alt = "";
  img.draggable = false;
  img.style.width = size + "px";
  img.style.height = size + "px";
  img.style.left = `${x - size / 2}px`;
  img.style.top = `${y - size / 2}px`;
  img.style.objectFit = "contain";
  img.style.zIndex = "-1";
  layer.appendChild(img);
}

/* Монетки рядом с местом клика: парят вверх и вращаются. На крите — 3 шт. */
function spawnClickCoin(x, y, crit) {
  if (!FXManager.particlesEnabled()) return;
  const layer = $("#svg-fx-layer");
  if (!layer) return;
  const count = crit ? 3 : 1;
  for (let i = 0; i < count; i++) {
    const img = document.createElement("img");
    img.src = SVG_FX_PATH + "fx_coin_spin.svg";
    img.className = "svg-fx coin-float";
    img.alt = "";
    img.draggable = false;
    const size = 30 + Math.floor(Math.random() * 10);
    const ox = x + (Math.random() - 0.5) * 50;
    const oy = y - 8 + (Math.random() - 0.5) * 20;
    img.style.width = size + "px";
    img.style.height = size + "px";
    img.style.left = `${ox - size / 2}px`;
    img.style.top = `${oy - size / 2}px`;
    img.style.objectFit = "contain";
    img.style.setProperty("--drift", `${Math.floor((Math.random() - 0.5) * 40)}px`);
    layer.appendChild(img);
    setTimeout(() => { if (img.parentNode) img.parentNode.removeChild(img); }, 1200);
  }
}

function spawnClickHeart(x, y, crit) {
  if (!FXManager.particlesEnabled()) return;
  const layer = $("#svg-fx-layer");
  if (!layer) return;
  const rootRect = $("#game-root").getBoundingClientRect();
  const panel = $("#skin-xp-panel");
  let cx = x, span = 120, topY = y;
  if (panel) {
    const r = panel.getBoundingClientRect();
    cx = r.left - rootRect.left + r.width / 2;
    span = Math.max(60, r.width);
    topY = r.top - rootRect.top;
  }
  const count = crit ? 10 : 5;
  for (let i = 0; i < count; i++) {
    const img = document.createElement("img");
    img.src = SVG_FX_PATH + "fx_heart_fly.svg";
    img.className = "svg-fx heart-float";
    img.alt = "";
    img.draggable = false;
    const size = 18 + Math.floor(Math.random() * 12);
    const ox = cx + (Math.random() - 0.5) * span;
    const oy = topY - 6 + (Math.random() - 0.5) * 14;
    img.style.width = size + "px";
    img.style.height = size + "px";
    img.style.left = `${ox - size / 2}px`;
    img.style.top = `${oy - size / 2}px`;
    img.style.objectFit = "contain";
    img.style.setProperty("--rot", `${Math.floor((Math.random() - 0.5) * 50)}deg`);
    img.style.animationDelay = (Math.random() * 0.18).toFixed(2) + "s";
    layer.appendChild(img);
    setTimeout(() => { if (img.parentNode) img.parentNode.removeChild(img); }, 1500);
  }
}

function spawnSlash() {
  if (!FXManager.particlesEnabled()) return;
  const host = $("#boss-sprite");
  if (!host) return;
  const make = (cls) => {
    const img = document.createElement("img");
    img.src = SVG_FX_PATH + "fx_slash.svg";
    img.className = "svg-fx slash-fx " + cls;
    img.alt = "";
    img.draggable = false;
    host.appendChild(img);
    setTimeout(() => { if (img.parentNode) img.parentNode.removeChild(img); }, 480);
  };
  make("slash-lr");
  make("slash-rl");
}

/************************************************************
FX MANAGER
************************************************************/
export const FXManager = {
  canvas: null,
  ctx: null,
  particles: [],
  texts: [],
  dpr: 1,
  w: 0,
  h: 0,
  init() {
    this.canvas = $("#fx-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.resize();
  },
  resize() {
    const root = $("#game-root");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = root.clientWidth;
    this.h = root.clientHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  particlesEnabled() {
    if (state.settings.reduce_motion) return false;
    return state.settings.effects_quality !== "low";
  },
  maxParticles() {
    if (!this.particlesEnabled()) return 0;
    const isMobile = window.innerWidth < 700;
    if (state.settings.effects_quality === "high") return isMobile ? 25 : 60;
    return 25;
  },
  spawn(x, y, color, count = 4, spread = 60) {
    if (!this.particlesEnabled()) return;
    const max = this.maxParticles();
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= max) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = randLocal(20, spread);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: randLocal(400, 700) / 1000,
        maxLife: 0.7,
        size: randLocal(3, 7),
        color,
        alpha: 0.5 + Math.random() * 0.3,
      });
    }
  },
  floating(x, y, text, color = "#2c3e50", size = 18) {
    if (this.texts.length >= 8) this.texts.shift();
    this.texts.push({ x, y, text, color, size, life: 0.75, maxLife: 0.75 });
  },
  catClickFX(x, y, amount, crit) {
    spawnPaw(x + (Math.random() - 0.5) * 30, y + 10);
    if (typeof spawnClickHeart === "function") spawnClickHeart(x, y, crit);
    spawnClickCoinAtCombo(crit);
  },
  feedFX(x, y, xp) {
    this.floating(x, y - 70, `+${fmt(xp)} XP`, "#ff6b35", 20);
    spawnClickHeart(0, 0, false);
  },
  levelFX(x, y) {
    this.floating(x, y - 90, t("levelUp"), "#4ecdc4", 22);
    this.spawn(x, y, "#ffe66d", 8, 90);
    spawnSVG("fx_level_ring.svg", x, y, 220, 950);
    spawnSVG("fx_star_pop.svg", x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 90, 56, 1000);
    spawnSVG("fx_star_pop.svg", x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 90, 44, 1000);
    for (let i = 0; i < 4; i++) {
      const ox = x + (Math.random() - 0.5) * 100;
      const oy = y + (Math.random() - 0.5) * 100;
      spawnSVG("fx_sparkle.svg", ox, oy, 50, 2500);
    }
  },
  skinLevelFX(x, y) {
    this.floating(x, y - 90, t("skinLevelUp"), "#ff6b35", 20);
    this.spawn(x, y, "#ffd700", 8, 85);
    spawnSVG("fx_level_ring.svg", x, y, 200, 950);
    spawnSVG("fx_glow_pulse.svg", x, y, 140, 2500);
  },
  cookFX(x, y) {
    this.floating(x, y - 60, t("cookDone"), "#4ecdc4", 18);
    this.spawn(x, y, "#ffffff", 4, 45);
    spawnSVG("fx_sparkle.svg", x, y, 50, 1500);
  },
  bossHitFX(x, y, damage) {
    if (state.settings.damage_numbers) {
      this.floating(x, y - 40, `-${fmt(damage)}`, "#e74c3c", 22);
    }
  },
  prestigeFX(x, y) {
    this.floating(x, y - 90, t("prestigeFx"), "#f1c40f", 24);
    this.spawn(x, y, "#f1c40f", 12, 80);
    spawnSVG("fx_confetti.svg", x, y, 180, 1000);
  },
  frame(dt) {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 55 * dt;
      const alpha = Math.max(0, (p.life / p.maxLife) * p.alpha);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.y -= 28 * dt;
      const alpha = Math.max(0, t.life / t.maxLife);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = t.color;
      this.ctx.font = `900 ${t.size}px system-ui, sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.fillText(t.text, t.x, t.y);
    }
    this.ctx.globalAlpha = 1;
  },
};

function randLocal(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/************************************************************
LOADING
************************************************************/
export const Loading = {
  async simulate() {
    const fill = $("#load-fill");
    const text = $("#load-text");
    let progress = 0;
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        progress = Math.min(100, progress + randLocal(7, 18));
        fill.style.width = `${progress}%`;
        text.textContent = t("loading", {
          percent: Math.floor(progress),
        });
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(resolve, 250);
        }
      }, 120);
    });
  },
  hide() {
    const screen = $("#loading-screen");
    screen.style.opacity = "0";
    setTimeout(() => screen.remove(), 450);
  },
};

/************************************************************
MODALS
************************************************************/
let currentModal = null;
let _hiddenAt = 0;
let _longPressActive = false;

export function openModal(title, bodyHTML, opts = {}) {
  Platform.gameplayStop();
  const closable = opts.closable !== false;
  const unclosable = opts.unclosable ? 'data-unclosable="true"' : "";
  let bgStyle = "";
  const bgMap = {
    shop: CONFIG.backgrounds?.shop,
    cook: CONFIG.backgrounds?.shop,
    feed: CONFIG.backgrounds?.main,
    skins: CONFIG.backgrounds?.main,
    gacha: CONFIG.backgrounds?.gacha,
    boss: CONFIG.backgrounds?.boss,
    prestige: CONFIG.backgrounds?.prestige,
    "prestige-confirm": CONFIG.backgrounds?.prestige,
    "tutorial-reward": CONFIG.backgrounds?.main,
    "language-picker": CONFIG.backgrounds?.main,
    settings: null,
    "skin-shop": null,
  };
  const bgUrl = bgMap[currentModal?.type];
  if (bgUrl) {
    // var(--mbg) is consumed from style.css, so a relative url() would be
    // rebased to /css/ and 404. Resolve to an absolute URL here: absolute
    // URLs are never rebased, so the blurred background loads everywhere.
    let absUrl = bgUrl;
    try { absUrl = new URL(bgUrl, document.baseURI).href; } catch (e) {}
    bgStyle = `style="--mbg:url('${absUrl}');"`;
  }
  const closeBtn = closable
    ? '<button class="close-btn" data-action="close-modal"><img src="' + CONFIG.uiIcons.close + '" class="close-icon" alt=""></button>'
    : "";
  $("#modal-root").innerHTML = `<div class="modal-overlay" ${unclosable}> <div class="modal" role="dialog" aria-modal="true" ${bgStyle}> <div class="modal-header"> <h3>${title}</h3> ${closeBtn} </div> <div class="modal-body">${bodyHTML}</div> </div> </div>`;
  AudioManager.play("button_open");
}

export function closeModal() {
  if (currentModal && currentModal.type === "gacha") {
    GachaSystem.applyPendingBuffs();
  }
  $("#modal-root").innerHTML = "";
  currentModal = null;
  AudioManager.play("button_close");
  TutorialSystem.onAction("closeModal"); // шаг «закрой окно» (после очистки, чтобы модалка награды не убилась)
  Platform.gameplayStart();
}

export function refreshCurrentModal() {
  if (!currentModal) return;
  if (_longPressActive) return; // hold: не перерисовывать модалку, иначе удалится кнопка под пальцем → pointercancel → обрыв авто-повтора

  const oldBody = document.querySelector("#modal-root .modal-body");
  const scrollTop = oldBody ? oldBody.scrollTop : 0;

  switch (currentModal.type) {
    case "shop": openShop(currentModal.tab); break;
    case "cook": openCook(); break;
    case "feed": openFeed(); break;
    case "skins": openSkins(); break;
    case "gacha": openGacha(); break;
    case "boss": openBoss(); break;
    case "prestige": openPrestige(); break;
    case "settings": openSettings(); break;
    case "skin-shop": openSkinShop(); break;
  }

  const newBody = document.querySelector("#modal-root .modal-body");

  if (newBody) {
    newBody.scrollTop = scrollTop;
  }
}

/************************************************************
HELPERS
************************************************************/
export function fitGame() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  let gameWidth = width;
  let gameHeight = height;
  if (width / height > 2) gameWidth = height * 2;
  const root = $("#game-root");
  root.style.width = `${gameWidth}px`;
  root.style.height = `${gameHeight}px`;
  root.style.margin = "0 auto";
}

export function getCatCenter() {
  const sprite = $("#cat-sprite");
  const root = $("#game-root");
  const rect = sprite.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  return {
    x: rect.left - rootRect.left + rect.width / 2,
    y: rect.top - rootRect.top + rect.height / 2,
  };
}

function getEventPos(e) {
  const rootRect = $("#game-root").getBoundingClientRect();
  return {
    x: (e.clientX || rootRect.width / 2) - rootRect.left,
    y: (e.clientY || rootRect.height / 2) - rootRect.top,
  };
}

function animateCat() {
  const sprite = $("#cat-sprite");
  const skinCfg = CONFIG.skins[state.global.active_skin_id];
  if (skinCfg.click) {
    const img = sprite.querySelector("img");
    if (img) img.src = skinCfg.click;
  }
  sprite.classList.remove("click");
  void sprite.offsetWidth;
  sprite.classList.add("click");
  setTimeout(() => { updateCatAppearance(); }, 150);
}

export function shakeScreen() {
  if (!state.settings.screen_shake || state.settings.reduce_motion) return;
  const layer = $("#game-layer");
  const x = randLocal(-3, 3);
  const y = randLocal(-2, 2);
  layer.style.transform = `translate(${x}px, ${y}px)`;
  setTimeout(() => { layer.style.transform = "none"; }, 100);
}

export function fxBossHit(damage) {
  const bossSprite = $("#boss-sprite");
  if (bossSprite) {
    bossSprite.classList.remove("hit");
    void bossSprite.offsetWidth;
    bossSprite.classList.add("hit");
  }
  const rect = bossSprite?.getBoundingClientRect();
  const rootRect = $("#game-root").getBoundingClientRect();
  if (rect && rootRect) {
    const cx = rect.left - rootRect.left + rect.width / 2;
    const cy = rect.top - rootRect.top + rect.height / 2;
    FXManager.bossHitFX(cx, cy, damage);
  }
  spawnSlash();
}

/************************************************************
RENDER
************************************************************/
export function updateCatAppearance() {
  const skinCfg = CONFIG.skins[state.global.active_skin_id];
  const skinData = activeSkin();
  const sprite = $("#cat-sprite");
  const name = $("#cat-name");

  let img = sprite.querySelector("img");
  if (!img) {
    img = document.createElement("img");
    img.draggable = false;
    sprite.textContent = "";
    sprite.appendChild(img);
  }
  if (skinCfg.idle) img.src = skinCfg.idle;

  sprite.style.removeProperty("border-color");
  sprite.style.removeProperty("background");
  sprite.style.removeProperty("box-shadow");

  let glowColor = "transparent";
  const lvl = skinData.level;
  if (lvl >= 100) glowColor = "rgba(255, 215, 0, 0.6)";
  else if (lvl >= 75) glowColor = "rgba(220, 230, 240, 0.6)";
  else if (lvl >= 50) glowColor = "rgba(255, 215, 0, 0.42)";
  else if (lvl >= 25) glowColor = "rgba(192, 192, 192, 0.45)";
  else if (lvl >= 10) glowColor = "rgba(255, 220, 130, 0.4)";
  sprite.style.setProperty("--cat-glow", `drop-shadow(0 0 22px ${glowColor})`);

  name.textContent = `${skinCfg.name} • ${t("levelShort")}${skinData.level}`;
}

/* HUD PILL — иконка создаётся ОДИН раз, дальше обновляется только
   число. Иначе update-loop (renderHUD каждые 0.2s) пересоздаёт <img>
   5 раз/сек и сбрасывает CSS/SMIL-анимацию → иконки не крутятся.
   Робастно к обеим старым структурам (iconHtml→asset-icon и hud-ico):
   если нет span.hud-val — пересобираем таблетку один раз. */
function setHudPill(sel, iconSrc, iconClass, text) {
  const el = $(sel);
  if (!el) return;
  let img = el.querySelector("img");
  let val = el.querySelector(".hud-val");
  if (!img || !val) {
    // first render OR migration from old markup (asset-icon without span):
    // rebuild once; afterwards only the text node changes → animation lives.
    el.innerHTML = `<img src="${iconSrc}" class="${iconClass}" alt=""><span class="hud-val"></span>`;
    img = el.querySelector("img");
    val = el.querySelector(".hud-val");
  } else {
    if (img.getAttribute("src") !== iconSrc) img.setAttribute("src", iconSrc);
    if (img.getAttribute("class") !== iconClass) {
      img.setAttribute("class", iconClass);
      img.removeAttribute("style"); // drop legacy inline width/height from iconHtml
    }
  }
  val.textContent = text;
}

export function renderHUD() {
  setHudPill("#hud-level", CONFIG.uiIcons.star, "hud-ico hud-flip",
    t("levelShort") + " " + state.global.player_level);
  setHudPill("#hud-coins", CONFIG.uiIcons.coinHud, "hud-ico hud-flip",
    fmt(state.global.coins));
  setHudPill("#hud-income", "Assets/ui_icons/icon_lightning.svg", "hud-ico hud-flip",
    fmt(autoclickerPerSecond()) + t("perSecond"));

  const pxp = state.global.player_xp_current;
  const pnext = state.global.player_xp_to_next;

  $("#player-xp-fill").style.width = `${Math.min(100, (pxp / pnext) * 100)}%`;
  $("#player-xp-text").textContent = `${fmt(pxp)} / ${fmt(pnext)}`;

  const skinCfg = CONFIG.skins[state.global.active_skin_id];
  const skinData = activeSkin();

  const sxp = skinData.xp_current || 0;
  const snext = xpNeeded(skinData.level || 1);

  const autoState = state.autoclicker.is_active ? t("on") : t("off");

  $("#skin-info").innerHTML = `
    <div>${skinCfg.name} • ${t("levelShort")} ${skinData.level} • ×${activeSkinIncomeMult().toFixed(2)}</div>
    <button
      class="small-btn"
      data-action="toggle-autoclicker"
      style="display:${state.autoclicker.unlocked ? "block" : "none"}"
    >
      ${t("autoclickerLabel")}: ${autoState}
    </button>
  `;

  $("#skin-xp-fill").style.width = `${Math.min(100, (sxp / snext) * 100)}%`;
  $("#skin-xp-text").textContent = `${fmt(sxp)} / ${fmt(snext)}`;

  const bossBtn = $("#btn-boss");

  if (bossBtn) {
    let icon, label, key;
    if (BossSystem.active) {
      icon = CONFIG.uiIcons.boss; label = t("fight"); key = "fight";
    } else if (BossSystem.canStart()) {
      icon = CONFIG.uiIcons.boss; label = t("boss"); key = "boss";
    } else {
      icon = CONFIG.uiIcons.clock; label = fmtTime(state.global.next_boss_time - Date.now()); key = "clock";
    }
    // Перерисовываем только при смене режима (active/canStart/cooldown),
    // а в режиме кулдауна — раз в секунду (таймер), а не 5 раз/сек.
    // Иконка не пересоздаётся каждый кадр → ico-sway не сбрасывается → нет моргания.
    const sec = Math.ceil((state.global.next_boss_time - Date.now()) / 1000);
    if (bossBtn.dataset.key !== key || (key === "clock" && bossBtn.dataset.sec !== String(sec))) {
      bossBtn.dataset.key = key;
      bossBtn.dataset.sec = String(sec);
      const cls = key === "clock" ? "ico-clock ico-sway" : "action-icon";
      bossBtn.innerHTML = `<img src="${icon}" class="${cls}" alt="" /><span>${label}</span>`;
    }
  }
}

export function renderBuffBar() {
  BuffManager.cleanup();

  const root = $("#buff-bar");
  const now = Date.now();

  const typeLabel = {
    click: t("click"),
    autoclicker: t("autoclicker"),
    all: t("all"),
  };

  root.innerHTML = state.buffs
    .map((b) => {
      const left = Math.max(0, Math.ceil((b.expires - now) / 1000));
      const iconSrc = CONFIG.dishes[b.id]?.icon || CONFIG.uiIcons.buff;
      const icon = iconHtml(iconSrc, 16);
      const low = left <= 5 ? "low" : "";

      return `
        <div class="buff-pill ${low}">
          ${icon} ×${b.mult} ${typeLabel[b.type] || ""} ${left}${t("secondsShort")}
        </div>
      `;
    })
    .join("");
}

let _quickFeedCache = "";

export function renderQuickFeed() {
  const root = $("#quickfeed-panel");

  const entries = Object.keys(CONFIG.dishes)
    .filter((id) => state.economy.dishes[id] > 0)
    .sort((a, b) => CONFIG.dishes[b].xp - CONFIG.dishes[a].xp)
    .slice(0, 5);
  // Кэш: id+количество. Не изменилось → не трогаем DOM → нет мерцания.
  const cacheKey = entries.map((id) => `${id}:${state.economy.dishes[id]}`).join(",");
  if (cacheKey === _quickFeedCache) return;
  _quickFeedCache = cacheKey;

  if (!entries.length) {
    root.innerHTML = `<div class="quick-empty">${t("noDishes")}</div>`;
    return;
  }

  root.innerHTML = entries
    .map((id) => {
      const dish = CONFIG.dishes[id];

      return `
        <button
          class="quick-btn"
          data-action="feed"
          data-id="${id}"
          title="${dish.name}"
        >
          ${iconHtml(dish.icon)}
          <span class="q-count">×${state.economy.dishes[id]}</span>
        </button>
      `;
    })
    .join("");
}

/*******************************************************************************
TUTORIAL SPOTLIGHT — «дыра»-подсветка над целью текущего шага.
Цель выбирается по шагу и по тому, открыта ли нужная модалка.
Синхронизация с DOM — через MutationObserver (см. initUI),
поэтому openModal/closeModal/renderHUD трогать не нужно.
*******************************************************************************/
let _spotLayer = null;
let _lastTutScroll = 0;
function ensureSpotlight() {
  if (_spotLayer) return _spotLayer;
  const layer = document.createElement("div");
  layer.id = "tutorial-spotlight";
  const hole = document.createElement("div");
  hole.className = "spot-hole";
  layer.appendChild(hole);
  document.body.appendChild(layer);
  _spotLayer = layer;
  return layer;
}
function clearSpotlight() {
  if (_spotLayer) { _spotLayer.remove(); _spotLayer = null; }
}
function getTutorialTarget(step) {
  const modalOpen = !!document.querySelector("#modal-root .modal");
  const inModal = (sel) => document.querySelector("#modal-root " + sel);
  const onScreen = (sel) => document.querySelector(sel);
  switch (step) {
    case 0:  return modalOpen ? null : onScreen("#cat-sprite");
    case 1:  return modalOpen ? null : onScreen('[data-action="open-shop"]');
    case 2:  return modalOpen ? inModal('button[data-action="buy-ingredient"][data-id="meat"]') : onScreen('[data-action="open-shop"]');
    case 3:  return modalOpen ? inModal('button[data-action="buy-ingredient"][data-id="herbs"]') : onScreen('[data-action="open-shop"]');
    case 4:  return modalOpen ? inModal(".close-btn") : null;
    case 5:  return modalOpen ? null : onScreen('[data-action="open-cook"]');
    case 6:  return modalOpen ? inModal('button[data-action="cook"][data-id="kotleta"]') : onScreen('[data-action="open-cook"]');
    case 7:  return modalOpen ? inModal(".close-btn") : null;
    case 8:  return onScreen('#quickfeed-panel button[data-action="feed"][data-id="kotleta"]') || onScreen('[data-action="open-feed"]');
    case 9:  return modalOpen ? null : onScreen('[data-action="open-boss"]');
    case 10: return modalOpen ? inModal(".close-btn") : null;
    case 11: return modalOpen ? null : onScreen('[data-action="open-gacha"]');
    case 12: return modalOpen ? inModal('button[data-action="gacha-pull"]:not(#gacha-pull-again)') : onScreen('[data-action="open-gacha"]');
    case 13: return null; // шаг результатов гачи: затемнение выключаем, баннер ведёт к крестику
    default: return null;
  }
}
export function positionSpotlight() {
  // Keep the tutorial banner out of the modal's close button (top-right).
  const tRoot = $("#tutorial-root");
  if (tRoot) {
    tRoot.classList.toggle("modal-open", !!document.querySelector("#modal-root .modal"));
  }
  if (state.tutorial.completed) { clearSpotlight(); return; }
  const target = getTutorialTarget(state.tutorial.current_step);
  const layer = ensureSpotlight();
  const hole = layer.firstElementChild;
  if (!target) { layer.style.display = "none"; return; }
  const r = target.getBoundingClientRect();
  if (!r || (r.width === 0 && r.height === 0)) { layer.style.display = "none"; return; }
  layer.style.display = "block";
  // Авто-скролл цели обучения в видимую область модалки (вытянутые экраны):
  // если подсвеченная кнопка за пределами видимой части .modal-body — плавно к ней,
  // чтобы игрок сразу видел, куда нажимать (а не только крестик сверху).
  const _tutScroller = target.closest(".modal-body");
  if (_tutScroller) {
    const _sr = _tutScroller.getBoundingClientRect();
    if (r.top < _sr.top + 4 || r.bottom > _sr.bottom - 4) {
      const _now = Date.now();
      if (!_lastTutScroll || _now - _lastTutScroll > 400) {
        _lastTutScroll = _now;
        // ВАЖНО: scrollIntoView прокручивает ВСЕХ прокручиваемых предков,
        // включая #game-root (overflow:hidden всё равно scroll-container!) —
        // из-за этого весь UI уезжал вверх и HUD обрезался (баг обучения).
        // Поэтому скроллим ТОЛЬКО .modal-body вручную: центрируем цель в его
        // видимой области через scrollTo. Внешние слои игры не трогаются.
        const _delta = (r.top - _sr.top) - (_sr.height - r.height) / 2;
        _tutScroller.scrollTo({
          top: _tutScroller.scrollTop + _delta,
          behavior: state.settings.reduce_motion ? "auto" : "smooth",
        });
      }
    }
  }
  const pad = 8;
  hole.style.left = (r.left - pad) + "px";
  hole.style.top = (r.top - pad) + "px";
  hole.style.width = (r.width + pad * 2) + "px";
  hole.style.height = (r.height + pad * 2) + "px";
}
// Держит инвариант обучения: на каждом шаге открыта ровно та модалка, где цель.
export function tutorialFocus(step) {
  switch (step) {
    case 1: openShop("ingredients"); break;
    case 2: openCook(); break;
    case 0:
    case 3:
    case 4: closeModal(); break;
  }
  setTimeout(positionSpotlight, 0);
}

export function renderTutorial() {
  const root = $("#tutorial-root");

  if (state.tutorial.completed) {
    root.innerHTML = "";
    clearSpotlight();
    return;
  }

  const step = state.tutorial.current_step;

  let text = t(`tutorial${step}`);

  if (step === 0) {
    text += ` (${state.tutorial.clicks || 0}/3)`;
  }

  root.innerHTML = `<div class="tutorial-banner"> <div>${t("tutorialPrefix", { text })}</div> <button class="small-btn" data-action="tutorial-skip"> ${t("tutorialSkip")} </button> </div>`;

  positionSpotlight();
}


/************************************************************
RENDER
************************************************************/
export function showTutorialReward() {
  currentModal = { type: "tutorial-reward" };
  const body = `<div class="center"> <div class="boss-result-emoji">${ICO.gift}</div> <div class="item-title">${t("tutorialRewardTitle")}</div> <div class="muted" style="font-size:14px;line-height:1.5">${t("tutorialRewardBody")}</div> <div style="margin-top:16px"> <button class="btn" data-action="tutorial-reward-ok">${t("tutorialRewardOk")}</button> </div> </div>`;
  openModal(t("tutorialComplete"), body);
}
/*******************************************************************************
LANGUAGE PICKER — первый экран нового игрока.
Без крестика и без закрытия по фону: выбор обязателен.
Заголовок намеренно двуязычный (язык ещё не выбран → t() не применить).
*******************************************************************************/
export function openLanguagePicker() {
  currentModal = { type: "language-picker" };
  const body = `<div class="lang-picker"> <div class="lang-title">Выбери язык<br>Choose language</div> <div class="lang-btns"> <button class="lang-btn ru" data-action="pick-language" data-lang="ru"><img src="${CONFIG.uiIcons.flagRu}" class="flag flag-img" alt="">Русский</button> <button class="lang-btn en" data-action="pick-language" data-lang="en"><img src="${CONFIG.uiIcons.globe}" class="flag flag-img ico-sway" alt="">English</button> </div> </div>`;
  openModal( ICO.cat, body, { closable: false, unclosable: true });
}

export function renderAll() {
  updateCatAppearance();
  renderHUD();
  renderBuffBar();
  renderQuickFeed();
  TutorialSystem.render();
  updateStaticTexts();
}

function updateStaticTexts() {
  document.title = t("gameTitle");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}

/************************************************************
MODAL SCREENS
************************************************************/
export function openShop(tab = "ingredients") {
  currentModal = { type: "shop", tab };
  const ingredientRemaining = dailyIngredientLimit() - state.daily_limits.ingredient_purchase_used;
  const dishRemaining = dailyDishLimit() - state.daily_limits.ready_dish_purchase_used;
  const ingredientsTab = Object.entries(CONFIG.ingredients)
    .map(([id, item]) => {
      const cost = ingredientCost(id);
      const cost10 = cost * 10;
      const have = state.economy.ingredients[id];
      const can1 = state.global.coins >= cost && ingredientRemaining >= 1;
      const can10 = state.global.coins >= cost10 && ingredientRemaining >= 10;
      return `<div class="list-item"> <div class="item-icon">${iconHtml(item.icon)}</div> <div class="item-main"> <div class="item-title">${item.name}</div> <div class="item-sub">${t("price")}: ${iconHtml(CONFIG.uiIcons.coin, 14)} ${fmt(cost)}<br>${t("stock")}: ${have}<br>${t("dailyLimit")}: ${ingredientRemaining}</div> </div> <div class="item-actions"> <div class="btn-row"> <button class="btn" data-action="buy-ingredient" data-id="${id}" data-qty="1" ${can1 ? "" : "disabled"}>×1</button> <button class="btn secondary" data-action="buy-ingredient" data-id="${id}" data-qty="10" ${can10 ? "" : "disabled"}>×10</button> </div> </div> </div>`;
    }).join(" ");
  const dishesTab = Object.entries(CONFIG.dishes)
    .map(([id, dish]) => {
      const price = dishPrice(id);
      const price10 = price * 10;
      const have = state.economy.dishes[id];
      const can1 = state.global.coins >= price && dishRemaining >= 1;
      const can10 = state.global.coins >= price10 && dishRemaining >= 10;
      return `<div class="list-item"> <div class="item-icon">${iconHtml(dish.icon)}</div> <div class="item-main"> <div class="item-title">${dish.name}</div> <div class="item-sub">${t("price")}: ${iconHtml(CONFIG.uiIcons.coin, 14)} ${fmt(price)}<br>${t("inventory")}: ${have}<br>${t("dailyLimit")}: ${dishRemaining}<br>${t("shopNoXp")}</div> </div> <div class="item-actions"> <div class="btn-row"> <button class="btn" data-action="buy-dish" data-id="${id}" data-qty="1" ${can1 ? "" : "disabled"}>×1</button> <button class="btn secondary" data-action="buy-dish" data-id="${id}" data-qty="10" ${can10 ? "" : "disabled"}>×10</button> </div> </div> </div>`;
    }).join(" ");
  const body = `<div class="tabs"> <button class="tab ${tab === "ingredients" ? "active" : ""}" data-action="shop-tab" data-tab="ingredients">${t("ingredients")}</button> <button class="tab ${tab === "dishes" ? "active" : ""}" data-action="shop-tab" data-tab="dishes">${t("readyDishes")}</button> </div> ${tab === "ingredients" ? ingredientsTab : dishesTab}`;
  openModal(t("shop"), body);
  TutorialSystem.onAction("openShop");
}

export function openCook() {
  currentModal = { type: "cook" };
  const body = Object.entries(CONFIG.dishes)
    .map(([id, dish]) => {
      const ingredientsText = Object.entries(dish.ingredients)
        .map(([ing, qty]) => {
          const have = state.economy.ingredients[ing];
          const ok = have >= qty;
          const ingIcon = CONFIG.ingredients[ing].icon || " ";
          const iconStr = /\.(svg|webp|png|jpe?g)$/i.test(ingIcon)
            ? `<img src="${ingIcon}" class="asset-icon" style="width:20px;height:20px;object-fit:contain;vertical-align:middle" />`
            : ingIcon;
          return `<span style="color:${ok ? "#27ae60" : "#e74c3c"}">${iconStr} ${have}/${qty}</span>`;
        }).join("  ");
      const canCook = Object.entries(dish.ingredients).every(([ing, qty]) => state.economy.ingredients[ing] >= qty);
      const buffText = dish.buff
        ? `${t(dish.buff.type)} ×${dish.buff.mult}, ${dish.buff.duration}${t("secondsShort")}`
        : t("noBuff");
      return `<div class="list-item"> <div class="item-icon">${iconHtml(dish.icon)}</div> <div class="item-main"> <div class="item-title">${dish.name}</div> <div class="item-sub">${t("feedingXp")}: ${fmt(dish.xp)}<br>${t("buff")}: ${buffText}<br>${t("recipe")}: ${ingredientsText}<br>${t("inventory")}: ${state.economy.dishes[id]}</div> </div> <div class="item-actions"> <button class="btn" data-action="cook" data-id="${id}" ${canCook ? "" : "disabled"}>${t("cookBtn")}</button> </div> </div>`;
    }).join(" ");
  openModal(t("cook"), body);
  TutorialSystem.onAction("openCook");
}

export function openFeed() {
  currentModal = { type: "feed" };
  const entries = Object.keys(CONFIG.dishes).sort((a, b) => CONFIG.dishes[b].xp - CONFIG.dishes[a].xp);
  const body = entries
    .map((id) => {
      const dish = CONFIG.dishes[id];
      const count = state.economy.dishes[id];
      const buffText = dish.buff
        ? `${t(dish.buff.type)} ×${dish.buff.mult}, ${dish.buff.duration}${t("secondsShort")}`
        : t("noBuff");
      return `<div class="list-item"> <div class="item-icon">${iconHtml(dish.icon)}</div> <div class="item-main"> <div class="item-title">${dish.name}</div> <div class="item-sub">${t("xpShort")}: ${fmt(dish.xp)}<br>${t("buff")}: ${buffText}<br>${t("amount")}: ${count}</div> </div> <div class="item-actions"> <button class="btn" data-action="feed" data-id="${id}" ${count > 0 ? "" : "disabled"}>${t("feedBtn")}</button> </div> </div>`;
    }).join("");
  openModal(t("feeding"), body);
}

export function openSkins() {
  currentModal = { type: "skins" };

  const body = `
    <div class="grid">
      ${Object.entries(CONFIG.skins)
        .sort(([a], [b]) => {
          const da = getSkin(a), db = getSkin(b);
          if (da.unlocked !== db.unlocked) return da.unlocked ? -1 : 1;
          if (da.unlocked && db.unlocked) return (db.unlocked_at || 0) - (da.unlocked_at || 0);
          return Number(a) - Number(b);
        })
        .map(([id, skin]) => {
          const data = getSkin(id);
          const active = Number(state.global.active_skin_id) === Number(id);
          const unlocked = data.unlocked;

          const xpText = unlocked
            ? `${fmt(data.xp_current)} / ${fmt(xpNeeded(data.level))}`
            : t("locked");

          return `
            <div class="skin-card ${active ? "active" : ""} ${unlocked ? "" : "locked"}">
              <div
                class="skin-emoji"
                style="
                  background:${hexToRgba(skin.color, 0.14)};
                  border:2px solid ${hexToRgba(skin.color, 0.35)};
                "
              >
                ${unlocked ? iconHtml(skin.idle, 72) : ICO.lock}
              </div>

              <div class="item-title">${skin.name}</div>

              <div class="item-sub">
                ${t("levelShort")} ${unlocked ? data.level : 0}<br>
                ${skin.desc}
              </div>
              <div class="item-sub skin-card-status">
                <span class="skin-bonus">${unlocked ? skinBonusText(id) : "—"}</span>
                <span>${xpText}</span>
              </div>

              <div class="skin-card-actions">
                ${
                  unlocked
                    ? `<button
                         class="btn ${active ? "selected" : ""}"
                         data-action="select-skin"
                         data-id="${id}"
                         ${active ? "disabled" : ""}
                       >
                         ${active ? t("selected") : t("select")}
                       </button>`
                    : `<button class="btn" disabled>${t("select")}</button>`
                }
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  openModal(t("skins"), body);
}

export function openGacha() {
  currentModal = { type: "gacha" };

  const pullsLeft = state.gacha.max_daily_pulls - state.gacha.daily_pulls_used;
  const pity = state.gacha.pity_counter;
  const pityLimit = effectivePity();
  const auto = state.gacha.auto_reveal;

  const body = `
    <div class="center">
      <div class="gacha-stats">
        <div class="gacha-chip">
          ${ICO.ticket} ${pullsLeft} / ${state.gacha.max_daily_pulls}
        </div>

        <div class="gacha-chip">
          ${ICO.sparkle} ${t("gachaGuarantee")} ${pity} / ${pityLimit}
        </div>
      </div>

      <div class="gacha-reveal-row">
        <span>${t("autoOpenCards")}</span>
        <label class="switch">
          <input type="checkbox" data-gacha-reveal ${auto ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </div>

      <button
        class="btn"
        data-action="gacha-pull"
        ${pullsLeft > 0 ? "" : "disabled"}
        style="font-size:16px;padding:14px 22px"
      >
      ${state.statistics.gacha_pulls === 0 ? t("firstPullFree") : ICO.tv + t("watchAd10")}
      </button>

      <div class="gacha-hint">
        ${t("oneViewTenRewards")}<br>
        ${t("guaranteeHint")}
      </div>
    </div>
  `;

  openModal(t("gacha"), body);

  TutorialSystem.onAction("openGacha");
}

/************************************************************
GACHA REVEAL-ON-EXIT — сначала открыть неоткрытые карты, потом действие
************************************************************/
let gachaRevealTimers = [];
let gachaRevealing = false;

function clearGachaRevealTimers() {
  gachaRevealTimers.forEach((t) => clearTimeout(t));
  gachaRevealTimers = [];
}
function getGachaCards() {
  const m = $("#modal-root");
  return m ? Array.from(m.querySelectorAll(".gacha-card")) : [];
}
function hasUnflippedGachaCards() {
  return getGachaCards().some((c) => !c.classList.contains("flipped"));
}
function setGachaNavDisabled(disabled) {
  const m = $("#modal-root");
  if (!m) return;
  m.querySelectorAll('[data-action="gacha-back"], #gacha-pull-again, .close-btn')
    .forEach((b) => { b.disabled = disabled; });
}
function revealAllGachaCards(done) {
  const unflipped = getGachaCards().filter((c) => !c.classList.contains("flipped"));
  if (!unflipped.length) { if (done) done(); return; }
  if (gachaRevealing) return;
  gachaRevealing = true;
  clearGachaRevealTimers();
  setGachaNavDisabled(true);
  const instant = state.settings.reduce_motion || state.settings.effects_quality === "low";
  if (instant) {
    unflipped.forEach((c) => c.classList.add("flipped"));
    AudioManager.play("coin");
    gachaRevealing = false;
    setGachaNavDisabled(false);
    if (done) setTimeout(done, 60);
    return;
  }
  unflipped.forEach((c, i) => {
    const t = setTimeout(() => {
      c.classList.add("flipped");
      AudioManager.play("coin");
      if (i === unflipped.length - 1) {
        gachaRevealing = false;
        setGachaNavDisabled(false);
        if (done) setTimeout(done, 200);
      }
    }, 120 + i * 120);
    gachaRevealTimers.push(t);
  });
}
function requestCloseModal() {
  if (currentModal && currentModal.type === "gacha" && hasUnflippedGachaCards()) {
    revealAllGachaCards(() => closeModal());
  } else {
    closeModal();
  }
}
function gachaBack() {
  if (currentModal && currentModal.type === "gacha" && hasUnflippedGachaCards()) {
    revealAllGachaCards(() => openGacha());
  } else {
    openGacha();
  }
}

export function showGachaResults(results) {
  currentModal = { type: "gacha", results: true };
  clearGachaRevealTimers();
  gachaRevealing = false;

  const pullsLeft = state.gacha.max_daily_pulls - state.gacha.daily_pulls_used;

  const grid = results
    .map((r, i) => {
      const skinClass = r.isSkin ? " result-skin" : "";
      return `<div class="gacha-card" data-i="${i}">
        <div class="gacha-card-inner">
          <div class="gacha-card-face gacha-card-front"><img src="${CONFIG.gacha.cardBack}" alt="" /></div>
          <div class="gacha-card-face gacha-card-back${skinClass} r-${r.rarity || "common"}">
            ${iconHtml(r.icon, 44)}
            <div class="gc-label">${r.label}</div>
          </div>
        </div>
      </div>`;
    })
    .join("");

  const body = ` <div class="center"> <div class="item-title" style="margin-bottom:10px">${t("resultsX10")}</div> <div class="result-grid">${grid}</div> <div class="btn-row" style="justify-content:center;margin-top:6px"> <button class="btn" id="gacha-pull-again" data-action="gacha-pull" ${pullsLeft > 0 ? "" : "disabled"}> ${iconHtml("Assets/ui_icons/icon_repeat.svg", 16)}${t("spinAgain")} </button> <button class="btn secondary" data-action="gacha-back">${t("backToGacha")}</button> </div> </div>`;
  openModal(t("gacha"), body);

  const modal = $("#modal-root");
  const cards = modal ? modal.querySelectorAll(".gacha-card") : [];
  const instant = state.settings.reduce_motion || state.settings.effects_quality === "low";
  const auto = state.gacha.auto_reveal;
// Фанфара скина — ровно в момент переворота его карты (см. Правку A в game.js).
// results[i].isSkin = флаг из doBatch; data-i на карте = индекс в results.
const skinSfxForCard = (card) => {
  const i = Number(card.dataset.i);
  if (results[i] && results[i].isSkin) AudioManager.play("gacha_skin");
};

  if (instant) {
    cards.forEach((c) => { c.classList.add("flipped"); skinSfxForCard(c); });
  } else if (auto) {
    cards.forEach((c, i) => setTimeout(() => {
      c.classList.add("flipped");
      AudioManager.play("coin");
      skinSfxForCard(c);
    }, 1000 + i * 130));
  } else {
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        if (card.classList.contains("flipped")) return;
        card.classList.add("flipped");
        AudioManager.play("coin");
        skinSfxForCard(card);
      });
    });
  }
}

export function openBoss() {
  currentModal = { type: "boss" };
  if (BossSystem.active) { openBossFight(); return; }
  const can = BossSystem.canStart();
  const left = state.global.next_boss_time - Date.now();
  const tier = BossSystem.getTier();
  const rewards = BossSystem.rewardTiers()[tier];
  const dishRewards = rewards.dishes
    .map(([id, qty]) => `${iconHtml(CONFIG.dishes[id].icon, 18)} ${CONFIG.dishes[id].name} ×${qty}`)
    .join(", ");
  const body = `<div class="center boss-screen"> <div class="boss-sprite"><img src="${CONFIG.boss.sprite}" alt="" /></div> <div class="item-title">${t("bossTier", { tier })}</div> <div class="muted"> ${t("bossDuration")}<br> ${t("bossWinReward", { coins: fmt(rewards.coins), dishes: dishRewards })}<br> ${t("bossLosePenalty")}<br> ${can ? t("bossReady") : t("bossAppearsIn", { time: fmtTime(left) })} </div> <div style="margin-top:12px"> <button class="btn danger" data-action="boss-start" ${can ? "" : "disabled"}>${t("startFight")}</button> </div> </div>`;
  openModal(t("boss"), body);
  TutorialSystem.onAction("openBoss");
}

export function openBossFight() {
  currentModal = { type: "boss" };
  const body = `<div class="center boss-screen"> <div class="bar"><div id="boss-hp-fill"></div><span id="boss-hp-text"></span></div> <div id="boss-timer" style="margin:8px 0;font-weight:900"><img src="${CONFIG.uiIcons.clock}" class="ico-clock ico-clock-lg ico-sway" alt=""> 60${t("secondsShort")}</div> <div class="boss-sprite" id="boss-sprite"><img src="${CONFIG.boss.sprite}" alt="" /></div> <button class="btn danger boss-attack-btn" data-action="boss-attack" style="width:100%">${t("attack")}</button> </div>`;
  openModal(t("bossFight"), body, { closable: false, unclosable: true });
  updateBossFightUI();
  MusicManager.playTrack("boss");
}

export function updateBossFightUI() {
  const hpFill = $("#boss-hp-fill");
  const hpText = $("#boss-hp-text");
  const timer = $("#boss-timer");
  if (hpFill) hpFill.style.width = `${(BossSystem.hp / BossSystem.maxHp) * 100}%`;
  if (hpText) hpText.textContent = `${fmt(BossSystem.hp)} / ${fmt(BossSystem.maxHp)}`;
  if (timer) {
    const sec = Math.max(0, Math.ceil((BossSystem.endsAt - Date.now()) / 1000));
    // Иконка создаётся один раз → ico-sway не сбрасывается → нет мерцания.
    if (!timer.querySelector("img")) {
      timer.innerHTML = `<img src="${CONFIG.uiIcons.clock}" class="ico-clock ico-clock-lg ico-sway" alt=""><span class="timer-val"></span>`;
    }
    const val = timer.querySelector(".timer-val");
    if (val) val.textContent = ` ${sec}${t("secondsShort")}`;
  }
}

export function showBossResult(win, rewards) {
  currentModal = { type: "boss" };
  const body = `<div class="center boss-screen"> <div class="boss-result-glow ${win ? "win" : "lose"}"> <div class="boss-result-emoji">${win ? ICO.trophy : ICO.broken}</div> <div class="item-title">${win ? t("bossWin") : t("bossLose")}</div> <div class="muted"> ${win ? t("bossReward", { coins: fmt(rewards.coins) }) : t("bossConsolation", { coins: fmt(rewards.coins) })} </div> </div> <div style="margin-top:16px"> <button class="btn secondary" data-action="open-boss">${t("toBoss")}</button> </div> </div>`;
  openModal(t("boss"), body);
  MusicManager.playTrack("main");
  Platform.showInterstitial();
}

export function openPrestige() {
  currentModal = { type: "prestige" };
  const can = state.global.player_level >= 100;
  const starsNow = state.global.chaos_stars;
  const starsPotential = calculatePrestigeStars();
  const starsBase = calculatePrestigeStarsBase();
  const upgrades = Object.entries(CONFIG.upgrades)
    .map(([key, cfg]) => {
      const tier = state.upgrades[`${key}_tier`];
      const maxed = tier >= cfg.max;
      const cost = cfg.cost(tier);
      const canBuy = !maxed && state.global.chaos_stars >= cost;
      return `
        <div class="list-item">
          <div class="item-icon">${ICO.starglow}</div>
          <div class="item-main">
            <div class="item-title">${cfg.name} • ${t("tier", { tier: tier + 1, max: cfg.max })}</div>
            <div class="item-sub">${cfg.desc}</div>
          </div>
          <div class="item-actions">
            <button class="btn" data-action="buy-upgrade" data-id="${key}" ${canBuy ? "" : "disabled"}>${maxed ? t("max") : t("buyForStars", { cost })}</button>
          </div>
        </div>`;
    }).join("");
  const body = `<div class="center"> <div class="item-title">${t("chaosStars", { stars: starsNow })}</div> <div class="muted"> ${t("prestigeAvailable100")}<br> ${t("currentLevel", { level: state.global.player_level })}<br> ${can ? t("canGetStars", { base: starsBase, total: starsPotential }) : t("prestigeStarsHint")}<br> ${t("prestigeResets")}<br> ${t("prestigeKeeps")} </div> <div style="margin:14px 0"> <button class="btn danger" data-action="prestige-do" ${can ? "" : "disabled"}> ${t("doPrestige")} </button> </div> </div> <div class="item-title" style="margin-bottom:10px">${t("upgradesForStars")}</div> ${upgrades}`;
  openModal(t("prestige"), body);
}

function openPrestigeConfirm() {
  currentModal = { type: "prestige-confirm" };
  const stars = calculatePrestigeStars();
  const body = `<div class="center"> <div class="boss-result-emoji">${ICO.starglow}</div> <div class="item-title">${t("prestigeConfirmTitle")}</div> <div class="muted" style="font-size:14px;line-height:1.5">${t("prestigeConfirmBody", { stars })}</div> <div class="btn-row" style="justify-content:center;margin-top:16px"> <button class="btn danger" data-action="prestige-confirm">${t("prestigeConfirmYes", { stars })}</button> <button class="btn ghost" data-action="prestige-cancel">${t("prestigeConfirmNo")}</button> </div> </div>`;
  openModal(t("prestige"), body);
}

const VOL_LEVELS = [0.25, 0.5, 0.75, 1.0];
function applyAudioSettings() {
  const sfxOn = !!state.settings.sound;
  const musicOn = sfxOn && !!state.settings.music;
  const sv = Math.max(0, Math.min(3, (state.settings.sfx_volume | 0) - 1));
  const mv = Math.max(0, Math.min(3, (state.settings.music_volume | 0) - 1));
  if (typeof window.SFX !== "undefined") {
    window.SFX.setMute(!sfxOn);
    window.SFX.setVolume(sfxOn ? 0.5 * VOL_LEVELS[sv] : 0);
  }
  MusicManager.setVolume(musicOn ? 0.6 * VOL_LEVELS[mv] : 0);
  MusicManager.setEnabled(musicOn);
}
function volBars(lvl) {
  let s = "";
  for (let i = 0; i < 4; i++) s += `<span class="vol-seg ${i < (lvl | 0) ? "on" : ""}"></span>`;
  return s;
}
const volRow = (label, act, lvl) =>
  `<div class="setting-row"> <div>${label}</div> <button class="vol-toggle" data-action="${act}">${volBars(lvl)}</button> </div>`;

export function openSettings() {
  currentModal = { type: "settings" };

  const s = state.settings;

  const sw = (label, key, on) => `
    <div class="setting-row">
      <div>${label}</div>
      <label class="switch">
        <input type="checkbox" data-setting="${key}" ${on ? "checked" : ""}>
        <span class="slider"></span>
      </label>
    </div>
  `;

  const qLabel =
    {
      low: t("qualityLow"),
      medium: t("qualityMedium"),
      high: t("qualityHigh"),
    }[s.effects_quality] || t("qualityMedium");

  const langLabel = s.language === "en" ? "English" : "Русский";

  const body = `
    ${sw(t("sound"), "sound", s.sound)}
    ${sw(t("music"), "music", s.music)}
    ${volRow(t("sfxVolume"), "cycle-sfx-vol", state.settings.sfx_volume)}
    ${volRow(t("musicVolume"), "cycle-music-vol", state.settings.music_volume)}
    ${sw(t("vibration"), "vibration", s.vibration)}
    ${sw(t("damageNumbers"), "damage_numbers", s.damage_numbers)}
    ${sw(t("screenShake"), "screen_shake", s.screen_shake)}
    ${sw(t("reduceMotion"), "reduce_motion", s.reduce_motion)}

    <div class="setting-row">
      <div>${t("effectsQuality")}</div>
      <button class="quality-toggle" data-action="cycle-quality">
        ${qLabel}
      </button>
    </div>

    <div class="setting-row">
      <div>${t("language")}</div>
      <button class="quality-toggle" data-action="cycle-language">
        ${langLabel}
      </button>
    </div>

    <div class="muted" style="margin-top:14px">
      ${t("progressAutoSave")}<br>
      ${t("version")}: ${state._meta.game_version} ·
      ${t("platform")}: ${Platform.mock ? t("platformMock") : t("platformYandex")}
    </div>
  `;

  openModal(t("settings"), body);
}

/************************************************************
SKIN SHOP — заглушка под будущие инапы Яндекс Игр.
Магазин пока НЕВИДИМ (кнопки в интерфейсе нет).
Когда модерация одобрит инапы:
  1) добавь кнопку в action-bar (index.html) с data-action="open-skin-shop";
  2) замени тело purchaseSkin() на реальный payments.purchase(id) + консумирование.
************************************************************/
function purchaseSkin(skinId) {
  // TODO IAP: ysdk.payments.purchase({ id: `skin_${skinId}` })
  // + обязательное консумирование покупки после успеха (иначе модерация не пройдёт).
  toast(t("skinShopSoon"));
}

export function openSkinShop() {
  currentModal = { type: "skin-shop" };
  const body = `<div class="shop-skin-grid">${Object.entries(CONFIG.skins).map(([id, skin]) => `<div class="shop-skin-card"> <div class="skin-emoji">${iconHtml(skin.idle, 72)}</div> <div class="item-title">${skin.name}</div> <div class="shop-price">${ICO.gem} ${t("soon")}</div> <button class="shop-buy-btn" data-action="buy-skin" data-id="${id}">${t("buy")}</button> </div>`)
    .join("")}</div>`;
  openModal(t("skinShop"), body);
}

/************************************************************
EVENTS
************************************************************/
function pressButton(btn) {
  if (!btn) return;

  btn.classList.remove("attack-hit");
  void btn.offsetWidth;
  btn.classList.add("attack-hit");
}

async function handleAction(action, btn) {
  if (btn?.disabled) return;

  switch (action) {
    case "close-modal":
      requestCloseModal();
      break;

    case "open-shop":
      openShop(btn?.dataset?.tab || "ingredients");
      break;

    case "shop-tab":
      openShop(btn.dataset.tab);
      break;

    case "open-cook":
      openCook();
      break;

    case "open-feed":
      openFeed();
      break;

    case "open-skins":
      openSkins();
      break;

    case "open-gacha":
      openGacha();
      break;

    case "gacha-back":
      gachaBack();
      break;

    case "open-boss":
      openBoss();
      break;

    case "open-prestige":
      openPrestige();
      break;

    case "open-settings":
      openSettings();
      break;

    case "open-skin-shop":
      openSkinShop();
      break;

    case "buy-ingredient":
      vibrate(6); buyIngredient(btn.dataset.id, Number(btn.dataset.qty || 1));
      break;

    case "buy-dish":
      vibrate(6); buyDish(btn.dataset.id, Number(btn.dataset.qty || 1));
      break;

    case "cook":
      vibrate(6); cookDish(btn.dataset.id);
      break;

    case "feed":
      vibrate(6); feedDish(btn.dataset.id);
      break;

    case "select-skin":
      selectSkin(Number(btn.dataset.id));
      break;

    case "toggle-autoclicker":
      toggleAutoclicker();
      break;

    case "gacha-pull":
      TutorialSystem.onAction("gachaPull");
      if (hasUnflippedGachaCards()) {
        revealAllGachaCards(() => GachaSystem.pull());
      } else {
        await GachaSystem.pull();
      }
      break;

    case "boss-start":
      BossSystem.start();
      break;

    case "boss-attack":
      vibrate(12);
      pressButton(btn);
      BossSystem.attack();
      break;

    case "prestige-do":
      openPrestigeConfirm();
      break;

    case "prestige-confirm":
      vibrate([20, 40, 20, 40, 50]);
      doPrestige();
      openPrestige();
      break;

    case "prestige-cancel":
      openPrestige();
      break;

    case "buy-upgrade":
      buyUpgrade(btn.dataset.id);
      break;

    case "buy-skin":
      purchaseSkin(Number(btn.dataset.id));
      break;

    case "cycle-quality": {
      const order = ["low", "medium", "high"];
      const i = order.indexOf(state.settings.effects_quality);

      state.settings.effects_quality = order[(i + 1) % order.length];

      SaveManager.save();
      refreshCurrentModal();
      break;
    }

    case "cycle-language":
      setLanguage(state.settings.language === "ru" ? "en" : "ru");
      break;
    case "cycle-sfx-vol":
      state.settings.sfx_volume = (state.settings.sfx_volume | 0) % 4 + 1;
      SaveManager.save();
      if (typeof window.SFX !== "undefined") window.SFX.setVolume(0.5 * VOL_LEVELS[(state.settings.sfx_volume | 0) - 1]);
      refreshCurrentModal();
      break;
    case "cycle-music-vol":
      state.settings.music_volume = (state.settings.music_volume | 0) % 4 + 1;
      SaveManager.save();
      MusicManager.setVolume(0.6 * VOL_LEVELS[(state.settings.music_volume | 0) - 1]);
      refreshCurrentModal();
      break;

    case "tutorial-skip":
      TutorialSystem.complete(true);
      break;
    case "tutorial-reward-ok":
      closeModal();
      break;
    case "pick-language": {
      const lang = btn?.dataset?.lang === "en" ? "en" : "ru";
      setLanguage(lang);                       // применит язык и перерисует HUD/баннер
      state.onboarding.language_chosen = true; // больше этот экран не покажем
      SaveManager.save();
      closeModal();                            // уберёт модалку языка
      renderTutorial();                        // баннер шага 0 на выбранном языке
      positionSpotlight();                     // «дыра» на котике (модалки уже нет)
      break;
    }
  }
}

/************************************************************
COMBO BADGE — счётчик кликов за серию
************************************************************/
let comboCount = 0;
let comboHideTimer = null;

/************************************************************
BADGE ROW — левый (доход за клик) + правый (серия кликов)
в одной строке над плашкой скина, чтобы ничего не прыгало
************************************************************/
let incomeHideTimer = null;

function ensureBadgeRow() {
  if ($("#badge-row")) return;
  const bs = document.querySelector(".bottom-section");
  const panel = $("#skin-xp-panel");
  if (!bs) return;
  const row = document.createElement("div");
  row.id = "badge-row";
  row.className = "badge-row";
  bs.insertBefore(row, panel);
}

function ensureClickIncomeBadge() {
  ensureBadgeRow();
  if ($("#click-income-badge")) return;
  const row = $("#badge-row");
  const el = document.createElement("div");
  el.id = "click-income-badge";
  el.className = "click-income-badge";
  row.appendChild(el); // первый в row → слева
}

function ensureComboBadge() {
  ensureBadgeRow();
  if ($("#combo-badge")) return;
  const row = $("#badge-row");
  const el = document.createElement("div");
  el.id = "combo-badge";
  el.className = "combo-badge";
  row.appendChild(el); // второй в row → справа
}

/* Обновляет левую плашку: золото за клик. На крите — красная + фактическое число. */
export function bumpClickIncome(gained, crit) {
  ensureClickIncomeBadge();
  const el = $("#click-income-badge");
  if (!el) return;
  el.innerHTML = iconHtml(CONFIG.uiIcons.coin, 14) + " +" + fmtClick(gained);
  el.classList.add("show");
  el.classList.toggle("crit", !!crit);
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
  clearTimeout(incomeHideTimer);
  incomeHideTimer = setTimeout(() => {
    el.classList.remove("show");
    el.classList.remove("crit");
  }, 1000);
}
export function bumpCombo() {
  ensureComboBadge();
  const el = $("#combo-badge");
  if (!el) return;
  comboCount += 1;
  el.textContent = `×${comboCount}`;
  el.classList.add("show");
  el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  clearTimeout(comboHideTimer);
  comboHideTimer = setTimeout(() => { el.classList.remove("show"); comboCount = 0; }, 1000);
}

/* Монетки у плашки комбо-кликов: появляются чуть выше и парят вверх. */
function spawnClickCoinAtCombo(crit) {
  if (!FXManager.particlesEnabled()) return;
  const layer = $("#svg-fx-layer");
  if (!layer) return;
  const rootRect = $("#game-root").getBoundingClientRect();
  const badge = $("#click-income-badge") || $("#skin-xp-panel");
  let cx = rootRect.width / 2, topY = rootRect.height / 2;
  if (badge) {
    const r = badge.getBoundingClientRect();
    cx = r.left - rootRect.left + r.width / 2;
    topY = r.top - rootRect.top;
  }
  const count = crit ? 3 : 1;
  for (let i = 0; i < count; i++) {
    const img = document.createElement("img");
    img.src = SVG_FX_PATH + "fx_coin_spin.svg";
    img.className = "svg-fx coin-float";
    img.alt = ""; img.draggable = false;
    const size = 24 + Math.floor(Math.random() * 8);
    const ox = cx + (Math.random() - 0.5) * 40;
    const oy = topY - 16 + (Math.random() - 0.5) * 10; // чуть выше плашки
    img.style.width = size + "px"; img.style.height = size + "px";
    img.style.left = `${ox - size / 2}px`; img.style.top = `${oy - size / 2}px`;
    img.style.objectFit = "contain";
    img.style.setProperty("--drift", `${Math.floor((Math.random() - 0.5) * 30)}px`);
    layer.appendChild(img);
    setTimeout(() => { if (img.parentNode) img.parentNode.removeChild(img); }, 1200);
  }
}

/* Лапка при клике: анимация снаружи (класс paw-float), как у сердечек/монеток. */
function spawnPaw(x, y) {
  const layer = $("#svg-fx-layer");
  if (!layer) return;
  const img = document.createElement("img");
  img.src = SVG_FX_PATH + "fx_paw_tap.svg";
  img.className = "svg-fx paw-float";
  img.alt = "";
  img.draggable = false;
  const size = 70;
  img.style.width = size + "px";
  img.style.height = size + "px";
  img.style.left = `${x - size / 2}px`;
  img.style.top = `${y - size / 2}px`;
  img.style.objectFit = "contain";
  layer.appendChild(img);
  setTimeout(() => { if (img.parentNode) img.parentNode.removeChild(img); }, 850);
}

/*************************************************
РАЗБЛОКИРОВКА ЗВУКА — «липкий» слушатель в фазе capture.
Вешается ДО initGame (см. main.js bootstrap → armAudioUnlock), чтобы
ранний тап (выбор языка на медленном старте по вайфаю) не пропал.
Пробует стартовать музыку на каждом касании, пока та реально не заиграет;
плюс «доводка»: если музыка включена, но ещё не играет (строгие браузеры
вроде Яндекс Браузера реджектят play() даже в жесте) — повторяем попытку
по таймеру, не дожидаясь нового жеста. Снимает себя, когда заиграло.
*************************************************/
let _audioArmed = false;
export function armAudioUnlock() {
  if (_audioArmed) return;
  _audioArmed = true;
  const tryKick = () => {
    try { AudioManager.ensure(); } catch (e) {}
    MusicManager.tryStart();
    if (typeof window.SFX !== "undefined" && !window.SFX._unlocked) {
      window.SFX.unlock();
      window.SFX._unlocked = true;
      setTimeout(() => window.SFX.loadSamples({ path: "Assets/sfx/" }), 0);
    }
  };
  const onGesture = () => {
    tryKick();
    // «доводка»: строгий браузер мог отклонить play() в жесте — повторяем
    // через 300мс (жест браузером уже засчитан, повторный play() проходит).
    setTimeout(tryKick, 300);
    setTimeout(() => {
      if (MusicManager._playingUrl) {
        document.removeEventListener("pointerdown", onGesture, true);
        _audioArmed = false;
      }
    }, 700);
  };
  document.addEventListener("pointerdown", onGesture, true);
}

export function setupEvents() {
  $("#cat-sprite").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (typeof window.SFX !== "undefined" && !window.SFX._unlocked) {
      window.SFX.unlock();
      window.SFX._unlocked = true;
      window.SFX.loadSamples({ path: "Assets/sfx/" });
    }
    const result = performClick();
    bumpClickIncome(result.gained, result.crit);   // левый бейдж ДО монеток
    vibrate(result.crit ? [12, 30, 18] : 7);
    const pos = getEventPos(e);
    FXManager.catClickFX(pos.x, pos.y, result.gained, result.crit);
    AudioManager.play(result.crit ? "crit" : "click");
    animateCat();
    bumpCombo();
    renderHUD();
  });
  document.addEventListener("click", (e) => {
    const overlay = e.target.closest(".modal-overlay");
    if (overlay && !overlay.dataset.unclosable && e.target === overlay) { requestCloseModal(); return; }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    handleAction(btn.dataset.action, btn);
  });
  $("#modal-root").addEventListener("change", (e) => {
    const gachaReveal = e.target.closest("[data-gacha-reveal]");
    if (gachaReveal) {
      state.gacha.auto_reveal = gachaReveal.checked;
      SaveManager.save();
      return;
    }
    const input = e.target.closest("[data-setting]");
    if (!input) return;
    const key = input.dataset.setting;
    const value = input.type === "checkbox" ? input.checked : input.value;
    state.settings[key] = value;
    SaveManager.save();
    applyAudioSettings();
  });
  window.addEventListener("resize", () => { fitGame(); FXManager.resize(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      AudioManager.suspend();
      MusicManager.pause();
      SaveManager.save();
      SaveManager.cloudSave();
      BossSystem.pause();
      _hiddenAt = Date.now();
      Platform.gameplayStop();
    } else {
      AudioManager.resume();
      MusicManager.resume();
      BossSystem.resume();
      if (!document.querySelector("#modal-root .modal")) Platform.gameplayStart();
      if (!BossSystem.active && Date.now() - _hiddenAt >= 5000) Platform.showInterstitial();
    }
  });
  window.addEventListener("beforeunload", () => { SaveManager.save(); });
}

/************************************************************
LONG PRESS — зажатие кнопки готовки/покупки/кормления = авто-повтор.
Первое срабатывание через 350мс, далее каждые 170мс, пока палец держит
или пока действие не вернёт false (кончились ресурсы/монеты).
************************************************************/
function setupLongPress() {
  const REPEAT = ["cook", "feed", "buy-ingredient", "buy-dish"];
  let holdTimer = null, repeatTimer = null, btn = null;
  const fire = () => {
    if (!btn || btn.disabled) return false;
    const a = btn.dataset.action, id = btn.dataset.id, qty = Number(btn.dataset.qty || 1);
    let ok = true;
    if (a === "cook") ok = cookDish(id);
    else if (a === "feed") ok = feedDish(id);
    else if (a === "buy-ingredient") ok = buyIngredient(id, qty);
    else if (a === "buy-dish") ok = buyDish(id, qty);
    refreshCurrentModal(); renderHUD();
    if (ok === false) stop();
    return ok;
  };
  const stop = () => {
    const wasHolding = _longPressActive;
    _longPressActive = false;            // разморозить модалку
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
    btn = null;
    if (wasHolding) refreshCurrentModal(); // один раз догнать числа/disabled после серии
  };
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b || !REPEAT.includes(b.dataset.action)) return;
    btn = b; vibrate(8);
    holdTimer = setTimeout(() => {
      holdTimer = null;
      _longPressActive = true; // заморозить перерисовку модалки на всё время удержания
      if (fire() !== false) repeatTimer = setInterval(fire, 170);
    }, 350);
  });
  ["pointerup", "pointercancel", "pointerleave", "blur"].forEach((ev) =>
    document.addEventListener(ev, stop, true)
  );
}

/************************************************************
INIT UI
************************************************************/
export function initUI() {
  fitGame();
  FXManager.init();
  setupEvents();
  setupLongPress();
  renderAll();
  // Новый игрок сначала выбирает язык — обучение стартует уже на нём.
  if (!state.onboarding.language_chosen) openLanguagePicker();
  // Баффы, накопленные в гаче до перезагрузки/закрытия — выдать один раз при старте.
  if (state.gacha.pending_buffs && state.gacha.pending_buffs.length) {
    GachaSystem.applyPendingBuffs();
  }
  // Spotlight-обучение: следим за DOM модалок и быстрого кормления,
  // чтобы «дыра» всегда оставалась на цели (даже при скролле/перерисовке).
  const spotObserver = new MutationObserver(() => positionSpotlight());
  const spotModalRoot = $("#modal-root");
  const spotQuickFeed = $("#quickfeed-panel");
  if (spotModalRoot) spotObserver.observe(spotModalRoot, { childList: true, subtree: true });
  if (spotQuickFeed) spotObserver.observe(spotQuickFeed, { childList: true, subtree: true });
  window.addEventListener("resize", positionSpotlight);
  document.addEventListener("scroll", positionSpotlight, true);
  positionSpotlight();
  if (!document.querySelector("#modal-root .modal")) Platform.gameplayStart();
  applyAudioSettings();
}