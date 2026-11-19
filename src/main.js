// Point d'entrée : un seul moteur à la fois, que l'icône de l'extension allume ou éteint.
(() => {
  const B = window.Balade;
  if (B.ready) return;

  let engine = null;

  B.toggle = () => {
    if (engine && engine.running && !engine.stopping) {
      engine.stop(); // sortie en douceur
      return;
    }
    if (engine) engine.destroy(); // un second clic pendant la sortie coupe net
    engine = new B.Engine(B.Config);
    engine.onDestroy = () => {
      if (B.engine === engine) B.engine = null;
    };
    B.engine = engine; // accessible depuis la console pour expérimenter
    engine.start();
  };

  B.ready = true;
})();
