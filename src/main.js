// Entry point: one engine at a time, started or stopped by the icon, menu or Alt+B.
// Settings are read on start, then tracked live (a change in the menu
// applies immediately, without restarting the cursors).
//
// Cross-page persistence: on beforeunload, cursor state (name, colorIndex, relative
// position) is saved to chrome.storage.session. On the next start, that snapshot is
// restored so cursors re-appear roughly where they were on the previous page.
(() => {
  const B = window.Balade;
  if (B.ready) return;

  let engine = null;
  let unsubscribe = null;

  const SESSION_KEY = "balade.crosspage";
  const SNAPSHOT_TTL = 30000; // ms — ignore stale snapshots, but allow slow cross-site loads

  function release() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }

  // Tell the service worker whether Balade is running in this tab, so it can
  // re-inject after a navigation (even cross-site, where the old page is gone
  // before webNavigation fires). Fire-and-forget: the SW may be asleep.
  function notifyRunning(running) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: "balade-state", running }).catch(() => {});
      }
    } catch (_) {}
  }

  // Save cursor state so the next page can restore it. Called periodically and
  // on page hide/unload — beforeunload alone is unreliable because the async
  // storage write may not flush, and it never fires in some cases (bfcache...).
  function saveSnapshot() {
    if (!engine || !engine.running || !engine.cursors.length) return;
    const W = window.innerWidth || 1, H = window.innerHeight || 1;
    const snapshot = {
      ts: Date.now(),
      cursors: engine.cursors
        .filter((c) => !c.leaving)
        .map((c) => ({
          name: c.name,
          colorIndex: c.colorIndex,
          rx: Math.min(1, Math.max(0, c.screenX / W)),  // relative 0-1
          ry: Math.min(1, Math.max(0, c.screenY / H))
        }))
    };
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.session) {
        chrome.storage.session.set({ [SESSION_KEY]: snapshot }).catch(() => {});
      }
    } catch (_) {}
  }

  let snapshotTimer = 0;
  window.addEventListener("beforeunload", saveSnapshot);
  // visibilitychange fires reliably on navigation, unlike beforeunload's flush.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveSnapshot();
  });

  async function loadSnapshot() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.session) return null;
      const result = await chrome.storage.session.get(SESSION_KEY);
      const snap = result[SESSION_KEY];
      if (!snap || !snap.cursors || !snap.cursors.length) return null;
      if (Date.now() - snap.ts > SNAPSHOT_TTL) return null;
      // Clear so we don't restore twice on a refresh.
      chrome.storage.session.remove(SESSION_KEY);
      return snap;
    } catch (_) { return null; }
  }

  /** @returns {Promise<"running"|"stopped"|"excluded">} */
  B.toggle = async () => {
    if (engine && engine.running && !engine.stopping) {
      saveSnapshot(); // keep a fresh snapshot in case the tab navigates mid-exit
      engine.stop(); // graceful exit
      return "stopped";
    }
    if (engine) engine.destroy(); // a request during exit starts fresh

    const settings = await B.Settings.load();
    if (B.Settings.isExcluded(settings, location.hostname)) return "excluded";
    const config = structuredClone(B.Config);
    B.Settings.applyToConfig(settings, config);

    // Restore cross-page snapshot if available.
    const snapshot = await loadSnapshot();

    engine = new B.Engine(config);
    const mine = engine;
    engine.onDestroy = () => {
      if (B.engine === mine) {
        B.engine = null;
        release();
        notifyRunning(false);
        if (snapshotTimer) { clearInterval(snapshotTimer); snapshotTimer = 0; }
      }
    };
    B.engine = engine;
    release();
    unsubscribe = B.Settings.subscribe((s) => {
      if (B.engine !== mine || !mine.running) return;
      if (B.Settings.isExcluded(s, location.hostname)) mine.stop();
      else mine.applySettings(s);
    });
    engine.start(snapshot);
    notifyRunning(true);
    // Periodic snapshot so a navigation always finds a fresh one, even if
    // beforeunload/visibilitychange didn't flush (cross-site, crash...).
    if (snapshotTimer) clearInterval(snapshotTimer);
    snapshotTimer = setInterval(saveSnapshot, 2000);
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
