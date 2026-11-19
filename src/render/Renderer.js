// Le rendu : un overlay plein écran, isolé du site par un Shadow DOM,
// qui ne capte jamais la souris (pointer-events: none).
// L'apparence (pointeurs, étiquettes, surbrillances) vient du thème actif (Themes.js).
(() => {
  const { Themes, FontLoader } = window.Balade;
  const HOST_TAG = "balade-overlay";

  const BASE_STYLE = `
    :host { all: initial; }
    .layer { position: fixed; inset: 0; pointer-events: none; overflow: hidden;
             opacity: 0; transition: opacity .4s ease; }
    .layer.on { opacity: 1; }
    .layer.on.hidden { opacity: 0; transition: opacity .2s ease; }
    .cur { position: absolute; left: 0; top: 0; will-change: transform; }
    .cur svg { position: absolute; left: 0; top: 0; overflow: visible; }
    .tag { position: absolute; white-space: nowrap; }
    .layer.nonames .cur:not(.pip) .tag { display: none; }
    .cur.pip svg { display: none; }
    .cur.pip .tag { left: 0 !important; top: 0 !important; transform: translateX(-50%); }
    .focus { position: absolute; left: 0; top: 0; opacity: 0; transition: opacity .2s ease; box-sizing: border-box; }
    .focus.on { opacity: 1; }
    .ghost { position: absolute; left: 0; top: 0; display: none; overflow: hidden;
             white-space: pre; box-sizing: border-box; }
    .ghost.on { display: flex; }
    .ghost .caret { display: inline-block; width: 1.5px; height: 1.15em; margin-left: 1px;
                    animation: blink 1s steps(1) infinite; }
    .spin { animation: spin 1.1s linear infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .layer { transition: none; }
      .ghost .caret, .spin { animation: none; }
    }
  `;

  // Marge au-delà de laquelle un curseur est considéré hors de l'écran (px).
  const OFF_MARGIN = 6;

  class Renderer {
    constructor() {
      this.host = null;
      this.layer = null;
      this.views = new Map(); // id du curseur → éléments DOM de sa vue
      this.hidden = false;
      this.theme = Themes.classique;
      this.themeId = "classique";
      this.showNames = true;
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
      style.textContent = BASE_STYLE + Object.values(Themes).map((t) => t.css).join("\n");
      this.layer = document.createElement("div");
      shadow.append(style, this.layer);
      this._applyLayerClass();
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

    /** Change de thème ; la police du thème est chargée à la volée. */
    setTheme(id) {
      if (!Themes[id]) id = "classique";
      this.themeId = id;
      this.theme = Themes[id];
      FontLoader.load(this.theme.font);
      for (const v of this.views.values()) v.key = null; // force le redessin des pointeurs
      this._applyLayerClass();
    }

    setShowNames(show) {
      this.showNames = show;
      this._applyLayerClass();
    }

    /** Cache ou montre tous les curseurs (plein écran). */
    setHidden(hidden) {
      this.hidden = hidden;
      this._applyLayerClass();
    }

    _applyLayerClass() {
      if (!this.layer) return;
      const on = this.layer.classList.contains("on");
      this.layer.className =
        `layer theme-${this.themeId}` +
        (on ? " on" : "") +
        (this.hidden ? " hidden" : "") +
        (this.showNames ? "" : " nonames");
    }

    _create(cursor) {
      const root = document.createElement("div");
      root.className = "cur";
      root.innerHTML = `<svg></svg><div class="tag"></div>`;

      const focus = document.createElement("div");
      focus.className = "focus";

      const ghost = document.createElement("div");
      ghost.className = "ghost";
      ghost.innerHTML = `<span class="txt"></span><span class="caret"></span>`;

      this.layer.append(focus, ghost, root);
      const view = {
        root,
        svg: root.firstChild,
        tag: root.lastChild,
        focus,
        ghost,
        ghostText: ghost.firstChild,
        caret: ghost.lastChild,
        ghostFor: null,
        key: null,
        tagText: null
      };
      this.views.set(cursor.id, view);
      return view;
    }

    /** Redessine le pointeur quand la forme, la couleur ou le thème changent. */
    _applyShape(v, c, color) {
      const t = this.theme;
      const size = t.size;
      const hot = t.hot[c.shape] || t.hot.arrow;
      const k = size / 24;
      v.svg.setAttribute("width", size);
      v.svg.setAttribute("height", size);
      v.svg.setAttribute("viewBox", "0 0 24 24");
      v.svg.innerHTML = t.svg(c.shape, color);
      v.svg.style.left = `${-hot.x * k}px`;
      v.svg.style.top = `${-hot.y * k}px`;
      v.svg.style.transformOrigin = `${hot.x * k}px ${hot.y * k}px`;
      // L'étiquette se place sous la pointe de la flèche, quelle que soit la forme.
      v.tag.style.left = `${size * 0.48}px`;
      v.tag.style.top = `${size * 0.66}px`;
      v.root.style.setProperty("--c", color);
      v.root.style.setProperty("--c2", t.second ? t.second(color) : color);
      // Curseur de texte : à la couleur du curseur (au crayon rouge dans le carnet).
      v.caret.style.background = this.themeId === "carnet" ? "#C2412D" : this.themeId === "classique" ? "#1B1D21" : color;
    }

    /** Copie la typographie et la boîte de contenu du champ, une fois par mot fantôme. */
    _styleGhost(v, el) {
      const cs = getComputedStyle(el);
      const g = v.ghost;
      g.style.font = cs.font;
      g.style.letterSpacing = cs.letterSpacing;
      g.style.color = this.theme.text;
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

    /**
     * Range les repères de bord de gauche à droite sans chevauchement :
     * chacun reste au plus près de l'abscisse de son curseur, et passe à la rangée
     * suivante quand il n'y a plus de place.
     */
    _layoutPips(pips, W, H) {
      for (const above of [true, false]) {
        const row = pips.filter((p) => p.above === above).sort((a, b) => a.x - b.x);
        let line = 0;
        let right = -Infinity;
        for (const p of row) {
          const w = p.v.tag.offsetWidth || 90;
          let left = Math.max(p.x - w / 2, right + 6, 8);
          if (left + w > W - 8) {
            line++;
            left = Math.max(8, Math.min(p.x - w / 2, W - 8 - w));
          }
          right = left + w;
          const y = above ? 10 + line * 26 : H - 30 - line * 26;
          p.v.root.style.transform = `translate(${(left + w / 2).toFixed(1)}px, ${y}px)`;
        }
      }
    }

    render(cursors, squash) {
      if (!this.layer) return;
      const t = this.theme;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const seen = new Set();
      const pips = [];

      for (const c of cursors) {
        seen.add(c.id);
        const v = this.views.get(c.id) || this._create(c);
        const color = t.palette[c.colorIndex % t.palette.length];
        const key = `${this.themeId}|${c.shape}|${color}`;
        if (v.key !== key) {
          this._applyShape(v, c, color);
          v.key = key;
        }

        // Hors de l'écran (au-dessus ou en dessous) : un repère au bord, avec le prénom.
        const above = c.screenY < -OFF_MARGIN;
        const below = c.screenY > H + OFF_MARGIN;
        const pip = (above || below) && !c.leaving;
        v.root.classList.toggle("pip", pip);

        let text = t.tag(c);
        if (pip) text = `${above ? "↑" : "↓"} ${text}`;
        if (v.tagText !== text) {
          v.tag.textContent = text;
          v.tagText = text;
        }

        if (pip) {
          // Placé après la boucle, pour que les repères ne se chevauchent pas.
          pips.push({ v, x: c.screenX, above });
        } else {
          v.root.style.transform = `translate(${c.screenX.toFixed(1)}px, ${c.screenY.toFixed(1)}px)`;
          const s = 1 - c.pressure * squash;
          v.svg.style.transform = `rotate(${c.angle.toFixed(1)}deg) scale(${s.toFixed(3)})`;
        }

        if (c.focus && c.focus.isConnected) {
          const r = c.focus.getBoundingClientRect();
          const pad = 3;
          v.focus.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
          v.focus.style.width = `${r.width + pad * 2}px`;
          v.focus.style.height = `${r.height + pad * 2}px`;
          v.focus.classList.add("on");
        } else {
          v.focus.classList.remove("on");
        }

        if (c.ghost && c.ghost.el.isConnected) {
          if (v.ghostFor !== c.ghost.el) this._styleGhost(v, c.ghost.el);
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

      this._layoutPips(pips, W, H);

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
