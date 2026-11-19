// Sanitizes SVG pointers imported by the user.
// The SVG ends up in pages you visit: only simple shapes are kept
// (allowlist of elements and attributes), no scripts, links, styles or external
// references. "currentColor" is kept: it will take the cursor's color.
(() => {
  const tr = (key, ...args) => window.Balade.I18n.t(key, ...args);
  const B = window.Balade || (window.Balade = { ready: false });
  if (B.SvgSanitizer) return;

  const ELEMENTS = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
  const ATTRS = new Set([
    "d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "points", "x1", "y1", "x2", "y2",
    "fill", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "stroke-miterlimit",
    "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "clip-rule", "transform", "paint-order"
  ]);
  const MAX_INPUT = 60000;
  const MAX_OUTPUT = 20000;
  const MAX_NODES = 400;

  // Accepted values: literal colors, numbers, path data, simple transforms.
  const COLOR = /^(none|currentColor|#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;
  const SAFE = /^[\d\s.,eE+\-MmLlHhVvCcSsQqTtAaZz%]*$/;
  const TRANSFORM = /^[\s\d.,eE+\-()a-zA-Z]*$/;
  const TRANSFORM_FN = /\b(?!matrix|translate|scale|rotate|skewX|skewY)[a-zA-Z]+\(/;

  function cleanValue(name, value) {
    const v = String(value).trim();
    if (v.length > 8000) return null;
    if (/url\s*\(|javascript:|expression|@import|[<>"'`\\]/i.test(v)) return null;
    if (name === "fill" || name === "stroke") return COLOR.test(v) ? v : null;
    if (name === "transform") return TRANSFORM.test(v) && !TRANSFORM_FN.test(v) ? v : null;
    if (["stroke-linejoin", "stroke-linecap", "fill-rule", "clip-rule", "paint-order"].includes(name)) {
      return /^[a-z\s-]{1,30}$/i.test(v) ? v : null;
    }
    return SAFE.test(v) ? v : null;
  }

  /**
   * @param {string} text contenu d'un fichier .svg
   * @returns {{ markup: string, viewBox: number[] }} formes nettoyées (sans la balise <svg>)
   * @throws {Error} message lisible si le fichier n'est pas utilisable
   */
  function clean(text) {
    if (typeof text !== "string" || text.length > MAX_INPUT) throw new Error("File too large (60 KB max).");
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.localName !== "svg" || doc.querySelector("parsererror")) {
      throw new Error(tr("svg_unreadable"));
    }

    // viewBox: from the file, or fall back to width/height.
    let vb = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
      const w = parseFloat(root.getAttribute("width"));
      const h = parseFloat(root.getAttribute("height"));
      if (!(w > 0 && h > 0)) throw new Error(tr("svg_no_size"));
      vb = [0, 0, w, h];
    }

    let nodes = 0;
    const out = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const copy = (src, dst) => {
      for (const child of src.children) {
        const name = child.localName;
        if (!ELEMENTS.has(name) || name === "svg") {
          // A nested <svg> or unknown element: keep only its allowed children.
          if (name === "svg" || name === "a" || name === "switch") copy(child, dst);
          continue;
        }
        if (++nodes > MAX_NODES) throw new Error("Drawing too complex (400 shapes max).");
        const el = document.createElementNS("http://www.w3.org/2000/svg", name);
        for (const attr of child.attributes) {
          const a = attr.localName;
          if (!ATTRS.has(a) || attr.namespaceURI) continue;
          const v = cleanValue(a, attr.value);
          if (v != null) el.setAttribute(a, v);
        }
        dst.appendChild(el);
        if (name === "g") copy(child, el);
      }
    };
    copy(root, out);
    if (nodes === 0) throw new Error(tr("svg_no_shapes"));

    const markup = new XMLSerializer().serializeToString(out).replace(/^<g[^>]*>|<\/g>$/g, "");
    if (markup.length > MAX_OUTPUT) throw new Error(tr("svg_too_big"));
    return { markup, viewBox: vb };
  }

  B.SvgSanitizer = { clean };
})();
