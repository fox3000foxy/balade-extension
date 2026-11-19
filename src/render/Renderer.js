// The renderer: a full-screen overlay, isolated from the site by a Shadow DOM,
// that never captures the mouse (pointer-events: none).
// Appearance (pointers, tags, highlights) comes from the active theme (Themes.js).
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
    .bubble { position: absolute; white-space: nowrap; opacity: 0; transform: translateY(4px) scale(.9);
              transform-origin: 0 100%; transition: opacity .18s ease, transform .18s ease; }
    .bubble.on { opacity: 1; transform: none; }
    .cur.pip .bubble { display: none; }
    .hud { position: absolute; pointer-events: none; }
    .hud.top { left: 50%; top: 14px; transform: translateX(-50%) !important; font-size: 14px !important; padding: 6px 14px !important; }
    .hud.top:not(.on) { transform: translate(-50%, -6px) !important; }
    .hud.corner { right: 14px; bottom: 14px; opacity: 0; }
    .hud.corner.on { opacity: .85; }
    .cur.bub-left .bubble { left: auto !important; right: 6px; }
    .cur.bub-below .bubble { bottom: auto !important; top: 44px; }
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
    .cur svg { transition: filter .25s ease; }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .layer { transition: none; }
      .ghost .caret, .spin { animation: none; }
    }
  `;

  // Margin beyond which a cursor is considered off-screen (px).
  const OFF_MARGIN = 6;

  class Renderer {
    constructor() {
      this.host = null;
      this.layer = null;
      this.views = new Map(); // cursor id -> DOM elements of its view
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
      this.hud = {
        top: Object.assign(document.createElement("div"), { className: "bubble hud top" }),
        corner: Object.assign(document.createElement("div"), { className: "bubble hud corner" })
      };
      this.layer.append(this.hud.top, this.hud.corner);
      shadow.append(style, this.layer);
      this._applyLayerClass();
      document.documentElement.appendChild(this.host);
      // Let the browser paint the initial state before the fade-in.
      requestAnimationFrame(() => this.layer && this.layer.classList.add("on"));
    }

    /** Fade out, then remove from the DOM. */
    unmount() {
      if (!this.host) return;
      const host = this.host;
      this.layer.classList.remove("on");
      setTimeout(() => host.remove(), 450);
      this.host = null;
      this.layer = null;
      this.views.clear();
    }

    /** Changes the theme (or custom theme); the theme font is loaded on demand. */
    setTheme(id, custom) {
      if (id === "perso" && custom && custom.enabled) {
        this.theme = window.Balade.makePerso(custom);
      } else {
        if (!Themes[id]) id = "classique";
        this.theme = Themes[id];
      }
      this.themeId = id;
      this.cssId = this.theme.cssId || id;
      this.version = (this.version || 0) + 1;
      FontLoader.load(this.theme.font);
      for (const v of this.views.values()) v.key = null; // force pointer redraw
      this._applyLayerClass();
    }

    setShowNames(show) {
      this.showNames = show;
      this._applyLayerClass();
    }

    /** Small fixed display: "top" (game) or "corner" (timer). null to hide. */
    setHud(slot, text) {
      const el = this.hud && this.hud[slot];
      if (!el) return;
      if (text == null) {
        el.classList.remove("on");
        return;
      }
      if (el.textContent !== text) el.textContent = text;
      el.classList.add("on");
    }

    /** Hides or shows all cursors (full screen). */
    setHidden(hidden) {
      this.hidden = hidden;
      this._applyLayerClass();
    }

    _applyLayerClass() {
      if (!this.layer) return;
      const on = this.layer.classList.contains("on");
      this.layer.className =
        `layer theme-${this.cssId || this.themeId}` +
        (on ? " on" : "") +
        (this.hidden ? " hidden" : "") +
        (this.showNames ? "" : " nonames");
    }

    _create(cursor) {
      const root = document.createElement("div");
      root.className = "cur";
      root.innerHTML = `<svg></svg><div class="tag"></div><div class="bubble"></div>`;

      const focus = document.createElement("div");
      focus.className = "focus";

      const ghost = document.createElement("div");
      ghost.className = "ghost";
      ghost.innerHTML = `<span class="txt"></span><span class="caret"></span>`;

      this.layer.append(focus, ghost, root);
      const view = {
        root,
        svg: root.firstChild,
        tag: root.children[1],
        bubble: root.children[2],
        bubbleText: null,
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

    /** Redraws the pointer when shape, color or theme change. */
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
      // The tag is placed below the arrow tip, whatever the shape.
      v.tag.style.left = `${size * 0.48}px`;
      v.tag.style.top = `${size * 0.66}px`;
      v.bubble.style.left = `${size * 0.55}px`;
      v.bubble.style.bottom = `${size * 0.35}px`;
      v.root.style.setProperty("--c", color);
      // With custom colors, tag text adapts to stay readable.
      if (this.themeId === "perso") {
        v.root.style.setProperty("--ct", window.Balade.textOn(color, this.cssId === "galets" ? "#2B241F" : "#1B1D21",
          this.cssId === "zine" ? "#F3EEE4" : "#FFFFFF"));
      } else {
        v.root.style.removeProperty("--ct");
      }
      v.root.style.setProperty("--c2", t.second ? t.second(color) : color);
      // Text caret: cursor color when ghostColor:"cursor", red pencil in Notebook, dark in Classic.
      const css = this.cssId || this.themeId;
      v.caret.style.background = t.ghostColor === "cursor" ? color
        : css === "carnet" ? "#C2412D"
        : css === "classique" && this.themeId !== "perso" ? "#1B1D21"
        : color;
    }

    /** Copies the field's typography and content box, once per ghost word. */
    _styleGhost(v, el) {
      const cs = getComputedStyle(el);
      const g = v.ghost;
      g.style.font = cs.font;
      g.style.letterSpacing = cs.letterSpacing;
      const fieldLum = window.Balade.Stage.luminance(cs.backgroundColor);
      // Ghost theme: text in the cursor's own color; others: theme text color (dark/light).
      if (this.theme.ghostColor === "cursor") {
        g.style.color = this._ghostCursorColor || this.theme.text;
      } else {
        g.style.color = fieldLum != null && fieldLum < 0.3 ? cs.color : this.theme.text;
      }
      // Covers the placeholder with the field's background, as when actually typing.
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
     * Lays out edge markers left to right without overlap:
     * each stays as close as possible to its cursor's x position, and
     * wraps to the next row when there's no room.
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
        const key = `${this.version}|${c.shape}|${color}`;
        if (v.key !== key) {
          this._applyShape(v, c, color);
          v.key = key;
        }

        // Off-screen (above or below): an edge marker with the name.
        const above = c.screenY < -OFF_MARGIN;
        const below = c.screenY > H + OFF_MARGIN;
        const pip = (above || below) && !c.leaving;
        v.root.classList.toggle("pip", pip);
        v.root.classList.toggle("dark", c.onDark);

        let text = t.tag(c);
        if (pip) text = `${above ? "↑" : "↓"} ${text}`;
        if (v.tagText !== text) {
          v.tag.textContent = text;
          v.tagText = text;
        }

        if (pip) {
          // Placed after the loop, so markers don't overlap.
          pips.push({ v, x: c.screenX, above });
        } else {
          v.root.style.transform = `translate(${c.screenX.toFixed(1)}px, ${c.screenY.toFixed(1)}px)`;
          const s = 1 - c.pressure * squash;
          const a = c.angle + (c.wiggle_ || 0);
          v.svg.style.transform = `rotate(${a.toFixed(1)}deg) scale(${s.toFixed(3)})`;
        }

        if (c.bubble) {
          // Near an edge, the bubble switches sides to stay readable.
          v.root.classList.toggle("bub-left", c.screenX > W - 160);
          v.root.classList.toggle("bub-below", c.screenY < 48);
          if (v.bubbleText !== c.bubble.text) {
            v.bubble.textContent = c.bubble.text;
            v.bubbleText = c.bubble.text;
          }
          v.bubble.classList.add("on");
        } else if (v.bubbleText !== null) {
          v.bubble.classList.remove("on");
          v.bubbleText = null;
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
          if (v.ghostFor !== c.ghost.el) {
            this._ghostCursorColor = c.color;
            this._styleGhost(v, c.ghost.el);
            this._ghostCursorColor = null;
          }
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
