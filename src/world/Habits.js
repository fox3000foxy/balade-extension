// Habit learning, site by site: which elements you click and in what order.
// It is a first-order Markov chain over elements: transitions "after A you clicked B"
// are counted, then P(B | A) = n(A->B) / n(A->*) is estimated.
//
// Privacy: everything stays on this computer (chrome.storage.local, never synced,
// never sent). Only the identity of clicked elements is stored (tag, label, link path),
// never what you type in fields.
(() => {
  const B = window.Balade;
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const MAX_KEYS = 300;
  const LINK_WINDOW = 90; // beyond this (s), two clicks are no longer considered sequential

  const CLICKABLE = "a[href],button,input,select,textarea,[role=button],summary,label";

  /** Stable identity of a clickable element: tag, readable id, label, link path. */
  function keyOf(target) {
    const el = target && target.closest ? target.closest(CLICKABLE) : null;
    if (!el) return null;
    const tag = el.localName;
    const id = el.id && !/\d{4,}|[a-f0-9]{8,}/i.test(el.id) ? el.id : "";
    // Associated <label for="id"> text (Zendesk-style forms use external labels).
    let labelText = "";
    try {
      if (el.id) {
        const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lab) labelText = lab.innerText || "";
      }
      if (!labelText && el.localName === "input") {
        const wrap = el.closest("label");
        if (wrap) labelText = wrap.innerText || "";
      }
    } catch (_) {}
    let text =
      el.getAttribute("aria-label") ||
      labelText ||
      (["a", "button", "summary", "label"].includes(tag) ? el.innerText : "") ||
      el.getAttribute("placeholder") ||
      el.getAttribute("name") ||
      el.getAttribute("type") ||
      "";
    text = text.replace(/\s+/g, " ").trim().slice(0, 40);
    let path = "";
    if (tag === "a") {
      try {
        path = new URL(el.href, location.href).pathname.slice(0, 60);
      } catch (err) { /* lien invalide */ }
    }
    if (!id && !text && !path) return null;
    return [tag, id, text, path].join("|");
  }

  class Habits {
    constructor(host) {
      this.host = String(host || "").toLowerCase();
      this.storageKey = `balade.habits.${this.host}`;
      this.data = { v: 1, n: {}, t: {} };
      this.last = null; // { key, time }
      this.enabled = true;
      this._saveTimer = 0;
      this._unsub = null;
      this._sessionSeen = new Set(); // element keys visited this session
    }

    static keyOf(el) {
      return keyOf(el);
    }

    async load() {
      this.dispose(); // avoid stacking watchers on repeated loads
      try {
        if (hasChrome) {
          const got = await chrome.storage.local.get(this.storageKey);
          if (got[this.storageKey]) this.data = got[this.storageKey];
        } else {
          const raw = localStorage.getItem(this.storageKey);
          if (raw) this.data = JSON.parse(raw);
        }
      } catch (err) { /* données illisibles : on repart de zéro */ }
      this._watch();
    }

    /** If the menu clears this site ("Forget"), also clear in memory. */
    _watch() {
      if (hasChrome) {
        const fn = (changes, area) => {
          if (area === "local" && changes[this.storageKey] && !changes[this.storageKey].newValue) this.reset();
        };
        chrome.storage.onChanged.addListener(fn);
        this._unsub = () => chrome.storage.onChanged.removeListener(fn);
      } else if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("balade.habits");
        ch.onmessage = (e) => {
          if (e.data === `forget:${this.host}`) this.reset();
        };
        this._unsub = () => ch.close();
      }
    }

    dispose() {
      if (this._unsub) this._unsub();
      this._unsub = null;
      clearTimeout(this._saveTimer);
    }

      reset() {
      this.data = { v: 1, n: {}, t: {} };
      this.last = null;
      this._sessionSeen = new Set();
    }

    /** Records a click; returns the element key (or null). */
    record(target, now) {
      const key = keyOf(target);
      if (!key) return null;
      if (!this.enabled) {
        this.last = { key, time: now };
        return key;
      }
      const d = this.data;
      d.n[key] = (d.n[key] || 0) + 1;
      if (this.last && this.last.key !== key && now - this.last.time < LINK_WINDOW) {
        const row = (d.t[this.last.key] = d.t[this.last.key] || {});
        row[key] = (row[key] || 0) + 1;
      }
      this.last = { key, time: now };
      this._prune();
      this._scheduleSave();
      return key;
    }

    /** True when the site has almost no click history (first visits). */
    isNew(maxClicks = 5) {
      const all = Object.values(this.data.n).reduce((a, b) => a + b, 0);
      return all < maxClicks;
    }

    // ---------- R&D axis 2: simulated cognition ----------

    /** Records a cursor visit (not a user click): feeds satiety and novelty. */
    visit(key, now) {
      if (!key) return;
      const v = this.data.v || (this.data.v = {});
      const e = v[key] || (v[key] = { n: 0, at: 0 });
      e.n++;
      e.at = now;
    }

    /**
     * Satiety 0..1 for an element: 0 fresh, 1 boring. Rises with visit count,
     * decays over ~10 minutes. Cursor visits feed it, not user clicks.
     */
    satiety(key, now) {
      const e = this.data.v && this.data.v[key];
      if (!e) return 0;
      const age = Math.max(0, now - e.at) / 600; // 10 min memory
      const grown = 1 - Math.exp(-e.n / 2); // 1 visit ~0.4, 3 visits ~0.8
      return grown * Math.exp(-age);
    }

    /** Share of page elements never visited this session: drives curiosity. */
    noveltyPressure(totalVisible) {
      if (!totalVisible) return 0;
      return Math.min(1, Math.max(0, 1 - this._sessionSeen.size / totalVisible));
    }

    /** Mark an element seen this session (resets on navigation). */
    markSeen(key) {
      if (key) this._sessionSeen.add(key);
    }

    resetSession() {
      this._sessionSeen = new Set();
    }

    /** Most likely element after `fromKey`: { key, p, total } or null. */
    predictNext(fromKey, minTotal = 3, minP = 0.4) {
      const row = this.data.t[fromKey];
      if (!row) return null;
      let total = 0;
      let best = null;
      for (const [k, c] of Object.entries(row)) {
        total += c;
        if (!best || c > best.c) best = { k, c };
      }
      if (!best || total < minTotal) return null;
      const p = best.c / total;
      return p >= minP ? { key: best.k, p, total } : null;
    }

    /**
     * Prior probability of clicking this element now: P(key | last click)
     * when the last click is recent, otherwise its general frequency (dampened).
     */
    prior(key, now) {
      const d = this.data;
      if (this.last && now - this.last.time < LINK_WINDOW) {
        const row = d.t[this.last.key];
        if (row) {
          const total = Object.values(row).reduce((a, b) => a + b, 0);
          if (total > 0) return (row[key] || 0) / total;
        }
      }
      const all = Object.values(d.n).reduce((a, b) => a + b, 0);
      return all > 0 ? (0.5 * (d.n[key] || 0)) / all : 0;
    }

    /** Keeps at most MAX_KEYS elements (least-clicked are forgotten). */
    _prune() {
      const keys = Object.keys(this.data.n);
      if (keys.length <= MAX_KEYS) return;
      keys.sort((a, b) => this.data.n[a] - this.data.n[b]);
      for (const k of keys.slice(0, keys.length - MAX_KEYS)) {
        delete this.data.n[k];
        delete this.data.t[k];
        for (const row of Object.values(this.data.t)) delete row[k];
      }
    }

    _scheduleSave() {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.save(), 1500);
    }

    async save() {
      this.data.updated = Date.now();
      try {
        if (hasChrome) await chrome.storage.local.set({ [this.storageKey]: this.data });
        else localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      } catch (err) { /* stockage plein ou indisponible */ }
    }

    /** Clears what was learned for a site (called from the menu). */
    static async forget(host) {
      const key = `balade.habits.${String(host || "").toLowerCase()}`;
      if (hasChrome) {
        await chrome.storage.local.remove(key);
      } else {
        try {
          localStorage.removeItem(key);
        } catch (err) { /* nothing */ }
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel("balade.habits");
          ch.postMessage(`forget:${String(host || "").toLowerCase()}`);
          ch.close();
        }
      }
    }

    /** Number of clicks learned for a site (to display in the menu). */
    static async count(host) {
      const key = `balade.habits.${String(host || "").toLowerCase()}`;
      try {
        let data = null;
        if (hasChrome) data = (await chrome.storage.local.get(key))[key];
        else data = JSON.parse(localStorage.getItem(key) || "null");
        return data ? Object.values(data.n || {}).reduce((a, b) => a + b, 0) : 0;
      } catch (err) {
        return 0;
      }
    }
  }

  B.Habits = Habits;
})();
