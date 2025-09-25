// ui-mobile.js — mobile gameplay UI
(function () {
  const { TICKER, MAX_POS, fmt2, clamp, isMobile, pickNews, loadLB, saveLB } = window.GameShared;
  const { buildNewsSchedule, tickPrice } = window.Market;
  const { BASE_DEPTH, computeImpact, replenishDepth, updateVWAP } = window.Trading;

  const h = React.createElement;
  const { useState, useEffect, useRef } = React;

  function UIMobile() {
    // session state
    const [screen, setScreen] = useState("welcome");
    const [mode, setMode] = useState("normal"); // "normal" | "easy"
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
    const [hist, setHist] = useState([{ t: 0, mid: 100 }]);
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

    // liquidity depth
    const [avail, _setAvail] = useState(BASE_DEPTH);
    const availRef = useRef(BASE_DEPTH);
    const setAvail = (v)=>{ const x=typeof v==="function"?v(availRef.current):v; availRef.current=x; _setAvail(x); };

    const newsEventsRef = useRef([]); // [{t}]
    const tradesRef = useRef([]);     // [{t, price, side}]
    const pauseUntilRef = useRef(0);
    const scheduleRef = useRef([]);
    const nextNewsIdxRef = useRef(0);
    const loopRef = useRef(null);
    const startRef = useRef(null);
    const endRef = useRef(null);
    const tickRef = useRef(0);

    const totalVal = cashRef.current + reserveRef.current + posRef.current * midRef.current;
    const pnl = totalVal - 100000;
    const pnlClass = pnl>0?"text-green-600":(pnl<0?"text-rose-600":"text-gray-900");

    function resetRound() {
      setMid(100); setFair(100);
      setCash(100000); setReserve(0); setPos(0); setAvg(null);
      setTick(0); tickRef.current=0; setHist([{ t:0, mid:100 }]);
      setRegime("Calm"); setHeadline(null); setNotice("");
      setAvail(BASE_DEPTH);
      newsEventsRef.current = [];
      tradesRef.current = [];
      pauseUntilRef.current = 0;
    }

    function startRound() {
      if (!player.trim()) return alert("Enter a name first!");
      localStorage.setItem("player_name", player.trim());
      resetRound();
      const dur = (mode==="easy") ? 90 : 120;
      setTimeLeft(dur);
      setScreen("play");

      const now = Date.now();
      startRef.current = now;
      endRef.current = now + dur*1000;
      scheduleRef.current = buildNewsSchedule(now, dur);
      nextNewsIdxRef.current = 0;
    }

    // main loop
    useEffect(() => {
      if (screen !== "play") return;
      if (loopRef.current) clearInterval(loopRef.current);

      const intervalMs = mode === "easy" ? 125 : 100;

      loopRef.current = setInterval(() => {
        const now = Date.now();

        if (now < pauseUntilRef.current) {
          setTimeLeft(Math.max(0, Math.ceil((endRef.current - now)/1000)));
          return;
        }

        const left = Math.max(0, Math.ceil((endRef.current - now)/1000));
        setTimeLeft(left);

        // price tick
        const nm = tickPrice({ mid: midRef.current, fair: fairRef.current, regime });
        setMid(nm);
        setTick(t => { const t2=t+1; tickRef.current=t2; setHist(h=>[...h, {t:t2, mid:nm}].slice(-700)); return t2; });

        // replenish depth
        setAvail(a => replenishDepth(a, intervalMs));

        // occasional regime flip
        if (Math.random() < 0.03) setRegime(r => r==="Calm" ? "Volatile" : "Calm");

        // news cadence
        const idx = nextNewsIdxRef.current;
        if (idx < scheduleRef.current.length && now >= scheduleRef.current[idx]) {
          const n = pickNews();
          setHeadline(n);
          newsEventsRef.current.push({ t: tickRef.current });
          if (n.pct !== 0) setFair(f => Math.max(1, f * (1 + n.pct)));
          nextNewsIdxRef.current = idx + 1;
          if (mode === "easy") {
            const pauseMs = 5000;
            pauseUntilRef.current = now + pauseMs;
            endRef.current += pauseMs;
            for (let i = nextNewsIdxRef.current; i < scheduleRef.current.length; i++) {
              scheduleRef.current[i] += pauseMs;
            }
          }
        }

        // end
        if (left <= 0) {
          clearInterval(loopRef.current); loopRef.current = null;
          if (mode === "normal") {
            const lb = loadLB();
            const entry = { name: player.trim(), pnl: Number(pnl.toFixed(2)), total: Number(totalVal.toFixed(2)), ts: now };
            const next = [...lb, entry].sort((a,b)=>b.pnl-a.pnl).slice(0, 50);
            saveLB(next);
          }
          setScreen("end");
        }
      }, intervalMs);

      return () => { if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; } };
    }, [screen, mode, regime]);

    function trade(side) {
      if (screen !== "play") return;
      const reqQty = Math.max(1, Math.round(size));
      const sgn = side === "BUY" ? +1 : -1;

      // position cap
      const maxAdd = (sgn > 0) ? (window.GameShared.MAX_POS - posRef.current) : (window.GameShared.MAX_POS + posRef.current);
      const qty = Math.max(0, Math.min(maxAdd, reqQty));
      if (qty === 0) {
        setNotice(`Position limit reached (±${window.GameShared.MAX_POS} sh).`);
        setTimeout(()=>setNotice(""), 1200);
        return;
      }

      const startMid = midRef.current;
      const impactMag = computeImpact(qty, availRef.current);
      const endMid = Math.max(1, startMid + sgn * impactMag);

      // VWAP slippage
      const vwap = side==="BUY"
        ? (startMid + spread/2) + 0.5 * (endMid - startMid)
        : (startMid - spread/2) + 0.5 * (endMid - startMid);

      const notional = qty * vwap;
      const fee = notional * 0.0001;

      const upd = updateVWAP(avgRef.current, posRef.current, side, qty, vwap);
      setAvg(upd.vwap);

      if (side === "BUY") {
        setCash(c => c - fee);
        if (posRef.current < 0) {
          setReserve(r => {
            const r2 = r - notional; if (r2 >= 0) return r2;
            setCash(c => c + r2); return 0;
          });
        } else {
          setCash(c => c - notional);
        }
        setPos(p => p + qty);
      } else {
        setCash(c => c - fee);
        if (posRef.current > 0) setCash(c => c + notional);
        else setReserve(r => r + notional);
        setPos(p => p - qty);
      }

      setTimeout(() => {
        if (posRef.current >= 0 && reserveRef.current > 0) {
          setCash(c => c + reserveRef.current);
          setReserve(0);
        }
      }, 0);

      // record markers & price
      setMid(endMid);
      setTick(t => { const t2 = t+1; tickRef.current=t2; setHist(h => [...h, {t:t2, mid:endMid}].slice(-700)); return t2; });
      tradesRef.current.push({ t: tickRef.current, price: endMid, side });

      // consume depth
      setAvail(a => Math.max(50, Math.min(BASE_DEPTH, a - qty)));
    }

    // --- RENDER ---
    if (screen === "welcome") {
      const lb = loadLB();
      const leader = (lb.length===0
        ? h("div",{className:"text-sm text-gray-500"},"No scores yet — be the first!")
        : h("ol",{className:"text-sm space-y-1"},
            lb.slice(0,10).map((r,i)=>
              h("li",{key:i,className:"flex justify-between"},
                h("span",null,`${i+1}. ${r.name}`),
                h("span",{className:r.pnl>0?"text-green-600":(r.pnl<0?"text-rose-600":"")}, `$${fmt2(r.pnl)}`)
              )
            ))
      );

      return h("div",{className:"p-3 space-y-3"},[
        h("div",{className:"text-xl font-bold"},"Liquidity Trading Game"),
        h("div",{className:"p-3 rounded-2xl border bg-white shadow-sm text-sm text-gray-700"},
          "Normal: 120s (news 15–105s). Easy: 90s + 5s pause on headlines."
        ),
        h("div",{className:"grid grid-cols-1 gap-2"},[
          h("label",{className:"p-3 rounded-2xl border bg-white flex gap-3"},
            h("input",{type:"radio",name:"mode",className:"mt-1",checked:mode==="easy",onChange:()=>setMode("easy")}),
            h("div",null,h("div",{className:"font-semibold"},"Easy"),
              h("div",{className:"text-sm text-gray-600"},"Colored cues, pauses, slower ticks. No leaderboard."))
          ),
          h("label",{className:"p-3 rounded-2xl border bg-white flex gap-3"},
            h("input",{type:"radio",name:"mode",className:"mt-1",checked:mode==="normal",onChange:()=>setMode("normal")}),
            h("div",null,h("div",{className:"font-semibold"},"Normal"),
              h("div",{className:"text-sm text-gray-600"},"No assists, full speed, leaderboard."))
          )
        ]),
        h("div",{className:"p-3 rounded-2xl border bg-white grid grid-cols-1 gap-2"},[
          h("div",null,
            h("label",{className:"text-xs text-gray-500"},"Your name"),
            h("input",{value:player,onChange:e=>setPlayer(e.target.value),className:"w-full border rounded-xl px-3 py-2 mt-1",placeholder:"e.g., Alex"})
          ),
          h("div",null,
            h("button",{onClick:startRound,className:"w-full px-4 py-3 rounded-xl border shadow-sm font-semibold bg-emerald-50"},"Start Round")
          )
        ]),
        h("div",{className:"p-3 rounded-2xl border bg-white"},[
          h("div",{className:"text-sm font-semibold mb-2"},"Leaderboard (Normal mode) — Top 10"),
          leader,
          h("div",{className:"mt-2"},
            h("button",{onClick:()=>{ if(confirm("Clear leaderboard?")){ saveLB([]); location.reload(); } },className:"px-3 py-2 rounded-xl border text-xs"},"Clear Leaderboard")
          )
        ])
      ]);
    }

    if (screen === "play") {
      return h("div",{className:"p-2 space-y-2"},[
        h("div",{className:"flex items-center justify-between"},[
          h("div",{className:"text-base font-bold"},"Liquidity Trading Game"),
          h("div",{className:"px-2 py-1 rounded-full text-xs border bg-white"}, `⏱ ${timeLeft}s`)
        ]),
        // News strip
        h("div",{className:"p-2 rounded-2xl border shadow-sm bg-white min-h-[52px]"},[
          h("div",{className:"text-sm font-semibold"}, headline ? (headline.pct>0?"▲ Positive macro": headline.pct<0?"▼ Negative macro":"→ Neutral macro") : "News"),
          h("div",{className:"text-sm"}, headline ? headline.h : "Waiting for news…"),
          h("div",{className:"text-xs text-gray-700 mt-1"}, headline ? `${headline.why}${headline.pct===0?"":` — fair value ${(headline.pct*100).toFixed(0)}%.`}` : "")
        ]),
        // Chart
        h(window.PriceChart,{data:hist,fairLine:fair,newsEvents:newsEventsRef.current,trades:tradesRef.current,posAvg:avgRef.current,posSide:Math.sign(posRef.current),mobile:true}),
        // Stats
        h("div",{className:"grid grid-cols-2 gap-2"},[
          h("div",{className:"p-2 rounded-xl border bg-white text-center"}, h("div",{className:"text-[12px] text-gray-500"},"Position"), h("div",{className:"text-lg font-semibold"}, `${posRef.current} sh`) ),
          h("div",{className:"p-2 rounded-xl border bg-white text-center"}, h("div",{className:"text-[12px] text-gray-500"},"P&L"), h("div",{className:`text-lg font-semibold ${pnlClass}`}, `$${fmt2(pnl)}`) )
        ]),
        // Trade panel
        h("div",{className:"p-3 rounded-2xl border bg-white space-y-2"},[
          h("div",{className:"text-sm font-semibold"},"Trade"),
          h("input",{className:"w-full border rounded-xl px-3 py-2",type:"number",min:1,step:1,value:size,onChange:e=>setSize(clamp(Number(e.target.value)||0,1,1000000)),placeholder:"Order size (shares)"}),
          h("div",{className:"grid grid-cols-1 gap-2 mt-1"},[
            h("button",{onClick:()=>trade("BUY"), className:"w-full px-4 py-3 rounded-xl border shadow-sm font-semibold bg-emerald-50"},"BUY"),
            h("button",{onClick:()=>trade("SELL"),className:"w-full px-4 py-3 rounded-xl border shadow-sm font-semibold bg-rose-50"},"SELL"),
          ]),
          h("div",{className:"text-[11px] text-gray-500"},"Fee 0.01% · Pos cap ±"+window.GameShared.MAX_POS)
        ])
      ]);
    }

    // end screen
    const lb = loadLB();
    return h("div",{className:"p-3 space-y-3"},[
      h("h2",{className:"text-xl font-bold"},"Round complete"),
      (mode==="normal"
        ? h("div",{className:"p-3 rounded-2xl border bg-white"},[
            h("div",{className:"text-sm font-semibold mb-2"},"Leaderboard (Normal mode) — Top 10"),
            (lb.length===0
              ? h("div",{className:"text-sm text-gray-500"},"No scores yet — be the first!")
              : h("ol",{className:"text-sm space-y-1"}, lb.slice(0,10).map((r,i)=>h("li",{key:i,className:"flex justify-between"}, h("span",null,`${i+1}. ${r.name}`), h("span",{className:r.pnl>0?"text-green-600":(r.pnl<0?"text-rose-600":"")}, `$${fmt2(r.pnl)}`)))))
          ])
        : h("div",{className:"p-3 rounded-2xl border bg-white text-sm text-gray-600"},"Easy mode results are not recorded in the leaderboard. Try Normal mode to compete!")
      ),
      h("div",{className:"flex gap-2"},
        h("button",{onClick:()=>setScreen("welcome"),className:"px-3 py-2 rounded-xl border"},"Back to Start"),
        h("button",{onClick:startRound,className:"px-3 py-2 rounded-xl border bg-emerald-50"},"Play Again")
      )
    ]);
  }

  window.UIMobile = UIMobile;
})();
