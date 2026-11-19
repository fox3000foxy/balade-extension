// Classe de base des comportements. Un comportement est un script écrit comme
// un générateur : `run(cursor)` décrit ce que fait le curseur, du début à la fin.
// C'est ici qu'on ajoutera plus tard les comportements de « prédiction de tâche ».
(() => {
  class Behavior {
    /** @param {Balade.Engine} engine */
    constructor(engine) {
      this.engine = engine;
      this.motion = engine.motion;
      this.stage = engine.stage;
      this.config = engine.config;
    }

    /** Nom lisible, utile pour déboguer. */
    get name() {
      return this.constructor.name;
    }

    /**
     * Le script du comportement. À redéfinir.
     * @param {Balade.Cursor} cursor
     */
    *run(cursor) { // eslint-disable-line require-yield
    }
  }

  window.Balade.Behavior = Behavior;
})();
