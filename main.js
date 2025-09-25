(function () {
  const { createElement } = React;
  const rootElement = document.getElementById("root");
  const root = ReactDOM.createRoot(rootElement);

  function tryRender() {
    if (window.App) {
      root.render(createElement(window.App));
    } else {
      console.log("App not ready yet, retrying…");
      setTimeout(tryRender, 200);
    }
  }

  tryRender();
})();
