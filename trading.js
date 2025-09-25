// trading.js — liquidity impact, VWAP, trading, reserve logic
(function () {
  const App = (window.App = window.App || {});
  const { clamp } = App.utils;
  const { MAX_POS } = App;

  // Liquidity constants
  const BASE_DEPTH = 1000;
  const IMP_MIN = 0.005, IMP_MAX = 0.90, IMP_POW = 2.2, LIQ_PWR = 0.5;

  function updateAvgPriceAfterTrade(avgPriceRef, pOld, side, qty, vwap) {
    const pNew = side === "BUY" ? pOld + qty : pOld - qty;
    if (pOld === 0) avgPriceRef.current = vwap;
    else if (Math.sign(pOld) === Math.sign(pNew)) {
      if (Math.abs(pNew) > Math.abs(pOld)) {
        avgPriceRef.current = (Math.abs(pOld) * avgPriceRef.current + qty * vwap) / Math.abs(pNew);
      }
    } else {
      const crossQty = Math.abs(pNew);
      avgPriceRef.current = crossQty > 0 ? vwap : null;
    }
    if (pNew === 0) avgPriceRef.current = null;
  }

  function triggerRevertBoost(qty, fair, mid, setRevertStrength, setRevertTicks) {
    if (qty >= 500) {
      const deviation = Math.abs(fair - mid);
      const strength = 0.08 * (qty / 1000) * (deviation / 1.0);
      setRevertStrength(strength);
      setRevertTicks(5);
    }
  }

  // MAIN trade() — uses ref-syncing setters (fix A)
  function trade(opts) {
    const {
      side, size, spread,
      posRef, cashRef, reserveRef, midRef, fairRef, availRef,
      setPos, setCash, setReserve, setMid, setAvail, setTick, setHist,
      avgPriceRef, soundOn,
      setNotice,
      tradesRef, tickRef,
      setRevertStrength, setRevertTicks,
      audio // {chirp}
    } = opts;

    const reqQty = Math.max(1, Math.round(size));
    const sgn = side === "BUY" ? +1 : -1;

    // position cap
    const maxAdd = (sgn>0) ? MAX_POS - posRef.current : MAX_POS + posRef.current;
    const qty = clamp(reqQty, 0, Math.max(0, maxAdd));
    if (qty === 0) {
      setNotice(`Position limit reached (±${MAX_POS} sh).`);
      setTimeout(() => setNotice(""), 1200);
      return;
    }

    // Impact -> endMid
    const startMid = midRef.current;
    const aD = Math.max(50, availRef.current);
    const after100 = Math.max(0, qty - 100);
    const x = after100 / 900;
    const curve = Math.pow(x, IMP_POW);
    const liqF = Math.pow(BASE_DEPTH / aD, LIQ_PWR);
    const impactMag = (IMP_MIN + (IMP_MAX - IMP_MIN) * curve) * liqF;
    const impact = sgn * impactMag;
    const endMid = Math.max(1, startMid + impact);

    // VWAP slippage
    const vwap = side==="BUY"
      ? (startMid + spread/2) + 0.5*(endMid-startMid)
      : (startMid - spread/2) + 0.5*(endMid-startMid);

    const notional = qty * vwap;
    const fee = notional * 0.0001;

    // maintain VWAP (fix first trade)
    const pOld = posRef.current;
    updateAvgPriceAfterTrade(avgPriceRef, pOld, side, qty, vwap);

    if (side === "BUY") {
      setCash(c => c - fee);
      if (pOld < 0) {
        setReserve(r => {
          const r2 = r - notional;
          if (r2 >= 0) return r2;
          setCash(c => c + r2); // r2 negative -> reduce cash
          return 0;
        });
      } else {
        setCash(c => c - notional);
      }
      setPos(p => p + qty);
    } else {
      setCash(c => c - fee);
      if (pOld > 0) setCash(c => c + notional);
      else setReserve(r => r + notional);
      setPos(p => p - qty);
    }

    // sweep reserve if short covered
    setTimeout(() => {
      if (posRef.current >= 0 && reserveRef.current > 0) {
        setCash(c => c + reserveRef.current);
        setReserve(0);
      }
    }, 0);

    if (soundOn) audio.chirp( side==="BUY" ? 420 : 880, side==="BUY" ? 880 : 420, 0.18, 0.03);
    if (navigator.vibrate) navigator.vibrate(15);

    setMid(endMid);
    setTick(t => { const t2 = t + 1; setHist(h => [...h, { t: t2, mid: endMid }].slice(-700)); return t2; });

    // record absolute tick for scrolling markers
    tradesRef.current.push({ t: tickRef.current, price: endMid, side });

    // consume liquidity
    setAvail(a => clamp(a - qty, 50, BASE_DEPTH));

    // faster reversion after large orders
    triggerRevertBoost(qty, fairRef.current, endMid, setRevertStrength, setRevertTicks);
  }

  App.trading = { BASE_DEPTH, trade };
})();
