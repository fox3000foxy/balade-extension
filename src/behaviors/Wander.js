// La flânerie : le curseur alterne trois humeurs, séparées par des pauses.
//  - se promener : aller vers un point au hasard, tout près ou à l'autre bout de l'écran ;
//  - gigoter     : quelques petits mouvements sur place, comme quelqu'un qui réfléchit ;
//  - inspecter   : aller sur un élément de la page (les champs de saisie en priorité),
//                  le survoler, parfois cliquer, et dans un champ vide, écrire un mot
//                  fantôme puis l'effacer. Rien n'est réellement cliqué ni écrit.
// Le pointeur change de forme en entrant sur un élément, comme le vrai :
// main sur les liens et boutons, barre en I sur les champs, viseur sur les images.
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
        yield* this.pause(cursor);
      }
    }

    /** Une pause ; de temps en temps, le curseur « réfléchit » (pointeur d'attente). */
    *pause(cursor) {
      const w = this.config.wander;
      const d = M.rand(w.pause[0], w.pause[1]) * cursor.temperament.patience * (w.pauseMul || 1);
      if (M.chance(w.waitChance)) {
        cursor.shape = "wait";
        yield* this.motion.wait(d + M.rand(0.6, 1.4));
        cursor.shape = "arrow";
      } else {
        yield* this.motion.wait(d);
      }
    }

    // ---------- Humeurs ----------

    *stroll(cursor) {
      const w = this.config.wander;
      const target = M.chance(w.longStroll)
        ? this.stage.randomPoint(w.marginX, w.marginY)
        : this.stage.nearbyPoint(cursor, w.nearRadius, w.marginX, w.marginY);
      // Une promenade n'a pas de cible précise : pas de geste de correction.
      yield* this.motion.moveTo(cursor, target, { speed: w.strollSpeed, precise: false, width: 120 });
    }

    *fidget(cursor) {
      const n = Math.floor(M.rand(2, 5));
      for (let i = 0; i < n; i++) {
        const a = M.rand(0, Math.PI * 2);
        const d = M.rand(8, 30);
        const target = this.stage.clampToScreen({
          x: cursor.x + Math.cos(a) * d,
          y: cursor.y + Math.sin(a) * d
        });
        yield* this.motion.moveTo(cursor, target, { speed: 0.9, precise: false, calm: 0.5 });
        yield* this.motion.wait(M.rand(0.05, 0.2));
      }
    }

    *inspect(cursor) {
      const busy = new Set(this.engine.cursors.map((c) => c.focus).filter(Boolean));
      const el = this.stage.pickElement(cursor, this.engine.time, this._last, busy);
      if (!el) {
        yield* this.stroll(cursor);
        return;
      }
      this._last = el;

      // Cible-fonction : si la page défile, le curseur suit l'élément.
      const aim = this.stage.aimOn(el, cursor);
      const r = el.getBoundingClientRect();
      const hoverShape = this.stage.shapeFor(el);
      yield* this.motion.moveTo(cursor, aim, {
        speed: 0.75,
        width: Math.min(r.width, r.height),
        // Le pointeur change de forme dès qu'il passe au-dessus de l'élément.
        onStep: () => {
          cursor.shape = this.stage.contains(el, cursor) ? hoverShape : "arrow";
        }
      });
      if (!this.stage.isInView(el, cursor)) return;
      cursor.shape = hoverShape;

      if (this.stage.isTextField(el)) {
        yield* this.visitField(cursor, el, aim);
      } else {
        yield* this.visitElement(cursor, el, aim);
      }

      cursor.focus = null;
      yield* this.stepAside(cursor, el, hoverShape);
    }

    // ---------- Détails des visites ----------

    /** Survol + clic éventuel sur un lien, un bouton, un titre, une image… */
    *visitElement(cursor, el, aim) {
      const w = this.config.wander;
      cursor.focus = el;
      yield* this.hover(cursor, aim, M.rand(...w.hover));

      const r = Math.random();
      if (r < w.doubleClickChance) {
        yield* this.motion.doubleClick(cursor);
      } else if (r < w.doubleClickChance + w.clickChance) {
        yield* this.motion.click(cursor);
      }
      yield* this.motion.wait(M.rand(0.15, 0.3));
    }

    /** Un champ de texte : clic, et parfois un mot fantôme. */
    *visitField(cursor, el, aim) {
      const w = this.config.wander;
      cursor.focus = el;
      yield* this.hover(cursor, aim, M.rand(0.15, 0.4));
      yield* this.motion.click(cursor);

      // On n'écrit que dans un champ vide, que l'utilisateur n'est pas en train d'utiliser.
      const empty = el.isContentEditable ? !el.textContent.trim() : !el.value;
      const busy = document.activeElement === el;
      if (!empty || busy || !M.chance(w.ghostTypeChance)) {
        yield* this.hover(cursor, aim, M.rand(0.3, 0.7));
        return;
      }

      // Le pointeur s'écarte un peu pour ne pas masquer ce qu'il « écrit ».
      const off = { x: M.rand(-20, 10), y: M.rand(12, 24) };
      const aside = () => {
        const p = aim();
        return { x: p.x + off.x, y: p.y + off.y };
      };
      yield* this.motion.moveTo(cursor, aside, { speed: 1.4, precise: false, calm: 0.4 });

      cursor.ghost = { el, text: "" };
      const ok = yield* this.typeGhost(cursor, el, M.pick(w.ghostWords), aside);

      if (ok) {
        yield* this.hover(cursor, aside, M.rand(0.5, 1.1)); // on admire
        if (M.chance(0.6)) {
          yield* this.eraseGhost(cursor, el, aside); // touche par touche
        } else {
          // Tout sélectionner et supprimer d'un coup.
          yield* this.hover(cursor, aside, M.rand(0.15, 0.3));
          if (this.engine.sound) this.engine.sound.erase(cursor);
        }
      }
      cursor.ghost = null;
      yield* this.hover(cursor, aside, M.rand(0.2, 0.4));
    }

    /**
     * Frappe irrégulière, caractère par caractère, en restant à côté du champ.
     * @returns {boolean} false si le champ a quitté la vue en route.
     */
    *typeGhost(cursor, el, word, anchor) {
      const sound = this.engine.sound;
      for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        let d = M.rand(0.07, 0.15);
        if (ch === " ") d += M.rand(0.05, 0.12);
        if (M.chance(0.05)) d += M.rand(0.2, 0.4); // hésitation
        yield* this.hover(cursor, anchor, d);
        if (!this.stage.isInView(el, cursor)) return false;
        cursor.ghost.text += ch;
        if (sound) sound.key(cursor, i);
      }
      return true;
    }

    *eraseGhost(cursor, el, anchor) {
      const sound = this.engine.sound;
      while (cursor.ghost.text.length > 0) {
        yield* this.hover(cursor, anchor, M.rand(0.04, 0.075));
        if (!this.stage.isInView(el, cursor)) return;
        cursor.ghost.text = cursor.ghost.text.slice(0, -1);
        if (sound) sound.backspace(cursor);
      }
    }

    /** Reste accroché à un point (souvent sur un élément) pendant `seconds`. */
    *hover(cursor, anchor, seconds) {
      let t = seconds;
      while (t > 0) {
        t -= yield;
        const p = anchor();
        cursor.x = p.x;
        cursor.y = p.y;
      }
    }

    /** Se pousser un peu, pour laisser voir ce qu'on vient de regarder. */
    *stepAside(cursor, el, hoverShape) {
      const target = this.stage.clampToScreen({
        x: cursor.x + M.rand(14, 30) * M.sign(),
        y: cursor.y + M.rand(10, 24)
      });
      yield* this.motion.moveTo(cursor, target, {
        speed: 1.2,
        precise: false,
        calm: 0.5,
        onStep: () => {
          cursor.shape = el.isConnected && this.stage.contains(el, cursor) ? hoverShape : "arrow";
        }
      });
      cursor.shape = "arrow";
    }
  }

  window.Balade.Wander = Wander;
})();
