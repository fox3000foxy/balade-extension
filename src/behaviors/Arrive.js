// Entrée en scène : le curseur arrive d'un bord de l'écran.
(() => {
  const { Behavior } = window.Balade;

  class Arrive extends Behavior {
    *run(cursor) {
      const w = this.config.wander;
      const target = this.stage.randomPoint(w.marginX, w.marginY);
      yield* this.motion.moveTo(cursor, target, { speed: 0.8 });
    }
  }

  window.Balade.Arrive = Arrive;
})();
