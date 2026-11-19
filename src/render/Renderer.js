// Le rendu : un overlay plein écran, isolé du site par un Shadow DOM,
// qui ne capte jamais la souris (pointer-events: none).
(() => {
  const HOST_TAG = "balade-overlay";

  // Formes dessinées pour ce projet. hot = point chaud (là où « pointe » le curseur).
  const SHAPES = {
    arrow: {
      hot: { x: 3, y: 2 },
      svg: (color) =>
        `<path d="M3 2 L3 18.5 L7.4 14.3 L10.3 20.9 L13.2 19.7 L10.4 13.2 L16.6 13.2 Z" ` +
        `fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`
    },
    ibeam: {
      hot: { x: 7, y: 11 },
      svg: (color) => {
        const d = "M4 2.5 Q7 2.5 7 4.5 Q7 2.5 10 2.5 M7 4.5 V17.5 M4 19.5 Q7 19.5 7 17.5 Q7 19.5 10 19.5";
        return (
          `<path d="${d}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>` +
          `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`
        );
      }
    }
  };

  const STYLE = `
    :host { all: initial; }
    .layer { position: fixed; inset: 0; pointer-events: none; overflow: hidden;
             opacity: 0; transition: opacity .4s ease; }
    .layer.on { opacity: 1; }
    .layer.on.hidden { opacity: 0; transition: opacity .2s ease; }
    .cur { position: absolute; left: 0; top: 0; will-change: transform; }
    .cur svg { position: absolute; overflow: visible;
               filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.25)); }
    .tag { position: absolute; left: 13px; top: 17px; padding: 2px 7px;
           border-radius: 9px 9px 9px 3px; color: #fff; white-space: nowrap;
           font: 600 11px/16px system-ui, -apple-system, "Segoe UI", sans-serif;
           box-shadow: 0 1px 3px rgba(0,0,0,.2); }
    .focus { position: absolute; left: 0; top: 0; border: 1.5px solid; border-radius: 5px;
             opacity: 0; transition: opacity .2s ease; box-sizing: border-box; }
    .focus.on { opacity: 1; }
    .ghost { position: absolute; left: 0; top: 0; display: none; overflow: hidden;
             white-space: pre; box-sizing: border-box; }
    .ghost.on { display: flex; }
    .ghost .caret { display: inline-block; width: 1.5px; height: 1.15em; margin-left: 1px;
                    animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .layer { transition: none; }
      .ghost .caret { animation: none; }
    }
  `;

  class Renderer {
    constructor() {
      this.host = null;
      this.layer = null;
      this.views = new Map(); // id du curseur → éléments DOM de sa vue
      this.hidden = false;
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

    /** Cache ou montre tous les curseurs (plein écran). */
    setHidden(hidden) {
      this.hidden = hidden;
      if (this.layer) this.layer.classList.toggle("hidden", hidden);
    }

    _create(cursor) {
      const root = document.createElement("div");
      root.className = "cur";
      root.innerHTML = `<svg width="20" height="22" viewBox="0 0 20 22"></svg><div class="tag"></div>`;
      const tag = root.querySelector(".tag");
      tag.textContent = cursor.name;
      tag.style.background = cursor.color;

      const focus = document.createElement("div");
      focus.className = "focus";
      focus.style.borderColor = cursor.color;

      const ghost = document.createElement("div");
      ghost.className = "ghost";
      ghost.innerHTML = `<span class="txt"></span><span class="caret"></span>`;
      ghost.querySelector(".caret").style.background = cursor.color;

      this.layer.append(focus, ghost, root);
      const view = {
        root,
        svg: root.firstChild,
        focus,
        ghost,
        ghostText: ghost.firstChild,
        ghostFor: null,
        shape: null
      };
      this.views.set(cursor.id, view);
      return view;
    }

    _applyShape(v, cursor) {
      const s = SHAPES[cursor.shape] || SHAPES.arrow;
      v.svg.innerHTML = s.svg(cursor.color);
      v.svg.style.left = `${-s.hot.x}px`;
      v.svg.style.top = `${-s.hot.y}px`;
      v.svg.style.transformOrigin = `${s.hot.x}px ${s.hot.y}px`;
      v.shape = cursor.shape;
    }

    /** Copie la typographie et la boîte de contenu du champ, une fois par mot fantôme. */
    _styleGhost(v, el, color) {
      const cs = getComputedStyle(el);
      const g = v.ghost;
      g.style.font = cs.font;
      g.style.letterSpacing = cs.letterSpacing;
      g.style.color = color;
      // Couvre le placeholder avec le fond du champ, comme quand on tape vraiment.
      const bg = cs.backgroundColor;
      g.style.background = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" ? bg : "transparent";
      g.style.alignItems = el.localName === "input" ? "center" : "flex-start";
      v.ghostPad = {
        l: parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
        r: parseFloat(cs.borderRightWidth) + parseFloat(cs.paddingRight),
        t: parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop),
        b: parseFloat(cs.borderBottomWidth) + parseFloat(cs.paddingBottom)
      };
      v.ghostFor = el;
    }

    render(cursors, squash) {
      if (!this.layer) return;
      const seen = new Set();

      for (const c of cursors) {
        seen.add(c.id);
        const v = this.views.get(c.id) || this._create(c);
        if (v.shape !== c.shape) this._applyShape(v, c);

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

        if (c.ghost) {
          if (v.ghostFor !== c.ghost.el) this._styleGhost(v, c.ghost.el, c.color);
          const r = c.ghost.el.getBoundingClientRect();
          const p = v.ghostPad;
          v.ghost.style.transform = `translate(${r.left + p.l}px, ${r.top + p.t}px)`;
          v.ghost.style.width = `${Math.max(0, r.width - p.l - p.r)}px`;
          v.ghost.style.height = `${Math.max(0, r.height - p.t - p.b)}px`;
          if (v.ghostText.textContent !== c.ghost.text) v.ghostText.textContent = c.ghost.text;
          v.ghost.classList.add("on");
        } else if (v.ghostFor) {
          v.ghost.classList.remove("on");
          v.ghostText.textContent = "";
          v.ghostFor = null;
        }
      }

      for (const [id, v] of this.views) {
        if (!seen.has(id)) {
          v.root.remove();
          v.focus.remove();
          v.ghost.remove();
          this.views.delete(id);
        }
      }
    }
  }

  window.Balade.Renderer = Renderer;
})();
