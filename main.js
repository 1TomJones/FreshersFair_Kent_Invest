/* main.js — Freshers Fair Liquidity Game (split build)
   - React 18 UMD (from index.html)
   - Tailwind (from index.html)
*/

const { useState, useEffect, useRef } = React;
const h = React.createElement;

// ---------- Config / Utils ----------
const TICKER = "SPX";
const MAX_POS = 1000;
const LB_KEY = "liquidity_fair_leaderboard_v14";

const fmt2 = n => Number(n).toFixed(2);
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
const isMobileNow = () => (typeof window!=="undefined" && window.innerWidth <= 640);

const loadLB = () => { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; } };
const saveLB = (arr) => localStorage.setItem(LB_KEY, JSON.stringify(arr));

// ---------- Audio (tiny beeps) ----------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function ensureAudio() {
  if (!audioCtx) try { audioCtx = new AudioCtx(); } catch (e) {}
}
function _envGain(g, t0, dur, vol=0.03) {
  try { g.gain.setValueAtTime(Math.max(0.0001,vol), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0+dur); } catch {}
}
function beep(freq=520, dur=0.12, vol=0.03) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = "sine"; o.frequency.value = freq; _envGain(g,t,dur,vol); o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t+dur);
}
function chirp(a=420, b=880, dur=0.18, vol=0.03) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(a,t); o.frequency.linearRampToValueAtTime(b,t+dur); _envGain(g,t,dur,vol);
  o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t+dur);
}
function chord(freqs=[523.25,659.25,783.99], dur=0.6, vol=0.025){
  if (!audioCtx) return;
  const t = audioCtx.currentTime, bus = audioCtx.createGain(); bus.gain.setValueAtTime(vol,t); bus.connect(audioCtx.destination);
  freqs.forEach(f => { const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type="sine"; o.frequency.value=f; _envGain(g,t,dur,1); o.connect(g).connect(bus); o.start(t); o.stop(t+dur); });
}

// ---------- Fullscreen ----------
async function enterFullscreen(){ const el=document.documentElement; if(el.requestFullscreen) return el.requestFullscreen(); if(el.webkitRequestFullscreen) return el.webkitRequestFullscreen(); }
async function exitFullscreen(){ if(document.exitFullscreen) return document.exitFullscreen(); if(document.webkitExitFullscreen) return document.webkitExitFullscreen(); }

// ---------- Macro news ----------
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
const pickNews = () => NEWS[Math.floor(Math.random()*NEWS.length)];

// ---------- Brand (logo in headers is in index.html; we just show text here if needed) ----------
function BrandTitle({ text="Freshers Fair — Liquidity Trading Game" }){
  return h("span",{className:"font-bold text-xl md:text-2xl"}, text);
}

// ---------- PriceChart (SVG) ----------
function PriceChart({ data, fairLine=null, newsEvents=[], trades=[], posAvg=null, posSide=0, mobile=isMobileNow() }) {
  if (!data || data.length===0) return h("div",{style:{height:"200px"}});
  const heightVh = mobile ? 46 : 36;
  const cssH = heightVh + "vh";
  const w = 1800, hgt = 560;
  const BLEED = mobile ? 2 : 10;
  const yPadPct = mobile ? 0.005 : 0.02;

  const ys = data.map(d=>d.mid);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = (maxY - minY) * yPadPct; minY -= pad; maxY += pad;
  const rangeY = Math.max(1e-6, maxY - minY);

  const xOf = i => BLEED + (i / Math.max(1, data.length-1)) * (w - 2*BLEED);
  const yOf = v => (hgt - BLEED) - ((v - minY) / rangeY) * (hgt - 2*BLEED);
  const pts = data.map((d,i)=>`${xOf(i)},${yOf(d.mid)}`).join(" ");

  const elems = [];

  // y-grid + labels (compact)
  const ticks = mobile?3:5;
  for (let k=0;k<ticks;k++){
    const t = k/(ticks-1); const val = maxY - t*rangeY; const y = yOf(val);
    elems.push(h("line",{key:"gl"+k,x1:0,y1:y,x2:w,y2:y,stroke:"#eef2f7","stroke-width":1}));
    elems.push(h("text",{key:"gt"+k,x:6,y:y+5,"text-anchor":"start",className:"fill-gray-800 text-[12px] font-semibold"}, fmt2(val)));
  }

  // fair value
  if (fairLine != null) {
    const yFV = yOf(fairLine);
    elems.push(h("line",{key:"fv",x1:0,y1:yFV,x2:w,y2:yFV,stroke:"#94a3b8","stroke-width":1.4,"stroke-dasharray":"4 4",opacity:0.85}));
  }

  // price line
  elems.push(h("polyline",{key:"pl",points:pts,fill:"none",stroke:"#000","stroke-width":2.2,"stroke-opacity":0.9}));

  // VWAP line
  if (posAvg != null && posSide !== 0) {
    const yVW = yOf(posAvg);
    elems.push(h("line",{key:"vw",x1:0,y1:yVW,x2:w,y2:yVW,stroke:posSide>0?"#10b981":"#ef4444","stroke-width":2,"stroke-dasharray":"6 4",opacity:0.9}));
    elems.push(h("text",{key:"vwt",x:w-8,y:yVW-6,"text-anchor":"end",className:(posSide>0?"fill-emerald-600 ":"fill-rose-600 ")+"text-[12px] font-semibold"}, `VWAP ${posSide>0?"(long)":"(short)"} $${fmt2(posAvg)}`));
  }

  // trades (triangles)
  trades.forEach((tr,idx)=>{
    const i = tr.i; if (i<0 || i>=data.length) return;
    const x = xOf(i), y = yOf(tr.price);
    const isBuy = tr.side==="BUY", s = 6;
    const points = isBuy
      ? `${x},${y-s} ${x-s},${y+s} ${x+s},${y+s}`
      : `${x},${y+s} ${x-s},${y-s} ${x+s},${y-s}`;
    elems.push(h("polygon",{key:"tr"+idx,points,fill:isBuy?"#2563eb":"#ef4444",opacity:0.9,stroke:"#0f172a","stroke-width":0.5}));
  });

  // news markers: bubble at bottom + purple dotted line to TOP
  const bubbleR = mobile ? 16 : 18;
  const bubbleY = hgt - (bubbleR + 6);
  const newsColor = "#7c3aed";
  newsEvents.forEach((e, idx) => {
    const i = e.i; if (i<0 || i>=data.length) return;
    const x = xOf(i);
    elems.push(h("line",{key:"nl"+idx,x1:x,y1:0,x2:x,y2:bubbleY-bubbleR,stroke:newsColor,"stroke-width":1.8,"stroke-dasharray":"3 4",opacity:0.9}));
    elems.push(h("circle",{key:"nc"+idx,cx:x,cy:bubbleY,r:bubbleR,fill:"#fff",stroke:newsColor,"stroke-width":2,opacity:0.98}));
    elems.push(h("text",{key:"nt"+idx,x:x,y:bubbleY+5,"text-anchor":"middle",className:"fill-gray-900 text-[14px] font-bold"},"N"));
  });

  const par = mobile ? "xMidYMid meet" : "none";
  return h("div",{className: mobile ? "bg-transparent" : "p-3 rounded-2xl border shadow-sm bg-white"},
    h("svg",{viewBox:`0 0 ${w} ${hgt}`,style:{width:"100%",height:cssH,display:"block"},preserveAspectRatio:par}, elems)
  );
}

// ---------- News strip ----------
function NewsStrip({ headline, mode }){
  const colored = mode === "easy";
  const base = "p-3 rounded-2xl border shadow-sm";
  const cls = headline
    ? (colored ? (headline.pct>0?"bg-emerald-50 border-emerald-300":(headline.pct<0?"bg-rose-50 border-rose-300":"bg-slate-50 border-slate-300")) : "bg-white border-slate-200")
    : "bg-white border-slate-200";
  return h("div",{className:`${base} ${cls}`,style:{minHeight:"64px"}},[
    h("div",{key:"a",className:"text-sm font-semibold"}, headline ? (colored ? (headline.pct>0?"▲ Positive macro":headline.pct<0?"▼ Negative macro":"→ Neutral macro") : "News") : "News"),
    h("div",{key:"b",className:"text-sm"}, headline ? headline.h : "Waiting for news…"),
    h("div",{key:"c",className:"text-xs text-gray-700 mt-1"}, headline ? `${headline.why}${headline.pct===0 ? "" : ` — fair value ${(headline.pct*100).toFixed(0)}%.`}` : "Headlines drop every 15 seconds.")
  ]);
}

// ---------- Game ----------
function Game(){
  // responsive once at top (do NOT call inside branches)
  const [isMobile,setIsMobile] = useState(isMobileNow());
  useEffect(()=>{
    const onR=()=>setIsMobile(isMobileNow());
    window.addEventListener("resize",onR);
    return ()=>window.removeEventListener("resize",onR);
  },[]);

  // screens & mode
  const [screen, setScreen] = useState("welcome");
  const [mode, setMode] = useState("normal"); // "normal" | "easy"
  const [player, setPlayer] = useState(localStorage.getItem("player_name") || "");
  const [timeLeft, setTimeLeft] = useState(120);
  const [soundOn, setSoundOn] = useState(localStorage.getItem("sound_on")==="1");

  // market state
  const [mid, _setMid] = useState(100);
  const [fair, _setFair] = useState(100);
  const [spread] = useState(0.10);

  // liquidity/impact params
  const BASE_DEPTH = 1000;
  const [availDepth, _setAvailDepth] = useState(BASE_DEPTH);
  const REPLENISH_PER_SEC = 0.10;
  const IMP_MIN=0.005, IMP_MAX=0.90, IMP_POW=2.2, LIQ_PWR=0.5;

  // randomness
  const SIGMA_CALM = 0.0015, SIGMA_VOL = 0.0030;
  const JUMP_P = 0.001, JUMP_MIN=0.003, JUMP_MAX=0.010;

  // session state
  const [cash, _setCash] = useState(100000);
  const [reserve, _setReserve] = useState(0);
  const [pos, _setPos] = useState(0);
  const [tick, setTick] = useState(0);
  const [hist, setHist] = useState([{t:0, mid:100}]);
  const [size, setSize] = useState(100);

  const [regime, setRegime] = useState("Calm");
  const [headline, setHeadline] = useState(null);
  const [notice, setNotice] = useState("");

  // pause (Easy: 5s on news)
  const pauseUntilRef = useRef(0);

  // revert after big orders
  const [revertTicks, _setRevertTicks] = useState(0);
  const [revertStrength, _setRevertStrength] = useState(0);

  // refs sync
  const midRef=useRef(100), fairRef=useRef(100), cashRef=useRef(100000), posRef=useRef(0), availRef=useRef(BASE_DEPTH);
  const reserveRef=useRef(0);
  const avgPriceRef=useRef(null);
  const loopRef=useRef(null), startTimeRef=useRef(null), endTimeRef=useRef(null);
  const scheduleRef=useRef([]), nextNewsIdxRef=useRef(0);
  const revertTicksRef=useRef(0), revertStrengthRef=useRef(0);
  const tickRef=useRef(0);

  const newsEventsRef = useRef([]); // { i } where i is local index in hist
  const tradesRef = useRef([]);     // { i, price, side }

  const setMid   = v => { const x=typeof v==="function"?v(midRef.current):v;   midRef.current=x;   _setMid(x); };
  const setFair  = v => { const x=typeof v==="function"?v(fairRef.current):v;  fairRef.current=x;  _setFair(x); };
  const setCash  = v => { const x=typeof v==="function"?v(cashRef.current):v;  cashRef.current=x;  _setCash(x); };
  const setReserve = v => { const x=typeof v==="function"?v(reserveRef.current):v; reserveRef.current=x; _setReserve(x); };
  const setPos   = v => { const x=typeof v==="function"?v(posRef.current):v;   posRef.current=x;   _setPos(x); };
  const setAvail = v => { const x=typeof v==="function"?v(availRef.current):v; availRef.current=x; _setAvailDepth(x); };
  const setRevertTicks = v => { const x=typeof v==="function"?v(revertTicksRef.current):v; revertTicksRef.current=x; _setRevertTicks(x); };
  const setRevertStrength = v => { const x=typeof v==="function"?v(revertStrengthRef.current):v; revertStrengthRef.current=x; _setRevertStrength(x); };

  const total = cashRef.current + reserveRef.current + posRef.current*midRef.current;
  const pnl = total - 100000;
  const pnlClass = pnl>0?"text-green-600":(pnl<0?"text-rose-600":"text-gray-900");

  function enableSound(){ try { ensureAudio(); audioCtx && audioCtx.resume(); setSoundOn(true); localStorage.setItem("sound_on","1"); } catch(e){} }

  // drift toward FV with temporary revert boost after large orders
  function driftTowardFair(){
    const d = fairRef.current - midRef.current;
    const baseFactor = clamp(Math.abs(d)/10, 0, 1);
    const BETA_PER_SEC = 0.35; const betaTick = BETA_PER_SEC / 10; // 10Hz base
    let drift = betaTick * d * baseFactor;
    if (revertTicksRef.current > 0) {
      drift += revertStrengthRef.current * Math.sign(d) * Math.min(1, Math.abs(d)/0.5);
      setRevertTicks(t => t - 1);
      setRevertStrength(s => s * 0.6);
    }
    return clamp(drift, -0.12, +0.12);
  }
  function triggerRevertBoost(qty){
    if (qty >= 500) {
      const deviation = fairRef.current - midRef.current;
      const strength = 0.08 * (qty/1000) * (Math.abs(deviation)/1.0);
      setRevertStrength(strength);
      setRevertTicks(5);
    }
  }

  function resetRound(){
    setMid(100); setFair(100);
    setCash(100000); setReserve(0); setPos(0);
    setTick(0); tickRef.current = 0;
    setHist([{t:0, mid:100}]);
    setRegime("Calm"); setHeadline(null); setNotice("");
    setAvail(BASE_DEPTH);
    setRevertTicks(0); setRevertStrength(0);
    pauseUntilRef.current = 0;
    newsEventsRef.current = [];
    tradesRef.current = [];
    avgPriceRef.current = null;
  }

  function buildNewsSchedule(startMs, durSec){
    const last = durSec - 15; const arr=[];
    for (let s=15;s<=last;s+=15) arr.push(startMs + s*1000);
    return arr;
  }

  function startRound(){
    if(!player.trim()) return alert("Enter a name to start!");
    resetRound();
    const dur = (mode === "easy") ? 90 : 120;
    setTimeLeft(dur);
    setScreen("play");
    const start = Date.now();
    startTimeRef.current = start;
    endTimeRef.current   = start + dur*1000;
    scheduleRef.current  = buildNewsSchedule(start, dur);
    nextNewsIdxRef.current = 0;

    // (Optional) Try to enter fullscreen on start (especially nice on mobile)
    enterFullscreen().catch(()=>{});
  }

  function pauseFor(ms){
    const now = Date.now();
    pauseUntilRef.current = Math.max(pauseUntilRef.current, now + ms);
    endTimeRef.current += ms;
    for (let i = nextNewsIdxRef.current; i < scheduleRef.current.length; i++){
      scheduleRef.current[i] += ms;
    }
  }

  // main loop
  useEffect(() => {
    if (screen!=="play") return;
    if (loopRef.current) clearInterval(loopRef.current);

    const intervalMs = mode==="easy" ? 125 : 100;

    loopRef.current = setInterval(() => {
      const now = Date.now();

      // paused? (Easy after news)
      if (now < pauseUntilRef.current) {
        setTimeLeft(Math.max(0, Math.ceil((endTimeRef.current - now)/1000)));
        return;
      }

      const left = Math.max(0, Math.ceil((endTimeRef.current - now)/1000));
      setTimeLeft(left);

      // shock
      const sigmaAbs = fairRef.current * (regime==="Calm" ? SIGMA_CALM : SIGMA_VOL);
      let randomShock = (Math.random()*2 - 1) * sigmaAbs;
      if (Math.random() < JUMP_P) {
        const jMagPct = JUMP_MIN + Math.random()*(JUMP_MAX - JUMP_MIN);
        randomShock += (Math.random()<0.5?-1:1) * fairRef.current * jMagPct;
      }

      const step = randomShock + driftTowardFair();

      setMid(m => {
        const nm = Math.max(1, m + step);
        setTick(t => {
          const t2 = t + 1;
          tickRef.current = t2;
          setHist(h => [...h, { t: t2, mid: nm }].slice(-700));
          return t2;
        });
        return nm;
      });

      // liquidity refills
      const repl = BASE_DEPTH * (REPLENISH_PER_SEC * (intervalMs/1000));
      setAvail(a => clamp(a + repl, 50, BASE_DEPTH));

      // regime flip
      if (Math.random() < 0.03) setRegime(r => r==="Calm"?"Volatile":"Calm");

      // news (strict schedule)
      const idx = nextNewsIdxRef.current;
      if (idx < scheduleRef.current.length && now >= scheduleRef.current[idx]) {
        const n = pickNews();
        setHeadline(n);
        if (soundOn) {
          if (n.pct > 0) beep(740, 0.18, 0.03);
          else if (n.pct < 0) beep(330, 0.18, 0.03);
          else beep(520, 0.12, 0.02);
        }
        // mark at current hist index
        newsEventsRef.current.push({ i: Math.max(0, hist.length-1) });
        if (n.pct !== 0) setFair(f => Math.max(1, f * (1 + n.pct)));
        nextNewsIdxRef.current = idx + 1;
        if (mode === "easy") pauseFor(5000);
      }

      // end
      if (left <= 0) {
        clearInterval(loopRef.current); loopRef.current = null;
        const finalTotal = cashRef.current + reserveRef.current + posRef.current * midRef.current;
        const finalPnl = finalTotal - 100000;
        if (soundOn) {
          if (finalPnl > 0) chord([523.25,659.25,783.99], 0.6, 0.025);
          else chord([196.00,233.08,261.63], 0.6, 0.025);
        }
        if (mode === "normal") {
          const lb = loadLB();
          const entry = { name: player.trim()||"Player", pnl: Number(finalPnl.toFixed(2)), total: Number(finalTotal.toFixed(2)), ts: now };
          const next = [...lb, entry].sort((a,b)=>b.pnl-a.pnl).slice(0,50);
          saveLB(next);
        }
        setScreen("end");
      }
    }, intervalMs);

    return () => { if (loopRef.current) { clearInterval(loopRef.current); loopRef.current=null; } };
  }, [screen, mode, regime, soundOn]);

  // VWAP update helper (FIXED: handles first trade)
  function updateAvgPriceAfterTrade(pOld, side, qty, vwap){
    const pNew = side==="BUY" ? pOld + qty : pOld - qty;
    if (pOld === 0){
      avgPriceRef.current = vwap; // first open
    } else if (Math.sign(pOld) === Math.sign(pNew)){
      if (Math.abs(pNew) > Math.abs(pOld)){
        avgPriceRef.current = (Math.abs(pOld)*avgPriceRef.current + qty*vwap) / Math.abs(pNew);
      }
    } else {
      const crossQty = Math.abs(pNew);
      avgPriceRef.current = crossQty > 0 ? vwap : null;
    }
    if (pNew === 0) avgPriceRef.current = null;
  }

  // trading
  function trade(side){
    if (screen!=="play") return;
    const reqQty = Math.max(1, Math.round(size));
    const sgn = side==="BUY" ? +1 : -1;

    // position cap
    const maxAdd = (sgn>0) ? MAX_POS - posRef.current : MAX_POS + posRef.current;
    const qty = clamp(reqQty, 0, Math.max(0, maxAdd));
    if (qty === 0) { setNotice(`Position limit reached (±${MAX_POS} sh).`); setTimeout(()=>setNotice(""), 1200); return; }

    const startMid = midRef.current;
    const aD = Math.max(50, availRef.current);
    const after100 = Math.max(0, qty - 100);
    const x = after100 / 900;
    const curve = Math.pow(x, IMP_POW);
    const liquidityFactor = Math.pow(BASE_DEPTH / aD, LIQ_PWR);
    const impactMag = (IMP_MIN + (IMP_MAX - IMP_MIN) * curve) * liquidityFactor;
    const impact = sgn * impactMag;
    const endMid = Math.max(1, startMid + impact);

    // VWAP slippage (path midpoint)
    const vwap =
      side==="BUY" ? (startMid + spread/2) + 0.5 * (endMid - startMid)
                   : (startMid - spread/2) + 0.5 * (endMid - startMid);

    // fees
    const notional = qty * vwap;
    const fee = notional * 0.0001;

    // VWAP fix
    const pOld = posRef.current;
    updateAvgPriceAfterTrade(pOld, side, qty, vwap);

    // cash vs reserve (short proceeds)
    if (side==="BUY") {
      setCash(c=>c - fee);
      if (pOld < 0) {
        setReserve(r => { const r2 = r - notional; if (r2 >= 0) return r2; setCash(c => c + r2); return 0; });
      } else {
        setCash(c=>c - notional);
      }
      setPos(p=>p + qty);
    } else {
      setCash(c=>c - fee);
      if (pOld > 0) setCash(c=>c + notional);
      else setReserve(r=>r + notional);
      setPos(p=>p - qty);
    }

    // sweep reserve if flat / long
    setTimeout(() => {
      if (posRef.current >= 0 && reserveRef.current > 0) {
        setCash(c => c + reserveRef.current);
        setReserve(0);
      }
    }, 0);

    // sound + haptic
    if (soundOn) { side==="BUY" ? chirp(420,880,0.18,0.03) : chirp(880,420,0.18,0.03); }
    if (navigator.vibrate) navigator.vibrate(15);

    // price after impact
    setMid(endMid);
    setTick(t => {
      const t2 = t + 1; tickRef.current=t2;
      setHist(h => [...h, { t: t2, mid: endMid }].slice(-700));
      return t2;
    });

    // trade marker at current hist index
    tradesRef.current.push({ i: Math.max(0, hist.length-1), price: endMid, side });

    setAvail(a => clamp(a - qty, 50, BASE_DEPTH));
    triggerRevertBoost(qty);
  }

  // UI helpers
  const totalVal = cashRef.current + reserveRef.current + posRef.current * midRef.current;
  const posAvg = avgPriceRef.current;
  const posSide = Math.sign(posRef.current);

  // Screens
  if (screen==="welcome"){
    const lb = loadLB();
    const leader = (lb.length===0
      ? h("div",{className:"text-sm text-gray-500"},"No scores yet — be the first!")
      : h("ol",{className:"text-sm space-y-1"},
        lb.slice(0,10).map((r,i)=>h("li",{key:i,className:"flex justify-between"},
          h("span",null,`${i+1}. ${r.name}`),
          h("span",{className:r.pnl>0?"text-green-600":(r.pnl<0?"text-rose-600":"")}, `$${fmt2(r.pnl)}`)
        ))
      )
    );

    const modeBox = h("div",{className:"grid md:grid-cols-2 gap-3"},[
      h("label",{className:"p-3 rounded-2xl border shadow-sm bg-white flex gap-3 cursor-pointer"},
        h("input",{type:"radio",name:"mode",className:"mt-1",checked:mode==="easy",onChange:()=>setMode("easy")}),
        h("div",null,h("div",{className:"font-semibold"},"Easy"),
          h("div",{className:"text-sm text-gray-600"},"Colored news cues, 5s pause on headlines, ~20% slower ticks. No leaderboard."))
      ),
      h("label",{className:"p-3 rounded-2xl border shadow-sm bg-white flex gap-3 cursor-pointer"},
        h("input",{type:"radio",name:"mode",className:"mt-1",checked:mode==="normal",onChange:()=>setMode("normal")}),
        h("div",null,h("div",{className:"font-semibold"},"Normal"),
          h("div",{className:"text-sm text-gray-600"},"No assists, no pauses, full-speed ticks. Leaderboard enabled."))
      )
    ]);

    const wrapper = isMobile ? "mx-auto w-full px-3 space-y-6" : "mx-auto w-full px-8 max-w-[1500px] space-y-6";

    return h("div",{className:wrapper},[
      h("div",{className:"flex items-center justify-between"},
        h(BrandTitle,{}),
        h("div",{className:"flex items-center gap-2"},
          h("button",{onClick:enableSound,className:"px-3 py-2 rounded-xl border shadow-sm text-sm"}, soundOn?"🔊 Sound on":"🔇 Enable sound"),
          h("button",{onClick:async()=>{ try{ if(!document.fullscreenElement){ await enterFullscreen(); } else { await exitFullscreen(); } }catch{} }, className:"px-3 py-2 rounded-xl border shadow-sm text-sm"}, document.fullscreenElement ? "⤢ Exit FS" : "⤢ Fullscreen")
        )
      ),
      h("div",{className:"text-sm text-gray-700 p-3 rounded-2xl border bg-white shadow-sm"},
        "Normal rounds are 2 minutes; Easy rounds are 90s (pauses don’t eat into the time). News hits every 15s from 15s to 105s."
      ),
      modeBox,
      h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white grid md:grid-cols-3 gap-3 items-end"},[
        h("div",null,
          h("label",{className:"text-xs text-gray-500"},"Your name"),
          h("input",{value:player,onChange:e=>{setPlayer(e.target.value); localStorage.setItem("player_name", e.target.value||"");},
            className:"w-full border rounded-xl px-3 py-2 mt-1",placeholder:"e.g., Alex"})
        ),
        h("div",null,
          h("label",{className:"text-xs text-gray-500"},"(Info) News cadence"),
          h("div",{className:"text-sm text-gray-600 mt-1"},"15s, 30s, … 105s (no news at 0 or 120)")
        ),
        h("div",{className:"flex gap-2"},
          h("button",{onClick:startRound,className:"px-4 py-3 rounded-xl border shadow-sm font-semibold hover:bg-emerald-50"},"Start Round"),
          h("button",{onClick:enableSound,className:"px-4 py-3 rounded-xl border shadow-sm text-sm hover:bg-slate-50"}, soundOn ? "🔊 On":"🔇 Enable")
        )
      ]),
      h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white"},[
        h("div",{className:"text-sm font-semibold mb-2"},"Leaderboard (Normal mode) — Top 10"),
        leader,
        h("div",{className:"mt-3"},
          h("button",{onClick:()=>{ if(confirm("Clear leaderboard?")){ saveLB([]); location.reload(); } },className:"px-3 py-2 rounded-xl border text-xs hover:bg-slate-50"},"Clear Leaderboard")
        )
      ]),
      h("p",{className:"text-xs text-gray-500"},"Index proxy: think S&P 500 / FTSE 100 (broad macro sensitivity).")
    ]);
  }

  if (screen==="play"){
    const headerRight = h("div",{className:"flex items-center gap-2"},[
      h("span",{className:"px-2 py-1 rounded-full text-xs border bg-white"}, regime),
      h("span",{className:"px-2 py-1 rounded-full text-xs border bg-white"}, `⏱ ${timeLeft}s`),
      h("span",{className:"px-2 py-1 rounded-full text-xs border bg-white"}, (mode==="easy"?"Easy":"Normal")+" · "+TICKER),
      h("button",{onClick:enableSound,className:"px-2 py-1 rounded-full text-xs border bg-white"}, soundOn?"🔊":"🔇"),
      h("button",{onClick:async()=>{ try{ if(!document.fullscreenElement){ await enterFullscreen(); } else { await exitFullscreen(); } }catch{} }, className:"px-2 py-1 rounded-full text-xs border bg-white"}, "⤢"),
    ]);

    if (isMobile){
      return h("div",{className:"mx-auto w-full px-2 space-y-3"},[
        h("header",{className:"flex items-center justify-between"},
          h(BrandTitle,{}), headerRight
        ),
        h(NewsStrip,{headline, mode}),
        h(PriceChart,{data:hist,fairLine:fair,newsEvents:newsEventsRef.current,trades:tradesRef.current,posAvg:avgPriceRef.current,posSide:Math.sign(posRef.current),mobile:true}),
        h("div",{className:"grid grid-cols-2 gap-2"},[
          h("div",{className:"p-2 rounded-xl border bg-white text-center"},
            h("div",{className:"text-[12px] text-gray-500"},"Position"),
            h("div",{className:"text-lg font-semibold"}, `${posRef.current} sh`)
          ),
          h("div",{className:"p-2 rounded-xl border bg-white text-center"},
            h("div",{className:"text-[12px] text-gray-500"},"P&L"),
            h("div",{className:`text-lg font-semibold ${pnlClass}`}, `$${fmt2(pnl)}`)
          )
        ]),
        h("div",{className:"p-3 rounded-2xl border bg-white space-y-2"},[
          h("div",{className:"text-sm font-semibold"},"Trade"),
          h("div",{className:"flex items-center gap-2"},[
            h("input",{className:"flex-1 border rounded-xl px-3 py-2",type:"number",min:1,step:1,value:size,onChange:e=>setSize(clamp(Number(e.target.value)||0,1,1000000)),placeholder:"Size"}),
            h("button",{onClick:()=>trade("SELL"),className:"px-4 py-3 rounded-xl border shadow-sm font-semibold bg-rose-50 w-[38%]"},"SELL"),
            h("button",{onClick:()=>trade("BUY"), className:"px-4 py-3 rounded-xl border shadow-sm font-semibold bg-emerald-50 w-[38%]"},"BUY")
          ]),
          h("div",{className:"text-[11px] text-gray-500"},"Fee 0.01% · Pos cap ±"+MAX_POS)
        ])
      ]);
    }

    // Desktop
    const container = "mx-auto w-full px-8 max-w-[1500px] space-y-4";
    return h("div",{className:container},[
      h("header",{className:"flex items-center justify-between"},[
        h("div",{className:"text-xl font-semibold"}, `Trader: ${player}`),
        headerRight
      ]),
      h(NewsStrip,{headline, mode}),
      h("div",{className:"grid md:grid-cols-6 gap-3"},[
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"},
          h("div",{className:"text-xs text-gray-500"},"Mid"),
          h("div",{className:"text-2xl font-semibold"}, `$${fmt2(midRef.current)}`),
          h("div",{className:"text-xs text-gray-500 mt-1"},"Spread "+fmt2(spread))
        ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"},
          h("div",{className:"text-xs text-gray-500"},"Fair Value"),
          h("div",{className:"text-2xl font-semibold"}, `$${fmt2(fairRef.current)}`),
          h("div",{className:"text-xs text-gray-500 mt-1"},"Anchors drift")
        ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"},
          h("div",{className:"text-xs text-gray-500"},"Position"),
          h("div",{className:"text-2xl font-semibold"}, `${posRef.current} sh`),
          h("div",{className:"text-xs text-gray-500 mt-1"},"Cap ±"+MAX_POS)
        ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"},
          h("div",{className:"text-xs text-gray-500"},"Cash"),
          h("div",{className:"text-2xl font-semibold"}, `$${cashRef.current.toLocaleString()}`)
        ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"},
          h("div",{className:"text-xs text-gray-500"},"P&L (MTM)"),
          h("div",{className:`text-2xl font-semibold ${pnlClass}`}, `$${fmt2(pnl)}`),
          h("div",{className:"text-xs text-gray-500 mt-1"}, "Total $"+ (cashRef.current + reserveRef.current + posRef.current*midRef.current).toLocaleString())
        ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white flex items-center justify-center gap-2"},
          h("button",{onClick:enableSound,className:"px-3 py-2 rounded-xl border shadow-sm text-sm hover:bg-slate-50"}, soundOn?"🔊 Sound on":"🔇 Enable sound"),
          h("button",{onClick:async()=>{ try{ if(!document.fullscreenElement){ await enterFullscreen(); } else { await exitFullscreen(); } }catch{} }, className:"px-3 py-2 rounded-xl border shadow-sm text-sm hover:bg-slate-50"}, document.fullscreenElement ? "⤢ Exit FS" : "⤢ Fullscreen")
        )
      ]),
      notice && h("div",{className:"text-xs text-rose-700"}, notice),
      h(PriceChart,{data:hist,fairLine:fair,newsEvents:newsEventsRef.current,trades:tradesRef.current,posAvg:avgPriceRef.current,posSide:Math.sign(posRef.current),mobile:false}),
      h("div",{className:"grid md:grid-cols-3 gap-3 items-end"},[
        h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white space-y-3"},
          h("div",{className:"text-sm font-semibold"},"Trade"),
          h("label",{className:"text-xs text-gray-500"},"Order size (shares)"),
          h("input",{type:"number",min:1,step:1,value:size,onChange:e=>setSize(clamp(Number(e.target.value)||0,1,1000000)),className:"w-full border rounded-xl px-3 py-2"}),
          h("div",{className:"grid grid-cols-2 gap-2"},
            h("button",{onClick:()=>trade("SELL"),className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-rose-50"},"SELL"),
            h("button",{onClick:()=>trade("BUY"), className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-emerald-50"},"BUY")
          ),
          h("div",{className:"flex justify-between text-xs text-gray-500"},
            h("div",null,"Fee: 0.01% notional"),
            h("div",null,`Pos cap: ±${MAX_POS} sh · Liquidity refills each tick`)
          )
        ),
        h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white space-y-3"},
          h("div",{className:"text-sm font-semibold"},"Round Controls"),
          h("button",{onClick:()=>{ if(confirm("End round now?")) endTimeRef.current = Date.now(); }, className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-slate-50"},"End Round"),
          h("div",{className:"text-xs text-gray-500"}, mode==="easy" ? "Easy: colored news, 5s pause on headlines, slower ticks." : "Normal: no assists, full speed, leaderboard.")
        ),
        h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white space-y-2"},
          h("div",{className:"text-sm font-semibold"},"How to win"),
          h("ul",{className:"list-disc list-inside text-sm text-gray-700 space-y-1"},
            h("li",null,"Watch Fair Value moves on news (dashed line)."),
            h("li",null,"Slice orders across ticks to reduce impact."),
            h("li",null,"Follow your VWAP line to manage risk."),
            h("li",null,"Keep an eye on the position cap.")
          )
        )
      ])
    ]);
  }

  // --- End screen (no hooks here) ---
  const lb = loadLB();
  const finalTotalText = (cashRef.current + reserveRef.current + posRef.current*midRef.current).toLocaleString();
  const wrapper = isMobile ? "mx-auto w-full px-3 space-y-6" : "mx-auto w-full px-8 max-w-[1500px] space-y-6";
  return h("div",{className:wrapper},[
    h("h2",{className:"text-2xl font-bold"},"Round complete"),
    h("div",{className:"grid md:grid-cols-3 gap-3"},[
      h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"},
        h("div",{className:"text-xs text-gray-500"},"Trader"),
        h("div",{className:"text-2xl font-semibold"}, player || "Player")
      ),
      h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"},
        h("div",{className:"text-xs text-gray-500"},"Mode"),
        h("div",{className:"text-2xl font-semibold"}, mode==="easy"?"Easy":"Normal")
      ),
      h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"},
        h("div",{className:"text-xs text-gray-500"},"Total Value"),
        h("div",{className:"text-2xl font-semibold"}, "$"+finalTotalText)
      )
    ]),
    (mode==="normal"
      ? h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white"},[
          h("div",{className:"text-sm font-semibold mb-2"},"Leaderboard (Normal mode) — Top 10"),
          (lb.length===0
            ? h("div",{className:"text-sm text-gray-500"},"No scores yet — be the first!")
            : h("ol",{className:"text-sm space-y-1"},
                lb.slice(0,10).map((r,i)=>
                  h("li",{key:i,className:"flex justify-between"},
                    h("span",null,`${i+1}. ${r.name}`),
                    h("span",{className:r.pnl>0?"text-green-600":(r.pnl<0?"text-rose-600":"")}, `$${fmt2(r.pnl)}`)
                  )
                )
              )
          )
        ])
      : h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white text-sm text-gray-600"},"Easy mode results are not recorded in the leaderboard. Try Normal mode to compete!")
    ),
    h("div",{className:"mt-3 flex gap-2"},
      h("button",{onClick:()=>setScreen("welcome"),className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-slate-50"},"Back to Start"),
      h("button",{onClick:()=>{ setScreen("play");
          // restart inline
          const dur=(mode==="easy")?90:120; setTimeLeft(dur);
          setMid(100); setFair(100); setCash(100000); setReserve(0); setPos(0);
          setTick(0); tickRef.current=0; setHist([{t:0,mid:100}]); setRegime("Calm"); setHeadline(null); setNotice("");
          setAvail(1000); setRevertTicks(0); setRevertStrength(0); pauseUntilRef.current=0;
          newsEventsRef.current=[]; tradesRef.current=[]; avgPriceRef.current=null;
          const now=Date.now(); startTimeRef.current=now; endTimeRef.current=now+dur*1000;
          scheduleRef.current=(function(s,d){const last=d-15, arr=[]; for(let x=15;x<=last;x+=15) arr.push(s+x*1000); return arr; })(now,dur);
          nextNewsIdxRef.current=0;
        }, className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-emerald-50"},"Play Again")
  )]);
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(Game));
