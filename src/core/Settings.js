// Les réglages de l'utilisateur : valeurs par défaut, lecture/écriture, et traduction
// en paramètres du moteur. Partagé par l'overlay (content script), le menu et la démo.
//
// Stockage : chrome.storage.sync dans l'extension ; localStorage + BroadcastChannel
// ailleurs (page de démo), pour que tout fonctionne aussi sans extension.
(() => {
  const B = window.Balade || (window.Balade = { ready: false });
  if (B.Settings) return;

  const KEY = "balade.settings";

  const DEFAULTS = Object.freeze({
    theme: "classique",   // classique | zine | galets | carnet
    count: 6,             // nombre de curseurs (2 à 12)
    pace: 55,             // allure : 0 calme → 100 vive
    curiosity: 40,        // 0 rêveurs → 100 fouineurs
    volume: 40,           // 0 à 100
    ghostTyping: true,    // écrire des mots fantômes dans les champs
    showNames: true,      // étiquettes avec les prénoms
    hideFullscreen: true, // se cacher en plein écran
    social: true,         // rencontres et bulles
    reactive: true        // attention partagée, réactions à vos gestes, essaim à la demande
  });

  const THEMES = ["classique", "zine", "galets", "carnet"];

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync;

  function sanitize(raw) {
    const s = { ...DEFAULTS, ...(raw || {}) };
    const num = (v, min, max, d) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, Math.round(+v))) : d);
    s.theme = THEMES.includes(s.theme) ? s.theme : DEFAULTS.theme;
    s.count = num(s.count, 2, 12, DEFAULTS.count);
    s.pace = num(s.pace, 0, 100, DEFAULTS.pace);
    s.curiosity = num(s.curiosity, 0, 100, DEFAULTS.curiosity);
    s.volume = num(s.volume, 0, 100, DEFAULTS.volume);
    s.ghostTyping = !!s.ghostTyping;
    s.showNames = !!s.showNames;
    s.hideFullscreen = !!s.hideFullscreen;
    s.social = !!s.social;
    s.reactive = !!s.reactive;
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

    /** Enregistre une partie des réglages (fusionnée avec l'existant). */
    async save(patch) {
      const next = sanitize({ ...(await this.load()), ...patch });
      if (hasChrome) {
        await chrome.storage.sync.set({ [KEY]: next });
      } else {
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch (err) { /* stockage indisponible : réglage non conservé */ }
        const ch = getChannel();
        if (ch) ch.postMessage(next);
      }
      return next;
    },

    /** Appelle `fn(settings)` à chaque changement. Renvoie une fonction pour se désabonner. */
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
     * Traduit les réglages en paramètres du moteur (modifie `config` en place).
     * Les correspondances sont volontairement douces : le milieu des curseurs
     * redonne les valeurs de base de Config.js.
     */
    applyToConfig(s, config) {
      // Foule : l'effectif oscille de ±1 autour du nombre choisi.
      config.population.target = s.count;
      config.population.min = Math.max(1, s.count - 1);
      config.population.max = s.count + 1;

      // Allure : multiplicateur de vitesse de 0,6 à 1,5 (progression géométrique).
      const speed = 0.6 * Math.pow(2.5, s.pace / 100);
      config.motion.speedMul = speed;
      config.wander.pauseMul = 1 / Math.sqrt(speed);

      // Curiosité : probabilité de base d'aller inspecter un élément, de 0,1 à 0,6.
      config.wander.inspect = 0.1 + 0.5 * (s.curiosity / 100);

      config.sound.volume = 0.45 * (s.volume / 100);
      config.sound.enabled = s.volume > 0;
      config.wander.ghostTypeChance = s.ghostTyping ? 0.75 : 0;
      config.theme = s.theme;
      config.showNames = s.showNames;
      config.hideFullscreen = s.hideFullscreen;
      config.social.enabled = s.social;
      config.social.reactive = s.reactive;
      config.attention.enabled = s.reactive;
      return config;
    }
  };

  B.Settings = Settings;
})();
