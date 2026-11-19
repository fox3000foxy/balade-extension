// Service worker: the Alt+B shortcut starts or puts away the cursors in the active tab.
// (Clicking the icon opens the menu, which has its own button.)
importScripts("lib/inject.js");

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "toggle-balade") return;
  const target = tab && tab.id != null ? tab : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!target || target.id == null) return;
  try {
    await self.BaladeInject.toggle(target.id);
  } catch (err) {
    // Protected pages (chrome://, Chrome Web Store...): nothing to do.
    console.warn("[Balade] Impossible sur cette page :", err.message);
  }
});

// Cross-page persistence: the page notifies us when Balade starts/stops
// (sender.tab.id tells us which tab). On navigation completion we re-inject
// if it was running. The page itself saves cursor snapshots to
// chrome.storage.session; Engine.start() reads them and places cursors at
// their last relative positions. This works cross-site because the flag is
// set while the old page is still alive — unlike scripting it after
// onCommitted, when the old document is already gone.
const navKey = (tabId) => `balade.nav.${tabId}`;

async function setNavFlag(tabId, running) {
  try {
    if (running) await chrome.storage.session.set({ [navKey(tabId)]: true });
    else await chrome.storage.session.remove(navKey(tabId));
  } catch (_) {}
}

// Drop stale flags when a tab closes so we never re-inject into a recycled ID.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(navKey(tabId)).catch(() => {});
});

chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId }) => {
  if (frameId !== 0) return;
  const key = navKey(tabId);
  let flagged = false;
  try {
    flagged = !!(await chrome.storage.session.get(key))[key];
  } catch (_) { return; }
  if (!flagged) return;
  await chrome.storage.session.remove(key).catch(() => {});
  try {
    const st = await self.BaladeInject.status(tabId);
    if (st.state === "running") {
      // Auto-start script already running (or user restarted manually):
      // re-arm the flag so the *next* navigation persists too.
      await chrome.storage.session.set({ [key]: true });
      return;
    }
    await self.BaladeInject.toggle(tabId);
  } catch (_) {}
});

// Auto-start: keep the registration in sync with settings and granted permissions.
const syncAuto = () => self.BaladeInject.syncAutoStart().catch((err) => console.warn("[Balade]", err.message));
chrome.runtime.onInstalled.addListener(syncAuto);
chrome.runtime.onStartup.addListener(syncAuto);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes["balade.settings"]) syncAuto();
});
chrome.permissions.onAdded.addListener(syncAuto);
chrome.permissions.onRemoved.addListener(syncAuto);

// ---------- Tab video recording ----------
// The menu gets the stream ID (chrome.tabCapture, at the moment of your click),
// then the service worker hands the recording off to an offscreen document.

const REC_KEY = "balade.rec";

async function ensureOffscreen() {
  if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
  await chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: chrome.i18n.getMessage("rec_justification")
  });
}

async function setRecording(state) {
  if (state) await chrome.storage.session.set({ [REC_KEY]: state });
  else await chrome.storage.session.remove(REC_KEY);
  await chrome.action.setBadgeText({ text: state ? "REC" : "" });
  if (state) await chrome.action.setBadgeBackgroundColor({ color: "#E5484D" });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.target === "offscreen") return;
  if (msg.type === "balade-state" && sender.tab && sender.tab.id != null) {
    setNavFlag(sender.tab.id, !!msg.running);
    return; // no reply needed
  }
  (async () => {
    if (msg.type === "rec-start") {
      await ensureOffscreen();
      await setRecording({ tabId: msg.tabId, host: msg.host || "page", startedAt: Date.now() });
      chrome.runtime.sendMessage({ target: "offscreen", type: "start", streamId: msg.streamId });
      reply({ ok: true });
    } else if (msg.type === "rec-stop") {
      chrome.runtime.sendMessage({ target: "offscreen", type: "stop" });
      reply({ ok: true });
    } else if (msg.type === "rec-done") {
      const { [REC_KEY]: rec } = await chrome.storage.session.get(REC_KEY);
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
      const host = ((rec && rec.host) || "page").replace(/[^a-z0-9.-]/gi, "_");
      await chrome.downloads.download({ url: msg.url, filename: `balade-${host}-${stamp}.webm` });
      await setRecording(null);
      // Give the download time to read the video before freeing the memory.
      setTimeout(() => chrome.runtime.sendMessage({ target: "offscreen", type: "cleanup" }), 30000);
    } else if (msg.type === "rec-error") {
      console.warn("[Balade] Enregistrement impossible :", msg.message);
      await setRecording(null);
    }
  })().catch((err) => console.warn("[Balade]", err.message));
  return true; // async reply
});
