// ui-desktop.js — desktop layout components (full-bleed chart)
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
    return h("div", { className: `p-3 ${base} ${clsColor}`, style: { minHeight: "64px" } }, [
      h("div", { key:"a", className:"text-sm font-semibold" }, headline ? (colored ? (headline.pct>0?"▲ Positive macro":headline.pct<0?"▼ Negative macro":"→ Neutral macro") : "News") : "News"),
      h("div", { key:"b", className:"text-sm" }, headline ? headline.h : "Waiting for news…"),
      h("div", { key:"c", className:"text-xs text-gray-700 mt-1" }, headline ? `${headline.why}${headline.pct===0 ? "" : ` — fair value ${(headline.pct*100).toFixed(0)}%.`}` : "Headlines every 15s.")
    ]);
  }

  function DesktopTopStats({ mid, fair, spread, pos, cash, pnl, total, MAX_POS, pnlClass }) {
    return h("div", { className: "grid md:grid-cols-6 gap-3" }, [
      h("div", { className: "p-3 rounded-2xl border shadow-sm bg-white" }, [
        h("div", { className: "text-xs text-gray-500" }, "Mid"),
        h("div", { className: "text-2xl font-semibold" }, `$${fmt2(mid)}`),
        h("div", { className: "text-xs text-gray-500 mt-1" }, "Spread " + fmt2(spread)),
      ]),
      h("div", { className: "p-3 rounded-2xl border shadow-sm bg-white" }, [
        h("div", { className: "text-xs text-gray-500" }, "Fair Value"),
        h("div", { className: "text-2xl font-semibold" }, `$${fmt2(fair)}`),
        h("div", { className: "text-xs text-gray-500 mt-1" }, "Anchors drift"),
      ]),
      h("div", { className: "p-3 rounded-2xl border shadow-sm bg-white" }, [
        h("div", { className: "text-xs text-gray-500" }, "Position"),
        h("div", { className: "text-2xl font-semibold" }, `${pos} sh`),
        h("div", { className: "text-xs text-gray-500 mt-1" }, "Cap ±" + MAX_POS),
      ]),
      h("div", { className: "p-3 rounded-2xl border shadow-sm bg-white" }, [
        h("div", { className: "text-xs text-gray-500" }, "Cash"),
        h("div", { className: "text-2xl font-semibold" }, "$" + cash.toLocaleString()),
      ]),
      h("div", { className: "p-3 rounded-2xl border shadow-sm bg-white" }, [
        h("div", { className: "text-xs text-gray-500" }, "P&L (MTM)"),
        h("div", { className: "text-2xl font-semibold " + pnlClass }, `$${fmt2(pnl)}`),
        h("div", { className: "text-xs text-gray-500 mt-1" }, "Total $" + total.toLocaleString()),
      ]),
      null,
    ]);
  }

  function DesktopPlay(props) {
    const {
      player, regime, timeLeft, mode, soundOn, enableSound, fullscreenToggle,
      headline, hist, fair, newsEventsRef, tradesRef, avgPriceRef,
      midRef, fairRef, spread, posRef, cashRef, pnl, pnlClass, totalVal,
      MAX_POS, size, setSize, trade
    } = props;

    return React.createElement(React.Fragment, null,
      h("header", { className: "flex items-center justify-between" },
        h("div", { className: "text-xl font-semibold" }, `Trader: ${player}`),
        h("div", { className: "flex items-center gap-2" }, [
          h("span", { className: "px-2 py-1 rounded-full text-xs border bg-white" }, regime),
          h("span", { className: "px-2 py-1 rounded-full text-xs border bg-white" }, `⏱ ${timeLeft}s`),
          h("span", { className: "px-2 py-1 rounded-full text-xs border bg-white" }, `${mode==="easy"?"Easy":"Normal"} · ${App.TICKER}`),
          h("button", { onClick: enableSound, className: "px-2 py-1 rounded-full text-xs border bg-white" }, soundOn ? "🔊" : "🔇"),
          h("button", { onClick: fullscreenToggle, className: "px-2 py-1 rounded-full text-xs border bg-white" }, "⤢"),
        ])
      ),
      h(NewsStrip, { headline, mode }),
      h(DesktopTopStats, { mid: midRef.current, fair: fairRef.current, spread, pos: posRef.current, cash: cashRef.current, pnl, total: totalVal, MAX_POS, pnlClass }),

      // Full-bleed chart (fix B)
      h("div", { className: "full-bleed" },
        h("div", { className: "mx-auto max-w-[1920px] px-2" },
          h(App.PriceChart, { data: hist, fairLine: fair, newsEvents: newsEventsRef.current, trades: tradesRef.current, posAvg: avgPriceRef.current, posSide: Math.sign(posRef.current), mobile: false })
        )
      ),

      h("div", { className: "grid md:grid-cols-3 gap-3 items-end" }, [
        h("div", { className: "p-4 rounded-2xl border shadow-sm bg-white space-y-3" }, [
          h("div", { className: "text-sm font-semibold" }, "Trade"),
          h("label", { className: "text-xs text-gray-500" }, "Order size (shares)"),
          h("input", { type: "number", min: 1, step: 1, value: size, onChange: e => props.setSize(App.utils.clamp(Number(e.target.value)||0,1,1000000)), className: "w-full border rounded-xl px-3 py-2" }),
          h("div", { className: "grid grid-cols-2 gap-2" }, [
            h("button", { onClick: () => trade("SELL"), className: "px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-rose-50" }, "SELL"),
            h("button", { onClick: () => trade("BUY"),  className: "px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-emerald-50" }, "BUY"),
          ]),
          h("div", { className: "flex justify-between text-xs text-gray-500" }, [
            h("div", null, "Fee: 0.01% notional"),
            h("div", null, `Pos cap: ±${App.MAX_POS} sh · Liquidity refills each tick`),
          ]),
        ]),
        h("div", { className: "p-4 rounded-2xl border shadow-sm bg-white space-y-3" }, [
          h("div", { className: "text-sm font-semibold" }, "Round Controls"),
          h("button", { onClick: props.endNow, className: "px-3 py-2 rounded-xl border shadow-sm font-medium hover:bg-slate-50" }, "End Round"),
          h("div", { className: "text-xs text-gray-500" }, mode==="easy" ? "Easy: colored news, 5s pause on headlines, slower ticks." : "Normal: no assists, full speed, leaderboard."),
        ]),
        h("div", { className: "p-4 rounded-2xl border shadow-sm bg-white space-y-2" }, [
          h("div", { className: "text-sm font-semibold" }, "How to win"),
          h("ul", { className: "list-disc list-inside text-sm text-gray-700 space-y-1" }, [
            h("li", null, "Watch Fair Value moves on news (dashed line)."),
            h("li", null, "Slice orders across ticks to reduce impact."),
            h("li", null, "Follow your VWAP line to manage risk."),
            h("li", null, "Keep an eye on the position cap."),
          ]),
        ]),
      ])
    );
  }

  App.uiDesktop = { DesktopPlay };
})();
