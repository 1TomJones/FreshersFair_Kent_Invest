// app.js — assembles the full App
(function () {
  function App() {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    if (isMobile) {
      return React.createElement(window.UIMobile);
    } else {
      return React.createElement(window.UIDesktop);
    }
  }

  window.App = App;
})();
