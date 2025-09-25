// market.js — news, schedules, drift, randomness
(function () {
  const App = (window.App = window.App || {});
  const { clamp } = App.utils;

  // Macro news set
  const NEWS = [
    { h:"BoE cuts rates 50bps",            why:"Cheaper borrowing supports equities",              pct:+0.10 },
    { h:"BoE hikes rates 50bps",           why:"Higher rates weigh on valuations",                 pct:-0.10 },
    { h:"Fed signals strong dovish turn",  why:"Lower expected path of rates",                     pct:+0.08 },
    { h:"Fed turns firmly hawkish",        why:"Higher-for-longer rates priced in",                pct:-0.08 },
    { h:"Inflation cools below forecast",  why:"Less pressure for hikes",                          pct:+0.05 },
    { h:"Inflation jumps above forecast",  why:"Hike risks rise",                                  pct:-0.05 },
    { h:"Geopolitical tensions escalate",  why:"Risk-off tone hits indices",                       pct:-0.06 },
    { h:"Geopolitical de-escalation",      why:"Risk-on tone improves",                            pct:+0.04 },
    { h:"Mixed data; outlook unchanged",   why:"Little impact on fair value",                      pct: 0.00 },
    { h:"Energy strength buoys index",     why:"Modest index uplift",                              pct:+0.02 },
    { h:"Consumer weakens broadly",        why:"Modest index drag",                                pct:-0.02 },
  ];

  App.market = {
    pickNews: () => NEWS[Math.floor(Math.random()*NEWS.length)],
    schedule(startMs, durSec) {
      const last = durSec - 15, arr = [];
      for (let s = 15; s <= last; s += 15) arr.push(startMs + s*1000);
      return arr;
    },
    // mean reversion toward fair with situational "revert boost"
    driftTowardFair({ mid, fair, revertTicks, revertStrength }) {
      const d = fair - mid;
      const baseFactor = clamp(Math.abs(d)/10, 0, 1);
      const BETA_PER_SEC = 0.35;
      const betaTick = BETA_PER_SEC / 10; // 10 Hz
      let drift = betaTick * d * baseFactor;
      if (revertTicks > 0) {
        drift += revertStrength * Math.sign(d) * Math.min(1, Math.abs(d)/0.5);
      }
      return clamp(drift, -0.12, +0.12);
    }
  };

  // Randomness params (export so main can use)
  App.vol = {
    SIGMA_CALM: 0.0015,
    SIGMA_VOL:  0.0030,
    JUMP_P:     0.001,
    JUMP_MIN:   0.003,
    JUMP_MAX:   0.010,
  };
})();
