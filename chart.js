// chart.js — SVG PriceChart with scrolling markers
(function () {
  const h = React.createElement;

  function PriceChart({
    data,                // [{ t, mid }]
    fairLine = null,     // number|null
    newsEvents = [],     // [{ t }]
    trades = [],         // [{ t, price, side }]
    posAvg = null,       // number|null
    posSide = 0,         // -1, 0, +1
    mobile = false
  }) {
    if (!data || data.length === 0) return h("div", { style: { height: "200px" } });

    const w = 1800, hgt = mobile ? 900 : 480;
    const BLEED = 0;
    const yPadPct = mobile ? 0.002 : 0.02;

    const ys = data.map(d => d.mid);
    let minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = (maxY - minY) * yPadPct;
    minY -= pad; maxY += pad;
    const rangeY = Math.max(1e-6, maxY - minY);

    const xOf = (i) => BLEED + (i / Math.max(1, data.length - 1)) * (w - 2 * BLEED);
    const yOf = (v) => (hgt - BLEED) - ((v - minY) / rangeY) * (hgt - 2 * BLEED);

    const t0 = data[0].t;
    const idxFromTick = (tAbs) => Math.max(0, Math.min(data.length - 1, tAbs - t0));

    const pts = data.map((d, i) => `${xOf(i)},${yOf(d.mid)}`).join(" ");
    const elems = [];

    // grid
    const ticks = mobile ? 3 : 5;
    for (let k=0; k<ticks; k++) {
      const t = k/(ticks-1);
      const val = maxY - t*rangeY;
      const y = yOf(val);
      elems.push(h("line",{key:"g"+k,x1:0,y1:y,x2:w,y2:y,stroke:"#f3f4f6","stroke-width":1}));
      elems.push(h("text",{key:"gt"+k,x:6,y:y+5,className:"fill-gray-800 text-[12px] font-semibold"}, Number(val).toFixed(2)));
    }

    // fair value
    if (fairLine != null) {
      const yFV = yOf(fairLine);
      elems.push(h("line",{key:"fv",x1:0,y1:yFV,x2:w,y2:yFV,stroke:"#94a3b8","stroke-width":1.4,"stroke-dasharray":"4 4",opacity:0.85}));
    }

    // price
    elems.push(h("polyline",{key:"pl",points:pts,fill:"none",stroke:"#000","stroke-width":2.2,"stroke-opacity":0.9}));

    // VWAP
    if (posAvg != null && posSide !== 0) {
      const yVW = yOf(posAvg);
      elems.push(h("line",{key:"vw",x1:0,y1:yVW,x2:w,y2:yVW,stroke:posSide>0?"#10b981":"#ef4444","stroke-width":2,"stroke-dasharray":"6 4",opacity:0.9}));
      elems.push(h("text",{key:"vwt",x:w-8,y:yVW-6,"text-anchor":"end",className:(posSide>0?"fill-emerald-600 ":"fill-rose-600 ")+"text-[12px] font-semibold"},`VWAP ${posSide>0?"(long)":"(short)"} $${Number(posAvg).toFixed(2)}`));
    }

    // trades
    trades.forEach((tr, idx) => {
      if (typeof tr.t !== "number") return;
      const i = idxFromTick(tr.t);
      const x = xOf(i), y = yOf(tr.price);
      const isBuy = tr.side === "BUY", s = 6;
      const points = isBuy ? `${x},${y - s} ${x - s},${y + s} ${x + s},${y + s}` : `${x},${y + s} ${x - s},${y - s} ${x + s},${y - s}`;
      elems.push(h("polygon",{key:"tr"+idx,points,fill:isBuy?"#2563eb":"#ef4444",opacity:0.9,stroke:"#0f172a","stroke-width":0.5}));
    });

    // news bubbles at bottom with vertical purple line to top
    const bubbleR = mobile ? 16 : 18;
    const bubbleY = hgt - (bubbleR + 6);
    const newsColor = "#7c3aed";
    newsEvents.forEach((e, idx) => {
      const i = idxFromTick(e.t);
      const x = xOf(i);
      elems.push(h("line",{key:"nl"+idx,x1:x,y1:0,x2:x,y2:bubbleY - bubbleR,stroke:newsColor,"stroke-width":1.8,"stroke-dasharray":"3 4",opacity:0.9}));
      elems.push(h("circle",{key:"nc"+idx,cx:x,cy:bubbleY,r:bubbleR,fill:"#fff",stroke:newsColor,"stroke-width":2,opacity:0.98}));
      elems.push(h("text",{key:"nt"+idx,x:x,y:bubbleY+5,"text-anchor":"middle",className:"fill-gray-900 text-[14px] font-bold"},"N"));
    });

    const svgStyle = mobile
      ? { width: "100%", height: "auto", display: "block", aspectRatio: `${w}/${hgt}`, minHeight: "62vh", maxHeight: "76vh" }
      : { width: "100%", height: "36vh", display: "block" };

    return h(
      "div",
      { className: mobile ? "bg-transparent" : "p-3 rounded-2xl border shadow-sm bg-white" },
      h("svg",{viewBox:`0 0 ${w} ${hgt}`,style:svgStyle,preserveAspectRatio:"xMidYMid meet"}, elems)
    );
  }

  window.PriceChart = PriceChart;
})();
