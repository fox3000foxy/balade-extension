// La scène : dimensions de l'écran, repérage des éléments intéressants de la page,
// et détection du plein écran.
// Toutes les coordonnées sont celles de l'écran (viewport) : l'overlay est en position fixe.
(() => {
  const { M } = window.Balade;

  // Éléments qu'un humain regarderait ou viserait.
  const INTERESTING = [
    "a[href]", "button", "input", "select", "textarea", "[role=button]",
    "[contenteditable=true]", "h1", "h2", "h3", "img", "video", "label"
  ].join(",");

  // Champs où l'on tape du texte (pas les mots de passe, par discrétion).
  const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel", "number"]);

  class Stage {
    constructor(config, hostTag) {
      this.interest = config.wander.interest;
      this.hostTag = hostTag; // pour ignorer notre propre overlay
      this._cache = [];
      this._cacheAt = -Infinity;
    }

    get width() {
      return window.innerWidth;
    }

    get height() {
      return window.innerHeight;
    }

    /** Point au hasard dans la zone centrale de l'écran. */
    randomPoint(marginX, marginY) {
      return {
        x: M.rand(this.width * marginX, this.width * (1 - marginX)),
        y: M.rand(this.height * marginY, this.height * (1 - marginY))
      };
    }

    /** Point au hasard à moins de `radius` px de `from`, gardé dans la zone utile. */
    nearbyPoint(from, radius, marginX, marginY) {
      const a = M.rand(0, Math.PI * 2);
      const d = M.rand(radius * 0.3, radius);
      return {
        x: M.clamp(from.x + Math.cos(a) * d, this.width * marginX, this.width * (1 - marginX)),
        y: M.clamp(from.y + Math.sin(a) * d, this.height * marginY, this.height * (1 - marginY))
      };
    }

    /** Point hors écran, à gauche ou à droite, pour entrer ou sortir. */
    offscreenPoint(side, y) {
      return { x: side < 0 ? -40 : this.width + 40, y };
    }

    /** Garde un point à au moins `pad` px des bords. */
    clampToScreen(p, pad = 12) {
      return {
        x: M.clamp(p.x, pad, this.width - pad),
        y: M.clamp(p.y, pad, this.height - pad)
      };
    }

    // ---------- Éléments de la page ----------

    /** Le champ accepte-t-il du texte tapé ? */
    isTextField(el) {
      if (el.isContentEditable) return true;
      if (el.localName === "textarea") return !el.disabled && !el.readOnly;
      if (el.localName === "input") {
        const type = (el.getAttribute("type") || "").toLowerCase();
        return TEXT_INPUT_TYPES.has(type) && !el.disabled && !el.readOnly;
      }
      return false;
    }

    /** Catégorie d'un élément, pour son attrait. */
    kindOf(el) {
      const tag = el.localName;
      if (tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable) return "field";
      if (tag === "button" || el.getAttribute("role") === "button") return "button";
      if (tag === "a") return "link";
      if (tag === "h1" || tag === "h2" || tag === "h3") return "heading";
      if (tag === "img" || tag === "video") return "media";
      return "other";
    }

    /** Éléments visibles à l'écran (liste mise en cache 1 s, pour rester léger). */
    visibleElements(now) {
      if (now - this._cacheAt < 1) return this._cache;
      this._cacheAt = now;

      const out = [];
      const all = document.querySelectorAll(INTERESTING);
      const W = this.width;
      const H = this.height;
      for (let i = 0; i < all.length && out.length < 300; i++) {
        const el = all[i];
        if (el.closest(this.hostTag)) continue;
        if (el.localName === "input" && el.type === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 12 || r.height < 10) continue;
        if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
        out.push(el);
      }
      this._cache = out;
      return out;
    }

    /**
     * Rectangle d'un élément dans la vue d'un curseur (et non sur l'écran de l'utilisateur) :
     * le curseur peut avoir un temps de retard sur votre défilement.
     */
    rectInView(el, cursor) {
      const r = el.getBoundingClientRect();
      const dx = window.scrollX - cursor.viewX;
      const dy = window.scrollY - cursor.viewY;
      return { left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy, width: r.width, height: r.height };
    }

    /**
     * Tire un élément visible, au hasard mais pas uniformément :
     * poids = attrait de sa catégorie / (1 + distance / 400).
     * Les champs de saisie et les éléments proches sont nettement favorisés.
     * @param {Balade.Cursor} cursor
     * @param {number} now
     * @param {Element} [exclude] élément à ignorer (le dernier visité)
     * @param {Set<Element>} [busy] éléments déjà regardés par d'autres curseurs
     */
    pickElement(cursor, now, exclude, busy) {
      const list = this.visibleElements(now);
      if (list.length === 0) return null;
      let total = 0;
      const weights = list.map((el) => {
        if (el === exclude || !this.isInView(el, cursor)) return 0;
        const r = this.rectInView(el, cursor);
        const d = Math.hypot(r.left + r.width / 2 - cursor.x, r.top + r.height / 2 - cursor.y);
        let w = (this.interest[this.kindOf(el)] || 1) / (1 + d / 400);
        // Déjà regardé par un autre curseur : beaucoup moins tentant (évite les attroupements).
        if (busy && busy.has(el)) w *= 0.1;
        total += w;
        return w;
      });
      if (total <= 0) return null;
      let r = Math.random() * total;
      for (let i = 0; i < list.length; i++) {
        r -= weights[i];
        if (r <= 0 && weights[i] > 0) return list[i];
      }
      return null;
    }

    /**
     * Où un humain viserait sur cet élément : près du début si l'élément est grand,
     * jamais au centre exact. Le décalage est tiré une fois pour toutes ; le point est
     * recalculé à chaque appel, dans la vue du curseur (il suit le défilement).
     */
    aimOn(el, cursor) {
      const fx = M.rand(40, 60);
      const fy = M.rand(14, 22);
      const jx = M.rand(-5, 5);
      const jy = M.rand(-3, 3);
      return () => {
        const r = this.rectInView(el, cursor);
        return {
          x: M.clamp(r.left + Math.min(r.width * 0.5, fx) + jx, r.left + 2, r.right - 2),
          y: M.clamp(r.top + Math.min(r.height * 0.5, fy) + jy, r.top + 2, r.bottom - 2)
        };
      };
    }

    /** L'élément est-il visible dans la vue du curseur ? */
    isInView(el, cursor) {
      if (!el.isConnected) return false;
      const r = this.rectInView(el, cursor);
      return r.bottom > 0 && r.top < this.height && r.right > 0 && r.left < this.width;
    }

    /** La pointe du curseur est-elle au-dessus de l'élément ? */
    contains(el, cursor) {
      const r = this.rectInView(el, cursor);
      return cursor.x >= r.left && cursor.x <= r.right && cursor.y >= r.top && cursor.y <= r.bottom;
    }

    /** Pointeur adapté à l'élément survolé, comme le ferait le navigateur. */
    shapeFor(el) {
      if (this.isTextField(el)) return "ibeam";
      const kind = this.kindOf(el);
      if (kind === "link" || kind === "button") return "hand";
      if (kind === "media") return "crosshair";
      if (el.localName === "select") return "hand";
      return "arrow";
    }

    // ---------- Fond de page ----------

    /**
     * Luminance relative (0 noir → 1 blanc) du fond visible à ce point de l'écran :
     * on remonte depuis l'élément sous le point jusqu'au premier fond opaque.
     * Renvoie null si le fond est une image ou un dégradé (on ne sait pas trancher).
     */
    luminanceAt(x, y) {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
      let el = document.elementFromPoint(x, y);
      while (el && el.nodeType === 1) {
        if (el.localName === this.hostTag) return null;
        const cs = getComputedStyle(el);
        if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
        const lum = Stage.luminance(cs.backgroundColor);
        if (lum != null) return lum;
        el = el.parentElement;
      }
      // Rien d'opaque : fond du canevas, blanc par défaut, noir si la page se déclare sombre.
      const scheme = getComputedStyle(document.documentElement).colorScheme || "";
      return /^dark/.test(scheme) ? 0.05 : 1;
    }

    /** Luminance relative WCAG d'une couleur CSS rgb()/rgba() ; null si transparente ou illisible. */
    static luminance(color) {
      const m = /rgba?\(([^)]+)\)/.exec(color || "");
      if (!m) return null;
      const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      if (parts.length < 3) return null;
      const alpha = parts.length > 3 ? parts[3] : 1;
      if (alpha < 0.5) return null;
      const lin = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * lin(parts[0]) + 0.7152 * lin(parts[1]) + 0.0722 * lin(parts[2]);
    }

    // ---------- Plein écran ----------

    /**
     * Vrai si une vidéo ou un élément est en plein écran (API Fullscreen),
     * ou si la fenêtre de Chrome elle-même est en plein écran (F11, ⌃⌘F).
     * Le plein écran du navigateur n'a pas d'API dédiée : on le déduit du
     * media query display-mode, ou d'une fenêtre qui occupe exactement l'écran.
     */
    isFullscreen() {
      if (document.fullscreenElement) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return true;
      const s = window.screen;
      return (
        Math.abs(window.outerWidth - s.width) <= 1 &&
        Math.abs(window.outerHeight - s.height) <= 1 &&
        Math.abs(window.innerHeight - s.height) <= 1
      );
    }
  }

  window.Balade.Stage = Stage;
})();
