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
      social: "Bavardent entre eux", reactive: "Réagissent à vos gestes", swarmHint: "rassembler les spécimens",
      adaptDark: "S'adaptent à la nuit", site: "Terrain", siteExclude: "Zone protégée", siteAuto: "Lâcher dès l'arrivée",
      anticipate: "Devinent vos gestes", learn: "Retiennent vos habitudes",
      running: (n) => `Relevé du jour · ${n} spécimen${n > 1 ? "s" : ""}`, stopped: "Relevé du jour · aucun spécimen" }
  };
  const DEFAULT_WORDS = {
    theme: "Thème", pace: "Allure", paceHint: "calme → vive", curiosity: "Curiosité",
    curiosityHint: "rêveurs → fouineurs", ghostTyping: "Écrire dans les champs",
    showNames: "Afficher les prénoms", hideFullscreen: "Se cacher en plein écran",
    social: "Bavarder entre eux", reactive: "Réagir à ce que je fais", swarmHint: "appeler l'essaim autour du pointeur",
    adaptDark: "Adapter aux pages sombres", site: "Ce site", siteExclude: "Ne jamais lancer ici",
    siteAuto: "Lancer automatiquement ici",
    anticipate: "Deviner mes gestes", learn: "Apprendre mes habitudes",
    shortcut: "lance ou range les curseurs"
  };

  const TOGGLES = ["ghostTyping", "showNames", "social", "reactive", "anticipate", "learn", "adaptDark", "hideFullscreen"];

  let settings = null;
  let tabId = null;
  let state = { state: "stopped", count: 0, host: "" };

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
      let host = "";
      try {
        host = window.parent.location.hostname;
      } catch (err) { /* autre origine */ }
      state = hb ? { state: on ? "running" : "stopped", count: on ? e.cursors.filter((c) => !c.leaving).length : 0, host }
                 : { state: "unavailable", count: 0, host: "" };
    }
    if (state.state !== "unavailable" && state.host && Settings.isExcluded(settings, state.host) && state.state !== "running") {
      state.state = "excluded";
    }
    renderStatus();
    renderSite();
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
    if (state.state === "excluded") {
      $("status").textContent = "Exclu sur ce site";
      btn.textContent = "Lancer";
      btn.disabled = true;
      return;
    }
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
    for (const id of TOGGLES) $(id).checked = settings[id];
    document.querySelector(".swarm-hint").hidden = !settings.reactive;

    const w = words();
    document.querySelectorAll("[data-label]").forEach((el) => {
      const v = w[el.dataset.label];
      if (typeof v === "string") el.textContent = v;
    });
    renderStatus();
    renderSite();
  }

  // ---------- Ce site ----------

  const host = () => (state.host || "").toLowerCase();
  const without = (list, h) => list.filter((x) => x !== h);

  function renderSite() {
    const h = host();
    const box = $("site");
    box.hidden = !h || state.state === "unavailable";
    if (box.hidden) return;
    $("host").textContent = h;
    $("siteExclude").checked = settings.excludedSites.includes(h);
    $("siteAuto").checked = settings.autoSites.includes(h);
    $("siteAuto").disabled = settings.excludedSites.includes(h);

    const ex = settings.excludedSites;
    const au = settings.autoSites;
    $("sites").hidden = ex.length + au.length === 0;
    $("sitesSummary").textContent = `Sites exclus : ${ex.length} · automatiques : ${au.length}`;
    const list = $("sitesList");
    list.innerHTML = "";
    const add = (h2, kind) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${kind === "ex" ? "Exclu" : "Auto"} · ${h2}`;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "remove";
      rm.textContent = "×";
      rm.setAttribute("aria-label", `Retirer ${h2}`);
      rm.addEventListener("click", () =>
        update(kind === "ex" ? { excludedSites: without(settings.excludedSites, h2) } : { autoSites: without(settings.autoSites, h2) })
      );
      li.append(label, rm);
      list.appendChild(li);
    };
    ex.forEach((h2) => add(h2, "ex"));
    au.forEach((h2) => add(h2, "au"));
    renderLearned(h);
  }

  /** Ce que Balade a appris sur ce site (nombre de clics retenus), avec « Oublier ». */
  async function renderLearned(h) {
    const n = await window.Balade.Habits.count(h);
    $("learned").hidden = n === 0;
    $("learnedText").textContent = `${n} clic${n > 1 ? "s" : ""} appris ici, gardés sur cet ordinateur.`;
  }

  function bindSite() {
    $("forget").addEventListener("click", async () => {
      await window.Balade.Habits.forget(host());
      renderLearned(host());
    });
    $("siteExclude").addEventListener("change", async (e) => {
      const h = host();
      if (!h) return;
      const ex = e.target.checked ? [...settings.excludedSites, h] : without(settings.excludedSites, h);
      await update({ excludedSites: ex, autoSites: without(settings.autoSites, h) });
      setTimeout(refreshStatus, 400); // la page range ses curseurs d'elle-même
    });
    $("siteAuto").addEventListener("change", (e) => {
      const h = host();
      if (!h) return;
      if (!e.target.checked) {
        update({ autoSites: without(settings.autoSites, h) });
        return;
      }
      // Le lancement automatique demande l'accès au site : Chrome affiche une confirmation.
      // La demande doit partir tout de suite, pendant le clic.
      const ask = inExtension && chrome.permissions
        ? chrome.permissions.request({ origins: [`*://${h}/*`] })
        : Promise.resolve(true);
      ask.then((granted) => {
        if (granted) update({ autoSites: [...settings.autoSites, h] });
        else e.target.checked = false;
      });
    });
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
    bindSite();
    for (const id of ["count", "pace", "curiosity", "volume"]) {
      // Pendant le glissement : affichage immédiat ; au relâchement : enregistrement.
      $(id).addEventListener("input", (e) => {
        if (id === "count") $("count-out").textContent = e.target.value;
        if (id === "volume") $("volume-out").textContent = +e.target.value === 0 ? "muet" : `${e.target.value} %`;
      });
      $(id).addEventListener("change", (e) => update({ [id]: +e.target.value }));
    }
    for (const id of TOGGLES) {
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
