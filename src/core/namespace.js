// Shared namespace: all files declare their classes here.
// No bundler: files are injected in order and share `window`.
(() => {
  if (window.Balade) return;
  window.Balade = { version: "1.0.0", ready: false };
})();
