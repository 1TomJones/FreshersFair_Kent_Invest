/* main.js — waits for your App and renders it. Shows visible status on page. */
(function () {
  const STATUS_ID = "__boot_status";

  function setStatus(msg, isErr) {
    const root = document.getElementById("root");
    if (!root) return;
    let el = document.getElementById(STATUS_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = STATUS_ID;
      el.className = "p-4 text-sm";
      root.innerHTML = ""; // clear any previous content
      root.appendChild(el);
    }
    el.className = "p-4 text-sm " + (isErr ? "text-rose-700" : "text-gray-600");
    el.innerHTML = msg;
  }

  function haveEnv() {
    if (!window.React || !window.ReactDOM) {
      setStatus("React/ReactDOM not found — check script order in index.html.", true);
      return false;
    }
    if (!document.getElementById("root")) {
      setStatus("#root not found in DOM.", true);
      return false;
    }
    return true;
  }

  function resolveApp() {
    return window.App || window.Game || window.Root || null;
  }

  function mount() {
    try {
      const App = resolveApp();
      if (!App) {
        const scripts = Array.from(document.scripts).map(s => s.src.split("/").pop() || "(inline)");
        setStatus(
          `App not found. Looking for <code>window.App</code>.<br/>Loaded scripts:<br/><code>${scripts.join("<br/>")}</code>`,
          true
        );
        return;
      }
      const root = document.getElementById("root");
      const h = React.createElement;
      if (!window.__APP_ROOT__) window.__APP_ROOT__ = ReactDOM.createRoot(root);
      window.__APP_ROOT__.render(h(App));
    } catch (e) {
      console.error(e);
      setStatus("Render failed. Open console for details.", true);
    }
  }

  function waitAndMount() {
    if (!haveEnv()) return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (resolveApp()) {
        clearInterval(t);
        mount();
      } else if (tries === 1) {
        setStatus("Loading modules…");
      } else if (tries > 100) { // ~10s
        clearInterval(t);
        mount(); // will show a helpful error panel if still missing
      }
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitAndMount, { once: true });
  } else {
    waitAndMount();
  }
})();
