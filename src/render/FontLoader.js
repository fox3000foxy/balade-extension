// Charge une police embarquée dans l'extension pour l'overlay.
// On passe par l'API FontFace avec les octets du fichier : la police est disponible
// dans la page (et donc dans notre Shadow DOM) sans dépendre du réseau.
// En cas d'échec, l'overlay garde sa police de repli : rien ne casse.
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
