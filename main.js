/* main.js — Freshers Fair Liquidity Trading Game
   Requires React UMD + chart.js
*/

const { useState, useEffect, useRef } = React;
const h = React.createElement;

const TICKER = "SPX";
const MAX_POS = 1000;
const LB_KEY = "liquidity_fair_leaderboard_v15b";

const fmt2 = n => Number(n).toFixed(2);
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
const isMobileNow = () => (typeof window!=="undefined" && window.innerWidth <= 640);

const loadLB = () => { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; } };
const saveLB = (arr) => localStorage.setItem(LB_KEY, JSON.stringify(arr));

// Audio
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function ensureAudio(){ if(!audioCtx){ try{ audioCtx=new AudioCtx(); }catch(e){} } }
function _envGain(g,t0,d,vol=0.03){ try{ g.gain.setValueAtTime(Math.max(0.0001,vol),t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+d);}catch{} }
function beep(f=520,d=0.12,v=0.03){ if(!audioCtx) return; const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type="sine"; o.frequency.value=f; _envGain(g,t,d,v); o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t+d);}
function chirp(a=420,b=880,d=0.18,v=0.03){ if(!audioCtx)return; const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type="sine"; o.frequency.setValueAtTime(a,t); o.frequency.linearRampToValueAtTime(b,t+d); _envGain(g,t,d,v); o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t+d);}
function chord(freqs=[523.25,659.25,783.99],d=0.6,v=0.025){ if(!audioCtx)return; const t=audioCtx.currentTime,bus=audioCtx.createGain(); bus.gain.setValueAtTime(v,t); bus.connect(audioCtx.destination); freqs.forEach(f=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type="sine"; o.frequency.value=f; _envGain(g,t,d,1); o.connect(g).connect(bus); o.start(t); o.stop(t+d);});}

// Fullscreen
async function enterFullscreen(){ const el=document.documentElement; if(el.requestFullscreen) return el.requestFullscreen(); if(el.webkitRequestFullscreen) return el.webkitRequestFullscreen(); }
async function exitFullscreen(){ if(document.exitFullscreen) return document.exitFullscreen(); if(document.webkitExitFullscreen) return document.webkitExitFullscreen(); }

// News
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

function NewsStrip({ headline, mode }){
  const colored = mode==="easy";
  const isMob = isMobileNow();
  const base = "rounded-2xl border shadow-sm";
  const padCls = isMob ? "p-2" : "p-3";
  const clsColor = headline
    ? (colored ? (headline.pct>0?"bg-emerald-50 border-emerald-300":(headline.pct<0?"bg-rose-50 border-rose-300":"bg-slate-50 border-slate-300")) : "bg-white border-slate-200")
    : "bg-white border-slate-200";
  const minHStyle = { minHeight: isMob ? "48px" : "64px" };

  return h("div",{className:`${base} ${padCls} ${clsColor}`, style: minHStyle},[
    h("div",{key:"a",className:"text-sm font-semibold"}, headline ? (colored ? (headline.pct>0?"▲ Positive macro":headline.pct<0?"▼ Negative macro":"→ Neutral macro") : "News") : "News"),
    h("div",{key:"b",className:"text-sm"}, headline ? headline.h : "Waiting for news…"),
    h("div",{key:"c",className:"text-xs text-gray-700 mt-1"}, headline ? `${headline.why}${headline.pct===0 ? "" : ` — fair value ${(headline.pct*100).toFixed(0)}%.`}` : "Headlines drop every 15 seconds.")
  ]);
}

function Game(){
  const [isMobile,setIsMobile] = useState(isMobileNow());
  useEffect(()=>{ const onR=()=>setIsMobile(isMobileNow()); window.addEventListener("resize",onR); return ()=>window.removeEventListener("resize",onR); },[]);

  const [screen,setScreen]=useState("welcome");
  const [mode,setMode]=useState("normal");
  const [player,setPlayer]=useState(localStorage.getItem("player_name")||"");
  const [timeLeft,setTimeLeft]=useState(120);
  const [soundOn,setSoundOn]=useState(localStorage.getItem("sound_on")==="1");

  const [mid,_setMid]=useState(100);
  const [fair,_setFair]=useState(100);
  const [spread]=useState(0.10);
  const BASE_DEPTH=1000;
  const [availDepth,_setAvailDepth]=useState(BASE_DEPTH);
  const REPL_PER_SEC=0.10;
  const IMP_MIN=0.005, IMP_MAX=0.90, IMP_POW=2.2, LIQ_PWR=0.5;
  const SIGMA_CALM=0.0015, SIGMA_VOL=0.0030, JUMP_P=0.001, JUMP_MIN=0.003, JUMP_MAX=0.010;

  const [cash,_setCash]=useState(100000);
  const [reserve,_setReserve]=useState(0);
  const [pos,_setPos]=useState(0);
  const [tick,setTick]=useState(0);
  const [hist,setHist]=useState([{t:0,mid:100}]);
  const [size,setSize]=useState(100);

  const [regime,setRegime]=useState("Calm");
  const [headline,setHeadline]=useState(null);
  const [notice,setNotice]=useState("");

  const pauseUntilRef=useRef(0);
  const [revertTicks,_setRevertTicks]=useState(0);
  const [revertStrength,_setRevertStrength]=useState(0);

  const midRef=useRef(100), fairRef=useRef(100), cashRef=useRef(100000), posRef=useRef(0), availRef=useRef(BASE_DEPTH);
  const reserveRef=useRef(0);
  const avgPriceRef=useRef(null);
  const loopRef=useRef(null), startTimeRef=useRef(null), endTimeRef=useRef(null);
  const scheduleRef=useRef([]), nextNewsIdxRef=useRef(0);
  const revertTicksRef=useRef(0), revertStrengthRef=useRef(0);
  const tickRef=useRef(0);
  const newsEventsRef=useRef([]); // now stores { t }
  const tradesRef=useRef([]);     // now stores { t, price, side }

  const setMid=v=>{ const x=typeof v==="function"?v(midRef.current):v; midRef.current=x; _setMid(x); };
  const setFair=v=>{ const x=typeof v==="function"?v(fairRef.current):v; fairRef.current=x; _setFair(x); };
  const setCash=v=>{ const x=typeof v==="function"?v(cashRef.current):v; cashRef.current=x; _setCash(x); };
  const setReserve=v=>{ const x=typeof v==="function"?v(reserveRef.current):v; reserveRef.current=x; _setReserve(x); };
  const setPos=v=>{ const x=typeof v==="function"?v(posRef.current):v; posRef.current=x; _setPos(x); };
  const setAvail=v=>{ const x=typeof v==="function"?v(availRef.current):v; availRef.current=x; _setAvailDepth(x); };
  const setRevertTicks=v=>{ const x=typeof v==="function"?v(revertTicksRef.current):v; revertTicksRef.current=x; _setRevertTicks(x); };
  const setRevertStrength=v=>{ const x=typeof v==="function"?v(revertStrengthRef.current):v; revertStrengthRef.current=x; _setRevertStrength(x); };

  const total = cashRef.current + reserveRef.current + posRef.current*midRef.current;
  const pnl = total - 100000;
  const pnlClass = pnl>0?"text-green-600":(pnl<0?"text-rose-600":"text-gray-900");

  function enableSound(){ try{ if(!audioCtx) ensureAudio(); audioCtx && audioCtx.resume(); setSoundOn(true); localStorage.setItem("sound_on","1"); }catch{} }

  function driftTowardFair(){
    const d=fairRef.current - midRef.current;
    const baseFactor=Math.max(0, Math.min(1, Math.abs(d)/10));
    const BETA_PER_SEC=0.35; const betaTick=BETA_PER_SEC/10;
    let drift = betaTick*d*baseFactor;
    if(revertTicksRef.current>0){
      drift += revertStrengthRef.current*Math.sign(d)*Math.min(1,Math.abs(d)/0.5);
      setRevertTicks(t=>t-1); setRevertStrength(s=>s*0.6);
    }
    return Math.max(-0.12, Math.min(0.12, drift));
  }
  function triggerRevertBoost(qty){
    if(qty>=500){
      const deviation=Math.abs(fairRef.current - midRef.current);
      const strength=0.08*(qty/1000)*(deviation/1.0);
      setRevertStrength(strength); setRevertTicks(5);
    }
  }

  function resetRound(){
    setMid(100); setFair(100); setCash(100000); setReserve(0); setPos(0);
    setTick(0); tickRef.current=0; setHist([{t:0,mid:100}]);
    setRegime("Calm"); setHeadline(null); setNotice("");
    setAvail(BASE_DEPTH); setRevertTicks(0); setRevertStrength(0);
    pauseUntilRef.current=0; newsEventsRef.current=[]; tradesRef.current=[]; avgPriceRef.current=null;
  }

  function buildNewsSchedule(startMs, durSec){
    const last=durSec-15, arr=[]; for(let s=15;s<=last;s+=15) arr.push(startMs + s*1000); return arr;
  }

  function startRound(){
    if(!player.trim()) return alert("Enter a name to start!");
    resetRound();
    const dur=(mode==="easy")?90:120; setTimeLeft(dur);
    setScreen("play");
    const start=Date.now(); startTimeRef.current=start; endTimeRef.current=start+dur*1000;
    scheduleRef.current=buildNewsSchedule(start,dur); nextNewsIdxRef.current=0;
    enterFullscreen().catch(()=>{});
  }

  function pauseFor(ms){
    const now=Date.now();
    pauseUntilRef.current=Math.max(pauseUntilRef.current,now+ms);
    endTimeRef.current += ms;
    for(let i=nextNewsIdxRef.current;i<scheduleRef.current.length;i++) scheduleRef.current[i]+=ms;
  }

  useEffect(()=>{
    if(screen!=="play") return;
    if(loopRef.current) clearInterval(loopRef.current);
    const intervalMs = mode==="easy" ? 125 : 100;

    loopRef.current = setInterval(()=>{
      const now=Date.now();

      if(now < pauseUntilRef.current){
        setTimeLeft(Math.max(0, Math.ceil((endTimeRef.current - now)/1000)));
        return;
      }

      const left=Math.max(0, Math.ceil((endTimeRef.current - now)/1000));
      setTimeLeft(left);

      const sigmaAbs=fairRef.current*(regime==="Calm"?SIGMA_CALM:SIGMA_VOL);
      let randomShock=(Math.random()*2-1)*sigmaAbs;
      if(Math.random()<JUMP_P){
        const j=JUMP_MIN + Math.random()*(JUMP_MAX-JUMP_MIN);
        randomShock += (Math.random()<0.5?-1:1)*fairRef.current*j;
      }
      const step=randomShock + driftTowardFair();

      setMid(m=>{
        const nm=Math.max(1,m+step);
        setTick(t=>{ const t2=t+1; tickRef.current=t2; setHist(h=>[...h,{t:t2,mid:nm}].slice(-700)); return t2; });
        return nm;
      });

      const repl=BASE_DEPTH*(REPL_PER_SEC*(intervalMs/1000)); setAvail(a=>Math.max(50, Math.min(BASE_DEPTH, a+repl)));
      if(Math.random()<0.03) setRegime(r=>r==="Calm"?"Volatile":"Calm");

      const idx=nextNewsIdxRef.current;
      if(idx<scheduleRef.current.length && now>=scheduleRef.current[idx]){
        const n=pickNews(); setHeadline(n);
        if(soundOn){ if(n.pct>0) beep(740,0.18,0.03); else if(n.pct<0) beep(330,0.18,0.03); else beep(520,0.12,0.02); }
        // RECORD ABSOLUTE TICK for scrolling markers
        newsEventsRef.current.push({ t: tickRef.current });
        if(n.pct!==0) setFair(f=>Math.max(1, f*(1+n.pct)));
        nextNewsIdxRef.current = idx+1;
        if(mode==="easy") pauseFor(5000);
      }

      if(left<=0){
        clearInterval(loopRef.current); loopRef.current=null;
        const finalTotal=cashRef.current + reserveRef.current + posRef.current*midRef.current;
        const finalPnl=finalTotal-100000;
        if(soundOn){ if(finalPnl>0) chord([523.25,659.25,783.99],0.6,0.025); else chord([196.00,233.08,261.63],0.6,0.025); }
        if(mode==="normal"){
          const lb=loadLB(); const entry={name:player.trim()||"Player", pnl:Number(finalPnl.toFixed(2)), total:Number(finalTotal.toFixed(2)), ts:now};
          saveLB([...lb,entry].sort((a,b)=>b.pnl-a.pnl).slice(0,50));
        }
        setScreen("end");
      }
    }, intervalMs);

    return ()=>{ if(loopRef.current){ clearInterval(loopRef.current); loopRef.current=null; } };
  },[screen,mode,regime,soundOn]);

  function updateAvgPriceAfterTrade(pOld, side, qty, vwap){
    const pNew = side==="BUY" ? pOld + qty : pOld - qty;
    if(pOld===0){ avgPriceRef.current=vwap; }
    else if(Math.sign(pOld)===Math.sign(pNew)){
      if(Math.abs(pNew)>Math.abs(pOld)){
        avgPriceRef.current=(Math.abs(pOld)*avgPriceRef.current + qty*vwap)/Math.abs(pNew);
      }
    }else{
      const crossQty=Math.abs(pNew);
      avgPriceRef.current = crossQty>0 ? vwap : null;
    }
    if(pNew===0) avgPriceRef.current=null;
  }

  function trade(side){
    if(screen!=="play") return;
    const reqQty=Math.max(1,Math.round(size)); const sgn=side==="BUY"?+1:-1;
    const maxAdd = (sgn>0) ? MAX_POS - posRef.current : MAX_POS + posRef.current;
    const qty=Math.max(0, Math.min(maxAdd, reqQty));
    if(qty===0){ setNotice(`Position limit reached (±${MAX_POS} sh).`); setTimeout(()=>setNotice(""),1200); return; }

    const startMid=midRef.current;
    const aD=Math.max(50,availRef.current);
    const after100=Math.max(0,qty-100);
    const x=after100/900;
    const curve=Math.pow(x,IMP_POW);
    const liqF=Math.pow(BASE_DEPTH/aD,LIQ_PWR);
    const impactMag=(IMP_MIN + (IMP_MAX-IMP_MIN)*curve)*liqF;
    const impact=sgn*impactMag;
    const endMid=Math.max(1,startMid+impact);

    const vwap = side==="BUY" ? (startMid + spread/2) + 0.5*(endMid-startMid)
                              : (startMid - spread/2) + 0.5*(endMid-startMid);

    const notional=qty*vwap; const fee=notional*0.0001;

    const pOld=posRef.current; updateAvgPriceAfterTrade(pOld,side,qty,vwap);

    if(side==="BUY"){
      _setCash(c=>c - fee);
      if(pOld<0){ _setReserve(r=>{ const r2=r-notional; if(r2>=0) return r2; _setCash(c=>c + r2); return 0; }); }
      else { _setCash(c=>c - notional); }
      _setPos(p=>p + qty);
    }else{
      _setCash(c=>c - fee);
      if(pOld>0) _setCash(c=>c + notional);
      else _setReserve(r=>r + notional);
      _setPos(p=>p - qty);
    }

    setTimeout(()=>{ if(posRef.current>=0 && reserveRef.current>0){ _setCash(c=>c + reserveRef.current); _setReserve(0);} },0);

    if(soundOn){ side==="BUY" ? chirp(420,880,0.18,0.03) : chirp(880,420,0.18,0.03); }
    if(navigator.vibrate) navigator.vibrate(15);

    setMid(endMid);
    setTick(t=>{ const t2=t+1; tickRef.current=t2; setHist(h=>[...h,{t:t2,mid:endMid}].slice(-700)); return t2; });

    // RECORD ABSOLUTE TICK so markers scroll with history
    tradesRef.current.push({ t: tickRef.current, price: endMid, side });

    setAvail(a=>Math.max(50, Math.min(BASE_DEPTH, a - qty)));
    triggerRevertBoost(qty);
  }

  const totalVal=cashRef.current + reserveRef.current + posRef.current*midRef.current;

  // --- Renders ---
  if(screen==="welcome"){
    const lb=loadLB();
    const leader=(lb.length===0
      ? h("div",{className:"text-sm text-gray-500"},"No scores yet — be the first!")
      : h("ol",{className:"text-sm space-y-1"},
          lb.slice(0,10).map((r,i)=>h("li",{key:i,className:"flex justify-between"},
            h("span",null,`${i+1}. ${r.name}`),
            h("span",{className:r.pnl>0?"text-green-600":(r.pnl<0?"text-rose-600":"")}, `$${fmt2(r.pnl)}`)
          ))
        )
    );

    const modeBox=h("div",{className:"grid md:grid-cols-2 gap-3"},[
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

    const wrapper = isMobile ? "mx-auto w-full px-3 space-y-4" : "mx-auto w-full px-8 max-w-[1500px] space-y-6";
    return h("div",{className:wrapper},[
      h("div",{className:"text-2xl font-bold"},"Freshers Fair — Liquidity Trading Game"),
      h("div",{className:(isMobile?"p-2":"p-3")+" rounded-2xl border bg-white shadow-sm text-sm text-gray-700"},
        "Normal: 120s (news 15–105s). Easy: 90s and auto-pauses 5s on each headline."
      ),
      modeBox,
      h("div",{className:(isMobile?"p-3":"p-4")+" rounded-2xl border shadow-sm bg-white grid md:grid-cols-3 gap-3 items-end"},[
        h("div",null, h("label",{className:"text-xs text-gray-500"},"Your name"),
          h("input",{value:player,onChange:e=>{setPlayer(e.target.value); localStorage.setItem("player_name",e.target.value||"");},className:"w-full border rounded-xl px-3 py-2 mt-1",placeholder:"e.g., Alex"})
        ),
        h("div",null, h("label",{className:"text-xs text-gray-500"},"(Info) News cadence"), h("div",{className:"text-sm text-gray-600 mt-1"},"15s, 30s, … 105s")),
        h("div",{className:"flex gap-2"},
          h("button",{onClick:startRound,className:"px-4 py-3 rounded-xl border shadow-sm font-semibold hover:bg-emerald-50"},"Start Round"),
          h("button",{onClick:enableSound,className:"px-4 py-3 rounded-xl border shadow-sm text-sm hover:bg-slate-50"}, soundOn ? "🔊 On" : "🔇 Enable")
        )
      ]),
      h("div",{className:(isMobile?"p-3":"p-4")+" rounded-2xl border shadow-sm bg-white"},[
        h("div",{className:"text-sm font-semibold mb-2"},"Leaderboard (Normal mode) — Top 10"),
        leader,
        h("div",{className:"mt-3"}, h("button",{onClick:()=>{ if(confirm("Clear leaderboard?")){ saveLB([]); location.reload(); } }, className:"px-3 py-2 rounded-xl border text-xs hover:bg-slate-50"},"Clear Leaderboard"))
      ]),
      h("p",{className:"text-xs text-gray-500"},"Index proxy: think S&P 500 / FTSE 100 (macro-sensitive).")
    ]);
  }

  if(screen==="play"){
    const headerRight = h("div",{className:"flex items-center gap-2"},[
      h("span",{className:"px-2 py-1 rounded-full text-xs border bg-white"}, regime),
      h("span",{className:"px-2 py-1 rounded-full text-xs border bg-white"}, `⏱ ${timeLeft}s`),
      h("span",{className:"px-2 py-1 rounded-full text-xs border bg-white"}, (mode==="easy"?"Easy":"Normal")+" · "+TICKER),
      h("button",{onClick:enableSound, className:"px-2 py-1 rounded-full text-xs border bg-white"}, soundOn ? "🔊" : "🔇"),
      h("button",{onClick:async()=>{ try{ if(!document.fullscreenElement){ await enterFullscreen(); } else { await exitFullscreen(); } }catch{} }, className:"px-2 py-1 rounded-full text-xs border bg-white"}, "⤢"),
    ]);

    if(isMobile){
      return h("div",{className:"mx-auto w-full px-2 space-y-2"},[
        h("header",{className:"flex items-center justify-between"},
          h("div",{className:"text-base font-bold"},"Liquidity Trading Game"), headerRight
        ),
        h(NewsStrip,{headline, mode}),
        h(window.PriceChart,{data:hist,fairLine:fair,newsEvents:newsEventsRef.current,trades:tradesRef.current,posAvg:avgPriceRef.current,posSide:Math.sign(posRef.current),mobile:true}),
        h("div",{className:"grid grid-cols-2 gap-2"},[
          h("div",{className:"p-2 rounded-xl border bg-white text-center"}, h("div",{className:"text-[12px] text-gray-500"},"Position"), h("div",{className:"text-lg font-semibold"}, `${posRef.current} sh`) ),
          h("div",{className:"p-2 rounded-xl border bg-white text-center"}, h("div",{className:"text-[12px] text-gray-500"},"P&L"), h("div",{className:`text-lg font-semibold ${pnlClass}`}, `$${fmt2(pnl)}`) )
        ]),
        h("div",{className:"p-3 rounded-2xl border bg-white space-y-2"},[
          h("div",{className:"text-sm font-semibold"},"Trade"),
          h("input",{className:"w-full border rounded-xl px-3 py-2",type:"number",min:1,step:1,value:size,onChange:e=>setSize(clamp(Number(e.target.value)||0,1,1000000)),placeholder:"Order size (shares)"}),
          h("div",{className:"grid grid-cols-1 gap-2 mt-1"},[
            h("button",{onClick:()=>trade("BUY"), className:"w-full px-4 py-3 rounded-xl border shadow-sm font-semibold bg-emerald-50"},"BUY"),
            h("button",{onClick:()=>trade("SELL"),className:"w-full px-4 py-3 rounded-xl border shadow-sm font-semibold bg-rose-50"},"SELL"),
          ]),
          h("div",{className:"text-[11px] text-gray-500"},"Fee 0.01% · Pos cap ±"+MAX_POS)
        ])
      ]);
    }

    // Desktop
    const container="mx-auto w-full px-8 max-w-[1500px] space-y-4";
    return h("div",{className:container},[
      h("header",{className:"flex items-center justify-between"},
        h("div",{className:"text-xl font-semibold"}, `Trader: ${player}`), headerRight
      ),
      h(NewsStrip,{headline, mode}),
      h("div",{className:"grid md:grid-cols-6 gap-3"},[
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Mid"), h("div",{className:"text-2xl font-semibold"}, `$${fmt2(midRef.current)}`), h("div",{className:"text-xs text-gray-500 mt-1"},"Spread "+fmt2(spread)) ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Fair Value"), h("div",{className:"text-2xl font-semibold"}, `$${fmt2(fairRef.current)}`), h("div",{className:"text-xs text-gray-500 mt-1"},"Anchors drift") ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Position"), h("div",{className:"text-2xl font-semibold"}, `${posRef.current} sh`), h("div",{className:"text-xs text-gray-500 mt-1"},"Cap ±"+MAX_POS) ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Cash"), h("div",{className:"text-2xl font-semibold"}, `$${cashRef.current.toLocaleString()}`) ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"P&L (MTM)"), h("div",{className:`text-2xl font-semibold ${pnlClass}`}, `$${fmt2(pnl)}`), h("div",{className:"text-xs text-gray-500 mt-1"},"Total $"+(cashRef.current + reserveRef.current + posRef.current*midRef.current).toLocaleString()) ),
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white flex items-center justify-center gap-2"}, h("button",{onClick:enableSound,className:"px-3 py-2 rounded-xl border shadow-sm text-sm hover:bg-slate-50"}, soundOn?"🔊 Sound on":"🔇 Enable sound"), h("button",{onClick:async()=>{ try{ if(!document.fullscreenElement){ await enterFullscreen(); } else { await exitFullscreen(); } }catch{} }, className:"px-3 py-2 rounded-xl border shadow-sm text-sm hover:bg-slate-50"}, document.fullscreenElement ? "⤢ Exit FS":"⤢ Fullscreen") )
      ]),
      notice && h("div",{className:"text-xs text-rose-700"}, notice),
      h(window.PriceChart,{data:hist,fairLine:fair,newsEvents:newsEventsRef.current,trades:tradesRef.current,posAvg:avgPriceRef.current,posSide:Math.sign(posRef.current),mobile:false}),
      h("div",{className:"grid md:grid-cols-3 gap-3 items-end"},[
        h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white space-y-3"},
          h("div",{className:"text-sm font-semibold"},"Trade"),
          h("label",{className:"text-xs text-gray-500"},"Order size (shares)"),
          h("input",{type:"number",min:1,step:1,value:size,onChange:e=>setSize(clamp(Number(e.target.value)||0,1,1000000)),className:"w-full border rounded-xl px-3 py-2"}),
          h("div",{className:"grid grid-cols-2 gap-2"},
            h("button",{onClick:()=>trade("SELL"),className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-rose-50"},"SELL"),
            h("button",{onClick:()=>trade("BUY"), className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-emerald-50"},"BUY")
          ),
          h("div",{className:"flex justify-between text-xs text-gray-500"}, h("div",null,"Fee: 0.01% notional"), h("div",null,`Pos cap: ±${MAX_POS} sh · Liquidity refills each tick`) )
        ),
        h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white space-y-3"},
          h("div",{className:"text-sm font-semibold"},"Round Controls"),
          h("button",{onClick:()=>{ if(confirm("End round now?")) endTimeRef.current=Date.now(); }, className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-slate-50"},"End Round"),
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

  // End screen
  const lb=loadLB();
  const finalTotalText=(cashRef.current + reserveRef.current + posRef.current*midRef.current).toLocaleString();
  const wrapper=isMobile ? "mx-auto w-full px-3 space-y-4" : "mx-auto w-full px-8 max-w-[1500px] space-y-6";
  return h("div",{className:wrapper},[
    h("h2",{className:"text-2xl font-bold"},"Round complete"),
    h("div",{className:"grid md:grid-cols-3 gap-3"},[
      h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Trader"), h("div",{className:"text-2xl font-semibold"}, player||"Player") ),
      h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Mode"), h("div",{className:"text-2xl font-semibold"}, mode==="easy"?"Easy":"Normal") ),
      h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Total Value"), h("div",{className:"text-2xl font-semibold"}, "$"+finalTotalText) )
    ]),
    (mode==="normal"
      ? h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white"},[
          h("div",{className:"text-sm font-semibold mb-2"},"Leaderboard (Normal mode) — Top 10"),
          (lb.length===0
            ? h("div",{className:"text-sm text-gray-500"},"No scores yet — be the first!")
            : h("ol",{className:"text-sm space-y-1"},
                lb.slice(0,10).map((r,i)=> h("li",{key:i,className:"flex justify-between"},
                  h("span",null,`${i+1}. ${r.name}`),
                  h("span",{className:r.pnl>0?"text-green-600":(r.pnl<0?"text-rose-600":"")}, `$${fmt2(r.pnl)}`)
                ))
              )
          )
        ])
      : h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white text-sm text-gray-600"},"Easy mode results are not recorded in the leaderboard. Try Normal mode to compete!")
    ),
    h("div",{className:"mt-3 flex gap-2"},
      h("button",{onClick:()=>setScreen("welcome"),className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-slate-50"},"Back to Start"),
      h("button",{onClick:()=>{ setScreen("play");
        const dur=(mode==="easy")?90:120; setTimeLeft(dur);
        setMid(100); setFair(100); setCash(100000); setReserve(0); setPos(0);
        setTick(0); tickRef.current=0; setHist([{t:0,mid:100}]); setRegime("Calm"); setHeadline(null); setNotice("");
        setAvail(1000); setRevertTicks(0); setRevertStrength(0); pauseUntilRef.current=0;
        newsEventsRef.current=[]; tradesRef.current=[]; avgPriceRef.current=null;
        const now=Date.now(); startTimeRef.current=now; endTimeRef.current=now+dur*1000;
        scheduleRef.current=(function(s,d){const last=d-15,arr=[]; for(let x=15;x<=last;x+=15) arr.push(s+x*1000); return arr;})(now,dur);
        nextNewsIdxRef.current=0;
      }, className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-emerald-50"},"Play Again")
    )
  ]);
}

// Mount
const root=ReactDOM.createRoot(document.getElementById("root"));
root.render(h(Game));
