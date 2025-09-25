// app.js — assembles everything into one React App
(function () {
  const { useState, useEffect } = React;

  function App() {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    // pick which layout to use
    if (isMobile) {
      return React.createElement(window.UIMobile);
    } else {
      return React.createElement(window.UIDesktop);
    }
  }

  // Expose the App so main.js can mount it
  window.App = App;
})();
