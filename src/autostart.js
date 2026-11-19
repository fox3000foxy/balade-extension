// Lancement automatique : injecté par le service worker sur les sites choisis dans le menu
// (« Lancer automatiquement ici »). Ne fait rien si le site est exclu ou si la balade tourne déjà.
(() => {
  const B = window.Balade;
  if (!B || !B.Settings || !B.toggle) return;
  B.Settings.load().then((s) => {
    const host = location.hostname.toLowerCase();
    if (!s.autoSites.includes(host) || B.Settings.isExcluded(s, host)) return;
    if (B.engine && B.engine.running) return;
    B.toggle();
  });
})();
