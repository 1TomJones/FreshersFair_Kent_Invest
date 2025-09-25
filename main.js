/* main.js — tiny bootstrapper that mounts the already-assembled App
   Assumes your other scripts define:  window.App  (a React component)
   and that React/ReactDOM UMD are loaded by index.html.
*/

(function () {
  // Version tag for cache-busting sanity
  const BOOT_VERSION = "boot-20250925-01";
  console.log("[Main] loaded", BOOT_VERSION);

  // Guard rails
  function assertEnv() {
    if (!window.React || !window.ReactDOM) {
      console.error("[Main] React/ReactDOM not found. Check index.html script order.");
      return false;
    }
    if (!document.getElementById("root")) {
      console.error("[Main] #root not found in DOM.");
      return false;
    }
    if (!window.App) {
      console.error("[Main] window.App not found. Ensure your split files define window.App.");
      return false;
    }
    return true;
  }

  // Mount once; keep the root around for any future hot reloads
  function mount() {
    if (!assertEnv()) return;
    const h = window.React.createElement;
    const rootEl = document.getElementById("root");

    if (!window.__APP_ROOT__) {
      window.__APP_ROOT__ = window.ReactDOM.createRoot(rootEl);
    }
    window.__APP_ROOT__.render(h(window.App));
  }

  // Optional: give other modules a simple way to trigger a re-render
  // (e.g., if they swap the global App at runtime)
  window.__remountApp = mount;

  // Mount on DOM ready (works for GitHub Pages and local file)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  // Optional niceties: if the page regains visibility and others requested a remount
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && typeof window.__onAppVisible === "function") {
      try { window.__onAppVisible(); } catch (e) { console.warn(e); }
    }
  });

  // If other modules want to react to resize, they can assign window.onAppResize
  window.addEventListener("resize", () => {
    if (typeof window.onAppResize === "function") {
      try { window.onAppResize(); } catch (e) { console.warn(e); }
    }
  });
})();
