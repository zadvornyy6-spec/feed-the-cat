/* sfx.js — ГИБРИДНЫЙ звук для «Накорми котика после битвы»
   9 звуков = процедурно (Web Audio), 7 звуков = твой сэмпл с авто-fallback на код.
   API не изменился: SFX.play(name) / SFX.unlock() / SFX.setVolume(v) / SFX.setMute(m)
   Новое: SFX.loadSamples() — подтягивает твои .ogg/.mp3 из папки. */
(function () {
  var ctx = null, master = null, noiseBuf = null, vol = 0.5, muted = false;
  var sampleBuf = {};                 // имя -> декодированный AudioBuffer
  var sampleReady = {};               // имя -> true когда буфер готов
  // имена, которые ПЫТАЮТСЯ играть сэмплом (если файла нет — уйдут в процедурный fallback)
  var SAMPLE_NAMES = ['gacha_skin', 'prestige', 'level_up', 'feed', 'boss_start', 'select_skin', 'error'];

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : vol;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function shape(g, st, peak, attack, sustain, release) {
    g.gain.setValueAtTime(0.0001, st);
    g.gain.linearRampToValueAtTime(peak, st + attack);
    if (sustain > 0) g.gain.setValueAtTime(peak, st + attack + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, st + attack + sustain + release);
  }
  function tone(o) {
    ensure();
    var at = o.attack || 0.008, su = o.sustain || 0, re = o.release || 0.15;
    var dur = at + su + re, st = ctx.currentTime + (o.t || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, st);
    if (o.detune) osc.detune.value = o.detune;
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, st + dur);
    shape(g, st, o.peak || 0.2, at, su, re);
    var out = g;
    if (o.trem) {
      var tg = ctx.createGain(); tg.gain.value = 1;
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.trem.rate; lg.gain.value = o.trem.depth;
      lfo.connect(lg).connect(tg.gain); g.connect(tg); out = tg;
      lfo.start(st); lfo.stop(st + dur + 0.05);
    }
    out.connect(o.dest || master); osc.connect(g);
    osc.start(st); osc.stop(st + dur + 0.05);
  }
  function noise(o) {
    ensure();
    var at = o.attack || 0.004, su = o.sustain || 0, re = o.release || 0.1;
    var dur = at + su + re, st = ctx.currentTime + (o.t || 0);
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = o.filterType || 'lowpass'; f.frequency.value = o.filter || 1000;
    var g = ctx.createGain(); shape(g, st, o.peak || 0.2, at, su, re);
    s.connect(f).connect(g).connect(master); s.start(st); s.stop(st + dur + 0.05);
  }
  function arp(notes, step, o) { notes.forEach(function (n, i) { tone(Object.assign({ freq: n, t: (o.t0 || 0) + i * step }, o)); }); }
  function shimmer(start, n) { for (var i = 0; i < n; i++) tone({ freq: 2400 - i * 220, type: 'sine', peak: 0.1, attack: 0.003, release: 0.12, t: start + i * 0.05 }); }

  var N = { C5:523.25, E5:659.25, G5:783.99, C6:1046.5, E6:1318.51, B5:987.77 };

  /* ---- процедурная библиотека (8 как было + НОВЫЙ boss_win) ---- */
  var lib = {
    click:        function () { tone({ freq: 620, to: 320, release: 0.09, peak: 0.22 }); },
    crit:         function () { tone({ freq: 900, to: 520, release: 0.1, type: 'triangle', peak: 0.24 }); tone({ freq: 1320, release: 0.06, peak: 0.12, t: 0.02 }); noise({ release: 0.03, peak: 0.07, filter: 3000 }); },
    coin:         function () { tone({ freq: N.B5, release: 0.08, type: 'triangle', peak: 0.2 }); tone({ freq: N.E6, release: 0.16, type: 'triangle', peak: 0.2, t: 0.08 }); },
    cook:         function () { tone({ freq: 220, to: 430, release: 0.12, peak: 0.2 }); noise({ release: 0.18, peak: 0.06, filter: 1500, t: 0.02 }); tone({ freq: 300, to: 520, release: 0.1, peak: 0.12, t: 0.14 }); },
    boss_hit:     function () { noise({ release: 0.08, peak: 0.18, filter: 900 }); tone({ freq: 150, to: 80, attack: 0.004, release: 0.12, peak: 0.22 }); },
    boss_lose:    function () { tone({ freq: 392, release: 0.18, peak: 0.18 }); tone({ freq: 330, release: 0.18, peak: 0.17, t: 0.18 }); tone({ freq: 262, release: 0.4, peak: 0.16, t: 0.36 }); },
    button_open:  function () { tone({ freq: 320, to: 640, release: 0.12, peak: 0.18 }); noise({ release: 0.08, peak: 0.04, filter: 2500 }); },
    button_close: function () { tone({ freq: 520, to: 240, release: 0.1, peak: 0.16 }); },

    /* НОВЫЙ boss_win: разгон-фанфара → колокол-удар → восходящее арпеджио → полный тёплый аккорд → сияние */
    boss_win: function () {
      tone({ freq: 300, to: 720, attack: 0.01, release: 0.12, type: 'triangle', peak: 0.14 });                 // фанфарный разгон
      tone({ freq: N.C5, type: 'sine', peak: 0.16, attack: 0.004, release: 0.55 });                            // колокол-удар (вес)
      tone({ freq: N.C5 * 2, type: 'sine', peak: 0.06, attack: 0.004, release: 0.4 });                         // обертон колокола
      arp([N.C5, N.E5, N.G5, N.C6, N.E6], 0.075, { t0: 0.12, type: 'triangle', peak: 0.16, release: 0.2 });    // восходящее арпеджио
      // финальный аккорд с лёгким расстроем = «тёплый» хор, а не сухие бипы
      tone({ freq: N.C5, type: 'sine', peak: 0.12, attack: 0.01, sustain: 0.35, release: 0.8, t: 0.5, detune: -4 });
      tone({ freq: N.E5, type: 'sine', peak: 0.10, attack: 0.01, sustain: 0.35, release: 0.8, t: 0.5, detune:  5 });
      tone({ freq: N.G5, type: 'sine', peak: 0.09, attack: 0.01, sustain: 0.35, release: 0.8, t: 0.5, detune: -3 });
      tone({ freq: N.C6, type: 'sine', peak: 0.08, attack: 0.01, sustain: 0.35, release: 0.9, t: 0.5, detune:  6 });
      shimmer(0.55, 5);                                                                                        // сияние длиннее/ярче
      tone({ freq: 2640, type: 'sine', peak: 0.05, attack: 0.003, release: 0.5, t: 0.95 });                    // верхняя искра-точка
    }
  };

  /* ---- процедурные заглушки для 7 «сэмплных» имён (fallback, пока нет файла) ---- */
  lib.gacha_skin  = function () { arp([N.C5, N.E5, N.G5, N.C6, N.E6], 0.08, { type: 'triangle', peak: 0.16, release: 0.16 }); tone({ freq: N.C5, type: 'sine', peak: 0.12, attack: 0.01, sustain: 0.3, release: 0.4, t: 0.45 }); shimmer(0.5, 4); };
  lib.prestige    = function () { tone({ freq: 300, to: 1500, attack: 0.02, sustain: 0.3, release: 0.2, peak: 0.15, trem: { rate: 14, depth: 0.4 } }); tone({ freq: 880, peak: 0.14, attack: 0.01, sustain: 0.2, release: 0.7, t: 0.3 }); shimmer(0.5, 4); };
  lib.level_up    = function () { arp([N.C5, N.E5, N.G5, N.C6], 0.09, { type: 'triangle', peak: 0.18, release: 0.14 }); };
  lib.feed        = function () { tone({ freq: 190, type: 'sine', peak: 0.16, attack: 0.05, sustain: 0.35, release: 0.2, trem: { rate: 24, depth: 0.6 } }); tone({ freq: 520, to: 240, attack: 0.005, release: 0.08, peak: 0.14 }); };
  lib.boss_start  = function () { tone({ freq: 110, release: 0.25, peak: 0.22 }); tone({ freq: 180, to: 430, attack: 0.02, sustain: 0.3, release: 0.2, type: 'triangle', peak: 0.13, trem: { rate: 8, depth: 0.3 }, t: 0.05 }); noise({ release: 0.15, peak: 0.05, filter: 600 }); };
  lib.select_skin = function () { tone({ freq: 980, release: 0.09, type: 'sine', peak: 0.13 }); tone({ freq: 1470, release: 0.14, type: 'sine', peak: 0.09, t: 0.05 }); shimmer(0.09, 2); };
  lib.error       = function () { tone({ freq: 240, to: 170, release: 0.11, type: 'sine', peak: 0.15 }); tone({ freq: 190, to: 140, release: 0.16, type: 'sine', peak: 0.11, t: 0.09 }); };

  /* ---- проигрывание сэмпла (пул голосов: каждый play = новый source) ---- */
  function playSample(name) {
    var src = ctx.createBufferSource();
    src.buffer = sampleBuf[name];
    src.connect(master);              // через master → громкость и mute работают и для сэмплов
    src.start();
  }

  /* ---- загрузка твоих файлов. basePath='sfx/', ext=['ogg','mp3'] ---- */
  function pickExt() {
    // mp3-first: в Assets/sfx/ лежат только mp3, поэтому ogg-проба всегда давала 404.
    // Фиксируем порядок ['mp3','ogg'] — бесполезный ogg-запрос больше не делается.
    return ['mp3', 'ogg'];
  }
  function loadOne(name, basePath, exts, done) {
    var i = 0;
    (function tryNext() {
      if (i >= exts.length) { done(false); return; }              // ни один формат не подошёл → fallback на код
      var url = basePath + name + '.' + exts[i++];
      fetch(url).then(function (r) {
        if (!r.ok) throw 0;
        return r.arrayBuffer();
      }).then(function (buf) {
        return ctx.decodeAudioData(buf);
      }).then(function (decoded) {
        sampleBuf[name] = decoded; sampleReady[name] = true; done(true);
      }).catch(function () { tryNext(); });
    })();
  }

  window.SFX = {
    play: function (name) {
      ensure();
      if (SAMPLE_NAMES.indexOf(name) >= 0 && sampleReady[name]) { playSample(name); return; } // сэмпл готов → он
      if (lib[name]) lib[name]();                                                          // иначе процедура (или fallback)
    },
    unlock: function () { ensure(); },
    names: Object.keys(lib),
    setVolume: function (v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = muted ? 0 : vol; },
    setMute: function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : vol; },
    /* позвать один раз после первого тапа (нужен живой ctx для decodeAudioData) */
    loadSamples: function (opts) {
      ensure();
      opts = opts || {};
      var basePath = opts.path || 'sfx/';
      var exts = opts.ext || pickExt();
      var list = opts.names || SAMPLE_NAMES;
      list.forEach(function (n) { loadOne(n, basePath, exts, function () {}); });
    },
    isSample: function (name) { return !!sampleReady[name]; }   // для отладки: играет сэмпл или код
  };
})();