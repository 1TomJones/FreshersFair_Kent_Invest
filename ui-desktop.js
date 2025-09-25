// ui-desktop.js — desktop gameplay UI
(function () {
  const { TICKER, MAX_POS, fmt2, clamp, isMobile, pickNews, loadLB, saveLB } = window.GameShared;
  const { buildNewsSchedule, tickPrice } = window.Market;
  const { BASE_DEPTH, computeImpact, replenishDepth, updateVWAP } = window.Trading;

  const h = React.createElement;
  const { useState, useEffect, useRef } = React;

  function UIDesktop() {
    const [screen, setScreen] = useState("welcome");
    const [mode, setMode] = useState("normal");
    const [player, setPlayer] = useState(localStorage.getItem("player_name") || "");
    const [timeLeft, setTimeLeft] = useState(120);

    const [mid, _setMid] = useState(100);
    const [fair, _setFair] = useState(100);
    const [spread] = useState(0.10);
    const [regime, setRegime] = useState("Calm");

    const [cash, _setCash] = useState(100000);
    const [reserve, _setReserve] = useState(0);
    const [pos, _setPos] = useState(0);
    const [avgPrice, _setAvgPrice] = useState(null);

    const [tick, setTick] = useState(0);
    const [hist, setHist] = useState([{ t:0, mid:100 }]);
    const [size, setSize] = useState(100);

    const [headline, setHeadline] = useState(null);
    const [notice, setNotice] = useState("");

    const midRef=useRef(100), fairRef=useRef(100), cashRef=useRef(100000), reserveRef=useRef(0), posRef=useRef(0), avgRef=useRef(null);
    const setMid=(v)=>{ const x=typeof v==="function"?v(midRef.current):v; midRef.current=x; _setMid(x); };
    const setFair=(v)=>{ const x=typeof v==="function"?v(fairRef.current):v; fairRef.current=x; _setFair(x); };
    const setCash=(v)=>{ const x=typeof v==="function"?v(cashRef.current):v; cashRef.current=x; _setCash(x); };
    const setReserve=(v)=>{ const x=typeof v==="function"?v(reserveRef.current):v; reserveRef.current=x; _setReserve(x); };
    const setPos=(v)=>{ const x=typeof v==="function"?v(posRef.current):v; posRef.current=x; _setPos(x); };
    const setAvg=(v)=>{ const x=typeof v==="function"?v(avgRef.current):v; avgRef.current=x; _setAvgPrice(x); };

    const [avail, _setAvail] = useState(BASE_DEPTH);
    const availRef=useRef(BASE_DEPTH);
    const setAvail=(v)=>{ const x=typeof v==="function"?v(availRef.current):v; availRef.current=x; _setAvail(x); };

    const newsEventsRef=useRef([]); const tradesRef=useRef([]);
    const pauseUntilRef=useRef(0);
    const scheduleRef=useRef([]); const nextNewsIdxRef=useRef(0);
    const loopRef=useRef(null); const startRef=useRef(null); const endRef=useRef(null);
    const tickRef=useRef(0);

    const totalVal = cashRef.current + reserveRef.current + posRef.current * midRef.current;
    const pnl = totalVal - 100000;
    const pnlClass = pnl>0?"text-green-600":(pnl<0?"text-rose-600":"text-gray-900");

    function resetRound(){
      setMid(100); setFair(100); setCash(100000); setReserve(0); setPos(0); setAvg(null);
      setTick(0); tickRef.current=0; setHist([{t:0, mid:100}]);
      setRegime("Calm"); setHeadline(null); setNotice("");
      setAvail(BASE_DEPTH); newsEventsRef.current=[]; tradesRef.current=[]; pauseUntilRef.current=0;
    }

    function startRound(){
      if(!player.trim()) return alert("Enter a name to start!");
      localStorage.setItem("player_name", player.trim());
      resetRound();
      const dur = (mode==="easy") ? 90 : 120;
      setTimeLeft(dur); setScreen("play");
      const now=Date.now(); startRef.current=now; endRef.current=now+dur*1000;
      scheduleRef.current = buildNewsSchedule(now, dur);
      nextNewsIdxRef.current = 0;
    }

    useEffect(() => {
      if (screen!=="play") return;
      if (loopRef.current) clearInterval(loopRef.current);

      const intervalMs = mode==="easy" ? 125 : 100;

      loopRef.current = setInterval(() => {
        const now = Date.now();

        if (now < pauseUntilRef.current) {
          setTimeLeft(Math.max(0, Math.ceil((endRef.current - now)/1000)));
          return;
        }

        const left = Math.max(0, Math.ceil((endRef.current - now)/1000));
        setTimeLeft(left);

        const nm = tickPrice({ mid: midRef.current, fair: fairRef.current, regime });
        setMid(nm);
        setTick(t=>{ const t2=t+1; tickRef.current=t2; setHist(h=>[...h,{t:t2,mid:nm}].slice(-700)); return t2; });

        setAvail(a => replenishDepth(a, intervalMs));

        if (Math.random() < 0.03) setRegime(r => r==="Calm" ? "Volatile" : "Calm");

        const idx = nextNewsIdxRef.current;
        if (idx < scheduleRef.current.length && now >= scheduleRef.current[idx]) {
          const n = pickNews(); setHeadline(n);
          newsEventsRef.current.push({ t: tickRef.current });
          if (n.pct !== 0) setFair(f => Math.max(1, f * (1 + n.pct)));
          nextNewsIdxRef.current = idx + 1;
          if (mode === "easy") {
            const pauseMs=5000; pauseUntilRef.current=now+pauseMs; endRef.current+=pauseMs;
            for (let i=nextNewsIdxRef.current; i<scheduleRef.current.length; i++) scheduleRef.current[i]+=pauseMs;
          }
        }

        if (left <= 0) {
          clearInterval(loopRef.current); loopRef.current=null;
          if (mode==="normal") {
            const lb=loadLB(); const entry={name:player.trim(), pnl:Number(pnl.toFixed(2)), total:Number(totalVal.toFixed(2)), ts:now};
            const next=[...lb,entry].sort((a,b)=>b.pnl-a.pnl).slice(0,50); saveLB(next);
          }
          setScreen("end");
        }
      }, intervalMs);

      return ()=>{ if(loopRef.current){ clearInterval(loopRef.current); loopRef.current=null; } };
    }, [screen, mode, regime]);

    function trade(side){
      if(screen!=="play") return;
      const reqQty = Math.max(1, Math.round(size));
      const sgn = side==="BUY" ? +1 : -1;
      const maxAdd = (sgn>0) ? (MAX_POS - posRef.current) : (MAX_POS + posRef.current);
      const qty = Math.max(0, Math.min(maxAdd, reqQty));
      if (qty === 0) { setNotice(`Position limit reached (±${MAX_POS} sh).`); setTimeout(()=>setNotice(""),1200); return; }

      const startMid = midRef.current;
      const impact = computeImpact(qty, availRef.current);
      const endMid = Math.max(1, startMid + sgn * impact);

      const vwap = side==="BUY"
        ? (startMid + spread/2) + 0.5*(endMid - startMid)
        : (startMid - spread/2) + 0.5*(endMid - startMid);

      const notional = qty * vwap; const fee = notional * 0.0001;

      const upd = updateVWAP(avgRef.current, posRef.current, side, qty, vwap);
      setAvg(upd.vwap);

      if (side==="BUY") {
        setCash(c=>c - fee);
        if (posRef.current < 0) {
          setReserve(r=>{ const r2=r - notional; if (r2 >= 0) return r2; setCash(c=>c + r2); return 0; });
        } else { setCash(c=>c - notional); }
        setPos(p=>p + qty);
      } else {
        setCash(c=>c - fee);
        if (posRef.current > 0) setCash(c=>c + notional);
        else setReserve(r=>r + notional);
        setPos(p=>p - qty);
      }

      setTimeout(()=>{ if (posRef.current >= 0 && reserveRef.current > 0) { setCash(c=>c + reserveRef.current); setReserve(0);} },0);

      setMid(endMid);
      setTick(t=>{ const t2=t+1; tickRef.current=t2; setHist(h=>[...h,{t:t2,mid:endMid}].slice(-700)); return t2; });
      tradesRef.current.push({ t: tickRef.current, price: endMid, side });

      setAvail(a=>Math.max(50, Math.min(BASE_DEPTH, a - qty)));
    }

    // --- Render ---
    if (screen==="welcome") {
      const lb = loadLB();
      const leader=(lb.length===0
        ? h("div",{className:"text-sm text-gray-500"},"No scores yet — be the first!")
        : h("ol",{className:"text-sm space-y-1"},
            lb.slice(0,10).map((r,i)=>h("li",{key:i,className:"flex justify-between"}, h("span",null,`${i+1}. ${r.name}`), h("span",{className:r.pnl>0?"text-green-600":(r.pnl<0?"text-rose-600":"")}, `$${fmt2(r.pnl)}`))
          )
        )
      );

      return h("div",{className:"mx-auto w-full px-8 max-w-[1500px] space-y-6"},[
        h("h1",{className:"text-3xl font-bold"},"Freshers Fair — Liquidity Trading Game"),
        h("div",{className:"p-3 rounded-2xl border bg-white shadow-sm text-sm text-gray-700"},
          "Normal: 120s (news 15–105s). Easy: 90s and auto-pauses 5s on each headline."
        ),
        h("div",{className:"grid md:grid-cols-2 gap-3"},[
          h("label",{className:"p-3 rounded-2xl border shadow-sm bg-white flex gap-3 cursor-pointer"},
            h("input",{type:"radio",name:"mode",className:"mt-1",checked:mode==="easy",onChange:()=>setMode("easy")}),
            h("div",null,h("div",{className:"font-semibold"},"Easy"), h("div",{className:"text-sm text-gray-600"},"Colored news cues, 5s pause on headlines, ~20% slower ticks. No leaderboard."))
          ),
          h("label",{className:"p-3 rounded-2xl border shadow-sm bg-white flex gap-3 cursor-pointer"},
            h("input",{type:"radio",name:"mode",className:"mt-1",checked:mode==="normal",onChange:()=>setMode("normal")}),
            h("div",null,h("div",{className:"font-semibold"},"Normal"), h("div",{className:"text-sm text-gray-600"},"No assists, no pauses, full-speed ticks. Leaderboard enabled."))
          )
        ]),
        h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white grid md:grid-cols-3 gap-3 items-end"},[
          h("div",null, h("label",{className:"text-xs text-gray-500"},"Your name"), h("input",{value:player,onChange:e=>setPlayer(e.target.value),className:"w-full border rounded-xl px-3 py-2 mt-1",placeholder:"e.g., Alex"})),
          h("div",null, h("label",{className:"text-xs text-gray-500"},"News cadence"), h("div",{className:"text-sm text-gray-600 mt-1"},"15s, 30s, … 105s")),
          h("div",{className:"flex gap-2"}, h("button",{onClick:startRound,className:"px-4 py-3 rounded-xl border shadow-sm font-semibold hover:bg-emerald-50"},"Start Round"))
        ]),
        h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white"},[
          h("div",{className:"text-sm font-semibold mb-2"},"Leaderboard (Normal mode) — Top 10"),
          leader,
          h("div",{className:"mt-3"}, h("button",{onClick:()=>{ if(confirm("Clear leaderboard?")){ saveLB([]); location.reload(); } }, className:"px-3 py-2 rounded-xl border text-xs hover:bg-slate-50"},"Clear Leaderboard"))
        ])
      ]);
    }

    if (screen==="play") {
      return h("div",{className:"mx-auto w-full px-8 max-w-[1500px] space-y-4"},[
        h("header",{className:"flex items-center justify-between"},
          h("div",{className:"text-xl font-semibold"}, `Trader: ${player}`),
          h("div",{className:"px-2 py-1 rounded-full text-xs border bg-white"}, `⏱ ${timeLeft}s`)
        ),
        // news strip
        h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white min-h-[56px]"},[
          h("div",{className:"text-sm font-semibold"}, headline ? "News" : "News"),
          h("div",{className:"text-sm"}, headline ? headline.h : "Waiting for news…"),
          h("div",{className:"text-xs text-gray-700 mt-1"}, headline ? `${headline.why}${headline.pct===0?"":` — fair value ${(headline.pct*100).toFixed(0)}%.`}` : "")
        ]),

        // full-bleed chart
        h("div",{className:"relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen"},
          h("div",{className:"mx-auto max-w-[1920px] px-2"},
            h(window.PriceChart,{data:hist,fairLine:fair,newsEvents:newsEventsRef.current,trades:tradesRef.current,posAvg:avgRef.current,posSide:Math.sign(posRef.current),mobile:false})
          )
        ),

        // stats + controls
        h("div",{className:"grid md:grid-cols-6 gap-3"},[
          h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Mid"), h("div",{className:"text-2xl font-semibold"}, `$${fmt2(midRef.current)}`), h("div",{className:"text-xs text-gray-500 mt-1"},"Spread "+fmt2(spread)) ),
          h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Fair Value"), h("div",{className:"text-2xl font-semibold"}, `$${fmt2(fairRef.current)}`), h("div",{className:"text-xs text-gray-500 mt-1"},"Anchors drift") ),
          h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Position"), h("div",{className:"text-2xl font-semibold"}, `${posRef.current} sh`), h("div",{className:"text-xs text-gray-500 mt-1"},"Cap ±"+MAX_POS) ),
          h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"Cash"), h("div",{className:"text-2xl font-semibold"}, `$${cashRef.current.toLocaleString()}`) ),
          h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white"}, h("div",{className:"text-xs text-gray-500"},"P&L (MTM)"), h("div",{className:`text-2xl font-semibold ${pnlClass}`}, `$${fmt2(pnl)}`), h("div",{className:"text-xs text-gray-500 mt-1"},"Total $"+(cashRef.current + reserveRef.current + posRef.current*midRef.current).toLocaleString()) ),
          h("div",{className:"p-3 rounded-2xl border shadow-sm bg-white flex items-center justify-center"}, h("div",{className:"text-xs text-gray-500"},"Round running"))
        ]),

        notice && h("div",{className:"text-xs text-rose-700"}, notice),

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
            h("button",{onClick:()=>{ if(confirm("End round now?")) endRef.current = Date.now(); }, className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-slate-50"},"End Round"),
            h("div",{className:"text-xs text-gray-500"}, mode==="easy" ? "Easy: colored news, 5s pause on headlines, slower ticks." : "Normal: no assists, full speed, leaderboard.")
          ),
          h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white space-y-2"},
            h("div",{className:"text-sm font-semibold"},"How to win"),
            h("ul",{className:"list-disc list-inside text-sm text-gray-700 space-y-1"},
              h("li",null,"Watch Fair Value moves on news (dashed line)."),
              h("li",null,"Slice orders across ticks to reduce impact."),
              h("li",null,"Use the VWAP line to manage risk."),
              h("li",null,"Keep an eye on the position cap.")
            )
          )
        ])
      ]);
    }

    const lb=loadLB();
    return h("div",{className:"mx-auto w-full px-8 max-w-[1500px] space-y-6"},[
      h("h2",{className:"text-2xl font-bold"},"Round complete"),
      (mode==="normal"
        ? h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white"},[
            h("div",{className:"text-sm font-semibold mb-2"},"Leaderboard (Normal mode) — Top 10"),
            (lb.length===0
              ? h("div",{className:"text-sm text-gray-500"},"No scores yet — be the first!")
              : h("ol",{className:"text-sm space-y-1"}, lb.slice(0,10).map((r,i)=>h("li",{key:i,className:"flex justify-between"}, h("span",null,`${i+1}. ${r.name}`), h("span",{className:r.pnl>0?"text-green-600":(r.pnl<0?"text-rose-600":"")}, `$${fmt2(r.pnl)}`)))
            )
          ])
        : h("div",{className:"p-4 rounded-2xl border shadow-sm bg-white text-sm text-gray-600"},"Easy mode results are not recorded in the leaderboard. Try Normal mode to compete!")
      ),
      h("div",{className:"mt-3 flex gap-2"},
        h("button",{onClick:()=>setScreen("welcome"),className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-slate-50"},"Back to Start"),
        h("button",{onClick:startRound,className:"px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-emerald-50"},"Play Again")
      )
    ]);
  }

  window.UIDesktop = UIDesktop;
})();
