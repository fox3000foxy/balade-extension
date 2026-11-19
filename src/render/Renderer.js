// Le rendu : un overlay plein écran, isolé du site par un Shadow DOM,
// qui ne capte jamais la souris (pointer-events: none).
(() => {
  const HOST_TAG = "balade-overlay";

  // Flèche dessinée pour ce projet. Point chaud (pointe) en (3, 2).
  const ARROW_PATH = "M3 2 L3 18.5 L7.4 14.3 L10.3 20.9 L13.2 19.7 L10.4 13.2 L16.6 13.2 Z";
  const HOTSPOT = { x: 3, y: 2 };

  const STYLE = `
    :host { all: initial; }
    .layer { position: fixed; inset: 0; pointer-events: none; overflow: hidden;
             opacity: 0; transition: opacity .4s ease; }
    .layer.on { opacity: 1; }
    .cur { position: absolute; left: 0; top: 0; will-change: transform; }
    .cur svg { position: absolute; left: ${-HOTSPOT.x}px; top: ${-HOTSPOT.y}px;
               overflow: visible; transform-origin: ${HOTSPOT.x}px ${HOTSPOT.y}px;
               filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.25)); }
    .tag { position: absolute; left: 13px; top: 17px; padding: 2px 7px;
           border-radius: 9px 9px 9px 3px; color: #fff; white-space: nowrap;
           font: 600 11px/16px system-ui, -apple-system, "Segoe UI", sans-serif;
           box-shadow: 0 1px 3px rgba(0,0,0,.2); }
    .focus { position: absolute; left: 0; top: 0; border: 1.5px solid; border-radius: 5px;
             opacity: 0; transition: opacity .2s ease; box-sizing: border-box; }
    .focus.on { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { .layer { transition: none; } }
  `;

  class Renderer {
    constructor() {
      this.host = null;
      this.layer = null;
      this.views = new Map(); // id du curseur → { root, svg, focus }
    }

    static get hostTag() {
      return HOST_TAG;
    }

    mount() {
      this.host = document.createElement(HOST_TAG);
      this.host.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;";
      const shadow = this.host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = STYLE;
      this.layer = document.createElement("div");
      this.layer.className = "layer";
      shadow.append(style, this.layer);
      document.documentElement.appendChild(this.host);
      // Laisse le navigateur peindre l'état initial avant le fondu d'entrée.
      requestAnimationFrame(() => this.layer && this.layer.classList.add("on"));
    }

    /** Fondu de sortie, puis retrait du DOM. */
    unmount() {
      if (!this.host) return;
      const host = this.host;
      this.layer.classList.remove("on");
      setTimeout(() => host.remove(), 450);
      this.host = null;
      this.layer = null;
      this.views.clear();
    }

    _create(cursor) {
      const root = document.createElement("div");
      root.className = "cur";
      root.innerHTML =
        `<svg width="20" height="22" viewBox="0 0 20 22">` +
        `<path d="${ARROW_PATH}" fill="${cursor.color}" stroke="#fff" ` +
        `stroke-width="1.5" stroke-linejoin="round"/></svg>` +
        `<div class="tag"></div>`;
      const tag = root.querySelector(".tag");
      tag.textContent = cursor.name;
      tag.style.background = cursor.color;

      const focus = document.createElement("div");
      focus.className = "focus";
      focus.style.borderColor = cursor.color;

      this.layer.append(focus, root);
      const view = { root, svg: root.firstChild, focus };
      this.views.set(cursor.id, view);
      return view;
    }

    render(cursors, squash) {
      if (!this.layer) return;
      const seen = new Set();

      for (const c of cursors) {
        seen.add(c.id);
        const v = this.views.get(c.id) || this._create(c);
        const x = Math.round(c.screenX * 10) / 10;
        const y = Math.round(c.screenY * 10) / 10;
        v.root.style.transform = `translate(${x}px, ${y}px)`;
        const s = 1 - c.pressure * squash;
        v.svg.style.transform = `rotate(${c.angle.toFixed(1)}deg) scale(${s.toFixed(3)})`;

        if (c.focus) {
          const r = c.focus.getBoundingClientRect();
          const pad = 3;
          v.focus.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
          v.focus.style.width = `${r.width + pad * 2}px`;
          v.focus.style.height = `${r.height + pad * 2}px`;
          v.focus.classList.add("on");
        } else {
          v.focus.classList.remove("on");
        }
      }

      for (const [id, v] of this.views) {
        if (!seen.has(id)) {
          v.root.remove();
          v.focus.remove();
          this.views.delete(id);
        }
      }
    }
  }

  window.Balade.Renderer = Renderer;
})();
