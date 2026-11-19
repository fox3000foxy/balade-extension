// Les quatre thèmes : dessins des pointeurs (SVG, viewBox 24×24), points chauds,
// palettes et styles des étiquettes. Tous les pointeurs sont dessinés pour ce projet.
//
// Pointeurs : arrow (flèche), hand (main, sur les liens et boutons), ibeam (texte),
// crosshair (viseur, sur les images), wait (attente, pendant certaines pauses).
(() => {
  // Silhouettes communes. La flèche suit les proportions d'un pointeur système :
  // bord gauche vertical, pointe à 45°, queue fine et inclinée.
  const ARROW = "M4 2.5 L4 18 L7.6 14.6 L10.2 20.1 L12.8 18.9 L10.3 13.6 L15 13.5 Z";
  const HAND =
    "M9 3.5 a1.8 1.8 0 0 1 3.6 0 V10 h0.4 a1.6 1.6 0 0 1 3.2 0.3 V11 a1.6 1.6 0 0 1 3.2 0.4 V16 " +
    "a5.5 5.5 0 0 1 -5.5 5.5 h-1.6 a5 5 0 0 1 -4.2 -2.3 L4.6 14.6 a1.6 1.6 0 0 1 2.6 -1.9 L9 14.5 Z";
  const IBEAM_SOFT = "M9 3.5 Q12 3.5 12 5.5 Q12 3.5 15 3.5 M12 5.5 V18.5 M9 20.5 Q12 20.5 12 18.5 Q12 20.5 15 20.5";

  const HOT_COMMON = {
    arrow: { x: 4, y: 2.5 },
    hand: { x: 10.8, y: 1.8 },
    ibeam: { x: 12, y: 12 },
    crosshair: { x: 12, y: 12 },
    wait: { x: 12, y: 12 }
  };

  const THEMES = {
    // ---------------------------------------------------------------- Classique
    classique: {
      label: "Classique",
      size: 26,
      font: null, // police du système
      palette: ["#E5484D", "#F76B15", "#30A46C", "#0090FF", "#8E4EC6", "#D6409F", "#12A594", "#AD7F58"],
      hot: { ...HOT_COMMON, wait: { x: 4, y: 2.5 } },
      text: "#1B1D21",
      svg(shape) {
        const body = 'fill="#fff" stroke="#1B1D21" stroke-width="1.2" stroke-linejoin="round"';
        const halo = (d) =>
          `<path d="${d}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>` +
          `<path d="${d}" fill="none" stroke="#1B1D21" stroke-width="1.3" stroke-linecap="round"/>`;
        switch (shape) {
          case "hand": return `<path d="${HAND}" ${body}/>`;
          case "ibeam": return halo(IBEAM_SOFT);
          case "crosshair": return halo("M12 3 V21 M3 12 H21");
          case "wait":
            return (
              `<path d="${ARROW}" ${body}/>` +
              `<circle cx="18" cy="18" r="3.6" fill="#fff" stroke="#C9CDD3" stroke-width="1.8"/>` +
              `<g class="spin" style="transform-origin:18px 18px"><path d="M18 14.4 A3.6 3.6 0 0 1 21.6 18" fill="none" stroke="#2563EB" stroke-width="1.8" stroke-linecap="round"/></g>`
            );
          default: return `<path d="${ARROW}" ${body}/>`;
        }
      },
      tag: (c) => c.name,
      css: `
        .theme-classique .tag { background: var(--c); color: #fff; border-radius: 9px 9px 9px 3px;
          font: 600 11px/16px system-ui, -apple-system, "Segoe UI", sans-serif; padding: 2px 7px;
          box-shadow: 0 1px 3px rgba(0,0,0,.2); }
        .theme-classique .focus { border: 1.5px solid var(--c); border-radius: 5px; }
        .theme-classique .cur svg { filter: drop-shadow(0 1px 1.2px rgba(0,0,0,.3)); }
        .theme-classique .bubble { background: #fff; color: #1B1D21; border: 1px solid #D5D9DF; border-radius: 10px 10px 10px 2px;
          padding: 3px 9px; font: 500 12px/16px system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
      `
    },

    // ---------------------------------------------------------------- Zine risographié
    zine: {
      label: "Zine",
      size: 26,
      font: { family: "Balade Chivo Mono", file: "ChivoMono.ttf" },
      palette: ["#2B59C3", "#FF4FA3", "#00A95C", "#FF6C2F", "#765BA7", "#1E1C1A"],
      hot: HOT_COMMON,
      text: "#1E1C1A",
      second(color) {
        return color === "#FF4FA3" ? "#2B59C3" : "#FF4FA3";
      },
      svg(shape, color) {
        const two = (draw) =>
          `<g transform="translate(1.3 1.3)">${draw(this.second(color))}</g>` +
          `<g style="mix-blend-mode:multiply">${draw(color)}</g>`;
        switch (shape) {
          case "hand": return two((c) => `<path d="${HAND}" fill="${c}"/>`);
          case "ibeam": return two((c) => `<path d="M8 3 H16 M12 3 V21 M8 21 H16" fill="none" stroke="${c}" stroke-width="2.6"/>`);
          case "crosshair":
            return two((c) => `<g fill="none" stroke="${c}" stroke-width="2.2"><circle cx="12" cy="12" r="6"/><path d="M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22"/></g>`);
          case "wait":
            return `<g class="spin" style="transform-origin:12px 12px">` +
              two((c) => `<g fill="${c}"><circle cx="12" cy="5" r="2.2"/><circle cx="18" cy="9" r="2"/><circle cx="17" cy="16" r="1.8"/><circle cx="11" cy="19" r="1.6"/><circle cx="6" cy="14" r="1.4"/></g>`) +
              `</g>`;
          default: return two((c) => `<path d="${ARROW}" fill="${c}"/>`);
        }
      },
      tag: (c) => `${c.name} · n°${String(c.id + 1).padStart(2, "0")}`,
      css: `
        .theme-zine .tag { background: var(--c); color: #F3EEE4; border-radius: 0; padding: 3px 8px;
          font: 600 11px/14px "Balade Chivo Mono", ui-monospace, monospace; box-shadow: 3px 3px 0 var(--c2); }
        .theme-zine .focus { border: 1.5px dashed var(--c); border-radius: 0; box-shadow: 3px 3px 0 var(--c2); }
        .theme-zine .bubble { background: #F3EEE4; color: #1E1C1A; border: 1.5px solid #1E1C1A; padding: 2px 7px;
          font: 600 11px/15px "Balade Chivo Mono", ui-monospace, monospace; box-shadow: 3px 3px 0 var(--c); }
      `
    },

    // ---------------------------------------------------------------- Galets d'argile
    galets: {
      label: "Galets",
      size: 28,
      font: { family: "Balade Fredoka", file: "Fredoka.ttf" },
      palette: ["#D9785A", "#7FA27C", "#A592D8", "#E0A93A", "#6F9FC0", "#C4687E"],
      hot: HOT_COMMON,
      text: "#3B342E",
      svg(shape, color) {
        const soft = `stroke="#FBF7F1" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke"`;
        switch (shape) {
          case "hand":
            return `<path d="${HAND}" fill="${color}" ${soft}/><circle cx="10.8" cy="5" r="0.9" fill="#FBF7F1" opacity=".7"/>`;
          case "ibeam":
            return `<path d="${IBEAM_SOFT}" fill="none" stroke="#FBF7F1" stroke-width="5" stroke-linecap="round"/>` +
              `<path d="${IBEAM_SOFT}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`;
          case "crosshair":
            return `<circle cx="12" cy="12" r="6.5" fill="${color}" stroke="#FBF7F1" stroke-width="2.4"/>` +
              `<circle cx="12" cy="12" r="1.6" fill="#3B342E"/>` +
              `<path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5" stroke="#3B342E" stroke-width="2.2" stroke-linecap="round"/>`;
          case "wait":
            return `<g class="spin" style="transform-origin:12px 12px">` +
              `<ellipse cx="7" cy="14" rx="3.6" ry="3" fill="${color}"/><ellipse cx="12.5" cy="8.5" rx="3.2" ry="2.8" fill="#A592D8"/>` +
              `<ellipse cx="17.5" cy="14.5" rx="3" ry="2.6" fill="#7FA27C"/></g>`;
          default:
            return `<path d="${ARROW}" fill="${color}" ${soft}/><circle cx="5.9" cy="8.2" r="1" fill="#FBF7F1" opacity=".7"/>`;
        }
      },
      tag: (c) => c.name,
      css: `
        .theme-galets .tag { background: var(--c); color: #2B241F; border-radius: 14px 14px 14px 5px;
          padding: 3px 10px; font: 600 12px/16px "Balade Fredoka", system-ui, sans-serif; }
        .theme-galets .focus { border: 2.5px solid var(--c); border-radius: 14px; opacity: .85; }
        .theme-galets .bubble { background: #FBF7F1; color: #3B342E; border-radius: 16px 16px 16px 6px; padding: 4px 11px;
          font: 600 12px/16px "Balade Fredoka", system-ui, sans-serif; box-shadow: 0 3px 10px rgba(59,52,46,.15); }
      `
    },

    // ---------------------------------------------------------------- Carnet de terrain
    carnet: {
      label: "Carnet",
      size: 26,
      font: { family: "Balade Spline Sans Mono", file: "SplineSansMono.ttf" },
      // Ici la couleur est celle du surligneur de l'étiquette ; le trait reste à l'encre.
      palette: ["#D7EB6A", "#FFD36E", "#9FE0D0", "#F7A8C4", "#B9C8FF", "#FFB38A"],
      hot: HOT_COMMON,
      text: "#1F2B44",
      svg(shape) {
        const ink = 'fill="#F6F1E3" stroke="#1F2B44" stroke-width="1.5" stroke-linejoin="round"';
        switch (shape) {
          case "hand":
            return `<path d="${HAND}" ${ink}/><path d="M12.6 10 V13 M15.8 10.6 V13 M9.3 4 V13.6" fill="none" stroke="#1F2B44" stroke-width=".6" stroke-linecap="round" opacity=".6"/>`;
          case "ibeam":
            return `<path d="M8.5 3.2 C10 3 11.6 3.4 12 5 C12.4 3.4 14 3 15.5 3.2 M12 5 V19 M8.5 20.8 C10 21 11.6 20.6 12 19 C12.4 20.6 14 21 15.5 20.8" fill="none" stroke="#F6F1E3" stroke-width="3.6" stroke-linecap="round"/>` +
              `<path d="M8.5 3.2 C10 3 11.6 3.4 12 5 C12.4 3.4 14 3 15.5 3.2 M12 5 V19 M8.5 20.8 C10 21 11.6 20.6 12 19 C12.4 20.6 14 21 15.5 20.8" fill="none" stroke="#1F2B44" stroke-width="1.5" stroke-linecap="round"/>`;
          case "crosshair":
            return `<circle cx="12" cy="12" r="6" fill="none" stroke="#1F2B44" stroke-width="1.5"/>` +
              `<path d="M12 2.5 V8 M12 16 V21.5 M2.5 12 H8 M16 12 H21.5" stroke="#1F2B44" stroke-width="1.5" stroke-linecap="round"/>` +
              `<circle cx="12" cy="12" r="1.1" fill="#C2412D"/>`;
          case "wait":
            return `<g class="spin" style="transform-origin:12px 12px"><path d="M12 4 A8 8 0 1 1 4.5 9.5" fill="none" stroke="#1F2B44" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2.5 2.2"/>` +
              `<path d="M4.5 9.5 L3.6 6.4 M4.5 9.5 L7.6 8.8" fill="none" stroke="#C2412D" stroke-width="1.5" stroke-linecap="round"/></g>`;
          default:
            return `<path d="${ARROW}" ${ink}/><path d="M4.3 2.9 L4.2 17.6 L7.6 14.3 M10.6 13.3 L14.6 13.2" fill="none" stroke="#1F2B44" stroke-width=".6" stroke-linecap="round" opacity=".6"/>`;
        }
      },
      tag: (c) => `n°${String(c.id + 1).padStart(2, "0")} · ${c.name}`,
      css: `
        .theme-carnet .tag { background: #F6F1E3; color: #1F2B44; border: 1px solid #1F2B44; border-radius: 0;
          padding: 2px 6px; font: 400 11px/15px "Balade Spline Sans Mono", ui-monospace, monospace;
          transform: rotate(-3deg); box-shadow: inset 0 -6px 0 var(--c); }
        .theme-carnet .focus { border: 1.5px solid #C2412D; border-radius: 3px; }
        .theme-carnet .bubble { background: #FBF8EE; color: #1F2B44; border: 1px solid #1F2B44; padding: 2px 7px;
          font: 400 11px/15px "Balade Spline Sans Mono", ui-monospace, monospace; transform: rotate(2deg); }
        .theme-carnet .bubble.on { transform: rotate(2deg); }
      `
    }
  };

  window.Balade.Themes = THEMES;
})();
