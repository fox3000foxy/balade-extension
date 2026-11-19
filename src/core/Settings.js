// User settings: defaults, read/write, and mapping to engine parameters.
// Shared by the overlay (content script), the menu, and the demo.
//
// Storage: chrome.storage.sync in the extension; localStorage + BroadcastChannel
// elsewhere (demo page), so everything works without the extension too.
(() => {
  const B = window.Balade || (window.Balade = { ready: false });
  if (B.Settings) return;

  const KEY = "balade.settings";

  const DEFAULTS = Object.freeze({
    theme: "classique",   // classique | zine | galets | carnet
    count: 6,             // number of cursors (2 to 12)
    pace: 55,             // pace: 0 calm -> 100 lively
    curiosity: 40,        // 0 dreamers -> 100 snoopers
    volume: 40,           // 0 to 100
    ghostTyping: true,    // type ghost words in empty fields
    showNames: true,      // show name tags
    hideFullscreen: true, // hide in full screen
    social: true,         // greetings and bubbles
    reactive: true,       // shared attention, reactions to gestures, on-demand swarm
    adaptDark: true,      // adapt pointers to dark backgrounds
    anticipate: true,     // guess the element you are aiming at
    learn: true,          // learn your click sequences (local only)
    names: [],            // your names (empty: use the default list)
    custom: null,         // custom theme: { enabled, base, palette, pointer }
    excludedSites: [],    // sites where Balade never starts (hostnames)
    autoSites: []         // sites where Balade starts automatically (hostnames)
  });

  const THEMES = ["fantome", "classique", "zine", "galets", "carnet"];
  const HEX = /^#[0-9a-f]{6}$/i;

  /** Custom theme: base, palette (#rrggbb colors), imported pointer (already sanitized). */
  function sanitizeCustom(c) {
    if (!c || typeof c !== "object") return null;
    const palette = (Array.isArray(c.palette) ? c.palette : []).filter((x) => HEX.test(x)).slice(0, 10);
    let pointer = null;
    const p = c.pointer;
    if (p && typeof p.markup === "string" && p.markup.length <= 20000 && Array.isArray(p.viewBox) &&
        p.viewBox.length === 4 && p.viewBox.every(Number.isFinite) && p.viewBox[2] > 0 && p.viewBox[3] > 0) {
      const hx = Number(p.hot && p.hot.x);
      const hy = Number(p.hot && p.hot.y);
      pointer = {
        markup: p.markup,
        viewBox: p.viewBox,
        hot: { x: Number.isFinite(hx) ? hx : p.viewBox[0], y: Number.isFinite(hy) ? hy : p.viewBox[1] },
        name: String(p.name || "").slice(0, 60)
      };
    }
    return {
      enabled: !!c.enabled,
      base: THEMES.includes(c.base) ? c.base : "classique",
      palette: palette.length ? palette : null,
      pointer
    };
  }

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync;

  function sanitize(raw) {
    const s = { ...DEFAULTS, ...(raw || {}) };
    const num = (v, min, max, d) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, Math.round(+v))) : d);
    s.custom = sanitizeCustom(s.custom);
    const allowed = s.custom && s.custom.enabled ? [...THEMES, "perso"] : THEMES;
    s.theme = allowed.includes(s.theme) ? s.theme : DEFAULTS.theme;
    s.names = [...new Set((Array.isArray(s.names) ? s.names : [])
      .map((n) => String(n).replace(/\s+/g, " ").trim().slice(0, 24)).filter(Boolean))].slice(0, 40);
    s.count = num(s.count, 2, 12, DEFAULTS.count);
    s.pace = num(s.pace, 0, 100, DEFAULTS.pace);
    s.curiosity = num(s.curiosity, 0, 100, DEFAULTS.curiosity);
    s.volume = num(s.volume, 0, 100, DEFAULTS.volume);
    s.ghostTyping = !!s.ghostTyping;
    s.showNames = !!s.showNames;
    s.hideFullscreen = !!s.hideFullscreen;
    s.social = !!s.social;
    s.reactive = !!s.reactive;
    s.adaptDark = !!s.adaptDark;
    s.anticipate = !!s.anticipate;
    s.learn = !!s.learn;
    const hosts = (list) =>
      [...new Set((Array.isArray(list) ? list : []).map((h) => String(h).trim().toLowerCase()).filter(Boolean))].slice(0, 200);
    s.excludedSites = hosts(s.excludedSites);
    s.autoSites = hosts(s.autoSites).filter((h) => !s.excludedSites.includes(h));
    return s;
  }

  let channel = null;
  const getChannel = () => {
    if (!channel && typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(KEY);
    return channel;
  };

  const Settings = {
    DEFAULTS,
    THEMES,

    async load() {
      if (hasChrome) {
        const got = await chrome.storage.sync.get(KEY);
        return sanitize(got[KEY]);
      }
      try {
        return sanitize(JSON.parse(localStorage.getItem(KEY) || "null"));
      } catch (err) {
        return sanitize(null);
      }
    },

    /** Saves a subset of settings (merged with existing). */
    async save(patch) {
      const next = sanitize({ ...(await this.load()), ...patch });
      if (hasChrome) {
        await chrome.storage.sync.set({ [KEY]: next });
      } else {
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch (err) { /* storage unavailable: setting not saved */ }
        const ch = getChannel();
        if (ch) ch.postMessage(next);
      }
      return next;
    },

    /** Calls `fn(settings)` on every change. Returns an unsubscribe function. */
    subscribe(fn) {
      if (hasChrome) {
        const listener = (changes, area) => {
          if (area === "sync" && changes[KEY]) fn(sanitize(changes[KEY].newValue));
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
      }
      const ch = getChannel();
      if (!ch) return () => {};
      const listener = (e) => fn(sanitize(e.data));
      ch.addEventListener("message", listener);
      return () => ch.removeEventListener("message", listener);
    },

    /**
     * Maps settings to engine parameters (modifies `config` in place).
     * Curves are intentionally gentle: the slider midpoint reproduces Config.js defaults.
     */
    applyToConfig(s, config) {
      // Crowd: count oscillates by +/-1 around the chosen number.
      config.population.target = s.count;
      config.population.min = Math.max(1, s.count - 1);
      config.population.max = s.count + 1;

      // Pace: speed multiplier from 0.6 to 1.5 (geometric progression).
      const speed = 0.6 * Math.pow(2.5, s.pace / 100);
      config.motion.speedMul = speed;
      config.wander.pauseMul = 1 / Math.sqrt(speed);

      // Curiosity: base probability of inspecting an element, from 0.1 to 0.6.
      config.wander.inspect = 0.1 + 0.5 * (s.curiosity / 100);

      config.sound.volume = 0.45 * (s.volume / 100);
      config.sound.enabled = s.volume > 0;
      config.wander.ghostTypeChance = s.ghostTyping ? 0.75 : 0;
      config.theme = s.theme;
      config.custom = s.custom;
      config.names = s.names.length ? s.names : B.Config.names;
      config.showNames = s.showNames;
      config.hideFullscreen = s.hideFullscreen;
      config.social.enabled = s.social;
      config.social.reactive = s.reactive;
      config.attention.enabled = s.reactive;
      config.adaptDark = s.adaptDark;
      config.predict.enabled = s.anticipate;
      config.predict.learn = s.learn;
      return config;
    },

    /** Is Balade excluded on this hostname? */
    isExcluded(s, host) {
      return s.excludedSites.includes(String(host || "").toLowerCase());
    }
  };

  B.Settings = Settings;
})();
