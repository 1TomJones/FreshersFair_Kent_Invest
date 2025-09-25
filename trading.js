// trading.js — order impact, VWAP, cash/reserve logic

(function () {
  const BASE_DEPTH = 1000;
  const REPLENISH_PER_SEC = 0.10;

  // Impact curve (almost no impact up to 100 shares; ramps to 1000)
  const IMPACT_MIN = 0.005;
  const IMPACT_MAX = 0.90;
  const IMPACT_CURVE_POW = 2.2;
  const LIQ_POWER = 0.5;

  function computeImpact(qty, aDepth) {
    const after100 = Math.max(0, qty - 100);
    const x = after100 / 900;                         // 0..1
    const curve = Math.pow(x, IMPACT_CURVE_POW);
    const liquidityFactor = Math.pow(BASE_DEPTH / Math.max(50, aDepth), LIQ_POWER);
    const mag = (IMPACT_MIN + (IMPACT_MAX - IMPACT_MIN) * curve) * liquidityFactor;
    return mag;
  }

  function replenishDepth(avail, intervalMs) {
    const repl = BASE_DEPTH * (REPLENISH_PER_SEC * (intervalMs / 1000));
    return Math.max(50, Math.min(BASE_DEPTH, avail + repl));
  }

  function updateVWAP(avg, pOld, side, qty, vwap) {
    const pNew = side === "BUY" ? pOld + qty : pOld - qty;
    if (pOld === 0) return { vwap: vwap, pNew };
    if (Math.sign(pOld) === Math.sign(pNew)) {
      if (Math.abs(pNew) > Math.abs(pOld)) {
        const newAvg = (Math.abs(pOld) * avg + qty * vwap) / Math.abs(pNew);
        return { vwap: newAvg, pNew };
      }
      return { vwap: avg, pNew };
    } else {
      const crossQty = Math.abs(pNew);
      const newAvg = crossQty > 0 ? vwap : null;
      return { vwap: newAvg, pNew };
    }
  }

  window.Trading = {
    BASE_DEPTH,
    computeImpact,
    replenishDepth,
    updateVWAP
  };
})();
