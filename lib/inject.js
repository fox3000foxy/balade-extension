// Injection des scripts dans un onglet et pilotage de la balade.
// Chargé par le service worker (importScripts) et par le menu (<script>).
(() => {
  // L'ordre compte : chaque fichier s'appuie sur ceux qui le précèdent.
  const FILES = [
    "src/core/namespace.js",
    "src/core/MathUtils.js",
    "src/core/Config.js",
    "src/core/Settings.js",
    "src/entities/Cursor.js",
    "src/motion/Path.js",
    "src/motion/Motion.js",
    "src/world/Stage.js",
    "src/behaviors/Behavior.js",
    "src/behaviors/Arrive.js",
    "src/behaviors/Leave.js",
    "src/behaviors/Wander.js",
    "src/render/Themes.js",
    "src/render/FontLoader.js",
    "src/render/Renderer.js",
    "src/audio/Sound.js",
    "src/engine/Engine.js",
    "src/main.js"
  ];

  async function ensureLoaded(tabId) {
    const [{ result: loaded }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(window.Balade && window.Balade.ready)
    });
    if (!loaded) await chrome.scripting.executeScript({ target: { tabId }, files: FILES });
  }

  const BaladeInject = {
    FILES,

    /** Lance ou range la balade dans l'onglet. Renvoie le nouvel état. */
    async toggle(tabId) {
      await ensureLoaded(tabId);
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.Balade.toggle()
      });
      return result;
    },

    /**
     * État de la balade dans l'onglet : { state, count } avec state = "running",
     * "stopped" ou "unavailable" (page protégée : chrome://, Web Store…).
     */
    async status(tabId) {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const e = window.Balade && window.Balade.engine;
            const on = !!(e && e.running && !e.stopping);
            return { state: on ? "running" : "stopped", count: on ? e.cursors.filter((c) => !c.leaving).length : 0 };
          }
        });
        return result;
      } catch (err) {
        return { state: "unavailable", count: 0 };
      }
    }
  };

  self.BaladeInject = BaladeInject;
})();
