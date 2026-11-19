// Enter: the cursor arrives from an edge of the screen, with a little "hello".
(() => {
  const { Behavior } = window.Balade;

  class Arrive extends Behavior {
    *run(cursor) {
      const w = this.config.wander;
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
    }
  }

  window.Balade.Arrive = Arrive;
})();
