// Entry point: one engine at a time, started or stopped by the icon, menu or Alt+B.
// Settings are read on start, then tracked live (a change in the menu
// applies immediately, without restarting the cursors).
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
      engine.stop(); // graceful exit
      return "stopped";
    }
    if (engine) engine.destroy(); // a request during exit starts fresh

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
    B.engine = engine; // accessible from the console for experimentation
    release();
    unsubscribe = B.Settings.subscribe((s) => {
      if (B.engine !== mine || !mine.running) return;
      // The site was just excluded: everyone leaves.
      if (B.Settings.isExcluded(s, location.hostname)) mine.stop();
      else mine.applySettings(s);
    });
    engine.start();
    return "running";
  };

  /** Starts the cursors if needed. Returns false if the site is excluded. */
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
