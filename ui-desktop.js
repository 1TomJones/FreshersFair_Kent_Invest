function UIDesktop() {
  return React.createElement("div", { className: "p-4" },
    React.createElement("h1", { className: "text-2xl font-bold" }, "Desktop Game Layout"),
    React.createElement("p", null, "Here will go the trading UI for desktop.")
  );
}

window.UIDesktop = UIDesktop;
