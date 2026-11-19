// Le menu : lit et enregistre les réglages (appliqués en direct sur la page),
// lance ou range la balade dans l'onglet actif, et prend l'apparence du thème choisi.
(() => {
  const { Settings, Themes, makePerso, I18n } = window.Balade;
  const $ = (id) => document.getElementById(id);

  const inExtension = typeof chrome !== "undefined" && chrome.tabs && chrome.scripting;

  // Textes : chaque thème peut avoir ses propres mots (clé « <thème>_label_… » dans
  // _locales), sinon le texte commun (« label_… »).
  const word = (key) => I18n.first([`${skin()}_label_${key}`, `label_${key}`]);
  const themeWord = (key, ...args) => I18n.first([`${skin()}_${key}`, key], ...args);
  const themePlural = (key, n) => {
    const form = new Intl.PluralRules(I18n.lang).select(n) === "one" ? "one" : "other";
    return themeWord(`${key}_${form}`, n);
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
      state = hb ? {
        state: on ? "running" : "stopped",
        count: on ? e.cursors.filter((c) => !c.leaving).length : 0,
        host,
        game: on && e.game ? { caught: e.game.caught, total: e.game.total } : null,
        focus: on && e.focus ? { phase: e.focus.phase, left: Math.max(0, Math.round((e.focus.until - Date.now()) / 1000)) } : null
      }
                 : { state: "unavailable", count: 0, host: "" };
    }
    if (state.state !== "unavailable" && state.host && Settings.isExcluded(settings, state.host) && state.state !== "running") {
      state.state = "excluded";
    }
    renderStatus();
    renderSite();
    renderExtras();
  }

  // ---------- Jeux et outils ----------

  /** Appelle une fonction de Balade dans la page (extension) ou dans la page hôte (démo). */
  async function callPage(name, args = []) {
    if (inExtension) return self.BaladeInject.call(tabId, name, args);
    const hb = hostBalade();
    return hb ? hb[name](...args) : null;
  }

  async function recState() {
    if (!inExtension || !chrome.storage.session) return null;
    return (await chrome.storage.session.get("balade.rec"))["balade.rec"] || null;
  }

  async function renderExtras() {
    const ok = state.state === "running" || state.state === "stopped";
    const game = state.game;
    const focus = state.focus;
    const g = $("gameBtn");
    g.disabled = !ok;
    g.setAttribute("aria-pressed", String(!!game));
    g.textContent = game ? I18n.t("game_stop", game.caught, game.total) : I18n.t("game_start");
    const f = $("focusBtn");
    f.disabled = !ok;
    f.setAttribute("aria-pressed", String(!!focus));
    const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    f.textContent = focus
      ? I18n.t(focus.phase === "focus" ? "focus_stop" : "break_stop", mmss(focus.left))
      : I18n.t("focus_start");
    const r = $("recBtn");
    const rec = await recState();
    r.hidden = !inExtension || !chrome.tabCapture;
    r.disabled = !rec && state.state === "unavailable";
    r.setAttribute("aria-pressed", String(!!rec));
    r.textContent = rec ? I18n.t("rec_stop", mmss(Math.round((Date.now() - rec.startedAt) / 1000))) : I18n.t("rec_start");
  }

  function bindExtras() {
    $("gameBtn").addEventListener("click", async () => {
      const wasPlaying = !!state.game;
      await callPage(wasPlaying ? "stopGame" : "startGame");
      setTimeout(refreshStatus, 200);
      if (inExtension && !wasPlaying) window.close(); // place au jeu
    });
    $("focusBtn").addEventListener("click", async () => {
      await callPage(state.focus ? "stopFocus" : "startFocus", [25]);
      setTimeout(refreshStatus, 200);
    });
    $("recBtn").addEventListener("click", async () => {
      if (await recState()) {
        chrome.runtime.sendMessage({ type: "rec-stop" });
        setTimeout(renderExtras, 300);
        return;
      }
      // L'identifiant du flux doit être demandé pendant le clic, depuis le menu.
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        if (chrome.runtime.lastError || !streamId) {
          $("status").textContent = I18n.t("rec_failed");
          return;
        }
        chrome.runtime.sendMessage({ type: "rec-start", streamId, tabId, host: state.host }, () => setTimeout(renderExtras, 300));
      });
    });
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

  /** Habillage effectif : celui du thème, ou celui de départ du thème perso. */
  function skin() {
    return settings.theme === "perso" && settings.custom ? settings.custom.base : settings.theme;
  }

  function themeObj(id) {
    return id === "perso" ? makePerso(settings.custom) : Themes[id];
  }

  function renderStatus() {
    const btn = $("toggle");
    if (state.state === "excluded") {
      $("status").textContent = I18n.t("status_excluded");
      btn.textContent = I18n.t("btn_start");
      btn.disabled = true;
      return;
    }
    if (state.state === "unavailable") {
      $("status").textContent = I18n.t("status_unavailable");
      btn.textContent = I18n.t("btn_start");
      btn.disabled = true;
      return;
    }
    btn.disabled = false;
    const on = state.state === "running";
    btn.textContent = I18n.t(on ? "btn_put_away" : "btn_start");
    $("status").textContent = on ? themePlural("status_running", Math.max(state.count, 1)) : themeWord("status_stopped");
  }

  function iconSvg(themeId, size) {
    const t = themeObj(themeId);
    const color = t.palette[themeId === "classique" ? 3 : 0];
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${t.svg("arrow", color)}</svg>`;
  }

  function renderThemes() {
    const box = $("themes");
    box.innerHTML = "";
    const ids = settings.custom && settings.custom.enabled ? [...Settings.THEMES, "perso"] : Settings.THEMES;
    box.style.gridTemplateColumns = `repeat(${ids.length}, minmax(0, 1fr))`;
    for (const id of ids) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(settings.theme === id));
      b.innerHTML = `${iconSvg(id, 18)}<span>${themeObj(id).label}</span>`;
      b.addEventListener("click", () => update({ theme: id }));
      box.appendChild(b);
    }
  }

  function render() {
    document.body.dataset.theme = skin();
    $("logo").innerHTML = iconSvg(settings.theme, 28);
    renderThemes();

    for (const id of ["count", "pace", "curiosity", "volume"]) $(id).value = settings[id];
    $("count-out").textContent = settings.count;
    $("volume-out").textContent = volumeText(settings.volume);
    for (const id of TOGGLES) $(id).checked = settings[id];
    document.querySelector(".swarm-hint").hidden = !settings.reactive;

    document.querySelectorAll("[data-label]").forEach((el) => {
      el.textContent = word(el.dataset.label);
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
    $("sitesSummary").textContent = I18n.t("sites_summary", ex.length, au.length);
    const list = $("sitesList");
    list.innerHTML = "";
    const add = (h2, kind) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = I18n.t(kind === "ex" ? "site_excluded_item" : "site_auto_item", h2);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "remove";
      rm.textContent = "×";
      rm.setAttribute("aria-label", I18n.t("site_remove", h2));
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
    $("learnedText").textContent = I18n.plural("learned", n);
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
      keys.textContent = I18n.t("shortcut_none");
    }
  }

  // ---------- Branchements ----------

  function bind() {
    $("toggle").addEventListener("click", toggle);
    bindSite();
    bindExtras();
    for (const id of ["count", "pace", "curiosity", "volume"]) {
      // Pendant le glissement : affichage immédiat ; au relâchement : enregistrement.
      $(id).addEventListener("input", (e) => {
        if (id === "count") $("count-out").textContent = e.target.value;
        if (id === "volume") $("volume-out").textContent = volumeText(+e.target.value);
      });
      $(id).addEventListener("change", (e) => update({ [id]: +e.target.value }));
    }
    for (const id of TOGGLES) {
      $(id).addEventListener("change", (e) => update({ [id]: e.target.checked }));
    }
    $("customize").addEventListener("click", () => {
      if (inExtension && chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
      else window.open("../options/options.html", "_blank");
    });
    $("shortcuts").addEventListener("click", () => {
      if (inExtension) chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    });
    if (!inExtension) $("shortcuts").hidden = true;
  }

  const volumeText = (v) => (v === 0 ? I18n.t("volume_muted") : I18n.t("volume_value", v));

  (async () => {
    I18n.apply();
    settings = await Settings.load();
    bind();
    render();
    tabId = await getTabId();
    await refreshStatus();
    renderShortcut();
    // Le nombre de curseurs varie pendant que le menu est ouvert.
    setInterval(refreshStatus, 1000);
  })();
})();
