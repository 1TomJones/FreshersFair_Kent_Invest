// chart.js — tiny placeholder chart so the page never looks blank
(function () {
  function Chart() {
    return React.createElement("div", { className: "p-3 rounded-xl border bg-white" },
      React.createElement("div", { className: "text-sm mb-2 font-semibold" }, "Chart"),
      React.createElement("div", { className: "h-40 w-full bg-slate-100 rounded-md flex items-center justify-center text-xs text-gray-500" }, "chart placeholder")
    );
  }
  window.Chart = Chart;
})();
