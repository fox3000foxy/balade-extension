// Entrée en scène : le curseur arrive d'un bord de l'écran, avec un petit « coucou ».
(() => {
  const { Behavior } = window.Balade;

  class Arrive extends Behavior {
    *run(cursor) {
      const w = this.config.wander;
      const target = this.stage.randomPoint(w.marginX, w.marginY);
      if (this.engine.sound) this.engine.sound.hello(cursor);
      yield* this.motion.moveTo(cursor, target, { speed: 0.8, precise: false, width: 120 });
    }
  }

  window.Balade.Arrive = Arrive;
})();
