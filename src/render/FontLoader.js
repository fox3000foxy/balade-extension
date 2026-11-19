// Loads a font bundled with the extension for the overlay.
// Uses the FontFace API with the raw file bytes: the font is available
// in the page (and in our Shadow DOM) without any network request.
// On failure, the overlay keeps its fallback font: nothing breaks.
(() => {
  const B = window.Balade;
  const loaded = new Map(); // famille → Promise

  function urlFor(file) {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(`fonts/${file}`);
    }
    return (B.assetBase || "") + `fonts/${file}`;
  }

  B.FontLoader = {
    /** @param {{family: string, file: string} | null} font */
    load(font) {
      if (!font || typeof FontFace === "undefined") return Promise.resolve(false);
      if (loaded.has(font.family)) return loaded.get(font.family);
      const p = fetch(urlFor(font.file))
        .then((r) => {
          if (!r.ok) throw new Error(r.status);
          return r.arrayBuffer();
        })
        .then((buf) => new FontFace(font.family, buf, { weight: "100 900" }).load())
        .then((face) => {
          document.fonts.add(face);
          return true;
        })
        .catch(() => false);
      loaded.set(font.family, p);
      return p;
    }
  };
})();
