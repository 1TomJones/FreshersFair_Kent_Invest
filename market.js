// market.js — price engine & news schedule

(function () {
  // Price noise & drift params
  const SIGMA_CALM = 0.0015;
  const SIGMA_VOL  = 0.0030;
  const JUMP_PROB  = 0.001;
  const JUMP_MIN   = 0.003;
  const JUMP_MAX   = 0.010;

  // Drift strength toward fair-value (stronger when far away)
  const BETA_PER_SEC = 0.35;

  function buildNewsSchedule(startMs, durationSec) {
    const last = durationSec - 15;
    const arr = [];
    for (let s = 15; s <= last; s += 15) arr.push(startMs + s * 1000);
    return arr;
  }

  function tickPrice({ mid, fair, regime }) {
    const sigma = (regime === "Calm" ? SIGMA_CALM : SIGMA_VOL) * fair;
    let step = (Math.random() * 2 - 1) * sigma;

    // occasional jump
    if (Math.random() < JUMP_PROB) {
      const mag = JUMP_MIN + Math.random() * (JUMP_MAX - JUMP_MIN);
      step += (Math.random() < 0.5 ? -1 : +1) * fair * mag;
    }

    // drift towards fair (stronger when far)
    const d = fair - mid;
    const baseFactor = Math.max(0, Math.min(1, Math.abs(d) / 10));
    const betaTick = BETA_PER_SEC / 10; // engine is ~10 Hz
    step += betaTick * d * baseFactor;

    return Math.max(1, mid + step);
  }

  window.Market = { buildNewsSchedule, tickPrice };
})();
