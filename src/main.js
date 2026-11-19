// Point d'entrée : un seul moteur à la fois, que l'icône, le menu ou Alt+B allument ou éteignent.
// Les réglages sont lus au lancement, puis suivis en direct (un changement dans le menu
// s'applique immédiatement, sans relancer la balade).
(() => {
  const B = window.Balade;
  if (B.ready) return;

  let engine = null;
  let unsubscribe = null;

  function release() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }

  /** @returns {Promise<"running"|"stopped"|"excluded">} */
  B.toggle = async () => {
    if (engine && engine.running && !engine.stopping) {
      engine.stop(); // sortie en douceur
      return "stopped";
    }
    if (engine) engine.destroy(); // une demande pendant la sortie relance une balade neuve

    const settings = await B.Settings.load();
    if (B.Settings.isExcluded(settings, location.hostname)) return "excluded";
    const config = structuredClone(B.Config);
    B.Settings.applyToConfig(settings, config);

    engine = new B.Engine(config);
    const mine = engine;
    engine.onDestroy = () => {
      if (B.engine === mine) {
        B.engine = null;
        release();
      }
    };
    B.engine = engine; // accessible depuis la console pour expérimenter
    release();
    unsubscribe = B.Settings.subscribe((s) => {
      if (B.engine !== mine || !mine.running) return;
      // Le site vient d'être exclu : tout le monde s'en va.
      if (B.Settings.isExcluded(s, location.hostname)) mine.stop();
      else mine.applySettings(s);
    });
    engine.start();
    return "running";
  };

  /** Démarre la balade si besoin. Renvoie false si le site est exclu. */
  async function ensureRunning() {
    if (engine && engine.running && !engine.stopping) return true;
    return (await B.toggle()) === "running";
  }

  B.startGame = async () => ((await ensureRunning()) ? (B.engine.startGame(), "game") : "excluded");
  B.stopGame = () => {
    if (B.engine) B.engine.endGame();
    return "stopped";
  };
  B.startFocus = async (minutes) => ((await ensureRunning()) ? (B.engine.startFocus(minutes), "focus") : "excluded");
  B.stopFocus = () => {
    if (B.engine) B.engine.stopFocus();
    return "stopped";
  };

  B.ready = true;
})();
