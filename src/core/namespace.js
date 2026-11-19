// Espace de noms unique : tous les fichiers y déclarent leurs classes.
// Pas de bundler : les fichiers sont injectés dans l'ordre et partagent `window`.
(() => {
  if (window.Balade) return;
  window.Balade = { version: "0.1.0", ready: false };
})();
