// app.js — picks mobile or desktop UI and exposes window.App
(function () {
  function App() {
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    const Comp = isMobile ? window.UIMobile : window.UIDesktop;

    if (!Comp) {
      return React.createElement("div", { className: "p-4 text-rose-700 text-sm" },
        "UI component not available. Did ui-mobile.js / ui-desktop.js set window.UIMobile / window.UIDesktop?"
      );
    }
    return React.createElement(Comp);
  }
  window.App = App;
})();
