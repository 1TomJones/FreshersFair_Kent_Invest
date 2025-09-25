// ui-mobile.js — mobile layout components
(function () {
  const App = (window.App = window.App || {});
  const { fmt2 } = App.utils;
  const h = React.createElement;

  function NewsStrip({ headline, mode }) {
    const colored = mode === "easy";
    const base = "rounded-2xl border shadow-sm";
    const clsColor = headline
      ? (colored ? (headline.pct>0?"bg-emerald-50 border-emerald-300":(headline.pct<0?"bg-rose-50 border-rose-300":"bg-slate-50 border-slate-300")) : "bg-white border-slate-200")
      : "bg-white border-slate-200";
    return h("div", { className: `p-2 ${base} ${clsColor}`, style: { minHeight: "48px" } }, [
      h("div", { key:"a", className:"text-sm font-semibold" }, headline ? (colored ? (headline.pct>0?"▲ Positive macro":headline.pct<0?"▼ Negative macro":"→ Neutral macro") : "News") : "News"),
      h("div", { key:"b", className:"text-sm" }, headline ? headline.h : "Waiting for news…"),
      h("div", { key:"c", className:"text-xs text-gray-700 mt-1" }, headline ? `${headline.why}${headline.pct===0 ? "" : ` — fair value ${(headline.pct*100).toFixed(0)}%.`}` : "Headlines every 15s.")
    ]);
  }

  function MobilePlay(props) {
    const {
      TICKER, pnlClass, pnl, posRef, headline, mode, hist, fair, newsEventsRef, tradesRef, avgPriceRef,
      size, setSize, MAX_POS, trade, fmt2,
      enableSound, soundOn, regime, timeLeft
    } = props;

    return React.createElement(React.Fragment, null,
      h("header", { className: "flex items-center justify-between px-2" },
        h("div", { className: "text-base font-bold" }, "Liquidity Trading"),
        h("div", { className: "flex items-center gap-2" }, [
          h("span", { className: "px-2 py-1 rounded-full text-xs border bg-white" }, regime),
          h("span", { className: "px-2 py-1 rounded-full text-xs border bg-white" }, `⏱ ${timeLeft}s`),
          h("span", { className: "px-2 py-1 rounded-full text-xs border bg-white" }, `${mode==="easy"?"Easy":"Normal"} · ${TICKER}`),
          h("button", { onClick: enableSound, className: "px-2 py-1 rounded-full text-xs border bg-white" }, soundOn ? "🔊" : "🔇"),
        ])
      ),
      h(NewsStrip, { headline, mode }),
      h(App.PriceChart, { data: hist, fairLine: fair, newsEvents: newsEventsRef.current, trades: tradesRef.current, posAvg: avgPriceRef.current, posSide: Math.sign(posRef.current), mobile: true }),
      h("div", { className: "grid grid-cols-2 gap-2 px-2" }, [
        h("div", { className: "p-2 rounded-xl border bg-white text-center" },
          h("div", { className: "text-[12px] text-gray-500" }, "Position"),
          h("div", { className: "text-lg font-semibold" }, `${posRef.current} sh`)
        ),
        h("div", { className: "p-2 rounded-xl border bg-white text-center" },
          h("div", { className: "text-[12px] text-gray-500" }, "P&L"),
          h("div", { className: `text-lg font-semibold ${pnlClass}` }, `$${fmt2(pnl)}`)
        ),
      ]),
      h("div", { className: "p-3 rounded-2xl border bg-white space-y-2 mx-2 mb-4" }, [
        h("div", { className: "text-sm font-semibold" }, "Trade"),
        h("input", { className: "w-full border rounded-xl px-3 py-2", type: "number", min: 1, step: 1, value: size, onChange: e => setSize(App.utils.clamp(Number(e.target.value)||0,1,1000000)), placeholder: "Order size (shares)" }),
        h("div", { className: "grid grid-cols-1 gap-2 mt-1" }, [
          h("button", { onClick: () => trade("BUY"),  className: "w-full px-4 py-3 rounded-xl border shadow-sm font-semibold bg-emerald-50" }, "BUY"),
          h("button", { onClick: () => trade("SELL"), className: "w-full px-4 py-3 rounded-xl border shadow-sm font-semibold bg-rose-50"    }, "SELL"),
        ]),
        h("div", { className: "text-[11px] text-gray-500" }, `Fee 0.01% · Pos cap ±${MAX_POS}`)
      ])
    );
  }

  App.uiMobile = { NewsStrip, MobilePlay };
})();
