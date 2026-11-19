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
