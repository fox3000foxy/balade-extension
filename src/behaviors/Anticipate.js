// Anticipate: a cursor heads toward the element you will probably click
// (guessed from your gesture or habits), hovers around it, and waits to see if it was right.
(() => {
  const { Behavior, M } = window.Balade;

  class Anticipate extends Behavior {
    /**
     * @param {Balade.Engine} engine
     * @param {Element} el élément deviné
     * @param {"gesture"|"habit"} reason
     */
    constructor(engine, el, reason) {
      super(engine);
      this.el = el;
      this.reason = reason;
    }

    *run(cursor) {
      const engine = this.engine;
      const el = this.el;
      const bubbles = this.config.bubbles;
      const social = this.config.social.enabled;
      const since = engine.time;
      const aim = this.stage.aimOn(el, cursor);
      const shape = this.stage.shapeFor(el);
      cursor.predicting = el;

      try {
        // Must arrive fast: no correction gesture.
        yield* this.motion.moveTo(cursor, aim, {
          speed: this.reason === "gesture" ? 2.4 : 1.2,
          precise: false,
          onStep: () => {
            cursor.shape = this.stage.contains(el, cursor) ? shape : "arrow";
          }
        });
        if (!this.stage.isInView(el, cursor)) return;
        cursor.shape = shape;
        cursor.focus = el;
        if (social && this.reason === "habit" && M.chance(0.5)) cursor.say(M.pick(bubbles.predict), engine.time);

        // Wait for your move.
        const wait = this.reason === "gesture" ? 1.6 : 4.5;
        let verdict = null;
        while (engine.time - since < wait + 1) {
          const dt = yield;
          const p = aim();
          cursor.x = M.damp(cursor.x, p.x, 12, dt);
          cursor.y = M.damp(cursor.y, p.y, 12, dt);
          verdict = engine.judgePrediction(el, since);
          if (verdict) break;
          if (engine.time - since > wait) break;
        }

        if (verdict === "right") {
          engine.predictionHits++;
          cursor.wiggle(engine.time);
          cursor.setMood("proud", engine.time, 10); // nailed it: shows for a while
          if (engine.sound) engine.sound.greet(cursor);
          if (social && M.chance(0.45)) cursor.say(M.pick(bubbles.right), engine.time);
        } else if (verdict === "wrong" && social && M.chance(0.2)) {
          cursor.setMood("grumpy", engine.time, 8);
          cursor.say(M.pick(bubbles.wrong), engine.time, 1.2);
        }
        yield* this.motion.wait(M.rand(0.2, 0.5));
        cursor.focus = null;
        cursor.shape = "arrow";
        // Step aside.
        const away = this.stage.clampToScreen({ x: cursor.x + M.rand(30, 60) * M.sign(), y: cursor.y + M.rand(20, 40) });
        yield* this.motion.moveTo(cursor, away, { speed: 1.2, precise: false, calm: 0.5 });
      } finally {
        cursor.predicting = null;
      }
    }
  }

  window.Balade.Anticipate = Anticipate;
})();
