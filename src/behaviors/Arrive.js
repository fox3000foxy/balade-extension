// Enter: the cursor arrives from an edge of the screen, with a little "hello".
(() => {
  const { Behavior } = window.Balade;

  class Arrive extends Behavior {
    constructor(engine, paceMul = 1) {
      super(engine);
      this.paceMul = paceMul;
    }

    *run(cursor) {
      const w = this.config.wander;
      const saved = cursor.temperament.pace;
      cursor.temperament.pace *= this.paceMul;
      try {
        const target = this.stage.randomPoint(w.marginX, w.marginY);
        if (this.engine.sound) this.engine.sound.hello(cursor);
        // First-visit tour: the first cursor on an unknown site becomes a guide.
        if (!this.engine._guideDone && this.engine.habits.isNew && this.engine.habits.isNew()) {
          this.engine._guideDone = true;
          yield* this.motion.moveTo(cursor, target, { speed: 0.8, precise: false, width: 120 });
          const Guide = window.Balade.Guide;
          if (Guide) yield* new Guide(this.engine).run(cursor);
          return;
        }
        yield* this.motion.moveTo(cursor, target, { speed: 0.8, precise: false, width: 120 });
      } finally {
        cursor.temperament.pace = saved;
      }
    }
  }

  window.Balade.Arrive = Arrive;
})();
