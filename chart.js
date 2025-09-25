/* chart.js — SVG PriceChart. Exposes window.PriceChart */

(function () {
  const h = React.createElement;
  const isMobileNow = () => (typeof window !== "undefined" && window.innerWidth <= 640);

  function PriceChart({
    data,
    fairLine = null,
    newsEvents = [],
    trades = [],
    posAvg = null,
    posSide = 0,
    mobile = isMobileNow(),
  }) {
    if (!data || data.length === 0) return h("div", { style: { height: "200px" } });

    // Base drawing space
    const w = 1800, hgt = 560;

    // On mobile: zero internal padding and tiny value-padding
    const BLEED = mobile ? 0 : 10;
    const yPadPct = mobile ? 0.001 : 0.02;

    const ys = data.map((d) => d.mid);
    let minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = (maxY - minY) * yPadPct;
    minY -= pad; maxY += pad;
    const rangeY = Math.max(1e-6, maxY - minY);

    const xOf = (i) => BLEED + (i / Math.max(1, data.length - 1)) * (w - 2 * BLEED);
    const yOf = (v) => (hgt - BLEED) - ((v - minY) / rangeY) * (hgt - 2 * BLEED);
    const pts = data.map((d, i) => `${xOf(i)},${yOf(d.mid)}`).join(" ");

    const elems = [];

    // Light grid + readable labels
    const ticks = mobile ? 3 : 5;
    for (let k = 0; k < ticks; k++) {
      const t = k / (ticks - 1);
      const val = maxY - t * rangeY;
      const y = yOf(val);
      elems.push(h("line", { key: "gl" + k, x1: 0, y1: y, x2: w, y2: y, stroke: "#f3f4f6", "stroke-width": 1 }));
      const labCls = mobile ? "fill-gray-800 text-[13px] font-semibold" : "fill-gray-800 text-[12px] font-semibold";
      elems.push(h("text", { key: "gt" + k, x: 6, y: y + 5, "text-anchor": "start", className: labCls }, Number(val).toFixed(2)));
    }

    // Fair value
    if (fairLine != null) {
      const yFV = yOf(fairLine);
      elems.push(h("line", { key: "fv", x1: 0, y1: yFV, x2: w, y2: yFV, stroke: "#94a3b8", "stroke-width": 1.4, "stroke-dasharray": "4 4", opacity: 0.85 }));
    }

    // Price
    elems.push(h("polyline", { key: "pl", points: pts, fill: "none", stroke: "#000", "stroke-width": 2.2, "stroke-opacity": 0.9 }));

    // VWAP
    if (posAvg != null && posSide !== 0) {
      const yVW = yOf(posAvg);
      elems.push(h("line", { key: "vw", x1: 0, y1: yVW, x2: w, y2: yVW, stroke: posSide > 0 ? "#10b981" : "#ef4444", "stroke-width": 2, "stroke-dasharray": "6 4", opacity: 0.9 }));
      elems.push(
        h(
          "text",
          { key: "vwt", x: w - 8, y: yVW - 6, "text-anchor": "end", className: (posSide > 0 ? "fill-emerald-600 " : "fill-rose-600 ") + "text-[12px] font-semibold" },
          `VWAP ${posSide > 0 ? "(long)" : "(short)"} $${Number(posAvg).toFixed(2)}`
        )
      );
    }

    // Trades (triangles)
    trades.forEach((tr, idx) => {
      const i = tr.i; if (i < 0 || i >= data.length) return;
      const x = xOf(i), y = yOf(tr.price);
      const isBuy = tr.side === "BUY", s = 6;
      const points = isBuy ? `${x},${y - s} ${x - s},${y + s} ${x + s},${y + s}` : `${x},${y + s} ${x - s},${y - s} ${x + s},${y - s}`;
      elems.push(h("polygon", { key: "tr" + idx, points, fill: isBuy ? "#2563eb" : "#ef4444", opacity: 0.9, stroke: "#0f172a", "stroke-width": 0.5 }));
    });

    // News (bottom bubble + purple line to top)
    const bubbleR = mobile ? 16 : 18;
    const bubbleY = hgt - (bubbleR + 6);
    const newsColor = "#7c3aed";
    newsEvents.forEach((e, idx) => {
      const i = e.i; if (i < 0 || i >= data.length) return;
      const x = xOf(i);
      elems.push(h("line", { key: "nl" + idx, x1: x, y1: 0, x2: x, y2: bubbleY - bubbleR, stroke: newsColor, "stroke-width": 1.8, "stroke-dasharray": "3 4", opacity: 0.9 }));
      elems.push(h("circle", { key: "nc" + idx, cx: x, cy: bubbleY, r: bubbleR, fill: "#fff", stroke: newsColor, "stroke-width": 2, opacity: 0.98 }));
      elems.push(h("text", { key: "nt" + idx, x: x, y: bubbleY + 5, "text-anchor": "middle", className: "fill-gray-900 text-[14px] font-bold" }, "N"));
    });

    // IMPORTANT: avoid distortion on mobile.
    // We let CSS control the height via aspect-ratio and max-height,
    // and keep the SVG's natural aspect using 'meet'.
    const svgStyle = mobile
      ? { width: "100%", height: "auto", display: "block", aspectRatio: `${w}/${hgt}`, maxHeight: "50vh" } // shorter than before
      : { width: "100%", height: "36vh", display: "block" };

    const par = "xMidYMid meet";

    return h(
      "div",
      { className: mobile ? "bg-transparent" : "p-3 rounded-2xl border shadow-sm bg-white" },
      h("svg", { viewBox: `0 0 ${w} ${hgt}`, style: svgStyle, preserveAspectRatio: par }, elems)
    );
  }

  window.PriceChart = PriceChart;
})();
