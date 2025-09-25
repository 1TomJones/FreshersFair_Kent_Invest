(function () {
  function UIDesktop() {
    return React.createElement("div", { className: "max-w-5xl mx-auto p-4 space-y-4" },
      React.createElement("h1", { className: "text-2xl font-bold" }, "Desktop Game Layout"),
      React.createElement("div", { className: "p-3 rounded-xl border bg-white" }, "This is the desktop UI placeholder."),
      React.createElement(window.Chart || (() => React.createElement("div", null, "Chart missing")))
    );
  }
  window.UIDesktop = UIDesktop;
})();
