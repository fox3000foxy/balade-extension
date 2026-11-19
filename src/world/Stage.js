// The stage: screen dimensions, finding interesting page elements,
// and full-screen detection.
// All coordinates are viewport coordinates: the overlay is position:fixed.
(() => {
  const { M } = window.Balade;

  // Elements a human would look at or aim for.
  const INTERESTING = [
    "a[href]", "button", "input", "select", "textarea", "[role=button]",
    "[contenteditable=true]", "h1", "h2", "h3", "img", "video", "label"
  ].join(",");

  // Fields where text is typed (not passwords, for privacy).
  const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel", "number"]);

  // Name/id/placeholder hints that mark a search or filter field.
  const HINT_RE = /search|filter|query|find|cherch|filtr/;

  class Stage {
    constructor(config, hostTag) {
      this.interest = config.wander.interest;
      this.hostTag = hostTag; // to ignore our own overlay
      this._cache = [];
      this._cacheAt = -Infinity;
    }

    get width() {
      return window.innerWidth;
    }

    get height() {
      return window.innerHeight;
    }

    /** Random point in the central area of the screen. */
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

    /** Off-screen point, left or right, for entering or leaving. */
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

    // ---------- Page elements ----------

    /** Does this field accept typed text? */
    isTextField(el) {
      if (el.isContentEditable) return true;
      if (el.localName === "textarea") return !el.disabled && !el.readOnly;
      if (el.localName === "input") {
        const type = (el.getAttribute("type") || "").toLowerCase();
        return TEXT_INPUT_TYPES.has(type) && !el.disabled && !el.readOnly;
      }
      return false;
    }

    /** True if el is a checkbox or radio button (candidate for ghost toggle). */
    isToggle(el) {
      if (el.localName !== "input") return false;
      const type = (el.getAttribute("type") || "").toLowerCase();
      return type === "checkbox" || type === "radio";
    }

    /**
     * True if el is safe for ghost typing:
     * - empty value / content
     * - not a search, combobox or autocomplete widget
     * - not currently focused by the real user
     */
    isGhostSafe(el) {
      // Must not be in use
      if (document.activeElement === el) return false;
      // Must be empty
      const empty = el.isContentEditable ? !el.textContent.trim() : !el.value;
      if (!empty) return false;
      // Reject search / combobox / autocomplete roles and types
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (role === "combobox" || role === "searchbox" || role === "listbox") return false;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "search") return false;
      if (el.getAttribute("aria-autocomplete")) return false;
      if (el.getAttribute("aria-haspopup")) return false;
      // Reject by name/id/placeholder heuristics (search bars, filters...)
      const hint = [
        el.getAttribute("name") || "",
        el.getAttribute("id") || "",
        el.getAttribute("placeholder") || "",
        el.getAttribute("aria-label") || ""
      ].join(" ").toLowerCase();
      if (HINT_RE.test(hint)) return false;
      // Reject if the element lives inside a search landmark.
      if (el.closest('[role="search"]')) return false;
      return true;
    }

    /** Category of an element, for its attraction weight. */
    kindOf(el) {
      const tag = el.localName;
      if (tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable) return "field";
      if (tag === "button" || el.getAttribute("role") === "button") return "button";
      if (tag === "a") return "link";
      if (tag === "h1" || tag === "h2" || tag === "h3") return "heading";
      if (tag === "img" || tag === "video") return "media";
      return "other";
    }

    /** Visible elements on screen (cached for 1 s, to stay lightweight). */
    invalidateCache() {
      this._cacheAt = -Infinity;
    }

    /** Rough page kind from element counts (cached per page): article, form, media, app. */
    pageKind() {
      if (this._kind) return this._kind;
      const count = (sel) => document.querySelectorAll(sel).length;
      const ps = count("article p, main p");
      const fields = count("input, select, textarea");
      const media = count("video, audio");
      this._kind = ps >= 3 ? "article" : fields >= 3 ? "form" : media > 0 ? "media" : "app";
      return this._kind;
    }

    visibleElements(now) {
      if (now - this._cacheAt < 1) return this._cache;
      this._cacheAt = now;

      const out = [];
      const all = document.querySelectorAll(INTERESTING);
      const W = this.width;
      const H = this.height;
      this._kind = null; // recomputed lazily by pageKind() on this fresh scan
      for (let i = 0; i < all.length && out.length < 300; i++) {
        const el = all[i];
        // Our overlay lives in a shadow root, so querySelectorAll never returns
        // its children; only skip the host element itself (O(1) tag check, no closest()).
        if (el.localName === this.hostTag) continue;
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
     * Rectangle of an element in a cursor's view (not on the user's screen):
     * the cursor may lag behind your scroll position.
     */
    rectInView(el, cursor) {
      const r = el.getBoundingClientRect();
      const dx = window.scrollX - cursor.viewX;
      const dy = window.scrollY - cursor.viewY;
      return { left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy, width: r.width, height: r.height };
    }

    /**
     * Picks a visible element randomly but not uniformly:
     * weight = category interest / (1 + distance / 400).
     * Input fields and nearby elements are strongly favoured.
     * @param {Balade.Cursor} cursor
     * @param {number} now
     * @param {Element} [exclude] element to skip (the last visited)
     * @param {Set<Element>} [busy] elements already watched by other cursors
     */
    pickElement(cursor, now, exclude, busy, habits) {
      const list = this.visibleElements(now);
      if (list.length === 0) return null;
      let total = 0;
      const weights = list.map((el) => {
        if (el === exclude || !this.isInView(el, cursor)) return 0;
        const r = this.rectInView(el, cursor);
        const d = Math.hypot(r.left + r.width / 2 - cursor.x, r.top + r.height / 2 - cursor.y);
        const kind = this.kindOf(el);
        let w = (this.interest[kind] || 1) / (1 + d / 400);
        // Reading ambiance: headings on articles, fields on forms are extra tempting.
        if (this._kind === "article" && kind === "heading") w *= 2;
        else if (this._kind === "form" && kind === "field") w *= 1.5;
        // Already watched by another cursor: much less tempting (avoids clustering).
        if (busy && busy.has(el)) w *= 0.1;
        // R&D axis 2: satiety (visited gets boring, down to 20%) and novelty
        // (unseen elements get a bonus while much of the page is unexplored).
        if (habits) {
          const key = window.Balade.Habits.keyOf(el);
          if (key) {
            w *= 1 - 0.8 * habits.satiety(key, now);
            if (!habits._sessionSeen.has(key)) w *= 1 + habits.noveltyPressure(list.length);
          }
        }
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
     * Where a human would aim on this element: near the start if large,
     * never the exact center. The offset is drawn once; the point is
     * recomputed each call in the cursor's view (it follows scrolling).
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

    /** Is the element visible in the cursor's view? */
    isInView(el, cursor) {
      if (!el.isConnected) return false;
      const r = this.rectInView(el, cursor);
      return r.bottom > 0 && r.top < this.height && r.right > 0 && r.left < this.width;
    }

    /** Is the cursor tip over the element? */
    contains(el, cursor) {
      const r = this.rectInView(el, cursor);
      return cursor.x >= r.left && cursor.x <= r.right && cursor.y >= r.top && cursor.y <= r.bottom;
    }

    /** Pointer shape matching the hovered element, as the browser would show. */
    shapeFor(el) {
      if (this.isTextField(el)) return "ibeam";
      const kind = this.kindOf(el);
      if (kind === "link" || kind === "button") return "hand";
      if (kind === "media") return "crosshair";
      if (el.localName === "select") return "hand";
      return "arrow";
    }

    // ---------- Page background ----------

    /**
     * Relative luminance (0 black -> 1 white) of the visible background at a screen point:
     * walks up from the element under the point to the first opaque background.
     * Returns null if the background is an image or gradient (can't decide).
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
      // No opaque background: canvas default, white unless the page declares dark.
      const scheme = getComputedStyle(document.documentElement).colorScheme || "";
      return /^dark/.test(scheme) ? 0.05 : 1;
    }

    /** WCAG contrast ratio of an element's text vs its background; null if undecidable. */
    contrastOf(el) {
      if (!el.isConnected) return null;
      const fg = Stage.luminance(getComputedStyle(el).color);
      if (fg == null) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      const bg = this.luminanceAt(r.left + Math.min(r.width / 2, 8), r.top + Math.min(r.height / 2, 8));
      if (bg == null) return null;
      const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
      return (hi + 0.05) / (lo + 0.05);
    }
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

    // ---------- Full screen ----------

    /**
     * True if a video or element is in full screen (Fullscreen API),
     * or if the Chrome window itself is in full screen (F11).
     * Browser full screen has no dedicated API: inferred from the
     * display-mode media query, or a window that fills the screen exactly.
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
