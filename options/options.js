// Customization page: names, custom theme (style, colors, imported pointer).
// Every change is saved immediately and applies live on open pages.
(() => {
  const { Settings, Themes, SvgSanitizer, makePerso, I18n } = window.Balade;
  const $ = (id) => document.getElementById(id);
  const BASES = ["classique", "zine", "galets", "carnet"];
  const SAMPLE_NAMES = I18n.list("names_list").slice(0, 4);

  let s = null;
  let custom = null;
  let savedTimer = 0;

  // Theme tag styles are also used in the preview.
  const style = document.createElement("style");
  style.textContent = Object.values(Themes).map((t) => t.css).join("\n");
  document.head.appendChild(style);

  async function save(patch) {
    s = await Settings.save(patch);
    custom = s.custom || defaultCustom();
    $("saved").textContent = I18n.t("opt_saved");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => ($("saved").textContent = ""), 1600);
    render();
  }

  function defaultCustom() {
    return { enabled: false, base: "classique", palette: null, pointer: null };
  }

  const palette = () => (custom.palette && custom.palette.length ? custom.palette : Themes[custom.base].palette);
  const saveCustom = (changes) => save({ custom: { ...custom, ...changes } });

  // ---------- Names ----------

  let namesTimer = 0;
  function bindNames() {
    $("names").addEventListener("input", () => {
      const list = $("names").value.split("\n").map((n) => n.trim()).filter(Boolean);
      $("namesCount").textContent = countText(list.length);
      clearTimeout(namesTimer);
      namesTimer = setTimeout(() => save({ names: list }), 500);
    });
    $("namesReset").addEventListener("click", () => {
      $("names").value = "";
      save({ names: [] });
    });
  }
  const countText = (n) => (n ? I18n.plural("opt_names_count", n) + (n > 40 ? I18n.t("opt_names_over") : "") : I18n.t("opt_names_default"));

  // ---------- Custom theme ----------

  function renderBases() {
    const box = $("bases");
    box.innerHTML = "";
    for (const id of BASES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "base";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(custom.base === id));
      const t = Themes[id];
      b.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">${t.svg("arrow", t.palette[0])}</svg><span>${t.label}</span>`;
      b.addEventListener("click", () => saveCustom({ base: id }));
      box.appendChild(b);
    }
  }

  function renderPalette() {
    const box = $("palette");
    box.innerHTML = "";
    const colors = palette();
    colors.forEach((c, i) => {
      const w = document.createElement("div");
      w.className = "swatch";
      const input = document.createElement("input");
      input.type = "color";
      input.value = c;
      input.setAttribute("aria-label", I18n.t("opt_color_n", i + 1));
      input.addEventListener("change", () => {
        const next = [...palette()];
        next[i] = input.value;
        saveCustom({ palette: next });
      });
      const code = document.createElement("code");
      code.textContent = c;
      w.append(input, code);
      if (colors.length > 1) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "rm";
        rm.textContent = "×";
        rm.setAttribute("aria-label", I18n.t("opt_color_remove", c));
        rm.addEventListener("click", () => saveCustom({ palette: palette().filter((_, j) => j !== i) }));
        w.appendChild(rm);
      }
      box.appendChild(w);
    });
    $("addColor").disabled = colors.length >= 10;
  }

  function bindTheme() {
    $("customOn").addEventListener("change", (e) => {
      const on = e.target.checked;
      const theme = on ? "perso" : s.theme === "perso" ? "classique" : s.theme;
      save({ custom: { ...custom, enabled: on }, theme });
    });
    $("addColor").addEventListener("click", () => {
      const base = Themes[custom.base].palette;
      const next = [...palette()];
      next.push(base[next.length % base.length]);
      saveCustom({ palette: next });
    });
    $("resetColors").addEventListener("click", () => saveCustom({ palette: null }));

    $("svgFile").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      $("svgError").textContent = "";
      try {
        const { markup, viewBox } = SvgSanitizer.clean(await file.text());
        // Default hotspot: the top-left corner of the drawing, like a classic arrow.
        const hot = { x: viewBox[0] + viewBox[2] * 0.12, y: viewBox[1] + viewBox[3] * 0.08 };
        saveCustom({ pointer: { markup, viewBox, hot, name: file.name } });
      } catch (err) {
        $("svgError").textContent = err.message;
      }
    });
    $("svgRemove").addEventListener("click", () => saveCustom({ pointer: null }));

    // Place the hotspot: click the drawing, or use arrow keys (1 unit, 10 with Shift).
    const area = $("hotArea");
    area.addEventListener("click", (e) => {
      const p = custom.pointer;
      if (!p) return;
      const r = area.getBoundingClientRect();
      const { k, ox, oy } = fit(p.viewBox);
      saveCustom({ pointer: { ...p, hot: { x: p.viewBox[0] + (e.clientX - r.left - ox) / k, y: p.viewBox[1] + (e.clientY - r.top - oy) / k } } });
    });
    area.addEventListener("keydown", (e) => {
      const p = custom.pointer;
      if (!p) return;
      const step = (e.shiftKey ? 10 : 1) * (Math.max(p.viewBox[2], p.viewBox[3]) / 160);
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      saveCustom({ pointer: { ...p, hot: { x: p.hot.x + d[0], y: p.hot.y + d[1] } } });
    });
  }

  /** Mise à l'échelle d'une viewBox dans le carré de 160 px (proportions gardées). */
  function fit(vb) {
    const k = 160 / Math.max(vb[2], vb[3]);
    return { k, ox: (160 - vb[2] * k) / 2, oy: (160 - vb[3] * k) / 2 };
  }

  function renderPointer() {
    const p = custom.pointer;
    $("hotBox").hidden = !p;
    $("svgRemove").hidden = !p;
    if (!p) return;
    const svg = $("hotSvg");
    svg.setAttribute("viewBox", p.viewBox.join(" "));
    svg.setAttribute("color", palette()[0]);
    svg.innerHTML = p.markup; // already sanitized by SvgSanitizer
    const { k, ox, oy } = fit(p.viewBox);
    $("hotMark").style.left = `${ox + (p.hot.x - p.viewBox[0]) * k}px`;
    $("hotMark").style.top = `${oy + (p.hot.y - p.viewBox[1]) * k}px`;
  }

  /** Aperçu : quatre curseurs dessinés exactement comme dans les pages. */
  function renderPreview() {
    const box = $("preview");
    box.className = `preview theme-${custom.base}`;
    box.innerHTML = "";
    const t = makePerso({ ...custom, enabled: true });
    const names = s.names.length ? s.names : SAMPLE_NAMES;
    const shapes = ["arrow", "arrow", "hand", "ibeam"];
    const colors = palette();
    shapes.forEach((shape, i) => {
      const color = colors[i % colors.length];
      const hot = t.hot[shape] || t.hot.arrow;
      const size = t.size * 1.4;
      const k = size / 24;
      const cur = document.createElement("div");
      cur.className = "cur";
      cur.style.left = `${70 + i * 160}px`;
      cur.style.top = "34px";
      cur.style.setProperty("--c", color);
      cur.style.setProperty("--ct", window.Balade.textOn(color, custom.base === "galets" ? "#2B241F" : "#1B1D21",
        custom.base === "zine" ? "#F3EEE4" : "#FFFFFF"));
      cur.style.setProperty("--c2", t.second ? t.second(color) : color);
      cur.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="left:${-hot.x * k}px;top:${-hot.y * k}px">${t.svg(shape, color)}</svg>`;
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.style.left = `${size * 0.48}px`;
      tag.style.top = `${size * 0.66}px`;
      tag.textContent = t.tag({ name: names[i % names.length], id: i });
      cur.appendChild(tag);
      box.appendChild(cur);
    });
  }

  function render() {
    $("customOn").checked = !!custom.enabled;
    $("namesCount").textContent = countText(s.names.length);
    renderBases();
    renderPalette();
    renderPointer();
    renderPreview();
  }

  (async () => {
    I18n.apply();
    $("names").placeholder = I18n.list("names_list").slice(0, 3).join("\n");
    s = await Settings.load();
    custom = s.custom || defaultCustom();
    $("names").value = s.names.join("\n");
    bindNames();
    bindTheme();
    render();
  })();
})();
