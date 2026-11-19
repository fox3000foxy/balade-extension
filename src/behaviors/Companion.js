// Companion: during focus mode, one cursor stays and "works" beside you.
// It settles in a corner, fidgets, pauses, and rejoices at break time.
// Visual only: no clicks, no typing into the page.
(() => {
  const { Behavior, M } = window.Balade;

  class Companion extends Behavior {
    *run(cursor) {
      const engine = this.engine;
      const w = this.config.wander;
      const corner = () => ({
        x: this.stage.width * M.rand(0.78, 0.9),
        y: this.stage.height * M.rand(0.75, 0.88)
      });
      yield* this.motion.moveTo(cursor, corner(), { speed: 0.7, precise: false, width: 120 });
      for (;;) {
        // Break time: everyone comes back, the companion cheers.
        if (!engine.focus || engine.focus.phase !== "focus") {
          if (engine.sound) engine.sound.cheer();
          return;
        }
        // Work: small moves, thinking pauses.
        for (let i = 0, n = Math.floor(M.rand(2, 4)); i < n; i++) {
          const target = this.stage.clampToScreen({
            x: cursor.x + M.rand(-36, 36),
            y: cursor.y + M.rand(-28, 28)
          });
          yield* this.motion.moveTo(cursor, target, { speed: 0.7, precise: false, calm: 0.6 });
          yield* this.motion.wait(M.rand(0.2, 0.6));
        }
        const d = M.rand(w.pause[0], w.pause[1]) * cursor.temperament.patience;
        if (M.chance(w.waitChance)) {
          cursor.shape = "wait";
          yield* this.motion.wait(d + M.rand(0.6, 1.4));
          cursor.shape = "arrow";
        } else {
          yield* this.motion.wait(d);
        }
      }
    }
  }

  window.Balade.Companion = Companion;
})();
