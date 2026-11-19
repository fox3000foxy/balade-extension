// Auto-start: injected by the service worker on sites chosen in the menu
// ("Start automatically here"). Does nothing if the site is excluded or cursors are already running.
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
