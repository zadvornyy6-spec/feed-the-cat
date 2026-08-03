import {
  CONFIG,
  SAVE_KEY,
  CLOUD_MOCK_KEY,
  ALLOW_MOCK_REWARDED,
  GP_SDK_URL,
  VK_BRIDGE_URL,
  I18N,
} from "./config.js";

// Inline-SVG иконки вместо эмодзи. Цвет задаётся CSS-классом .ico-\*.
export const ICO = {
  coin:     `<img src="${CONFIG.uiIcons.coin}" class="ico-img" alt="" draggable="false">`,
  star:     `<img src="${CONFIG.uiIcons.star}" class="ico-img ico-twinkle" alt="" draggable="false">`,
  starglow: `<img src="${CONFIG.uiIcons.star}" class="ico-img ico-twinkle ico-glow" alt="" draggable="false">`,
  gift:     `<img src="${CONFIG.uiIcons.gift}" class="ico-img ico-bounce" alt="" draggable="false">`,
  party:    `<img src="${CONFIG.uiIcons.party}" class="ico-img ico-bounce" alt="" draggable="false">`,
  meat:     `<img src="${CONFIG.ingredients.meat.icon}" class="ico-img" alt="" draggable="false">`,
  heart:    `<img src="${CONFIG.uiIcons.heart}" class="ico-img ico-beat" alt="" draggable="false">`,
  paw:      `<img src="${CONFIG.uiIcons.paw}" class="ico-img ico-bounce" alt="" draggable="false">`,
  cat:      `<img src="${CONFIG.uiIcons.cat}" class="ico-img" alt="" draggable="false">`,
  ticket:   `<img src="${CONFIG.uiIcons.ticket}" class="ico-img ico-sway" alt="" draggable="false">`,
  sparkle:  `<img src="${CONFIG.uiIcons.sparkle}" class="ico-img ico-twinkle" alt="" draggable="false">`,
  trophy:   `<img src="${CONFIG.uiIcons.trophy}" class="ico-img ico-bounce" alt="" draggable="false">`,
  broken:   `<img src="${CONFIG.uiIcons.broken}" class="ico-img" alt="" draggable="false">`,
  lock:     `<img src="${CONFIG.uiIcons.lock}" class="ico-img" alt="" draggable="false">`,
  gem:      `<img src="${CONFIG.uiIcons.gem}" class="ico-img ico-twinkle" alt="" draggable="false">`,
  cloud:    `<img src="${CONFIG.uiIcons.cloud}" class="ico-img" alt="" draggable="false">`,
  tv:       `<img src="${CONFIG.uiIcons.tv}" class="ico-img" alt="" draggable="false">`,
  ribbon:   `<img src="${CONFIG.uiIcons.ribbon}" class="ico-img" alt="" draggable="false">`,
  close:    `<img src="${CONFIG.uiIcons.close}" class="ico-img ico-close-inline" alt="" draggable="false">`,
};
// Заменяет токены {{name}} на svg. Вызывается внутри t() → работает везде, включая тосты.
export function emojify(str) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, k) => ICO[k] || "");
}

/************************************************************
 * UI hooks
 *
 * game.js не работает напрямую с DOM.
 * Все визуальные действия прокидываются через hooks из main.js.
 ************************************************************/

export const hooks = {
  toast: () => {},
  audioPlay: () => {},
  fxFed: () => {},
  fxLevel: () => {},
  fxSkinLevel: () => {},
  fxCook: () => {},
  fxBossHit: () => {},
  fxPrestige: () => {},
  shakeScreen: () => {},
  renderAll: () => {},
  renderHUD: () => {},
  renderBuffBar: () => {},
  renderQuickFeed: () => {},
  updateCatAppearance: () => {},
  refreshCurrentModal: () => {},
  renderTutorial: () => {},
  openBossFight: () => {},
  updateBossFightUI: () => {},
  showBossResult: () => {},
  showGachaResults: () => {},
  showTutorialReward: () => {},
  musicPause: () => {},
  musicResume: () => {},
};

export function setHooks(obj) {
  Object.assign(hooks, obj);
}

/************************************************************
 * UTILS
 ************************************************************/

export function fmt(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(Math.floor(n));

  const units = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp"];
  let u = 0;

  while (n >= 1000 && u < units.length - 1) {
    n /= 1000;
    u++;
  }

  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[u];
}

export function fmtTime(ms) {
  if (ms <= 0) return "0" + t("secondsShort");
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}${t("hoursShort")} ${m}${t("minutesShort")}`;
  if (m > 0) return `${m}${t("minutesShort")} ${s}${t("secondsShort")}`;
  return `${s}${t("secondsShort")}`;
}

export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

export function softCap(raw, cap, k = 0.05) {
  if (raw <= 0 || cap <= 0) return 0;

  const normalized = raw / cap;
  const kFactor = k / 0.05;

  return cap * (1 - Math.exp(-normalized * kFactor));
}

export function hexToRgba(hex, alpha = 1) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function mergeDeep(target, source) {
  const out = { ...target };

  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      out[key] = mergeDeep(target[key], source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }

  return out;
}

/************************************************************
 * DEFAULT STATE
 ************************************************************/

function defaultState() {
  return {
    _meta: {
      schema_version: 1,
      game_version: "1.0",
      created_at: new Date().toISOString(),
      last_played: new Date().toISOString(),
      checksum: "",
    },
    global: {
      coins: 100,
      lifetime_coins: 0,
      player_level: 1,
      player_xp_current: 0,
      player_xp_to_next: 110,
      total_clicks: 0,
      prestige_count: 0,
      chaos_stars: 0,
      active_skin_id: 1,
      last_boss_fight_timestamp: 0,
      next_boss_time: 0,
      new_skins_cycle: 0,
      claimed_skin_levels_for_stars: 0,
    },
    skins: {
      1: { unlocked: true, level: 1, xp_current: 0 },
    },
    economy: {
      ingredients: { meat: 0, fish: 0, berries: 0, herbs: 0, milk: 0 },
      dishes: { kotleta: 0, dessert: 0, ukha: 0, feast: 0, rainbow: 0 },
    },
    daily_limits: {
      ingredient_purchase_used: 0,
      ready_dish_purchase_used: 0,
      last_reset_timestamp: new Date().toDateString(),
    },
    gacha: { pity_counter: 0, daily_pulls_used: 0, max_daily_pulls: 10, history: [], auto_reveal: false, pending_buffs: [] },
    autoclicker: {
      unlocked: false,
      click_interval_seconds: 2,
      efficiency_multiplier: 1.0,
      is_active: false,
    },
    upgrades: {
      bowls_tier: 0,
      training_tier: 0,
      storage_tier: 0,
      boss_damage_tier: 0,
      gacha_discount_tier: 0,
    },
    buffs: [],
    tutorial: {
      completed: false,
      current_step: 0,
      clicks: 0,
    },
    onboarding: {
      language_chosen: false,
    },
    settings: {
      sound: true,
      music: true,
      vibration: true,
      sfx_volume: 3,
      music_volume: 3,
      effects_quality: "medium",
      damage_numbers: true,
      screen_shake: true,
      reduce_motion: false,
      language: "ru",
    },
    statistics: {
      sessions: 0,
      playtime_seconds: 0,
      ads_rewarded_watched: 0,
      gacha_pulls: 0,
      boss_fights: 0,
      boss_wins: 0,
      prestiges: 0,
      dishes_cooked: 0,
      dishes_fed: 0,
    },
  };
}

export let state = defaultState();

/************************************************************
 * LOCALIZATION
 ************************************************************/

export function t(key, vars = {}) {
  const lang = state.settings?.language || "ru";
  const dict = I18N[lang]?.ui || I18N.ru.ui;
  const fallback = I18N.ru.ui;

  let text = dict[key] ?? fallback[key] ?? key;

  return emojify(String(text).replace(/{(\w+)}/g, (match, name) => {
    return vars[name] !== undefined ? vars[name] : match;
  }));
}

export function applyLocalization() {
  const lang = state.settings?.language || "ru";
  const d = I18N[lang] || I18N.ru;
  const ru = I18N.ru;

  for (const id of Object.keys(CONFIG.ingredients)) {
    Object.defineProperty(CONFIG.ingredients[id], "name", {
      configurable: true,
      enumerable: true,
      get() {
        return d.ingredients?.[id] || ru.ingredients?.[id] || id;
      },
    });
  }

  for (const id of Object.keys(CONFIG.dishes)) {
    Object.defineProperty(CONFIG.dishes[id], "name", {
      configurable: true,
      enumerable: true,
      get() {
        return d.dishes?.[id] || ru.dishes?.[id] || id;
      },
    });
  }

  for (const id of Object.keys(CONFIG.skins)) {
    Object.defineProperty(CONFIG.skins[id], "name", {
      configurable: true,
      enumerable: true,
      get() {
        return d.skins?.[id]?.name || ru.skins?.[id]?.name || id;
      },
    });

    Object.defineProperty(CONFIG.skins[id], "desc", {
      configurable: true,
      enumerable: true,
      get() {
        return d.skins?.[id]?.desc || ru.skins?.[id]?.desc || "";
      },
    });
  }

  for (const key of Object.keys(CONFIG.upgrades)) {
    Object.defineProperty(CONFIG.upgrades[key], "name", {
      configurable: true,
      enumerable: true,
      get() {
        return d.upgrades?.[key]?.name || ru.upgrades?.[key]?.name || key;
      },
    });

    Object.defineProperty(CONFIG.upgrades[key], "desc", {
      configurable: true,
      enumerable: true,
      get() {
        return d.upgrades?.[key]?.desc || ru.upgrades?.[key]?.desc || "";
      },
    });
  }
}

export function setLanguage(lang) {
  if (!I18N[lang]) lang = "ru";

  state.settings.language = lang;

  applyLocalization();
  SaveManager.save();

  hooks.renderAll();
  hooks.refreshCurrentModal();
}

/************************************************************
 * PLATFORM / YANDEX SDK WRAPPER
 ************************************************************/

/************************************************************
PLATFORM — фасад над GamePush SDK (единый слой под все витрины).
Весь остальной код (ui.js, логика) знает ТОЛЬКО эти методы; бэкенд
(YaGames раньше, GamePush теперь) меняется только здесь.
Модель инициализации GamePush = колбэк window.onGPInit(gp), а не промис,
поэтому loadGamePush() ставит колбэк ДО загрузки скрипта и ждёт его с
таймаутом. Без токена (GP_SDK_URL="") скрипт не грузится → gp=null →
mock=true → локалка работает бит-в-бит как раньше (мок гачи, localStorage).
Методы, чьё точное имя взято из доки GamePush, а не из выжимки требований,
защищены optional chaining + try: если на конкретной версии SDK имени нет —
тихий fallback, без краша. Красная линия: платные скины НЕ ломают бесплатный
путь через гачу (это решается на уровне магазина в заходе IAP, не здесь).
************************************************************/
export const Platform = {
  gp: null,
  _gpInstance: null,
  vk: null,
  backend: "mock",   // "mock" | "gp" | "vk" — кто реально отвечает на вызовы
  mock: true,
  lang: null,
  _sessionStart: 0,
  _lastInterstitial: 0,
  _gameplay: false,
  _vkBridge: null,
  _vkParams: null,

  async init() {
    this._sessionStart = Date.now();

    // 1) VK — пробуем первым, если мы в контексте VK (iframe / vk_app_id в URL).
    if (this._isVKContext()) {
      try {
        const bridge = await this.loadVK();
        if (bridge) {
          let lp = {};
          try { lp = (await this._vkTimeout(bridge.send("VKWebAppGetLaunchParams", {}), 4000)) || {}; } catch (e) {}
          const appId = Number(lp.vk_app_id || 0);
          if (appId > 0) {
            this.vk = bridge;
            this._vkParams = lp;
            this.backend = "vk";
            this.mock = false;
            this.lang = lp.vk_language || null;   // автоопределение языка (vk_language)
            console.info("[Platform] backend=vk app=" + appId + " lang=" + this.lang);
            // VK Bridge шлёт ВСЕ события в один обработчик — фильтруем по event.type.
            // subscribe("ИмяСобытия", fn) НЕВАЛИДНО: bridge зовёт строку как функцию
            // → "e is not a function" на каждом событии VK. Правильно: subscribe(fn).
            try {
              this.vk.subscribe((event) => {
                const type = event && event.detail && event.detail.type;
                if (!type) return;
                if (type === "VKWebAppViewHide") {
                  try { hooks.musicPause(); } catch (e) {}
                  try { BossSystem.pause(); } catch (e) {}
                  try { SaveManager.save(); } catch (e) {}
                } else if (type === "VKWebAppViewRestore") {
                  try { hooks.musicResume(); } catch (e) {}
                  try { BossSystem.resume(); } catch (e) {}
                }
              });
            } catch (e) { console.warn("VK lifecycle subscribe failed", e); }
            this.preloadRewarded();
            return;
          }
        }
      } catch (err) {
        console.warn("VK init failed, falling back.", err);
      }
    }

    // 2) GamePush — прочие витрины (как раньше).
    try {
      const gp = await this.loadGamePush();
      if (gp) {
        this.gp = gp;
        try { await gp.player?.ready; } catch (e) {}
        this.mock = !!gp.isDev;
        this.backend = this.mock ? "mock" : "gp";
        this.lang = gp.language || null;
      } else {
        this.gp = null;
        this.mock = true;
        this.backend = "mock";
        this.lang = null;
      }
    } catch (err) {
      console.warn("GamePush init failed, using mock.", err);
      this.gp = null;
      this.mock = true;
      this.backend = "mock";
      this.lang = null;
    }
    console.info("[Platform] backend=" + this.backend);
  },

  // Мы в контексте VK? Параметры VK передаёт через URL (search/hash), а саму
  // игру открывает в iframe. На github.io в обычном браузере оба признака
  // ложны → мост не грузится. Если доступ к top запрещён (cross-origin iframe)
  // — считаем себя в витрине и даём мосту шанс (он сам отпадёт без vk_app_id).
  _isVKContext() {
    try {
      const url = (location.search || "") + "&" + (location.hash || "");
      if (/\[?\&]vk_app_id=/.test(url)) return true;
      if (window.self !== window.top) return true;
    } catch (e) {
      return true;
    }
    return false;
  },

  // Таймаут для VK-вызовов: в WebView (Android/iOS) промис моста может не
  // резолвиться — без race игра виснет на лоадере навсегда.
  _vkTimeout(p, ms = 4000) {
    return Promise.race([
      Promise.resolve(p).catch((e) => { console.warn("VK call failed", e); return null; }),
      new Promise((r) => setTimeout(() => r(null), ms)),
    ]);
  },
  // Предзагрузка rewarded-материалов (по доке VK: Check = предзагрузка заранее,
  // а не в момент клика). Зовём при старте VK и при открытии гачи.
  preloadRewarded() {
    if (this.vk && this.backend === "vk") {
      try { this.vk.send("VKWebAppCheckNativeAds", { ad_format: "reward" }).catch(() => {}); } catch (e) {}
    }
  },

  // Грузим VK Bridge динамически (как GamePush). Без контекста VK — не зовётся.
  // Init обязателен и должен пройти до любых других событий; не прошёл → null
  // → игра стартует в моке, а не виснет на лоадере.
  async loadVK() {
    if (this._vkBridge) return this._vkBridge;
    if (!VK_BRIDGE_URL) return null;
    await new Promise((res) => {
      const s = document.createElement("script");
      s.src = VK_BRIDGE_URL;
      s.async = true;
      s.onload = () => res();
      s.onerror = () => res();
      document.head.appendChild(s);
    });
    const bridge = window.vkBridge;
    if (!bridge || typeof bridge.send !== "function") return null;
    try {
      const initRes = await this._vkTimeout(bridge.send("VKWebAppInit", {}), 4000);
      if (initRes === null) {
        console.warn("VKWebAppInit timeout/error, falling back to mock.");
        return null;   // игра стартует, а не виснет на лоадере
      }
    } catch (e) {
      console.warn("VKWebAppInit failed", e);
      return null;
    }
    this._vkBridge = bridge;
    return bridge;
  },

  // Грузим GamePush SDK динагически. Без токена — сразу null (локалка без платформы).
  // Колбэк onGPInit ставим ДО вставки скрипта и гоним его с таймаутом: если сеть/
  // конфиг не дали колбэк за 4с — игра стартует в моке, а не виснет на лоадере.
  async loadGamePush() {
    if (this._gpInstance) return this._gpInstance;
    if (!GP_SDK_URL) return null;                       // токен не задан → мок
    let resolveGp;
    const gpReady = new Promise((res) => { resolveGp = res; });
    window.onGPInit = (gp) => { this._gpInstance = gp; resolveGp(gp); };
    await new Promise((res) => {
      const s = document.createElement("script");
      s.src = GP_SDK_URL; s.async = true;
      s.onload = () => res(); s.onerror = () => res();
      document.head.appendChild(s);
    });
    const timeout = new Promise((res) => setTimeout(() => res(null), 4000));
    return (await Promise.race([gpReady, timeout])) || null;
  },

  // Сигнал «игра загружена». Для GamePush не является жёстким блокером модерации
  // (в отличие от Яндекс LoadingAPI.ready), поэтому зовём мягко: gameStart по их
  // требованиям витрин + любые альтернативные имена через optional chaining.
  loadingReady() {
    try { this.gp?.gameStart?.(); } catch (e) {}
    try { this.gp?.loading?.ready?.(); } catch (e) {}
  },

  // REWARDED (гача). gp.ads.showRewardedVideo() → await → bool (из доки GamePush).
  // Без gp — мок ТОЛЬКО вне боевого режима (mock=true), как и раньше.
  async showRewardedVideo() {
    // VK: rewarded через native ads (ad_format:'reward'). По доке VK — только
    // по инициативе игрока (кнопка гачи), награда уже указана в её тексте.
    // Check→Show подряд допустимы для первого показа. В тестовом режиме (до
    // каталога) Check вернёт false → fallback на мок, чтобы гача крутилась.
    if (this.vk && this.backend === "vk") {
      try {
        // Материалы предзагружены preloadRewarded(); Show — по клику игрока.
        const show = await this.vk.send("VKWebAppShowNativeAds", { ad_format: "reward" });
        if (show && show.result) {
          this.preloadRewarded(); // готовим материал следующей крутки
          return true;
        }
      } catch (e) { console.warn("VK rewarded error", e); }
      // Нет рекламы — нет награды (требование VK). Мок — только локально (backend "mock").
      return false;
    }
    if (this.gp && !this.mock && this.gp.ads?.showRewardedVideo) {
      try {
        const ok = await this.gp.ads.showRewardedVideo();
        return !!ok;
      } catch (e) {
        console.warn("Rewarded video error", e);
        return false;
      }
    }
    if (this.mock && ALLOW_MOCK_REWARDED) {
      return new Promise((resolve) => {
        hooks.toast(t("mockReward"));
        setTimeout(() => resolve(true), 1000);
      });
    }
    return false;
  },

  // INTERSTITIAL + GAMEPLAY. Имена gameplayStart/Stop совпадают с Яндекс почти
  // дословно; showFullscreen — из доки GamePush. Предохранители по времени —
  // платформо-независимы (не в 1-ю минуту, не чаще 2 мин) → оставляем.
  gameplayStart() {
    if (this._gameplay) return;
    this._gameplay = true;
    try { this.gp?.gameplayStart?.(); } catch (e) {}
  },
  gameplayStop() {
    if (!this._gameplay) return;
    this._gameplay = false;
    try { this.gp?.gameplayStop?.(); } catch (e) {}
  },
  showInterstitial() {
    if (this.mock) return;
    const now = Date.now();
    if (now - (this._sessionStart || now) < 60000) return;        // не в 1-ю минуту
    if (now - (this._lastInterstitial || 0) < 120000) return;     // не чаще 2 мин
    this._lastInterstitial = now;
    // VK: interstitial через native ads (ad_format:'interstitial'). По доке —
    // без подтверждения, строго на переходах (вызовы из ui.js: результат босса,
    // возврат из фона). В тестовом режиме Check вернёт false → тихо пропустим.
    if (this.vk && this.backend === "vk") {
      this.vk.send("VKWebAppCheckNativeAds", { ad_format: "interstitial" })
        .then((check) => {
          if (check && check.result) {
            return this.vk.send("VKWebAppShowNativeAds", { ad_format: "interstitial" });
          }
        })
        .catch((e) => console.warn("VK interstitial error", e));
      return;
    }
    // GamePush (как раньше)
    if (!this.gp?.ads?.showFullscreen) return;
    try { this.gp.ads.showFullscreen(); } catch (e) { console.warn("showFullscreen failed", e); }
  },

  // ОБЛАКО. Весь state → одна JSON-строка в поле 'progress' (создать в панели GP).
  // Без gp — прежний localStorage-mock (CLOUD_MOCK_KEY), локалка не теряет прогресс.
  async setData(data) {
    // VK cloud: ключ-значение, значение — строка. Ставим ПЕРВЫМ, чтобы в VK
    // прогресс шёл в их storage, а не в localStorage WebView (он может чиститься).
    if (this.vk && this.backend === "vk") {
      try {
        // VK Storage: { key, value }, лимит 2236 символов на value.
        // Разбиваем state по верхнеуровневым полям → каждый ключ < 2236.
        const gachaCloud = { ...data.gacha, history: [] };
        const chunks = {
          p_meta: data._meta, p_global: data.global, p_skins: data.skins,
          p_economy: data.economy, p_daily: data.daily_limits, p_gacha: gachaCloud,
          p_auto: data.autoclicker, p_upgr: data.upgrades, p_buffs: data.buffs,
          p_tut: data.tutorial, p_onb: data.onboarding, p_set: data.settings,
          p_stat: data.statistics,
        };
        for (const [key, val] of Object.entries(chunks)) {
          await this.vk.send("VKWebAppStorageSet", { key, value: JSON.stringify(val) });
        }
        return;
      } catch (e) { console.warn("VK storage set failed", e); }
    }
    if (this.gp?.player?.set) {
      try {
        this.gp.player.set("progress", JSON.stringify(data));
        try { await this.gp.player.sync?.(); } catch (e) {}
        return;
      } catch (e) { console.warn("Cloud save failed", e); }
    }
    localStorage.setItem(CLOUD_MOCK_KEY, JSON.stringify(data));
  },
  async getData() {
    if (this.vk && this.backend === "vk") {
      try {
        const keys = ["p_meta","p_global","p_skins","p_economy","p_daily",
                      "p_gacha","p_auto","p_upgr","p_buffs","p_tut","p_onb","p_set","p_stat"];
        const r = await this.vk.send("VKWebAppStorageGet", { keys });
        if (r && r.keys && r.keys.length) {
          const map = {};
          for (const entry of r.keys) {
            if (!entry.value) continue;
            try { map[entry.key] = JSON.parse(entry.value); }
            catch (e) { console.warn("VK storage: key " + entry.key + " parse failed", e); }
          }
          // Собираем обратно в структуру state
          const out = {};
          if (map.p_meta) out._meta = map.p_meta;
          if (map.p_global) out.global = map.p_global;
          if (map.p_skins) out.skins = map.p_skins;
          if (map.p_economy) out.economy = map.p_economy;
          if (map.p_daily) out.daily_limits = map.p_daily;
          if (map.p_gacha) out.gacha = map.p_gacha;
          if (map.p_auto) out.autoclicker = map.p_auto;
          if (map.p_upgr) out.upgrades = map.p_upgr;
          if (map.p_buffs) out.buffs = map.p_buffs;
          if (map.p_tut) out.tutorial = map.p_tut;
          if (map.p_onb) out.onboarding = map.p_onb;
          if (map.p_set) out.settings = map.p_set;
          if (map.p_stat) out.statistics = map.p_stat;
          if (Object.keys(out).length) return out;
        }
      } catch (e) { console.warn("VK storage get failed", e); }
    }
    if (this.gp?.player?.get) {
      try {
        const raw = this.gp.player.get("progress");
        if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (e) { console.warn("Cloud load failed", e); }
    }
    const raw = localStorage.getItem(CLOUD_MOCK_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  logEvent(name, data = {}) {
    try { this.gp?.analytics?.log?.(name, data); } catch (e) {}
    console.debug("[event]", name, data);
  },
};

/************************************************************
 * SAVE MANAGER
 ************************************************************/

export const SaveManager = {
  save() {
    try {
      state._meta.last_played = new Date().toISOString();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Local save failed", err);
    }
  },

  async load() {
    let localData = null;
    let cloudData = null;

    try {
      const raw = localStorage.getItem(SAVE_KEY);
      localData = raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn("Local load failed", err);
    }

    try {
      cloudData = await Platform.getData();
    } catch (err) {
      console.warn("Cloud load failed", err);
    }

    let chosen = null;

    if (localData && cloudData) {
      const localTime = Date.parse(localData?._meta?.last_played || 0) || 0;
      const cloudTime = Date.parse(cloudData?._meta?.last_played || 0) || 0;
      chosen = cloudTime > localTime ? cloudData : localData;
    } else {
      chosen = cloudData || localData;
    }

    if (chosen) {
      state = mergeDeep(defaultState(), chosen);
    } else {
      state = defaultState();
    }

    state.statistics.sessions += 1;
    normalizeState();
  },

  async cloudSave() {
    try {
      this.save();
      await Platform.setData(JSON.parse(JSON.stringify(state)));
      Platform.logEvent("cloud_save_success");
    } catch (err) {
      console.warn("Cloud save failed", err);
    }
  },

  async cloudLoad() {
    const cloudData = await Platform.getData();

    if (cloudData) {
      state = mergeDeep(defaultState(), cloudData);
      normalizeState();
      Platform.logEvent("cloud_load_success");
      this.save();
    }
  },
};

/************************************************************
 * NORMALIZE
 ************************************************************/

export function normalizeState() {
  function safeNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  if (!Array.isArray(state.buffs)) {
    state.buffs = [];
  }

  if (!Array.isArray(state.gacha.history)) {
    state.gacha.history = [];
  }
  if (!Array.isArray(state.gacha.pending_buffs)) {
    state.gacha.pending_buffs = [];
  }

  state.global.coins = safeNumber(state.global.coins, 0);
  state.global.lifetime_coins = safeNumber(state.global.lifetime_coins, 0);
  state.global.player_level = Math.max(1, Math.floor(safeNumber(state.global.player_level, 1)));
  state.global.player_xp_current = safeNumber(state.global.player_xp_current, 0);
  state.global.chaos_stars = safeNumber(state.global.chaos_stars, 0);
  state.global.prestige_count = safeNumber(state.global.prestige_count, 0);
  state.global.total_clicks = safeNumber(state.global.total_clicks, 0);
  state.global.active_skin_id = safeNumber(state.global.active_skin_id, 1);
  state.global.next_boss_time = safeNumber(state.global.next_boss_time, 0);

  state.statistics.sessions = safeNumber(state.statistics.sessions, 0);
  state.statistics.playtime_seconds = safeNumber(state.statistics.playtime_seconds, 0);
  state.statistics.ads_rewarded_watched = safeNumber(state.statistics.ads_rewarded_watched, 0);
  state.statistics.gacha_pulls = safeNumber(state.statistics.gacha_pulls, 0);
  state.statistics.boss_fights = safeNumber(state.statistics.boss_fights, 0);
  state.statistics.boss_wins = safeNumber(state.statistics.boss_wins, 0);
  state.statistics.prestiges = safeNumber(state.statistics.prestiges, 0);
  state.statistics.dishes_cooked = safeNumber(state.statistics.dishes_cooked, 0);
  state.statistics.dishes_fed = safeNumber(state.statistics.dishes_fed, 0);

  if (!state.skins[1]) {
    state.skins[1] = { unlocked: true, level: 1, xp_current: 0 };
  }

  if (!state.skins[state.global.active_skin_id]?.unlocked) {
    state.global.active_skin_id = 1;
  }

  state.global.player_xp_to_next = xpNeeded(state.global.player_level);

  if (state.global.player_level >= 10) {
    state.autoclicker.unlocked = true;
  }

  if (typeof state.gacha.auto_reveal === "undefined") state.gacha.auto_reveal = false;
  if (!state.tutorial || typeof state.tutorial.clicks === "undefined") {
    state.tutorial = {
      completed: false,
      current_step: 0,
      clicks: 0,
      ...state.tutorial,
    };
  }
  // Миграция: нумерация шагов обучения изменилась — незавершённое начинаем заново.
  if (!state.tutorial.completed && state.tutorial.current_step > 0) {
    state.tutorial.current_step = 0;
    state.tutorial.clicks = 0;
  }
  // Экран выбора языка показываем ровно один раз в жизни сейва.
  if (!state.onboarding || typeof state.onboarding.language_chosen === "undefined") {
    state.onboarding = { language_chosen: false };
  }
  // У вернувшихся игроков (есть любой прогресс) экран выбора языка НЕ всплывает.
  // Автоопределение языка через SDK (п. 2.14 Требований ЯИ).
  // Применяем только для нового игрока (язык ещё не выбран вручную).
  // Для вернувшегося — язык из сейва, автоопределение не трогаем.
  // Если язык SDK не поддерживается (не ru/en) — оставляем дефолт/сейв,
  // игрок увидит экран выбора языка (резервный набор ru/en).
  if (!state.onboarding.language_chosen && Platform.lang && I18N[Platform.lang]) {
    state.settings.language = Platform.lang;
    state.onboarding.language_chosen = true;
  }
  if (!state.onboarding.language_chosen) {
    const hasProgress =
      state.tutorial.completed ||
      state.global.player_level > 1 ||
      state.global.total_clicks > 0 ||
      state.global.lifetime_coins > 0;
    if (hasProgress) state.onboarding.language_chosen = true;
  }
  if (!state.settings.language || !I18N[state.settings.language]) {
    state.settings.language = "ru";
  }

  applyLocalization();

  if (typeof state.settings.vibration === "undefined") {
    state.settings.vibration = true;
  }
  if (typeof state.settings.sfx_volume === "undefined") state.settings.sfx_volume = 3;
  if (typeof state.settings.music_volume === "undefined") state.settings.music_volume = 3;

  BuffManager.cleanup();
  DailyLimits.check();

  // Миграция: проставляем unlocked_at старым скинам, у которых его нет.
  for (const id of Object.keys(state.skins)) {
    const s = state.skins[id];
    if (s && s.unlocked && !s.unlocked_at) s.unlocked_at = Number(id);
  }
}

/************************************************************
 * FORMULAS
 ************************************************************/

export function getSkin(id) {
  id = Number(id);
  return state.skins[id] || { unlocked: false, level: 0, xp_current: 0 };
}

export function activeSkin() {
  return getSkin(state.global.active_skin_id);
}

export function skinLevel(id) {
  return getSkin(Number(id)).level || 0;
}

export function xpNeeded(level) {
  let growth;

  if (level <= 10) growth = 1.1;
  else if (level <= 25) growth = 1.13;
  else if (level <= 60) growth = 1.18;
  else growth = 1.25;

  return Math.floor(100 * Math.pow(growth, level));
}

function skinIncomeBonus(level) {
  return 1 + level * 0.03;
}
export function activeSkinIncomeMult() {
  return skinIncomeBonus(activeSkin().level);
}

function prestigeIncomeMultiplier() {
  return 1 + state.global.prestige_count * 0.25 + state.global.chaos_stars * 0.02;
}

/************************************************************
SKIN PASSIVES — единая кривая с убывающей отдачей.
curve(level, max, scale): на level=scale даёт ~63% от max,
асимптотически стремится к max и НИКОГДА его не превышает.
scale = «на каком уровне получаем 2/3 потолка» (крути для баланса).
************************************************************/
function curve(level, maxBonus, scale) {
  if (level <= 0 || maxBonus <= 0 || scale <= 0) return 0;
  return maxBonus * (1 - Math.exp(-level / scale));
}

/* --- скидки в магазине (capped, не ломают экономику) --- */
function ingredientDiscount() { return curve(skinLevel(5), 0.25, 50); }  // Соня: до -25% на ингредиенты
function dishDiscount()       { return curve(skinLevel(6), 0.20, 50); }  // Батончик: до -20% на готовые блюда
function cookDoubleChance()   { return curve(skinLevel(6), 0.50, 40); }  // Батончик: до 50% двойного блюда

/* --- прогресс / крит / баффы / босс --- */
function playerXpBonus()      { return curve(skinLevel(9), 0.80, 40); }  // Искра: до +80% XP игрока за клик
function critMultBonus()      { return curve(skinLevel(2), 1.00, 60); }  // Мечник: крит x2.5 -> до x3.5
function buffDurationBonus()  { return curve(skinLevel(8), 0.50, 50); }  // Снежок: до +50% длительность баффов
function bossCooldownReduction() { return curve(skinLevel(7), 0.40, 50); } // Куся: до -40% кулдаун босса

export function ingredientCost(id) {
  const base = CONFIG.ingredients[id].baseCost;
  const levelFactor = Math.min(Math.pow(1.18, state.global.player_level), 50);
  return Math.max(1, Math.floor(base * levelFactor * (1 - ingredientDiscount())));
}
function ingredientCostNoReduction(id) {
  const base = CONFIG.ingredients[id].baseCost;
  const levelFactor = Math.min(Math.pow(1.18, state.global.player_level), 50);
  return Math.max(1, Math.floor(base * levelFactor));
}
export function dishPrice(id) {
  const dish = CONFIG.dishes[id];
  const sum = Object.entries(dish.ingredients).reduce(
    (acc, [ing, qty]) => acc + ingredientCostNoReduction(ing) * qty,
    0
  );
  const rarityMult = CONFIG.rarityMultiplier[dish.rarity];
  return Math.max(1, Math.floor(sum * 3 * rarityMult * (1 - dishDiscount())));
}
function baseClickValue() {
  return 1 + Math.floor(state.global.player_level / 5);
}
function baseClickIncome() {
  return (
    baseClickValue() *
    skinIncomeBonus(activeSkin().level) *
    prestigeIncomeMultiplier() *
    (1 + state.upgrades.training_tier * 0.05)
  );
}
function manualClickAdd() { return curve(skinLevel(3), 1.00, 40); }      // Огонёк: до +100% клика
function critChance() {
  return Math.min(0.85, curve(skinLevel(2), 0.35, 45) + BuffManager.critAdd()); // Мечник: до 35% + баффы
}
function autoclickerAdd() { return curve(skinLevel(4), 1.00, 40); }      // Тень: до +100% автокликера
function xpBonus() { return curve(skinLevel(1), 1.20, 35); }             // Бельчик: до +120% XP кормления
function bossDamageAdd() {
  return curve(skinLevel(7), 1.50, 40) + state.upgrades.boss_damage_tier * 0.15; // Куся + апгрейд
}
function imperBonus() { return curve(skinLevel(10), 1.00, 50); }         // Абрикосик: до +100% звёзд

export function manualClickIncome() {
  return (
    baseClickIncome() *
    (1 + manualClickAdd()) *
    BuffManager.clickMult() *
    BuffManager.allMult()
  );
}

export function autoclickerPerSecond() {
  if (!state.autoclicker.unlocked || !state.autoclicker.is_active) return 0;

  return (
    (baseClickIncome() / state.autoclicker.click_interval_seconds) *
    (1 + autoclickerAdd()) *
    state.autoclicker.efficiency_multiplier *
    BuffManager.autoclickerMult() *
    BuffManager.allMult()
  );
}

export function dailyIngredientLimit() {
  return 100 + state.global.player_level * 5;
}

export function dailyDishLimit() {
  return 10 + state.global.prestige_count * 2 + state.upgrades.storage_tier;
}



export function effectivePity() {
  const pityReduce = Math.floor(curve(skinLevel(8), 18, 45)); // Снежок: до -18 к гаранту
  const discount = Math.min(state.upgrades.gacha_discount_tier, 3);
  return Math.max(220 - pityReduce - discount, 200);
}

export function totalSkinLevels() {
  return Object.values(state.skins).reduce(
    (sum, s) => sum + (s.unlocked ? s.level : 0),
    0
  );
}

// База звёзд престижа БЕЗ учёта уровня игрока и БЕЗ бонуса Абрикосика.
// Уровень не участвует: престиж и так доступен только со 100-го — это гейт, а не источник звёзд.
export function calculatePrestigeStarsBase() {
  const newProgress = Math.max(
    0,
    totalSkinLevels() - state.global.claimed_skin_levels_for_stars
  );
  const PER_SKIN_PROGRESS = 5;   // звёзд за каждые N уровней скинов
  const PER_PRESTIGE = 2;        // бонус за каждый повторный престиж
  return Math.max(
    0,
    Math.floor(newProgress / PER_SKIN_PROGRESS) +
      state.global.new_skins_cycle +
      state.global.prestige_count * PER_PRESTIGE
  );
}
export function calculatePrestigeStars() {
  const base = calculatePrestigeStarsBase();
  const total = Math.floor(base * (1 + imperBonus())); // + бонус Абрикосика
  return Math.max(1, total); // минимум 1 звезда за сам факт престижа (никогда не 0)
}

/************************************************************
 * BUFF MANAGER
 ************************************************************/

export const BuffManager = {
  cleanup() {
    const now = Date.now();
    state.buffs = state.buffs.filter((b) => b.expires > now);
  },

  addBuff(id, type, mult, durationSec) {
    const addMs = durationSec * (1 + buffDurationBonus()) * 1000; // Снежок продлевает баффы
    const existing = state.buffs.find((b) => b.id === id);
    if (existing) {
      // Таймеры суммируются: повторный бафф продлевает текущий, а не сбрасывает
      existing.type = type;
      existing.mult = Math.max(existing.mult, mult);
      existing.expires = Math.max(existing.expires, Date.now()) + addMs;
    } else {
      state.buffs.push({ id, type, mult, expires: Date.now() + addMs });
    }
  },

  multByType(type) {
    this.cleanup();

    return state.buffs
      .filter((b) => b.type === type)
      .reduce((acc, b) => acc * b.mult, 1);
  },

  clickMult() {
    return this.multByType("click");
  },

  autoclickerMult() {
    return this.multByType("autoclicker");
  },

  allMult() {
    return this.multByType("all");
  },

  critAdd() {
    return 0;
  },
};

/************************************************************
 * DAILY LIMITS
 ************************************************************/

export const DailyLimits = {
  check() {
    const today = new Date().toDateString();

    if (state.daily_limits.last_reset_timestamp !== today) {
      state.daily_limits.ingredient_purchase_used = 0;
      state.daily_limits.ready_dish_purchase_used = 0;
      state.daily_limits.last_reset_timestamp = today;
      state.gacha.daily_pulls_used = 0;
    }
  },
};

/************************************************************
 * CORE ECONOMY / PROGRESSION
 ************************************************************/

function addCoins(amount) {
  if (amount <= 0) return;
  state.global.coins += amount;
  state.global.lifetime_coins += amount;
}

function spendCoins(amount) {
  state.global.coins = Math.max(0, state.global.coins - amount);
}

function addPlayerXP(amount) {
  if (amount <= 0) return;

  state.global.player_xp_current += amount;

  while (state.global.player_xp_current >= state.global.player_xp_to_next) {
    state.global.player_xp_current -= state.global.player_xp_to_next;
    state.global.player_level += 1;
    state.global.player_xp_to_next = xpNeeded(state.global.player_level);
    onPlayerLevelUp();
  }
}

function addSkinXP(amount) {
  if (amount <= 0) return;

  const skinId = state.global.active_skin_id;
  const skin = state.skins[skinId];

  if (!skin?.unlocked) return;

  skin.xp_current += amount;

  while (skin.xp_current >= xpNeeded(skin.level)) {
    skin.xp_current -= xpNeeded(skin.level);
    skin.level += 1;
    onSkinLevelUp(skinId);
  }
}

/************************************************************
Текст текущего бонуса скина (для меню «Скины»).
Считается той же кривой curve(), что и механика → числа совпадают.
Параметры (MAX, SCALE) должны совпадать с формулами выше.
************************************************************/
export function skinBonusText(id) {
  const lvl = skinLevel(id);
  const ru = (state.settings && state.settings.language) !== "en";
  const pct = (max, scale) => Math.round(curve(lvl, max, scale) * 100);
  const flr = (max, scale) => Math.floor(curve(lvl, max, scale));
  const SEP = " \u00b7 ";
  const L = {
    "1":  ru ? "XP кормления"        : "Feeding XP",
    "2a": ru ? "шанс крита"          : "crit chance",
    "2b": ru ? "сила крита ×"        : "crit power ×",
    "3":  ru ? "ручной клик"         : "manual click",
    "4":  ru ? "автокликер"          : "autoclicker",
    "5":  ru ? "цена ингредиентов"   : "ingredient price",
    "6a": ru ? "двойное блюдо"       : "double meal",
    "6b": ru ? "цена блюд"           : "meal price",
    "7a": ru ? "урон по боссу"       : "boss damage",
    "7b": ru ? "кулдаун босса"       : "boss cooldown",
    "8a": ru ? "к гаранту гачи"      : "to gacha guarantee",
    "8b": ru ? "длительность баффов" : "buff duration",
    "9":  ru ? "опыт игрока за клик" : "player XP per click",
    "10": ru ? "звёзды престижа"     : "prestige stars"
  };
  const n = Number(id);
  if (n === 1)  return "+" + pct(1.20, 35) + "% " + L["1"];
  if (n === 2)  return "+" + pct(0.35, 45) + "% " + L["2a"] + SEP + L["2b"] + (2.5 + curve(lvl, 1.00, 60)).toFixed(1);
  if (n === 3)  return "+" + pct(1.00, 40) + "% " + L["3"];
  if (n === 4)  return "+" + pct(1.00, 40) + "% " + L["4"];
  if (n === 5)  return "-" + pct(0.25, 50) + "% " + L["5"];
  if (n === 6)  return pct(0.50, 40) + "% " + L["6a"] + SEP + "-" + pct(0.20, 50) + "% " + L["6b"];
  if (n === 7)  return "+" + pct(1.50, 40) + "% " + L["7a"] + SEP + "-" + pct(0.40, 50) + "% " + L["7b"];
  if (n === 8)  return "-" + flr(18, 45) + " " + L["8a"] + SEP + "+" + pct(0.50, 50) + "% " + L["8b"];
  if (n === 9)  return "+" + pct(0.80, 40) + "% " + L["9"];
  if (n === 10) return "+" + pct(1.00, 50) + "% " + L["10"];
  return "";
}

function onPlayerLevelUp() {
  hooks.toast(t("playerLevelToast", { level: state.global.player_level }));
  hooks.audioPlay("level_up");
  hooks.fxLevel();

  if (state.global.player_level >= 10 && !state.autoclicker.unlocked) {
    state.autoclicker.unlocked = true;
    state.autoclicker.is_active = true;
    hooks.toast(t("autoclickerUnlocked"));
  }

  Platform.logEvent("player_level_up", { level: state.global.player_level });
  hooks.renderAll();
}

function onSkinLevelUp(skinId) {
  const skin = CONFIG.skins[skinId];
  const data = state.skins[skinId];

  hooks.toast(t("skinLevelToast", { name: skin.name, level: data.level }));
  hooks.audioPlay("level_up");
  hooks.fxSkinLevel();

  Platform.logEvent("skin_level_up", { skin: skinId, level: data.level });
  hooks.updateCatAppearance();
}

export function buyIngredient(id, qty) {
  DailyLimits.check();

  const remaining = dailyIngredientLimit() - state.daily_limits.ingredient_purchase_used;
  const cost = ingredientCost(id) * qty;

  if (remaining < qty) {
    hooks.audioPlay("error");
    hooks.toast(t("ingredientLimit"));
    return false;
  }

  if (state.global.coins < cost) {
    hooks.audioPlay("error");
    hooks.toast(t("notEnoughCoins"));
    return false;
  }

  spendCoins(cost);
  state.economy.ingredients[id] += qty;
  state.daily_limits.ingredient_purchase_used += qty;

  hooks.audioPlay("coin");
  Platform.logEvent("first_purchase", { type: "ingredient", id, qty });
  TutorialSystem.onAction("buyIngredient", id);

  SaveManager.save();
  hooks.renderAll();
  hooks.refreshCurrentModal();

  return true;
}

export function buyDish(id, qty) {
  DailyLimits.check();

  const remaining = dailyDishLimit() - state.daily_limits.ready_dish_purchase_used;
  const cost = dishPrice(id) * qty;

  if (remaining < qty) {
    hooks.audioPlay("error");
    hooks.toast(t("dishLimit"));
    return false;
  }

  if (state.global.coins < cost) {
    hooks.audioPlay("error");
    hooks.toast(t("notEnoughCoins"));
    return false;
  }

  spendCoins(cost);
  state.economy.dishes[id] += qty;
  state.daily_limits.ready_dish_purchase_used += qty;

  hooks.audioPlay("coin");
  Platform.logEvent("first_purchase", { type: "dish", id, qty });

  SaveManager.save();
  hooks.renderAll();
  hooks.refreshCurrentModal();

  return true;
}

export function cookDish(id) {
  const dish = CONFIG.dishes[id];

  const canCook = Object.entries(dish.ingredients).every(
    ([ing, qty]) => state.economy.ingredients[ing] >= qty
  );

  if (!canCook) {
    hooks.audioPlay("error");
    hooks.toast(t("notEnoughIngredients"));
    return false;
  }

  for (const [ing, qty] of Object.entries(dish.ingredients)) {
    state.economy.ingredients[ing] -= qty;
  }

  let amount = 1;
  if (Math.random() < cookDoubleChance()) {   // 0 на 0-м уровне, до 50% на высоких
    amount += 1;
    hooks.toast(t("doubleDish"));
  }

  state.economy.dishes[id] += amount;
  state.statistics.dishes_cooked += 1;

  hooks.audioPlay("cook");
  hooks.fxCook();

  Platform.logEvent("first_cook", { dish: id });
  TutorialSystem.onAction("cook", id);

  SaveManager.save();
  hooks.renderAll();
  hooks.refreshCurrentModal();

  return true;
}

export function feedDish(id) {
  if (state.economy.dishes[id] <= 0) {
    hooks.audioPlay("error");
    hooks.toast(t("noDish"));
    return false;
  }

  const dish = CONFIG.dishes[id];
  state.economy.dishes[id] -= 1;

  const feedingXp = Math.floor(
    dish.xp * (1 + state.upgrades.bowls_tier * 0.1) * (1 + xpBonus())
  );

  // ← ФИКС: кормление даёт XP только скину, НЕ игроку (прогресс игрока = только клики)
  addSkinXP(feedingXp);

  if (dish.buff) {
    BuffManager.addBuff(id, dish.buff.type, dish.buff.mult, dish.buff.duration);
  }

  state.statistics.dishes_fed += 1;

  hooks.audioPlay("feed");
  hooks.fxFed(feedingXp);

  Platform.logEvent("first_feed", { dish: id, xp: feedingXp });
  TutorialSystem.onAction("feed");

  SaveManager.save();
  hooks.renderAll();
  hooks.refreshCurrentModal();

  return true;
}

export function doPrestige() {
  if (state.global.player_level < 100) {
    hooks.audioPlay("error");
    hooks.toast(t("prestigeAvailable100"));
    return;
  }

  const stars = calculatePrestigeStars();
  state.global.chaos_stars += stars;
  state.global.claimed_skin_levels_for_stars = totalSkinLevels();
  state.global.prestige_count += 1;
  state.statistics.prestiges += 1;

  state.global.coins = 0;
  state.global.player_level = 1;
  state.global.player_xp_current = 0;
  state.global.player_xp_to_next = xpNeeded(1);
  state.global.new_skins_cycle = 0;

  state.economy.ingredients = { meat: 0, fish: 0, berries: 0, herbs: 0, milk: 0 };
  state.economy.dishes = { kotleta: 0, dessert: 0, ukha: 0, feast: 0, rainbow: 0 };

  state.daily_limits.ingredient_purchase_used = 0;
  state.daily_limits.ready_dish_purchase_used = 0;
  state.daily_limits.last_reset_timestamp = new Date().toDateString();

  state.buffs = [];
  state.autoclicker.unlocked = false;
  state.autoclicker.is_active = false;

  hooks.audioPlay("prestige");
  hooks.fxPrestige();

  Platform.logEvent("prestige", {
    stars,
    prestige: state.global.prestige_count,
  });

  SaveManager.save();
  SaveManager.cloudSave();
  hooks.renderAll();
  hooks.refreshCurrentModal();

  hooks.toast(t("prestigeToast", { stars }));
}

export function buyUpgrade(key) {
  const cfg = CONFIG.upgrades[key];
  const stateKey = `${key}_tier`;
  const tier = state.upgrades[stateKey];

  if (tier >= cfg.max) {
    hooks.audioPlay("error");
    hooks.toast(t("upgradeMax"));
    return;
  }

  const cost = cfg.cost(tier);

  if (state.global.chaos_stars < cost) {
    hooks.audioPlay("error");
    hooks.toast(t("notEnoughStars"));
    return;
  }

  state.global.chaos_stars -= cost;
  state.upgrades[stateKey] += 1;

  hooks.audioPlay("coin");

  SaveManager.save();
  hooks.renderAll();
  hooks.refreshCurrentModal();
}

export function selectSkin(id) {
  id = Number(id);

  if (!getSkin(id).unlocked) return;

  state.global.active_skin_id = id;
  hooks.audioPlay("select_skin");
  hooks.updateCatAppearance();
  hooks.renderAll();
  hooks.refreshCurrentModal();

  SaveManager.save();
}

export function toggleAutoclicker() {
  if (!state.autoclicker.unlocked) return;

  state.autoclicker.is_active = !state.autoclicker.is_active;

  hooks.renderHUD();
  SaveManager.save();
}

export function performClick() {
  let gained = manualClickIncome();
  let crit = false;
  if (Math.random() < critChance()) {
    gained *= (2.5 + critMultBonus());   // Мечник усиливает сам множитель крита
    crit = true;
  }
  addCoins(gained);
  const baseXp = 1 + Math.floor(gained / 25);
  const xp = Math.max(1, Math.floor(baseXp * (1 + playerXpBonus()))); // Искра: +XP игрока
  addPlayerXP(xp);
  state.global.total_clicks += 1;
  if (state.global.total_clicks === 1) {
    Platform.logEvent("first_click");
  }
  TutorialSystem.checkClick();
  return { gained, crit, xp };
}

/************************************************************
 * TUTORIAL
 ************************************************************/

export const TutorialSystem = {
  steps: [
    "Погладь котика 3 раза.",          // 0
    "Открой магазин.",                  // 1
    "Купи мясо.",                       // 2
    "Купи травы.",                      // 3
    "Закрой магазин.",                  // 4
    "Открой готовку.",                  // 5
    "Приготовь котлету.",               // 6
    "Закрой готовку.",                  // 7
    "Покорми котика.",                  // 8
    "Открой босса.",                    // 9  ← демо: посмотреть превью
    "Закрой босса.",                    // 10 ← бой подождёт окончания обучения
    "Открой гачу.",                     // 11
    "Первая крутка.",                   // 12
    "Закрой гачу.",                     // 13 → complete()
  ],

  render() {
    hooks.renderTutorial();
  },

  checkClick() {
    if (state.tutorial.completed || state.tutorial.current_step !== 0) return;

    state.tutorial.clicks = (state.tutorial.clicks || 0) + 1;

    if (state.tutorial.clicks >= 3) {
      this.advance();
    } else {
      this.render();
    }
  },

  onAction(action, id) {
    if (state.tutorial.completed) return;
    const step = state.tutorial.current_step;
    const next = () => this.advance();
    const same = () => this.render();
    if (action === "buyIngredient") {
      if ((step === 2 && id === "meat") || (step === 3 && id === "herbs")) next();
      else same();
    } else if (action === "cook") {
      if (step === 6 && id === "kotleta") next();
      else same();
    } else if (action === "feed") {
      if (step === 8) next();
      else same();
    } else if (action === "openShop") {
      if (step === 1) next();   // игрок открыл магазин руками → шаг 1→2
      else same();
    } else if (action === "openCook") {
      if (step === 5) next();   // игрок открыл готовку руками → шаг 5→6
      else same();
    } else if (action === "openBoss") {
      if (step === 9) next();
      else same();
    } else if (action === "openGacha") {
      if (step === 11) next();
      else same();
    } else if (action === "gachaPull") {
      if (step === 12) next();
      else same();
    } else if (action === "closeModal") {
      if (step === 4 || step === 7 || step === 10 || step === 13) next();
      else same();
    }
  },

  advance() {
    state.tutorial.current_step += 1;
    if (state.tutorial.current_step >= this.steps.length) {
      this.complete();
    } else {
      this.render();
    }
    SaveManager.save();
  },

  complete(skipped = false) {
    state.tutorial.completed = true;
    this.render();
    if (!skipped) {
      // Награда за прохождение целиком (пропуск награды не даёт).
      addCoins(50);
      state.economy.dishes.kotleta += 1;
      hooks.showTutorialReward(); // окошко-поздравление вместо тоста
    } else {
      hooks.toast(t("tutorialComplete"));
    }
    Platform.logEvent("tutorial_complete", { skipped });
    SaveManager.save();
    hooks.renderAll();
  },
};

/************************************************************
 * GACHA
 ************************************************************/

export const GachaSystem = {
  busy: false,

  async pull() {
    if (this.busy) return;

    DailyLimits.check();

    const pullsLeft = state.gacha.max_daily_pulls - state.gacha.daily_pulls_used;

    if (pullsLeft <= 0) {
      hooks.audioPlay("error");
      hooks.toast(t("gachaNoPulls"));
      return;
    }

    this.busy = true;
    try {
      // Самая первая крутка в жизни игрока — бесплатно, без рекламы.
      const isFirstEverPull = state.statistics.gacha_pulls === 0;
      let rewarded = true;
      if (!isFirstEverPull) {
        hooks.musicPause();
        rewarded = await Platform.showRewardedVideo();
        hooks.musicResume();
      }
      if (!rewarded) {
        hooks.audioPlay("error");
        hooks.toast(t("adNotCompleted"));
        Platform.logEvent("ad_rewarded_fail", { source: "gacha" });
        return;
      }
      if (!isFirstEverPull) {
        state.statistics.ads_rewarded_watched += 1;
        Platform.logEvent("ad_rewarded_complete", { source: "gacha" });
      } else {
        Platform.logEvent("gacha_first_free_pull");
      }

      const results = this.doBatch();

      state.gacha.daily_pulls_used += 1;
      state.statistics.gacha_pulls += 1;

      SaveManager.save();
      SaveManager.cloudSave();
      hooks.renderAll();
      hooks.showGachaResults(results);
    } finally {
      this.busy = false;
    }
  },

  doBatch() {
    const results = [];
    let skinDroppedInBatch = false; // ← максимум 1 скин за крутку
    const pityLimit = effectivePity();
    // Одна база на всю крутку → вся щедрость гачи крутится этой строкой.
    const base = 2 + Math.floor(state.global.player_level * 0.5);
    // Неперекрывающиеся диапазоны по редкости: следующая редкость всегда строго ценнее.
    const coinRange = {
      common:    [0.8, 1.2],
      rare:      [1.8, 2.4],
      epic:      [3.5, 4.8],
      legendary: [7.0, 10.0],
    };
    const rollCoins = (rarity) => {
     const [lo, hi] = coinRange[rarity] || coinRange.common;
     const f = lo + Math.random() * (hi - lo);
     return Math.max(1, Math.floor(base * f)); // ← «+0» математически невозможно
    };
    const MULT = { common: 1, rare: 2, epic: 4, legendary: 8 };
    for (let i = 0; i < 10; i++) {
      state.gacha.pity_counter += 1;
      const guaranteed = state.gacha.pity_counter >= pityLimit;
      let rarity;
      if (guaranteed && !skinDroppedInBatch) {
        rarity = "skin";
      } else {
        const roll = Math.random() * 100;
        if (roll < 0.5) rarity = "skin";            // 0.5%
        else if (roll < 1.5) rarity = "legendary";  // 1%
        else if (roll < 5.5) rarity = "epic";       // 4%
        else if (roll < 18) rarity = "rare";        // 12.5%
        else rarity = "common";                     // 82%
        if (rarity === "skin" && skinDroppedInBatch) rarity = "dish"; // ← второй скин за крутку → блюдо
      }
      if (rarity === "skin") {
        const locked = [];
        for (let id = 1; id <= 10; id++) {
          if (!getSkin(id).unlocked) locked.push(id);
        }
        if (locked.length > 0) {
          const skinId = pick(locked);
          state.skins[skinId] = { unlocked: true, level: 1, xp_current: 0, unlocked_at: Date.now() };
          state.global.new_skins_cycle += 1;
          state.gacha.pity_counter = 0;
          skinDroppedInBatch = true;
          results.push({ icon: CONFIG.skins[skinId].idle, label: CONFIG.skins[skinId].name, isSkin: true, rarity: "legendary" });
          // Фанфару скина НЕ играем здесь: doBatch генерирует батч ДО показа результатов,
          // т.е. пока все карты рубашкой вверх → звук спойлерил интригу крутки.
          // Звук перенесён в ui.js (showGachaResults) — играется ровно когда скин-карта
          // переворачивается лицом. Аналитику события оставляем как прежде.
          Platform.logEvent("gacha_skin_received", { skin: skinId });
        } else {
          // Все скины открыты: гарант конвертируется в фикс-монеты (кепки больше нет).
          state.gacha.pity_counter = 0;
          skinDroppedInBatch = true;
          const converted = Math.max(1, Math.floor(base * 12));
          addCoins(converted);
          results.push({ icon: CONFIG.uiIcons.coin, label: `+${fmt(converted)}`, rarity: "common" });
        }
        continue;
      }
      // Содержимое: epic/legendary -> 45% монеты / 35% блюда / 20% бафф; common/rare -> 50/50
      let content;
      if (rarity === "epic" || rarity === "legendary") {
        const cRoll = Math.random() * 100;
        if (cRoll < 45) content = "coins";
        else if (cRoll < 80) content = "dish";
        else content = "buff";
      } else {
        content = Math.random() < 0.5 ? "coins" : "dish";
      }
      const mult = MULT[rarity] || 1;
      if (content === "coins") {
        const amount = rollCoins(rarity); // ← диапазон редкости, без кепки
        addCoins(amount);
        results.push({ icon: CONFIG.uiIcons.coin, label: `+${fmt(amount)}`, rarity });
      } else if (content === "dish") {
        const dishId = this.randomDish();
        state.economy.dishes[dishId] += mult;   // количество блюд = множитель редкости
        const dName = CONFIG.dishes[dishId].name;
        results.push({ icon: CONFIG.dishes[dishId].icon, label: mult > 1 ? `${dName} ×${mult}` : dName, rarity });
      } else {
        // Бафф: epic — базовая длительность, legendary — ×2 дольше. Множитель не растёт.
        const durMult = rarity === "legendary" ? 2 : 1;
        const buff = pick([
          { id: "gacha_click", type: "click", mult: 1.2, duration: 60 },
          { id: "gacha_auto", type: "autoclicker", mult: 1.15, duration: 60 },
          { id: "gacha_all", type: "all", mult: 1.2, duration: 30 },
        ]);
        const duration = buff.duration * durMult;
        buff.label = `${t(buff.type)} ×${buff.mult}, ${duration}${t("secondsShort")}`;
        // Бафф не активируется сразу — копится в сейв и включится при выходе из гачи
        state.gacha.pending_buffs.push({ id: buff.id, type: buff.type, mult: buff.mult, duration });
        results.push({ icon: CONFIG.uiIcons.buff, label: buff.label, rarity });
      }
    }
    state.gacha.history.unshift({
      time: Date.now(),
      items: results.map((r) => r.label),
    });
    if (state.gacha.history.length > 20) state.gacha.history.pop();
    return results;
  },

  randomDish() {
    return pick(["kotleta", "dessert"]); // ← только basic: минимум XP, гача не качает скин
  },

  applyPendingBuffs() {
    const pending = state.gacha.pending_buffs;
    if (!pending || !pending.length) return;
    for (const b of pending) {
      BuffManager.addBuff(b.id, b.type, b.mult, b.duration);
    }
    state.gacha.pending_buffs = [];
    SaveManager.save();
    hooks.renderBuffBar();
    hooks.renderHUD();
  },
};

/************************************************************
 * BOSS SYSTEM
 ************************************************************/

export const BossSystem = {
  active: false,
  hp: 0,
  maxHp: 0,
  endsAt: 0,
  timer: null,
  lastAttack: 0,
  heat: 0,
  pausedAt: 0,
  tier: 1,

  rewardTiers() {
    return {
      1: { coins: 500, dishes: [["dessert", 1]], buffDuration: 300 },
      2: { coins: 2000, dishes: [["feast", 2]], buffDuration: 600 },
      3: { coins: 5000, dishes: [["rainbow", 1]], buffDuration: 900 },
      4: { coins: 10000, dishes: [["rainbow", 2]], buffDuration: 1200 },
    };
  },

  getTier() {
    const lvl = state.global.player_level;

    if (lvl <= 20) return 1;
    if (lvl <= 50) return 2;
    if (lvl <= 80) return 3;

    return 4;
  },

  canStart() {
    return Date.now() >= (state.global.next_boss_time || 0);
  },

  start() {
    if (this.active) {
      hooks.openBossFight();
      return;
    }
    // Во время обучения бой недоступен: превью посмотреть можно, драться — рано.
    if (!state.tutorial.completed) {
      hooks.audioPlay("error");
      hooks.toast(t("bossWaitTutorial"));
      return;
    }
    if (!this.canStart()) {
      hooks.audioPlay("error");
      hooks.toast(
        t("bossAvailableIn", {
          time: fmtTime(state.global.next_boss_time - Date.now()),
        })
      );
      return;
    }

    this.tier = this.getTier();

    this.maxHp = Math.floor(
      1000 *
        Math.min(Math.pow(1.3, state.global.player_level), 500) *
        (1 + state.global.prestige_count * 0.5)
    );

    this.hp = this.maxHp;
    this.endsAt = Date.now() + 60000;
    this.active = true;
    this.lastAttack = 0;
    this.heat = 0;
    state.statistics.boss_fights += 1;
    state.global.last_boss_fight_timestamp = Date.now();

    hooks.audioPlay("boss_start");
    Platform.logEvent("boss_start", { tier: this.tier, hp: this.maxHp });

    hooks.openBossFight();

    clearInterval(this.timer);
    this.pausedAt = 0;
    this.timer = setInterval(() => this.tick(), 200);
  },

  pause() {
    if (!this.active) return;
    clearInterval(this.timer);
    this.timer = null;
    this.pausedAt = Date.now();
  },

  resume() {
    if (!this.active) return;
    if (this.pausedAt) {
      this.endsAt += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), 200);
    }
  },

  damage(heat = 0) {
    const bonus = bossDamageAdd();
    const baseFrac = 0.016;
    const base = this.maxHp * baseFrac * (1 + bonus);
    const cap = Math.ceil(this.maxHp / 12);
    // Вилка урона: 70–130% от базового.
    // heat (0..1) смещает распределение к верхнему краю: быстрый темп -> большие числа чаще.
    const minF = 0.7, maxF = 1.3;
    const r = Math.random();
    const exp = 1.7 - heat * 1.2;   // heat 0 -> 1.7 (чаще малые), heat 1 -> 0.5 (чаще большие)
    const shaped = Math.pow(r, exp);
    const factor = minF + (maxF - minF) * shaped;
    const dmg = Math.max(1, Math.floor(base * factor));
    return Math.min(dmg, cap);
  },

  attack() {
    if (!this.active) return;

    const now = Date.now();

    if (now - this.lastAttack < 250) return;
    const interval = now - this.lastAttack;
    this.lastAttack = now;
    // Темп: 250 мс (максимально быстро) -> 1, >=1300 мс -> 0
    const speed = Math.max(0, Math.min(1, (1300 - interval) / (1300 - 250)));
    this.heat = this.heat * 0.55 + speed * 0.45;   // сглаживание темпа
    const dmg = this.damage(this.heat);
    this.hp = Math.max(0, this.hp - dmg);

    hooks.audioPlay("boss_hit");
    hooks.fxBossHit(dmg);
    hooks.shakeScreen();
    hooks.updateBossFightUI();

    if (this.hp <= 0) {
      this.win();
    }
  },

  tick() {
    if (!this.active) return;

    const left = this.endsAt - Date.now();

    hooks.updateBossFightUI();

    if (left <= 0) {
      this.lose();
    }
  },

  win() {
    clearInterval(this.timer);
    this.active = false;

    const rewards = this.rewardTiers()[this.tier];

    addCoins(rewards.coins);

    for (const [dishId, qty] of rewards.dishes) {
      state.economy.dishes[dishId] += qty;
    }

    BuffManager.addBuff("boss", "all", 1.2, rewards.buffDuration);

    state.global.next_boss_time = Date.now() + 24 * 3600 * 1000 * (1 - bossCooldownReduction());
    state.statistics.boss_wins += 1;

    hooks.audioPlay("boss_win");
    Platform.logEvent("boss_win", { tier: this.tier });

    SaveManager.save();
    SaveManager.cloudSave();
    hooks.renderAll();
    hooks.showBossResult(true, rewards);
  },

  lose() {
    clearInterval(this.timer);
    this.active = false;
    this.pausedAt = 0;

    const rewards = this.rewardTiers()[this.tier];
    const coins = Math.floor(rewards.coins * 0.25);

    addCoins(coins);

    state.global.next_boss_time = Date.now() + 28 * 3600 * 1000 * (1 - bossCooldownReduction());

    hooks.audioPlay("boss_lose");
    Platform.logEvent("boss_lose", { tier: this.tier });

    SaveManager.save();
    SaveManager.cloudSave();
    hooks.renderAll();
    hooks.showBossResult(false, { coins });
  },
};

/************************************************************
 * UPDATE LOOP
 ************************************************************/

let uiAccumulator = 0;
let secondAccumulator = 0;
let autoSaveAccumulator = 0;
let cloudAccumulator = 0;

export function update(dt) {
  DailyLimits.check();
  BuffManager.cleanup();

  if (state.autoclicker.unlocked && state.autoclicker.is_active) {
    const income = autoclickerPerSecond() * dt;
    if (income > 0) addCoins(income);
  }

  state.statistics.playtime_seconds += dt;

  uiAccumulator += dt;
  secondAccumulator += dt;
  autoSaveAccumulator += dt;
  cloudAccumulator += dt;

  if (uiAccumulator >= 0.2) {
    uiAccumulator = 0;
    hooks.renderHUD();
  }

  if (secondAccumulator >= 1) {
    secondAccumulator = 0;
    hooks.renderBuffBar();
    hooks.renderQuickFeed();
  }

  if (autoSaveAccumulator >= 60) {
    autoSaveAccumulator = 0;
    SaveManager.save();
  }
  if (cloudAccumulator >= 600) {
    cloudAccumulator -= 600;
    SaveManager.cloudSave();
  }
}

/************************************************************
 * INIT
 ************************************************************/

export async function initGame() {
  await Platform.init();
  await SaveManager.load();
  normalizeState();
}