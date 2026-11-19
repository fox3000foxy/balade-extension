// La flânerie : le curseur alterne trois humeurs, séparées par des pauses.
//  - se promener : aller lentement vers un point au hasard ;
//  - gigoter     : quelques petits mouvements sur place, comme quelqu'un qui réfléchit ;
//  - inspecter   : aller sur un élément de la page, le survoler, parfois cliquer dessus
//                  (clic simulé, rien n'est réellement cliqué).
(() => {
  const { Behavior, M } = window.Balade;

  class Wander extends Behavior {
    *run(cursor) {
      const w = this.config.wander;
      for (;;) {
        const r = Math.random();
        const inspectP = w.inspect + cursor.temperament.curiosity;
        if (r < inspectP) {
          yield* this.inspect(cursor);
        } else if (r < inspectP + w.fidget) {
          yield* this.fidget(cursor);
        } else {
          yield* this.stroll(cursor);
        }
        yield* this.motion.wait(M.rand(w.pause[0], w.pause[1]) * cursor.temperament.patience);
      }
    }

    *stroll(cursor) {
      const w = this.config.wander;
      const target = this.stage.randomPoint(w.marginX, w.marginY);
      yield* this.motion.moveTo(cursor, target, { speed: w.strollSpeed });
    }

    *fidget(cursor) {
      const n = Math.floor(M.rand(2, 5));
      for (let i = 0; i < n; i++) {
        const a = M.rand(0, Math.PI * 2);
        const d = M.rand(8, 30);
        const target = {
          x: M.clamp(cursor.x + Math.cos(a) * d, 10, this.stage.width - 10),
          y: M.clamp(cursor.y + Math.sin(a) * d, 10, this.stage.height - 10)
        };
        yield* this.motion.moveTo(cursor, target, { speed: 0.9 });
        yield* this.motion.wait(M.rand(0.05, 0.2));
      }
    }

    *inspect(cursor) {
      const w = this.config.wander;
      const el = this.stage.pickElement(cursor, this.engine.time);
      if (!el) {
        yield* this.stroll(cursor);
        return;
      }

      // Cible-fonction : si la page défile, le curseur suit l'élément.
      const aim = this.stage.aimOn(el);
      yield* this.motion.moveTo(cursor, aim, { speed: 0.6 });
      if (!this.stage.isOnScreen(el)) return;

      cursor.focus = el;
      let hover = M.rand(w.hover[0], w.hover[1]);
      // Pendant le survol, le curseur reste accroché à l'élément.
      while (hover > 0) {
        hover -= yield;
        const p = aim();
        cursor.x = p.x;
        cursor.y = p.y;
      }

      const r = Math.random();
      if (r < w.doubleClickChance) {
        yield* this.motion.doubleClick(cursor);
      } else if (r < w.doubleClickChance + w.clickChance) {
        yield* this.motion.click(cursor);
      }
      yield* this.motion.wait(M.rand(0.15, 0.3));
      cursor.focus = null;

      // Se pousser un peu, pour laisser voir ce qu'on vient de regarder.
      yield* this.motion.moveTo(
        cursor,
        { x: cursor.x + M.rand(14, 30) * M.sign(), y: cursor.y + M.rand(10, 24) },
        { speed: 1.2 }
      );
    }
  }

  window.Balade.Wander = Wander;
})();
