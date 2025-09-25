// app.js — chooses mobile/desktop UI and exposes window.App
(function () {
  function App() {
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    return React.createElement(isMobile ? window.UIMobile : window.UIDesktop);
  }
  window.App = App;
})();
