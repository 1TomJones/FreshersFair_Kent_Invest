/* main.js — robust bootstrapper that waits for your App and mounts it.
   It tries (in order): window.App, window.Game, window.Root, window.createApp().
   If your app module exports a function, e.g. window.createApp = () => <App/>,
   this file will call it. You can also manually signal readiness via:
     window.AppReady(AppComponent)
*/

(function () {
  const BOOT_VERSION = "boot-20250925-robust";
  console.log("[Main] loaded", BOOT_VERSION);

  // ----- tiny helpers -----
  const h = (el, props, ...kids) => window.React.createElement(el, props, ...kids);

  function getRoot() {
    return document.getElementById("root");
  }

  function resolveApp() {
    // Try common globals
    if (window.App) return window.App;
    if (window.Game) return window.Game;
    if (window.Root) return window.Root;
    if (typeof window.createApp === "function") {
      try {
        const maybe = window.createApp();
        // If they returned a React element, wrap it
        if (window.React.isValidElement?.(maybe)) {
          return function Wrapper() { return maybe; };
        }
        // If they returned a component/function, use it
        if (typeof maybe === "function") return maybe;
      } catch (e) {
        console.warn("[Main] createApp() threw:", e);
      }
    }
    return null;
  }

  function showStatus(message, isError = false) {
    const root = getRoot();
    if (!root) return;
    const cls = "font-sans text-sm " + (isError ? "text-rose-700" : "text-gray-600");
    root.innerHTML = `<div style="padding:16px">${message}</div>`;
    // minimal styling via Tailwind class names (if present)
    root.firstChild.className = cls;
  }

  function assertEnv() {
    if (!window.React || !window.ReactDOM) {
      showStatus("React/ReactDOM not found. Check script order in index.html.", true);
      console.error("[Main] React/ReactDOM not found.");
      return false;
    }
    if (!getRoot()) {
      console.error("[Main] #root not found in DOM.");
      return false;
    }
    return true;
  }

  // Expose a manual hook: other modules can call window.AppReady(App)
  window.AppReady = function(AppComponent) {
    try {
      window.App = AppComponent;
      mount(true);
    } catch (e) {
      console.error("[Main] AppReady failed:", e);
    }
  };

  function mount(force = false) {
    if (!assertEnv()) return;

    const App = resolveApp();
    if (!App && !force) {
      return;
    }
    if (!App) {
      // We were forced but still no app: display useful debug info
      const scripts = Array.from(document.scripts).map(s => s.src || "(inline)");
      showStatus(
        `<strong>App not found.</strong><br/>
         Looking for <code>window.App</code>, <code>window.Game</code>, <code>window.Root</code>, or <code>window.createApp()</code>.<br/>
         Loaded scripts:<br/><code>${scripts.join("<br/>")}</code>`, true
      );
      console.error("[Main] App not found on window.*");
      return;
    }

    try {
      if (!window.__APP_ROOT__) {
        const rootEl = getRoot();
        window.__APP_ROOT__ = window.ReactDOM.createRoot(rootEl);
      }
      window.__APP_ROOT__.render(h(App, {}));
      console.log("[Main] App mounted.");
    } catch (e) {
      console.error("[Main] Render failed:", e);
      showStatus("Render failed. See console for details.", true);
    }
  }

  // Retry loop: wait for your split files to define the App
  function waitAndMount() {
    if (!assertEnv()) return;

    let attempts = 0;
    const maxAttempts = 100; // ~10s at 100ms
    const timer = setInterval(() => {
      attempts++;
      const App = resolveApp();
      if (App) {
        clearInterval(timer);
        mount();
      } else if (attempts === 1) {
        showStatus("Loading… (waiting for app modules)");
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        // Force a mount to show debugging info
        mount(true);
      }
    }, 100);
  }

  // Auto-remount hooks (optional)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && typeof window.__onAppVisible === "function") {
      try { window.__onAppVisible(); } catch (e) { console.warn(e); }
    }
  });
  window.addEventListener("resize", () => {
    if (typeof window.onAppResize === "function") {
      try { window.onAppResize(); } catch (e) { console.warn(e); }
    }
  });

  // Start once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitAndMount, { once: true });
  } else {
    waitAndMount();
  }
})();
