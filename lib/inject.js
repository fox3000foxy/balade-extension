// Injection des scripts dans un onglet et pilotage de la balade.
// Chargé par le service worker (importScripts) et par le menu (<script>).
(() => {
  // L'ordre compte : chaque fichier s'appuie sur ceux qui le précèdent.
  const FILES = [
    "src/core/namespace.js",
    "src/core/I18n.js",
    "src/core/MathUtils.js",
    "src/core/Config.js",
    "src/core/Settings.js",
    "src/core/SvgSanitizer.js",
    "src/entities/Cursor.js",
    "src/motion/Path.js",
    "src/motion/Motion.js",
    "src/world/Stage.js",
    "src/world/Habits.js",
    "src/world/Predictor.js",
    "src/behaviors/Behavior.js",
    "src/behaviors/Arrive.js",
    "src/behaviors/Leave.js",
    "src/behaviors/Wander.js",
    "src/behaviors/Gather.js",
    "src/behaviors/Follow.js",
    "src/behaviors/Swarm.js",
    "src/behaviors/Anticipate.js",
    "src/behaviors/Flee.js",
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

  const SETTINGS_KEY = "balade.settings";
  const AUTO_ID = "balade-auto";

  const BaladeInject = {
    FILES,

    /**
     * Met à jour le lancement automatique : un script de contenu enregistré pour les sites
     * choisis, à condition que l'utilisateur ait accordé l'accès à chacun d'eux.
     */
    async syncAutoStart() {
      const got = await chrome.storage.sync.get(SETTINGS_KEY);
      const s = got[SETTINGS_KEY] || {};
      const excluded = new Set(s.excludedSites || []);
      const hosts = (s.autoSites || []).filter((h) => !excluded.has(h));
      const matches = [];
      for (const h of hosts) {
        const origin = `*://${h}/*`;
        if (await chrome.permissions.contains({ origins: [origin] })) matches.push(origin);
      }
      try {
        await chrome.scripting.unregisterContentScripts({ ids: [AUTO_ID] });
      } catch (err) { /* rien d'enregistré */ }
      if (matches.length === 0) return 0;
      await chrome.scripting.registerContentScripts([{
        id: AUTO_ID,
        matches,
        js: [...FILES, "src/autostart.js"],
        runAt: "document_idle",
        allFrames: false
      }]);
      return matches.length;
    },

    /** Lance ou range la balade dans l'onglet. Renvoie "running", "stopped" ou "excluded". */
    async toggle(tabId) {
      await ensureLoaded(tabId);
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.Balade.toggle()
      });
      return result;
    },

    /** Appelle une fonction de window.Balade dans l'onglet (startGame, startFocus…). */
    async call(tabId, name, args = []) {
      await ensureLoaded(tabId);
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (n, a) => window.Balade[n](...a),
        args: [name, args]
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
            return {
              state: on ? "running" : "stopped",
              count: on ? e.cursors.filter((c) => !c.leaving).length : 0,
              host: location.hostname,
              game: on && e.game ? { caught: e.game.caught, total: e.game.total } : null,
              focus: on && e.focus ? { phase: e.focus.phase, left: Math.max(0, Math.round((e.focus.until - Date.now()) / 1000)) } : null
            };
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
