// state.js — constants, utils, audio, fullscreen helpers, storage
(function () {
  const App = (window.App = window.App || {});

  App.TICKER = "SPX";
  App.MAX_POS = 1000;

  App.utils = {
    fmt2: (n) => Number(n).toFixed(2),
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    isMobile: () => (typeof window !== "undefined" && window.innerWidth <= 640),
    loadJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
  };

  // Local leaderboard (keep for fair use at the booth)
  App.LB_KEY = "liquidity_fair_leaderboard_v16";
  App.loadLB = () => App.utils.loadJSON(App.LB_KEY, []);
  App.saveLB = (arr) => App.utils.saveJSON(App.LB_KEY, arr);

  // Audio
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx;
  function ensureAudio() { if (!audioCtx) { try { audioCtx = new AudioCtx(); } catch (e) {} } }
  function _envGain(g, t0, d, vol = 0.03) { try { g.gain.setValueAtTime(Math.max(0.0001, vol), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); } catch {} }
  App.audio = {
    ensure() { ensureAudio(); },
    beep(freq = 520, dur = 0.12, vol = 0.03) {
      if (!audioCtx) return;
      const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = freq; _envGain(g, t, dur, vol);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + dur);
    },
    chirp(a = 420, b = 880, d = 0.18, v = 0.03) {
      if (!audioCtx) return;
      const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(a, t); o.frequency.linearRampToValueAtTime(b, t + d); _envGain(g, t, d, v);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + d);
    },
    chord(freqs = [523.25, 659.25, 783.99], d = 0.6, v = 0.025) {
      if (!audioCtx) return;
      const t = audioCtx.currentTime, bus = audioCtx.createGain(); bus.gain.setValueAtTime(v, t); bus.connect(audioCtx.destination);
      freqs.forEach(f => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "sine"; o.frequency.value = f; _envGain(g, t, d, 1); o.connect(g).connect(bus); o.start(t); o.stop(t + d); });
    },
    resume() { try { ensureAudio(); audioCtx && audioCtx.resume(); } catch {} }
  };

  // Fullscreen
  App.fullscreen = {
    async enter() { const el = document.documentElement; if (el.requestFullscreen) return el.requestFullscreen(); if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen(); },
    async exit() { if (document.exitFullscreen) return document.exitFullscreen(); if (document.webkitExitFullscreen) return document.webkitExitFullscreen(); },
  };
})();
