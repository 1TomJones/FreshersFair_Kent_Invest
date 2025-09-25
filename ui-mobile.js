(function () {
  function UIMobile() {
    return React.createElement("div", { className: "p-3 space-y-3" },
      React.createElement("h1", { className: "text-xl font-bold" }, "Mobile Game Layout"),
      React.createElement("div", { className: "p-3 rounded-xl border bg-white" }, "This is the mobile UI placeholder."),
      React.createElement(window.Chart || (() => React.createElement("div", null, "Chart missing")))
    );
  }
  window.UIMobile = UIMobile;
})();
