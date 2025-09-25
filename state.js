// state.js — helpers & shared config

(function () {
  const TICKER = "SPX";
  const MAX_POS = 1000;

  const fmt2 = (n) => Number(n).toFixed(2);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const isMobile = () => (typeof window !== "undefined" && window.innerWidth <= 640);

  // News catalogue (macro-friendly)
  const NEWS = [
    { h:"BoE cuts rates 50bps",            why:"Cheaper borrowing supports equities",              pct:+0.10 },
    { h:"BoE hikes rates 50bps",           why:"Higher rates weigh on valuations",                 pct:-0.10 },
    { h:"Fed signals dovish turn",         why:"Lower expected rate path",                         pct:+0.08 },
    { h:"Fed turns hawkish",               why:"Higher-for-longer rates",                          pct:-0.08 },
    { h:"Inflation cools below forecast",  why:"Less pressure for hikes",                          pct:+0.05 },
    { h:"Inflation jumps above forecast",  why:"Hike risks rise",                                  pct:-0.05 },
    { h:"Geopolitical tensions escalate",  why:"Risk-off tone hits indices",                       pct:-0.06 },
    { h:"Geopolitical de-escalation",      why:"Risk-on tone improves",                            pct:+0.04 },
    { h:"Mixed data; outlook unchanged",   why:"Little impact on fair value",                      pct: 0.00 },
    { h:"Energy strength buoys index",     why:"Sector tailwind, modest uplift",                   pct:+0.02 },
    { h:"Consumer weakens broadly",        why:"Sector headwind, modest drag",                     pct:-0.02 },
  ];
  const pickNews = () => NEWS[Math.floor(Math.random() * NEWS.length)];

  // Leaderboard
  const LB_KEY = "liquidity_fair_leaderboard_v16";
  const loadLB = () => { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; } };
  const saveLB = (arr) => localStorage.setItem(LB_KEY, JSON.stringify(arr));

  window.GameShared = {
    TICKER, MAX_POS, fmt2, clamp, isMobile, pickNews, loadLB, saveLB
  };
})();
