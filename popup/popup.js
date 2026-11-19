// Le menu : lit et enregistre les réglages (appliqués en direct sur la page),
// lance ou range la balade dans l'onglet actif, et prend l'apparence du thème choisi.
(() => {
  const { Settings, Themes } = window.Balade;
  const $ = (id) => document.getElementById(id);

  const inExtension = typeof chrome !== "undefined" && chrome.tabs && chrome.scripting;

  // Petits mots propres à chaque thème (le reste du texte est commun).
  const WORDING = {
    classique: { crowd: "Foule", count: "Curseurs", habits: "Comportements", sound: "Son",
      running: (n) => `${n} curseur${n > 1 ? "s" : ""} actif${n > 1 ? "s" : ""}`, stopped: "Rangés" },
    zine: { crowd: "La foule", count: "Curseurs", habits: "Habitudes", sound: "Le son",
      running: (n) => `Tirage n°02 · ${n} en balade`, stopped: "Tirage n°02 · rangés" },
    galets: { crowd: "La foule", count: "Curseurs", habits: "Habitudes", sound: "Le son",
      running: (n) => `${n} curseur${n > 1 ? "s" : ""} en promenade`, stopped: "Tout le monde dort" },
    carnet: { crowd: "Population", count: "Spécimens", habits: "Mœurs observées", sound: "Chants",
      ghostTyping: "Écrivent dans les champs", showNames: "Portent leur prénom", hideFullscreen: "Se cachent en plein écran",
      running: (n) => `Relevé du jour · ${n} spécimen${n > 1 ? "s" : ""}`, stopped: "Relevé du jour · aucun spécimen" }
  };
  const DEFAULT_WORDS = {
    theme: "Thème", pace: "Allure", paceHint: "calme → vive", curiosity: "Curiosité",
    curiosityHint: "rêveurs → fouineurs", ghostTyping: "Écrire dans les champs",
    showNames: "Afficher les prénoms", hideFullscreen: "Se cacher en plein écran",
    shortcut: "lance ou range les curseurs"
  };

  let settings = null;
  let tabId = null;
  let state = { state: "stopped", count: 0 };

  // ---------- Onglet actif ----------

  async function getTabId() {
    if (!inExtension) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? tab.id : null;
  }

  /** Hors extension (page de démo), le menu pilote la page qui l'affiche. */
  function hostBalade() {
    try {
      return window.parent !== window ? window.parent.Balade : null;
    } catch (err) {
      return null;
    }
  }

  async function refreshStatus() {
    if (inExtension) {
      state = tabId == null ? { state: "unavailable", count: 0 } : await self.BaladeInject.status(tabId);
    } else {
      const hb = hostBalade();
      const e = hb && hb.engine;
      const on = !!(e && e.running && !e.stopping);
      state = hb ? { state: on ? "running" : "stopped", count: on ? e.cursors.filter((c) => !c.leaving).length : 0 }
                 : { state: "unavailable", count: 0 };
    }
    renderStatus();
  }

  async function toggle() {
    $("toggle").disabled = true;
    try {
      if (inExtension) await self.BaladeInject.toggle(tabId);
      else if (hostBalade()) await hostBalade().toggle();
    } catch (err) {
      state = { state: "unavailable", count: 0 };
    }
    setTimeout(refreshStatus, 150);
  }

  // ---------- Affichage ----------

  function words() {
    return { ...DEFAULT_WORDS, ...WORDING[settings.theme] };
  }

  function renderStatus() {
    const w = words();
    const btn = $("toggle");
    if (state.state === "unavailable") {
      $("status").textContent = "Indisponible sur cette page";
      btn.textContent = "Lancer";
      btn.disabled = true;
      return;
    }
    btn.disabled = false;
    const on = state.state === "running";
    btn.textContent = on ? "Ranger" : "Lancer";
    $("status").textContent = on ? w.running(Math.max(state.count, 1)) : w.stopped;
  }

  function iconSvg(themeId, size) {
    const t = Themes[themeId];
    const color = t.palette[themeId === "classique" ? 3 : 0];
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${t.svg("arrow", color)}</svg>`;
  }

  function renderThemes() {
    const box = $("themes");
    box.innerHTML = "";
    for (const id of Settings.THEMES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(settings.theme === id));
      b.innerHTML = `${iconSvg(id, 18)}<span>${Themes[id].label}</span>`;
      b.addEventListener("click", () => update({ theme: id }));
      box.appendChild(b);
    }
  }

  function render() {
    document.body.dataset.theme = settings.theme;
    $("logo").innerHTML = iconSvg(settings.theme, 28);
    renderThemes();

    for (const id of ["count", "pace", "curiosity", "volume"]) $(id).value = settings[id];
    $("count-out").textContent = settings.count;
    $("volume-out").textContent = settings.volume === 0 ? "muet" : `${settings.volume} %`;
    for (const id of ["ghostTyping", "showNames", "hideFullscreen"]) $(id).checked = settings[id];

    const w = words();
    document.querySelectorAll("[data-label]").forEach((el) => {
      const v = w[el.dataset.label];
      if (typeof v === "string") el.textContent = v;
    });
    renderStatus();
  }

  async function update(patch) {
    settings = await Settings.save(patch);
    render();
  }

  // ---------- Raccourci ----------

  async function renderShortcut() {
    if (!inExtension || !chrome.commands) return;
    const cmds = await chrome.commands.getAll();
    const cmd = cmds.find((c) => c.name === "toggle-balade");
    const keys = $("keys");
    if (cmd && cmd.shortcut) {
      keys.innerHTML = cmd.shortcut
        .split("+")
        .map((k) => `<kbd>${k.replace(/[<>&]/g, "")}</kbd>`)
        .join("+");
    } else {
      keys.textContent = "Aucun raccourci";
    }
  }

  // ---------- Branchements ----------

  function bind() {
    $("toggle").addEventListener("click", toggle);
    for (const id of ["count", "pace", "curiosity", "volume"]) {
      // Pendant le glissement : affichage immédiat ; au relâchement : enregistrement.
      $(id).addEventListener("input", (e) => {
        if (id === "count") $("count-out").textContent = e.target.value;
        if (id === "volume") $("volume-out").textContent = +e.target.value === 0 ? "muet" : `${e.target.value} %`;
      });
      $(id).addEventListener("change", (e) => update({ [id]: +e.target.value }));
    }
    for (const id of ["ghostTyping", "showNames", "hideFullscreen"]) {
      $(id).addEventListener("change", (e) => update({ [id]: e.target.checked }));
    }
    $("shortcuts").addEventListener("click", () => {
      if (inExtension) chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    });
    if (!inExtension) $("shortcuts").hidden = true;
  }

  (async () => {
    settings = await Settings.load();
    bind();
    render();
    tabId = await getTabId();
    await refreshStatus();
    renderShortcut();
    // Le nombre de curseurs varie pendant que le menu est ouvert.
    setInterval(refreshStatus, 1500);
  })();
})();
