// La scène : dimensions de l'écran et repérage des éléments intéressants de la page.
// Toutes les coordonnées sont celles de l'écran (viewport) : l'overlay est en position fixe.
(() => {
  const { M } = window.Balade;

  // Éléments qu'un humain regarderait ou viserait.
  const INTERESTING = [
    "a[href]", "button", "input", "select", "textarea", "[role=button]",
    "h1", "h2", "h3", "img", "video", "label"
  ].join(",");

  class Stage {
    constructor(hostTag) {
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

    /** Point hors écran, à gauche ou à droite, pour entrer ou sortir. */
    offscreenPoint(side, y) {
      return { x: side < 0 ? -40 : this.width + 40, y };
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
        const r = el.getBoundingClientRect();
        if (r.width < 12 || r.height < 10) continue;
        if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
        out.push(el);
      }
      this._cache = out;
      return out;
    }

    /** Un élément visible au hasard, de préférence proche du point donné. */
    pickElement(near, now) {
      const list = this.visibleElements(now);
      if (list.length === 0) return null;
      // Tire 4 candidats et garde le plus proche : ni toujours le voisin, ni n'importe où.
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < 4; i++) {
        const el = M.pick(list);
        const r = el.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - near.x, r.top + r.height / 2 - near.y);
        if (d < bestD) {
          bestD = d;
          best = el;
        }
      }
      return best;
    }

    /**
     * Où un humain viserait sur cet élément : près du début si l'élément est grand,
     * jamais au centre exact. Le décalage est tiré une fois pour toutes.
     */
    aimOn(el) {
      const fx = M.rand(40, 60);
      const fy = M.rand(14, 22);
      const jx = M.rand(-5, 5);
      const jy = M.rand(-3, 3);
      return () => {
        const r = el.getBoundingClientRect();
        return {
          x: M.clamp(r.left + Math.min(r.width * 0.5, fx) + jx, r.left + 2, r.right - 2),
          y: M.clamp(r.top + Math.min(r.height * 0.5, fy) + jy, r.top + 2, r.bottom - 2)
        };
      };
    }

    isOnScreen(el) {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < this.height && r.right > 0 && r.left < this.width;
    }
  }

  window.Balade.Stage = Stage;
})();
