// Service worker : le raccourci Alt+B lance ou range la balade dans l'onglet actif.
// (Un clic sur l'icône ouvre le menu, qui a son propre bouton.)
importScripts("lib/inject.js");

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "toggle-balade") return;
  const target = tab && tab.id != null ? tab : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!target || target.id == null) return;
  try {
    await self.BaladeInject.toggle(target.id);
  } catch (err) {
    // Pages protégées (chrome://, Chrome Web Store…) : rien à faire.
    console.warn("[Balade] Impossible sur cette page :", err.message);
  }
});

// Lancement automatique : on garde l'enregistrement à jour avec les réglages et les accès accordés.
const syncAuto = () => self.BaladeInject.syncAutoStart().catch((err) => console.warn("[Balade]", err.message));
chrome.runtime.onInstalled.addListener(syncAuto);
chrome.runtime.onStartup.addListener(syncAuto);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes["balade.settings"]) syncAuto();
});
chrome.permissions.onAdded.addListener(syncAuto);
chrome.permissions.onRemoved.addListener(syncAuto);

// ---------- Enregistrement vidéo de l'onglet ----------
// Le menu obtient l'identifiant du flux (chrome.tabCapture, au moment de votre clic),
// puis le service worker confie l'enregistrement à un document hors écran.

const REC_KEY = "balade.rec";

async function ensureOffscreen() {
  if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
  await chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Enregistrer l'onglet en vidéo, à votre demande."
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
      // On laisse le temps au téléchargement de lire la vidéo avant de libérer la mémoire.
      setTimeout(() => chrome.runtime.sendMessage({ target: "offscreen", type: "cleanup" }), 30000);
    } else if (msg.type === "rec-error") {
      console.warn("[Balade] Enregistrement impossible :", msg.message);
      await setRecording(null);
    }
  })().catch((err) => console.warn("[Balade]", err.message));
  return true; // réponse asynchrone
});
