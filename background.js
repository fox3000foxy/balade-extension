// Service worker : injecte les scripts dans l'onglet actif (une seule fois),
// puis bascule la balade (démarrer / arrêter).

// L'ordre compte : chaque fichier s'appuie sur ceux qui le précèdent.
const FILES = [
  "src/core/namespace.js",
  "src/core/MathUtils.js",
  "src/core/Config.js",
  "src/entities/Cursor.js",
  "src/motion/Path.js",
  "src/motion/Motion.js",
  "src/world/Stage.js",
  "src/behaviors/Behavior.js",
  "src/behaviors/Arrive.js",
  "src/behaviors/Leave.js",
  "src/behaviors/Wander.js",
  "src/render/Renderer.js",
  "src/audio/Sound.js",
  "src/engine/Engine.js",
  "src/main.js"
];

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const target = { tabId: tab.id };
  try {
    const [{ result: loaded }] = await chrome.scripting.executeScript({
      target,
      func: () => Boolean(window.Balade && window.Balade.ready)
    });
    if (!loaded) {
      await chrome.scripting.executeScript({ target, files: FILES });
    }
    await chrome.scripting.executeScript({
      target,
      func: () => window.Balade.toggle()
    });
  } catch (err) {
    // Pages protégées (chrome://, Chrome Web Store…) : rien à faire.
    console.warn("[Balade] Injection impossible sur cette page :", err.message);
  }
});
